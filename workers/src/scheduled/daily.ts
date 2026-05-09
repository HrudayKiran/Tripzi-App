import { Env, getSupabaseAdmin } from '../lib/supabase';
import { createNotification, sendPushToUser } from '../lib/notifications';

/**
 * Daily trip lifecycle handler — runs at 8:00 AM IST via cron.
 * 1. Notify participants of trips starting today
 * 2. Auto-complete trips that ended yesterday + prompt ratings
 * 3. Mark expired trips (start date passed)
 * 4. Hide group chats 7 days after trip end
 */
export const handleDailyTripLifecycle = async (env: Env) => {
  const sb = getSupabaseAdmin(env);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  const sevenDaysAgoStr = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];

  console.log(`[Scheduler] Running daily trip lifecycle at ${now.toISOString()}`);

  // 1. TRIP START NOTIFICATIONS
  try {
    const { data: startingTrips } = await sb
      .from('trips')
      .select('id, title, user_id')
      .gte('from_date', todayStr)
      .lt('from_date', new Date(now.getTime() + 86400000).toISOString().split('T')[0])
      .neq('status', 'cancelled');

    for (const trip of startingTrips || []) {
      const { data: parts } = await sb.from('trip_participants').select('user_id').eq('trip_id', trip.id);
      const allUsers = [trip.user_id, ...(parts || []).map((p) => p.user_id)];

      for (const uid of allUsers) {
        await createNotification(sb, {
          recipientId: uid, type: 'trip_started', title: '🎉 Your trip starts today!',
          message: `"${trip.title || 'Trip'}" begins today. Have an amazing journey!`,
          entityId: trip.id, entityType: 'trip', deepLinkRoute: 'TripDetails',
        });
        await sendPushToUser(sb, env.FIREBASE_SERVICE_ACCOUNT_JSON, uid, {
          title: '🎉 Your trip starts today!', body: `"${trip.title || 'Trip'}" begins today!`,
        });
      }
    }
  } catch (e) { console.error('[Scheduler] Start notifications error:', e); }

  // 2. AUTO-COMPLETE + RATE PROMPT
  try {
    const { data: endedTrips } = await sb
      .from('trips')
      .select('id, title, user_id, is_completed')
      .gte('to_date', yesterdayStr)
      .lt('to_date', todayStr)
      .neq('status', 'cancelled')
      .eq('is_completed', false);

    for (const trip of endedTrips || []) {
      await sb.from('trips').update({ is_completed: true, completed_at: now.toISOString() }).eq('id', trip.id);

      const { data: parts } = await sb.from('trip_participants').select('user_id').eq('trip_id', trip.id);
      for (const p of parts || []) {
        await createNotification(sb, {
          recipientId: p.user_id, type: 'rate_trip', title: '⭐ Rate your trip!',
          message: `"${trip.title || 'Trip'}" has ended. Share your experience!`,
          entityId: trip.id, entityType: 'trip', deepLinkRoute: 'TripDetails',
        });
        await sendPushToUser(sb, env.FIREBASE_SERVICE_ACCOUNT_JSON, p.user_id, {
          title: '⭐ Rate your trip!', body: `"${trip.title || 'Trip'}" has ended.`,
        });
      }
    }
  } catch (e) { console.error('[Scheduler] End processing error:', e); }

  // 3. EXPIRE TRIPS
  try {
    await sb.from('trips').update({ is_expired: true }).lt('from_date', todayStr).eq('is_expired', false).neq('status', 'cancelled');
  } catch (e) { console.error('[Scheduler] Expire error:', e); }

  // 4. HIDE OLD GROUP CHATS
  try {
    const { data: groupChats } = await sb.from('group_chats').select('id, trip_id').eq('hidden', false).not('trip_id', 'is', null);
    for (const gc of groupChats || []) {
      const { data: trip } = await sb.from('trips').select('to_date').eq('id', gc.trip_id).maybeSingle();
      if (!trip) { await sb.from('group_chats').update({ hidden: true }).eq('id', gc.id); continue; }
      if (trip.to_date && trip.to_date < sevenDaysAgoStr) {
        await sb.from('group_chats').update({ hidden: true }).eq('id', gc.id);
      }
    }
  } catch (e) { console.error('[Scheduler] Hide chats error:', e); }

  console.log('[Scheduler] Daily trip lifecycle completed');
};
