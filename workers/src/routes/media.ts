import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';
import {
  buildPublicR2Url,
  createPresignedUploadUrl,
  createR2ObjectKey,
  deleteR2Object,
  deleteR2Objects,
  isOwnedObjectKey,
} from '../lib/r2';

const media = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

const isImageContentType = (value: unknown): value is string =>
  typeof value === 'string' && /^image\/[a-z0-9.+-]+$/i.test(value.trim());

/**
 * POST /media/profile-upload
 * Body: { contentType: string, fileName?: string }
 */
media.post('/profile-upload', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ contentType?: string; fileName?: string }>();
  const contentType = (typeof body.contentType === 'string' ? body.contentType.trim() : '').toLowerCase();

  if (!isImageContentType(contentType)) {
    return c.json({ error: 'A valid image content type is required.' }, 400);
  }

  const objectKey = createR2ObjectKey('profiles', userId, contentType, body.fileName?.trim());
  const uploadUrl = await createPresignedUploadUrl(c.env, objectKey, contentType);

  return c.json({
    uploadUrl,
    publicUrl: buildPublicR2Url(c.env, objectKey),
    objectKey,
  });
});

/**
 * POST /media/trip-upload
 * Body: { contentType: string, fileName?: string, tripId?: string }
 */
media.post('/trip-upload', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ contentType?: string; fileName?: string; tripId?: string }>();
  const contentType = (typeof body.contentType === 'string' ? body.contentType.trim() : '').toLowerCase();
  const tripId = typeof body.tripId === 'string' ? body.tripId.trim() : '';

  if (!isImageContentType(contentType)) {
    return c.json({ error: 'A valid image content type is required.' }, 400);
  }

  if (tripId) {
    const supabase = getSupabaseAdmin(c.env);
    const { data: trip } = await supabase
      .from('trips')
      .select('user_id')
      .eq('id', tripId)
      .maybeSingle();

    if (!trip) return c.json({ error: 'Trip not found.' }, 404);
    if (trip.user_id !== userId) return c.json({ error: 'You do not own this trip.' }, 403);
  }

  const objectKey = createR2ObjectKey('trips', userId, contentType, body.fileName?.trim());
  const uploadUrl = await createPresignedUploadUrl(c.env, objectKey, contentType);

  return c.json({
    uploadUrl,
    publicUrl: buildPublicR2Url(c.env, objectKey),
    objectKey,
  });
});

/**
 * DELETE /media/profile-image
 * Body: { objectKey: string }
 */
media.delete('/profile-image', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ objectKey?: string }>();
  const objectKey = typeof body.objectKey === 'string' ? body.objectKey.trim() : '';

  if (!objectKey) return c.json({ error: 'objectKey is required.' }, 400);
  if (!isOwnedObjectKey(objectKey, 'profiles', userId)) {
    return c.json({ error: 'You do not own this asset.' }, 403);
  }

  await deleteR2Object(c.env, objectKey);
  return c.json({ success: true });
});

/**
 * DELETE /media/trip-images
 * Body: { tripId?: string, objectKeys: string[] }
 */
media.delete('/trip-images', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ tripId?: string; objectKeys?: string[] }>();
  const tripId = typeof body.tripId === 'string' ? body.tripId.trim() : '';
  const objectKeys = Array.isArray(body.objectKeys)
    ? body.objectKeys.filter((k): k is string => typeof k === 'string').map((k) => k.trim()).filter(Boolean)
    : [];

  if (objectKeys.length === 0) {
    return c.json({ success: true, deletedCount: 0 });
  }

  if (tripId) {
    const supabase = getSupabaseAdmin(c.env);
    const { data: trip } = await supabase
      .from('trips')
      .select('user_id')
      .eq('id', tripId)
      .maybeSingle();

    if (!trip) return c.json({ error: 'Trip not found.' }, 404);
    if (trip.user_id !== userId) return c.json({ error: 'You do not own this trip.' }, 403);
  }

  for (const key of objectKeys) {
    if (!isOwnedObjectKey(key, 'trips', userId)) {
      return c.json({ error: 'You do not own one or more assets.' }, 403);
    }
  }

  await deleteR2Objects(c.env, objectKeys);
  return c.json({ success: true, deletedCount: objectKeys.length });
});

export default media;
