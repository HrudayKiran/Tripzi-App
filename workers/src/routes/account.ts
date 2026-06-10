import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';
import { deleteR2Prefix } from '../lib/r2';

const account = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

/**
 * GET /account/check-username/:username
 */
account.get('/check-username/:username', async (c) => {
  const username = c.req.param('username');
  const supabase = getSupabaseAdmin(c.env);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  
  if (error) {
    return c.json({ error: 'Database error' }, 500);
  }
  
  return c.json({ available: !data });
});

/**
 * POST /account/delete
 * Body: { reason: string }
 */
account.post('/delete', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ reason?: string }>();
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!reason) {
    return c.json({ error: 'A deletion reason is required.' }, 400);
  }

  const supabase = getSupabaseAdmin(c.env);

  // 1. Fetch user profile before deletion
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  // 2. Store in deleted_users
  await supabase.from('deleted_users').insert({
    user_id: userId,
    email: profile?.email || null,
    name: profile?.name || null,
    username: profile?.username || null,
    gender: profile?.gender || null,
    reason,
    profile_snapshot: profile || {},
  });

  // 3. Delete owned itineraries
  await supabase.from('itineraries').delete().eq('user_id', userId);

  // 5. Delete suggestions, bugs, feature requests
  await supabase.from('suggestions').delete().eq('user_id', userId);
  await supabase.from('bugs').delete().eq('user_id', userId);
  await supabase.from('feature_requests').delete().eq('user_id', userId);

  // Remove user from direct_chats participants array
  try {
    const { data: directChats } = await supabase
      .from('direct_chats')
      .select('id, participants')
      .contains('participants', [userId]);

    for (const chat of directChats || []) {
      const updatedParticipants = (chat.participants || []).filter((p: string) => p !== userId);
      await supabase
        .from('direct_chats')
        .update({ participants: updatedParticipants })
        .eq('id', chat.id);
    }
  } catch (e) {
    console.error('Error cleaning direct_chats participants:', e);
  }

  // Remove user from group_chats participants array
  try {
    const { data: groupChats } = await supabase
      .from('group_chats')
      .select('id, participants')
      .contains('participants', [userId]);

    for (const chat of groupChats || []) {
      const updatedParticipants = (chat.participants || []).filter((p: string) => p !== userId);
      await supabase
        .from('group_chats')
        .update({ participants: updatedParticipants })
        .eq('id', chat.id);
    }
  } catch (e) {
    console.error('Error cleaning group_chats participants:', e);
  }

  // Remove user from itineraries participants array
  try {
    const { data: sharedItineraries } = await supabase
      .from('itineraries')
      .select('id, participants')
      .contains('participants', [userId]);

    for (const itinerary of sharedItineraries || []) {
      const updatedParticipants = (itinerary.participants || []).filter((p: string) => p !== userId);
      await supabase
        .from('itineraries')
        .update({ participants: updatedParticipants })
        .eq('id', itinerary.id);
    }
  } catch (e) {
    console.error('Error cleaning itineraries participants:', e);
  }

  // 6. Delete notifications and push tokens
  await supabase.from('notifications').delete().eq('recipient_id', userId);
  await supabase.from('push_tokens').delete().eq('user_id', userId);

  // 7. Delete messages authored by user
  await supabase.from('messages').delete().eq('sender_id', userId);

  // 8. Delete live shares
  await supabase.from('live_shares').delete().eq('user_id', userId);

  // 9. Clean up R2 storage
  try {
    await deleteR2Prefix(c.env, `profiles/${userId}/`);
    await deleteR2Prefix(c.env, `direct_chats/${userId}/`);
    await deleteR2Prefix(c.env, `group_chats/${userId}/`);
    await deleteR2Prefix(c.env, `itineraries/${userId}/`);
    await deleteR2Prefix(c.env, `trips/${userId}/`);
  } catch (e) {
    console.error('R2 cleanup error:', e);
  }

  // 10. Delete profile (triggers public_profiles cleanup via trigger)
  await supabase.from('profiles').delete().eq('id', userId);

  // 11. Clean up D1 AI chat history
  try {
    const { results: conversations } = await c.env.DB.prepare(
      `SELECT id FROM ai_conversations WHERE user_id = ?`
    ).bind(userId).all();

    for (const conv of conversations || []) {
      await c.env.DB.prepare(`DELETE FROM ai_messages WHERE conversation_id = ?`).bind(conv.id).run();
    }
    await c.env.DB.prepare(`DELETE FROM ai_conversations WHERE user_id = ?`).bind(userId).run();
  } catch (e) {
    console.error('D1 AI cleanup error:', e);
  }

  // 12. Delete Supabase Auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    console.error('Error deleting auth user:', authError);
  }

  return c.json({ success: true });
});

/**
 * POST /account/push-token
 * Body: { token: string, deviceInfo?: string }
 * Registers or updates an FCM push token for the current user.
 */
account.post('/push-token', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ token: string; deviceInfo?: string }>();

  if (!body.token || typeof body.token !== 'string') {
    return c.json({ error: 'A valid token is required.' }, 400);
  }

  const supabase = getSupabaseAdmin(c.env);

  // Upsert — if this token already exists for this user, update timestamp.
  // If the token exists for a DIFFERENT user (account switch), reassign it.
  const { error: deleteOldError } = await supabase
    .from('push_tokens')
    .delete()
    .eq('token', body.token)
    .neq('user_id', userId);

  if (deleteOldError) {
    console.error('Error cleaning old token mapping:', deleteOldError);
  }

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      {
        user_id: userId,
        token: body.token,
        device_info: body.deviceInfo || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );

  if (error) {
    console.error('Error saving push token:', error);
    return c.json({ error: 'Failed to save push token.' }, 500);
  }

  return c.json({ success: true });
});

/**
 * DELETE /account/push-token
 * Body: { token: string }
 * Removes an FCM push token on logout.
 */
account.delete('/push-token', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ token: string }>();

  if (!body.token || typeof body.token !== 'string') {
    return c.json({ error: 'A valid token is required.' }, 400);
  }

  const supabase = getSupabaseAdmin(c.env);

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', body.token);

  if (error) {
    console.error('Error deleting push token:', error);
    return c.json({ error: 'Failed to delete push token.' }, 500);
  }

  return c.json({ success: true });
});

export default account;
