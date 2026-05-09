import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';
import { createNotification, sendPushToUser } from '../lib/notifications';

const trips = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

trips.post('/join', async (c) => {
  const userId = c.get('userId');
  const { tripId } = await c.req.json<{ tripId?: string }>();
  if (!tripId?.trim()) return c.json({ error: 'tripId is required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: trip } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (!trip) return c.json({ error: 'Trip not found.' }, 404);
  if (trip.user_id === userId) return c.json({ error: 'You are the host.' }, 400);
  if (trip.status === 'cancelled') return c.json({ error: 'Trip cancelled.' }, 400);
  if (trip.is_completed) return c.json({ error: 'Trip ended.' }, 400);

  const startDate = trip.from_date ? new Date(trip.from_date) : null;
  if (startDate && startDate.getTime() <= Date.now()) return c.json({ error: 'Trip already started.' }, 400);

  const { data: existing } = await sb.from('trip_participants').select('id').eq('trip_id', tripId).eq('user_id', userId).maybeSingle();
  if (existing) return c.json({ success: true });

  if (trip.current_travelers >= (trip.max_travelers || 10)) return c.json({ error: 'Trip is full.' }, 400);

  if (trip.gender_preference && trip.gender_preference !== 'anyone') {
    const { data: prof } = await sb.from('profiles').select('gender').eq('id', userId).maybeSingle();
    if (!prof?.gender) return c.json({ error: 'Set your gender first.' }, 400);
    if (prof.gender !== trip.gender_preference) return c.json({ error: `This trip is for ${trip.gender_preference} only.` }, 400);
  }

  await sb.from('trip_participants').insert({ trip_id: tripId, user_id: userId });
  return c.json({ success: true });
});

trips.post('/leave', async (c) => {
  const userId = c.get('userId');
  const { tripId, reason } = await c.req.json<{ tripId?: string; reason?: string }>();
  if (!tripId?.trim()) return c.json({ error: 'tripId is required.' }, 400);
  if (!reason?.trim()) return c.json({ error: 'A leave reason is required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: trip } = await sb.from('trips').select('user_id').eq('id', tripId).maybeSingle();
  if (!trip) return c.json({ error: 'Trip not found.' }, 404);
  if (trip.user_id === userId) return c.json({ error: 'Hosts cannot leave.' }, 400);

  await sb.from('trip_participants').delete().eq('trip_id', tripId).eq('user_id', userId);
  return c.json({ success: true });
});

trips.post('/cancel', async (c) => {
  const userId = c.get('userId');
  const { tripId, reason } = await c.req.json<{ tripId?: string; reason?: string }>();
  if (!tripId?.trim()) return c.json({ error: 'tripId is required.' }, 400);
  if (!reason?.trim()) return c.json({ error: 'A cancellation reason is required.' }, 400);
  const sb = getSupabaseAdmin(c.env);

  const { data: trip } = await sb.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (!trip) return c.json({ error: 'Trip not found.' }, 404);
  if (trip.user_id !== userId) return c.json({ error: 'Only the host can cancel.' }, 403);

  await sb.from('trips').update({ status: 'cancelled', is_cancelled: true, cancel_reason: reason, cancelled_at: new Date().toISOString() }).eq('id', tripId);
  await sb.from('group_chats').update({ hidden: true }).eq('trip_id', tripId);

  const { data: parts } = await sb.from('trip_participants').select('user_id').eq('trip_id', tripId).neq('user_id', userId);
  if (parts) {
    for (const p of parts) {
      await createNotification(sb, { recipientId: p.user_id, type: 'trip_cancelled', title: 'Trip Cancelled', message: `Host cancelled "${trip.title || 'Trip'}".`, entityId: tripId, entityType: 'trip', deepLinkRoute: 'MyTrips' });
      await sendPushToUser(sb, c.env.FIREBASE_SERVICE_ACCOUNT_JSON, p.user_id, { title: 'Trip Cancelled', body: `Host cancelled "${trip.title || 'Trip'}".` });
    }
  }
  return c.json({ success: true });
});

trips.post('/delete', async (c) => {
  const userId = c.get('userId');
  const { tripId, reason } = await c.req.json<{ tripId?: string; reason?: string }>();
  if (!tripId?.trim()) return c.json({ error: 'tripId is required.' }, 400);
  if (!reason?.trim()) return c.json({ error: 'A deletion reason is required.' }, 400);
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

  const { data: prof } = await sb.from('profiles').select('name, photo_url').eq('id', userId).maybeSingle();

  await sb.from('ratings').upsert({ trip_id: tripId, user_id: userId, host_id: trip.user_id, rating: r, feedback: feedback?.trim() || '', trip_title: trip.title || 'Trip', user_name: prof?.name || 'Traveler', user_photo: prof?.photo_url || '' }, { onConflict: 'trip_id,user_id' });
  return c.json({ success: true });
});

export default trips;
