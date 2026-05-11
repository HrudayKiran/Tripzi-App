import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';
import { createNotification, sendPushToUser } from '../lib/notifications';

const trips = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

const getProfile = async (sb: any, uid: string) => {
  const { data } = await sb.from('public_profiles').select('*').eq('id', uid).maybeSingle();
  return data;
};

trips.post('/join', async (c) => {
  const userId = c.get('userId');
  const { tripId } = await c.req.json<{ tripId?: string }>();
  if (!tripId?.trim()) return c.json({ error: 'tripId is required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: trip } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (!trip) return c.json({ error: 'Trip not found.' }, 404);
  if (trip.user_id === userId) return c.json({ error: 'Organizers cannot join their own trip.' }, 400);
  if (trip.status === 'cancelled') return c.json({ error: 'Trip is cancelled.' }, 400);
  if (trip.is_completed) return c.json({ error: 'Trip is already completed.' }, 400);

  const { data: existing } = await sb.from('trip_participants').select('id').eq('trip_id', tripId).eq('user_id', userId).maybeSingle();
  if (existing) return c.json({ success: true, already_joined: true });

  const participants = Array.isArray(trip.participants) ? trip.participants : (trip.participants ? JSON.parse(trip.participants) : []);
  if (trip.max_travelers && participants.length >= trip.max_travelers) {
    return c.json({ error: 'This trip is already full.' }, 400);
  }

  await sb.from('trip_participants').insert({ trip_id: tripId, user_id: userId });

  const newParticipants = [...participants, userId];
  await sb.from('trips').update({ 
    participants: newParticipants,
    current_travelers: newParticipants.length 
  }).eq('id', tripId);

  // Add user to the trip's group chat or create it if missing
  const { data: groupChat } = await sb.from('group_chats')
    .select('id, participants')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (groupChat) {
    const chatParticipants = Array.isArray(groupChat.participants) ? groupChat.participants : [];
    if (!chatParticipants.includes(userId)) {
      await sb.from('group_chats').update({
        participants: [...chatParticipants, userId],
        member_count: chatParticipants.length + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', groupChat.id);
    }
  } else {
    // Auto-create group chat
    await sb.from('group_chats').insert({
      trip_id: tripId,
      group_name: trip.title || 'Trip Group',
      trip_image: trip.cover_image || null,
      participants: [trip.user_id, userId], // Owner and joiner
      created_by: trip.user_id, // Owner
      member_count: 2,
      hidden: false,
      admins: [trip.user_id],
      last_message: { text: 'Group created', sender_id: null, created_at: new Date().toISOString() },
    });
  }

  const actor = await getProfile(sb, userId);
  const hostId = trip.user_id;

  const notifPayload = {
    recipientId: hostId,
    type: 'join_trip',
    title: 'New Trip Companion!',
    message: `${actor?.display_name || 'Someone'} joined your trip to ${trip.to_location || trip.location || trip.title}`,
    entityId: tripId,
    entityType: 'trip',
    actorId: userId,
    actorName: actor?.display_name,
    deepLinkRoute: 'TripDetails',
    deepLinkParams: { tripId }
  };

  await createNotification(sb, notifPayload);
  await sendPushToUser(sb, c.env.FIREBASE_SERVICE_ACCOUNT_JSON, hostId, {
    title: notifPayload.title,
    body: notifPayload.message,
    data: { route: 'TripDetails', tripId }
  });

  return c.json({ success: true });
});

trips.post('/leave', async (c) => {
  const userId = c.get('userId');
  const { tripId, reason } = await c.req.json<{ tripId?: string; reason?: string }>();
  if (!tripId?.trim()) return c.json({ error: 'tripId is required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: trip } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (!trip) return c.json({ error: 'Trip not found.' }, 404);
  if (trip.user_id === userId) return c.json({ error: 'Hosts cannot leave their own trips.' }, 400);

  await sb.from('trip_participants').delete().eq('trip_id', tripId).eq('user_id', userId);

  const participants = Array.isArray(trip.participants) ? trip.participants : (trip.participants ? JSON.parse(trip.participants) : []);
  const newParticipants = participants.filter((p: string) => p !== userId);
  
  await sb.from('trips').update({ 
    participants: newParticipants,
    current_travelers: newParticipants.length 
  }).eq('id', tripId);

  // Remove user from the trip's group chat
  const { data: groupChat } = await sb.from('chats')
    .select('id, participants')
    .eq('trip_id', tripId)
    .eq('type', 'group')
    .maybeSingle();

  if (groupChat) {
    const chatParticipants = Array.isArray(groupChat.participants) ? groupChat.participants : [];
    const newChatParticipants = chatParticipants.filter((p: string) => p !== userId);
    await sb.from('chats').update({
      participants: newChatParticipants,
      member_count: newChatParticipants.length,
      updated_at: new Date().toISOString(),
    }).eq('id', groupChat.id);
  }

  const actor = await getProfile(sb, userId);
  const hostId = trip.user_id;

  const notifPayload = {
    recipientId: hostId,
    type: 'leave_trip',
    title: 'Traveler Left',
    message: `${actor?.display_name || 'Someone'} left your trip to ${trip.to_location || trip.location || trip.title}`,
    entityId: tripId,
    entityType: 'trip',
    actorId: userId,
    actorName: actor?.display_name,
    deepLinkRoute: 'TripDetails',
    deepLinkParams: { tripId }
  };

  await createNotification(sb, notifPayload);
  await sendPushToUser(sb, c.env.FIREBASE_SERVICE_ACCOUNT_JSON, hostId, {
    title: notifPayload.title,
    body: notifPayload.message,
    data: { route: 'TripDetails', tripId }
  });

  return c.json({ success: true });
});

trips.post('/cancel', async (c) => {
  const userId = c.get('userId');
  const { tripId, reason } = await c.req.json<{ tripId?: string; reason?: string }>();
  if (!tripId?.trim()) return c.json({ error: 'tripId is required.' }, 400);
  if (!reason?.trim()) return c.json({ error: 'Reason is required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: trip } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (!trip) return c.json({ error: 'Trip not found.' }, 404);
  if (trip.user_id !== userId) return c.json({ error: 'Only host can cancel.' }, 403);

  await sb.from('trips').update({ 
    status: 'cancelled', 
    is_cancelled: true, 
    cancel_reason: reason, 
    cancelled_at: new Date().toISOString() 
  }).eq('id', tripId);
  
  await sb.from('chats').update({ hidden: true }).eq('trip_id', tripId);

  const participants = Array.isArray(trip.participants) ? trip.participants : (trip.participants ? JSON.parse(trip.participants) : []);
  const actor = await getProfile(sb, userId);

  for (const participantId of participants) {
    if (participantId === userId) continue;
    
    const notifPayload = {
      recipientId: participantId,
      type: 'trip_cancelled',
      title: 'Trip Cancelled',
      message: `The trip to ${trip.to_location || trip.location || trip.title} has been cancelled by the host.`,
      entityId: tripId,
      entityType: 'trip',
      actorId: userId,
      actorName: actor?.display_name,
      deepLinkRoute: 'MyTrips',
      deepLinkParams: { tripId }
    };

    await createNotification(sb, notifPayload);
    await sendPushToUser(sb, c.env.FIREBASE_SERVICE_ACCOUNT_JSON, participantId, {
      title: notifPayload.title,
      body: notifPayload.message,
      data: { route: 'TripDetails', tripId }
    });
  }

  return c.json({ success: true });
});

trips.post('/delete', async (c) => {
  const userId = c.get('userId');
  const { tripId, reason } = await c.req.json<{ tripId?: string; reason?: string }>();
  if (!tripId?.trim()) return c.json({ error: 'tripId is required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: trip } = await sb.from('trips').select('user_id').eq('id', tripId).maybeSingle();
  if (!trip) return c.json({ error: 'Trip not found.' }, 404);
  if (trip.user_id !== userId) return c.json({ error: 'Only host can delete.' }, 403);

  await sb.from('trip_participants').delete().eq('trip_id', tripId);
  await sb.from('trips').delete().eq('id', tripId);
  return c.json({ success: true });
});

trips.post('/rate', async (c) => {
  const userId = c.get('userId');
  const { tripId, rating, feedback } = await c.req.json<{ tripId?: string; rating?: number; feedback?: string }>();
  if (!tripId?.trim()) return c.json({ error: 'tripId is required.' }, 400);
  const r = Number(rating);
  if (!Number.isFinite(r) || r < 1 || r > 5) return c.json({ error: 'Rating must be 1-5.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: trip } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (!trip) return c.json({ error: 'Trip not found.' }, 404);
  if (trip.user_id === userId) return c.json({ error: 'Hosts cannot rate own trips.' }, 400);

  const { data: part } = await sb.from('trip_participants').select('id').eq('trip_id', tripId).eq('user_id', userId).maybeSingle();
  if (!part) return c.json({ error: 'Only joined travelers can rate.' }, 403);

  const actor = await getProfile(sb, userId);

  await sb.from('ratings').upsert({ 
    trip_id: tripId, 
    user_id: userId, 
    host_id: trip.user_id, 
    rating: r, 
    feedback: feedback?.trim() || '', 
    trip_title: trip.title || 'Trip', 
    user_name: actor?.display_name || 'Traveler', 
    user_photo: actor?.photo_url || '' 
  }, { onConflict: 'trip_id,user_id' });
  
  return c.json({ success: true });
});

export default trips;
