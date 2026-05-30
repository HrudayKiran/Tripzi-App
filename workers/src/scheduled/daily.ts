import { Env, getSupabaseAdmin } from '../lib/supabase';
import { createNotification, sendPushToUser } from '../lib/notifications';

/**
 * Daily itinerary lifecycle handler — runs at 8:00 AM IST via cron.
 * 1. Notify participants of itineraries starting today
 * 2. Hide group chats 7 days after itinerary end
 */
export const handleDailyTripLifecycle = async (env: Env) => {
  const sb = getSupabaseAdmin(env);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const sevenDaysAgoStr = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];

  console.log(`[Scheduler] Running daily itinerary lifecycle at ${now.toISOString()}`);

  // 1. ITINERARY START NOTIFICATIONS
  try {
    const { data: startingItineraries } = await sb
      .from('itineraries')
      .select('id, title, user_id, participants')
      .gte('from_date', todayStr)
      .lt('from_date', new Date(now.getTime() + 86400000).toISOString().split('T')[0]);

    for (const itin of startingItineraries || []) {
      let collaborators: string[] = [];
      try {
        collaborators = Array.isArray(itin.participants) 
          ? itin.participants 
          : JSON.parse(itin.participants || '[]');
      } catch {
        collaborators = [];
      }
      
      const allUsers = [itin.user_id, ...collaborators];

      for (const uid of allUsers) {
        await createNotification(sb, {
          recipientId: uid,
          type: 'trip_started',
          title: '🎉 Your itinerary starts today!',
          message: `"${itin.title || 'Itinerary'}" begins today. Have an amazing journey!`,
          entityId: itin.id,
          entityType: 'itinerary',
          deepLinkRoute: 'ItineraryView',
        });
        await sendPushToUser(sb, env.FIREBASE_SERVICE_ACCOUNT_JSON, uid, {
          title: '🎉 Your itinerary starts today!',
          body: `"${itin.title || 'Itinerary'}" begins today!`,
        });
      }
    }
  } catch (e) { console.error('[Scheduler] Start notifications error:', e); }

  // 2. HIDE OLD GROUP CHATS
  try {
    const { data: groupChats } = await sb.from('group_chats').select('id, itinerary_id').eq('hidden', false).not('itinerary_id', 'is', null);
    for (const gc of groupChats || []) {
      const { data: itin } = await sb.from('itineraries').select('to_date').eq('id', gc.itinerary_id).maybeSingle();
      if (!itin) { 
        await sb.from('group_chats').update({ hidden: true }).eq('id', gc.id); 
        continue; 
      }
      if (itin.to_date && itin.to_date < sevenDaysAgoStr) {
        await sb.from('group_chats').update({ hidden: true }).eq('id', gc.id);
      }
    }
  } catch (e) { console.error('[Scheduler] Hide chats error:', e); }

  console.log('[Scheduler] Daily itinerary lifecycle completed');
};
