import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';
import { deleteR2Prefix } from '../lib/r2';

const account = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

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

  // 3. Remove from trip participants
  const { data: joinedTrips } = await supabase
    .from('trip_participants')
    .select('trip_id')
    .eq('user_id', userId);

  if (joinedTrips && joinedTrips.length > 0) {
    await supabase
      .from('trip_participants')
      .delete()
      .eq('user_id', userId);
  }

  // 4. Delete owned trips
  await supabase.from('trips').delete().eq('user_id', userId);

  // 5. Delete ratings, reports, feedback
  await supabase.from('ratings').delete().eq('user_id', userId);
  await supabase.from('reports').delete().eq('reporter_id', userId);
  await supabase.from('suggestions').delete().eq('user_id', userId);
  await supabase.from('bugs').delete().eq('user_id', userId);
  await supabase.from('feature_requests').delete().eq('user_id', userId);

  // 6. Delete notifications and push tokens
  await supabase.from('notifications').delete().eq('user_id', userId);
  await supabase.from('push_tokens').delete().eq('user_id', userId);

  // 7. Delete messages authored by user
  await supabase.from('messages').delete().eq('sender_id', userId);

  // 8. Delete live shares
  await supabase.from('live_shares').delete().eq('user_id', userId);

  // 9. Clean up R2 storage
  try {
    await deleteR2Prefix(c.env, `profiles/${userId}/`);
    await deleteR2Prefix(c.env, `trips/${userId}/`);
  } catch (e) {
    console.error('R2 cleanup error:', e);
  }

  // 10. Delete profile (triggers public_profiles cleanup via trigger)
  await supabase.from('profiles').delete().eq('id', userId);

  // 11. Delete Supabase Auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    console.error('Error deleting auth user:', authError);
  }

  return c.json({ success: true });
});

export default account;
