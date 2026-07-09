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
 * POST /media/direct-chat-upload
 * Body: { contentType: string, fileName?: string, chatId?: string }
 */
media.post('/direct-chat-upload', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ contentType?: string; fileName?: string; chatId?: string }>();
  const contentType = (typeof body.contentType === 'string' ? body.contentType.trim() : '').toLowerCase();

  if (!isImageContentType(contentType)) {
    return c.json({ error: 'A valid image content type is required.' }, 400);
  }

  const objectKey = createR2ObjectKey('direct_chats', userId, contentType, body.fileName?.trim());
  const uploadUrl = await createPresignedUploadUrl(c.env, objectKey, contentType);

  return c.json({
    uploadUrl,
    publicUrl: buildPublicR2Url(c.env, objectKey),
    objectKey,
  });
});

/**
 * POST /media/group-chat-upload
 * Body: { contentType: string, fileName?: string, chatId?: string }
 */
media.post('/group-chat-upload', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ contentType?: string; fileName?: string; chatId?: string }>();
  const contentType = (typeof body.contentType === 'string' ? body.contentType.trim() : '').toLowerCase();

  if (!isImageContentType(contentType)) {
    return c.json({ error: 'A valid image content type is required.' }, 400);
  }

  const objectKey = createR2ObjectKey('group_chats', userId, contentType, body.fileName?.trim());
  const uploadUrl = await createPresignedUploadUrl(c.env, objectKey, contentType);

  return c.json({
    uploadUrl,
    publicUrl: buildPublicR2Url(c.env, objectKey),
    objectKey,
  });
});

/**
 * POST /media/itinerary-upload
 * Body: { contentType: string, fileName?: string, itineraryId?: string }
 */
media.post('/itinerary-upload', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ contentType?: string; fileName?: string; itineraryId?: string }>();
  const contentType = (typeof body.contentType === 'string' ? body.contentType.trim() : '').toLowerCase();
  const itineraryId = typeof body.itineraryId === 'string' ? body.itineraryId.trim() : '';

  if (!isImageContentType(contentType)) {
    return c.json({ error: 'A valid image content type is required.' }, 400);
  }

  if (itineraryId) {
    const supabase = getSupabaseAdmin(c.env);
    const { data: itinerary } = await supabase
      .from('itineraries')
      .select('user_id')
      .eq('id', itineraryId)
      .maybeSingle();

    if (!itinerary) return c.json({ error: 'Itinerary not found.' }, 404);
    if (itinerary.user_id !== userId) return c.json({ error: 'You do not own this itinerary.' }, 403);
  }

  const objectKey = createR2ObjectKey('itineraries', userId, contentType, body.fileName?.trim());
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
 * DELETE /media/direct-chat-image
 * Body: { objectKey: string }
 */
media.delete('/direct-chat-image', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ objectKey?: string }>();
  const objectKey = typeof body.objectKey === 'string' ? body.objectKey.trim() : '';

  if (!objectKey) return c.json({ error: 'objectKey is required.' }, 400);
  if (!isOwnedObjectKey(objectKey, 'direct_chats', userId)) {
    return c.json({ error: 'You do not own this asset.' }, 403);
  }

  await deleteR2Object(c.env, objectKey);
  return c.json({ success: true });
});

/**
 * DELETE /media/group-chat-image
 * Body: { objectKey: string }
 */
media.delete('/group-chat-image', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ objectKey?: string }>();
  const objectKey = typeof body.objectKey === 'string' ? body.objectKey.trim() : '';

  if (!objectKey) return c.json({ error: 'objectKey is required.' }, 400);
  if (!isOwnedObjectKey(objectKey, 'group_chats', userId)) {
    return c.json({ error: 'You do not own this asset.' }, 403);
  }

  await deleteR2Object(c.env, objectKey);
  return c.json({ success: true });
});

/**
 * DELETE /media/itinerary-image
 * Body: { itineraryId?: string, objectKeys: string[] }
 */
media.delete('/itinerary-image', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ itineraryId?: string; objectKeys?: string[] }>();
  const itineraryId = typeof body.itineraryId === 'string' ? body.itineraryId.trim() : '';
  const objectKeys = Array.isArray(body.objectKeys)
    ? body.objectKeys.filter((k): k is string => typeof k === 'string').map((k) => k.trim()).filter(Boolean)
    : [];

  if (objectKeys.length === 0) {
    return c.json({ success: true, deletedCount: 0 });
  }

  if (itineraryId) {
    const supabase = getSupabaseAdmin(c.env);
    const { data: itinerary } = await supabase
      .from('itineraries')
      .select('user_id')
      .eq('id', itineraryId)
      .maybeSingle();

    if (!itinerary) return c.json({ error: 'Itinerary not found.' }, 404);
    if (itinerary.user_id !== userId) return c.json({ error: 'You do not own this itinerary.' }, 403);
  }

  for (const key of objectKeys) {
    if (!isOwnedObjectKey(key, 'itineraries', userId)) {
      return c.json({ error: 'You do not own one or more assets.' }, 403);
    }
  }

  await deleteR2Objects(c.env, objectKeys);
  return c.json({ success: true, deletedCount: objectKeys.length });
});



export default media;
