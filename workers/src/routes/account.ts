import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';
import { deleteR2Prefix } from '../lib/r2';

const account = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

/**
 * GET /account/check-username/:username
 * Authenticated — used on CompleteProfileScreen and EditProfileScreen.
 * Sanitizes input, normalizes to lowercase, and excludes the caller's own
 * username so editing to the same username returns { available: true }.
 */
account.get('/check-username/:username', async (c) => {
  const callerId = c.get('userId');
  const raw = c.req.param('username');

  // Sanitize and normalize
  const username = raw.trim().toLowerCase();

  if (!USERNAME_REGEX.test(username)) {
    return c.json(
      { error: 'Invalid username format. Use 3-20 chars: lowercase letters, numbers, underscore.' },
      400
    );
  }

  const supabase = getSupabaseAdmin(c.env);

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', callerId)   // exclude caller's own record
    .maybeSingle();

  if (error) {
    console.error('[CheckUsername] Supabase error:', error.message);
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
  const stepErrors: string[] = [];

  // 1. Fetch user profile before deletion
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  // 2. Archive in deleted_users — CRITICAL: abort if this fails to prevent data loss without audit trail
  const { error: archiveError } = await supabase.from('deleted_users').insert({
    user_id: userId,
    email: profile?.email || null,
    name: profile?.name || null,
    username: profile?.username || null,
    gender: profile?.gender || null,
    reason,
    profile_snapshot: profile || {},
  });

  if (archiveError) {
    console.error('[Delete] ABORT: Failed to archive user before deletion:', archiveError.message);
    return c.json({ error: 'Failed to archive user data. Deletion aborted for safety.' }, 500);
  }

  // 3. Delete owned itineraries
  try {
    const { error } = await supabase.from('itineraries').delete().eq('user_id', userId);
    if (error) stepErrors.push(`Step 3 (itineraries): ${error.message}`);
  } catch (e: any) { stepErrors.push(`Step 3 (itineraries): ${e?.message}`); }

  // 4. Delete suggestions, bugs, feature requests
  try {
    await supabase.from('suggestions').delete().eq('user_id', userId);
    await supabase.from('bugs').delete().eq('user_id', userId);
    await supabase.from('feature_requests').delete().eq('user_id', userId);
  } catch (e: any) { stepErrors.push(`Step 4 (feedback): ${e?.message}`); }

  // 5. Remove user from direct_chats participants array
  try {
    const { data: directChats } = await supabase
      .from('direct_chats')
      .select('id, participants')
      .contains('participants', [userId]);

    for (const chat of directChats || []) {
      const updatedParticipants = (chat.participants || []).filter((p: string) => p !== userId);
      await supabase.from('direct_chats').update({ participants: updatedParticipants }).eq('id', chat.id);
    }
  } catch (e: any) { stepErrors.push(`Step 5 (direct_chats): ${e?.message}`); }

  // 6. Remove user from group_chats participants array
  try {
    const { data: groupChats } = await supabase
      .from('group_chats')
      .select('id, participants')
      .contains('participants', [userId]);

    for (const chat of groupChats || []) {
      const updatedParticipants = (chat.participants || []).filter((p: string) => p !== userId);
      await supabase.from('group_chats').update({ participants: updatedParticipants }).eq('id', chat.id);
    }
  } catch (e: any) { stepErrors.push(`Step 6 (group_chats): ${e?.message}`); }

  // 7. Remove user from itineraries participants array
  try {
    const { data: sharedItineraries } = await supabase
      .from('itineraries')
      .select('id, participants')
      .contains('participants', [userId]);

    for (const itinerary of sharedItineraries || []) {
      const updatedParticipants = (itinerary.participants || []).filter((p: string) => p !== userId);
      await supabase.from('itineraries').update({ participants: updatedParticipants }).eq('id', itinerary.id);
    }
  } catch (e: any) { stepErrors.push(`Step 7 (itineraries participants): ${e?.message}`); }

  // 8. Delete notifications and push tokens
  try {
    await supabase.from('notifications').delete().eq('recipient_id', userId);
    await supabase.from('push_tokens').delete().eq('user_id', userId);
  } catch (e: any) { stepErrors.push(`Step 8 (notifications/tokens): ${e?.message}`); }

  // 9. Delete messages authored by user
  try {
    const { error } = await supabase.from('messages').delete().eq('sender_id', userId);
    if (error) stepErrors.push(`Step 9 (messages): ${error.message}`);
  } catch (e: any) { stepErrors.push(`Step 9 (messages): ${e?.message}`); }

  // 10. Delete live shares
  try {
    await supabase.from('live_shares').delete().eq('user_id', userId);
  } catch (e: any) { stepErrors.push(`Step 10 (live_shares): ${e?.message}`); }

  // 11. Clean up R2 storage
  try {
    await deleteR2Prefix(c.env, `profiles/${userId}/`);
    await deleteR2Prefix(c.env, `direct_chats/${userId}/`);
    await deleteR2Prefix(c.env, `group_chats/${userId}/`);
    await deleteR2Prefix(c.env, `itineraries/${userId}/`);
    await deleteR2Prefix(c.env, `trips/${userId}/`);
  } catch (e: any) { stepErrors.push(`Step 11 (R2): ${e?.message}`); }

  // 12. Delete profile (triggers public_profiles cleanup via DB trigger)
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) stepErrors.push(`Step 12 (profiles): ${error.message}`);
  } catch (e: any) { stepErrors.push(`Step 12 (profiles): ${e?.message}`); }

  // 13. Clean up D1 AI chat history
  try {
    const { results: conversations } = await c.env.DB.prepare(
      `SELECT id FROM ai_conversations WHERE user_id = ?`
    ).bind(userId).all();

    for (const conv of conversations || []) {
      await c.env.DB.prepare(`DELETE FROM ai_messages WHERE conversation_id = ?`).bind(conv.id).run();
    }
    await c.env.DB.prepare(`DELETE FROM ai_conversations WHERE user_id = ?`).bind(userId).run();
  } catch (e: any) { stepErrors.push(`Step 13 (D1): ${e?.message}`); }

  // 14. Delete Supabase Auth user — final step
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    console.error('[Delete] Step 14: Failed to delete auth user:', authError.message);
    stepErrors.push(`Step 14 (auth): ${authError.message}`);
  }

  if (stepErrors.length > 0) {
    console.warn(`[Delete] User ${userId} deleted with ${stepErrors.length} non-fatal step error(s):`, stepErrors);
  } else {
    console.log(`[Delete] User ${userId} fully deleted.`);
  }

  return c.json({ success: true, warnings: stepErrors.length > 0 ? stepErrors : undefined });
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
