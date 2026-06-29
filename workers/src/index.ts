import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, getSupabaseAdmin } from './lib/supabase';
import { requireAuth } from './middleware/auth';
import { globalRateLimit, aiRateLimit, mediaRateLimit } from './middleware/rateLimit';
import accountRoutes from './routes/account';
import aiRoutes from './routes/ai';
import kbRoutes from './routes/kb';
import mediaRoutes from './routes/media';
import groupChatsRoutes from './routes/group_chats';
import chatNotificationRoutes from './routes/chat';
import { handleDailyTripLifecycle } from './scheduled/daily';
import { deleteR2Objects } from './lib/r2';

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// Global CORS
app.use('*', (c, next) => {
  const originHeader = c.req.header('Origin');
  const allowedOrigins = ['https://nxtvibes.vercel.app'];
  const origin = (!originHeader || allowedOrigins.includes(originHeader)) ? originHeader || '*' : '';

  const corsHandler = cors({
    origin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  return corsHandler(c, next);
});

// Health check (no auth)
app.get('/', (c) => c.json({ status: 'ok', service: 'nxtvibes-workers' }));

// All authenticated routes — auth first, then rate limiting
app.use('/account/*', requireAuth, globalRateLimit);
app.use('/ai/*', requireAuth, aiRateLimit);
app.use('/media/*', requireAuth, mediaRateLimit);
app.use('/group_chats/*', requireAuth, globalRateLimit);
app.use('/chat/*', requireAuth, globalRateLimit);

// Mount routes
app.route('/account', accountRoutes);
app.route('/ai', aiRoutes);
app.route('/ai/kb', kbRoutes);
app.route('/media', mediaRoutes);
app.route('/group_chats', groupChatsRoutes);
app.route('/chat', chatNotificationRoutes);

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,

  // Cron trigger handler — runs daily at 2:30 AM UTC (8:00 AM IST)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([
      handleDailyTripLifecycle(env),
      cleanupExpiredChats(env),
      cleanupDeletedMedia(env),
      cleanupExpiredLiveShares(env),
    ]));
  },
};

/**
 * Cleanup AI conversations older than 30 days.
 * Runs as part of the daily cron trigger.
 */
async function cleanupExpiredChats(env: Env): Promise<void> {
  try {
    console.log('[Cleanup] Starting expired AI chats cleanup...');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get expired conversation IDs
    const expired = await env.DB.prepare(
      `SELECT id FROM ai_conversations WHERE updated_at < ?`
    ).bind(thirtyDaysAgo).all();

    const ids = (expired.results || []).map((r: any) => r.id);

    if (ids.length === 0) {
      console.log('[Cleanup] No expired AI chats to process.');
      return;
    }

    // Delete messages first, then conversations (batch)
    for (const id of ids) {
      await env.DB.prepare(`DELETE FROM ai_messages WHERE conversation_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM ai_conversations WHERE id = ?`).bind(id).run();
    }
    console.log(`[Cleanup] Deleted ${ids.length} expired AI conversations.`);
  } catch (e: any) {
    console.error('[Cleanup] Expired chats cleanup error:', e?.message || e);
  }
}

/**
 * Cleanup deleted media queue from Supabase and delete R2 assets.
 * Runs as part of the daily cron trigger.
 */
async function cleanupDeletedMedia(env: Env): Promise<void> {
  try {
    console.log('[Cleanup] Starting deleted media cleanup...');
    const supabase = getSupabaseAdmin(env);

    // Fetch up to 100 media records to delete
    const { data: mediaItems, error } = await supabase
      .from('deleted_media')
      .select('id, object_key')
      .limit(100);

    if (error) {
      console.error('[Cleanup] Supabase query error:', error.message);
      return;
    }

    if (!mediaItems || mediaItems.length === 0) {
      console.log('[Cleanup] No deleted media to process.');
      return;
    }

    console.log(`[Cleanup] Processing ${mediaItems.length} deleted media items...`);
    const keys = mediaItems.map((item: any) => item.object_key);

    // Delete the objects from R2
    await deleteR2Objects(env, keys);
    console.log(`[Cleanup] Deleted ${keys.length} R2 objects.`);

    // Remove the records from the deleted_media queue
    const ids = mediaItems.map((item: any) => item.id);
    const { error: deleteError } = await supabase
      .from('deleted_media')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('[Cleanup] Failed to remove queue records:', deleteError.message);
    } else {
      console.log(`[Cleanup] Removed ${ids.length} records from deleted_media queue.`);
    }
  } catch (e: any) {
    console.error('[Cleanup] Deleted media cleanup error:', e?.message || e);
  }
}

/**
 * Cleanup expired live shares from Supabase.
 * Runs as part of the daily cron trigger.
 */
async function cleanupExpiredLiveShares(env: Env): Promise<void> {
  try {
    console.log('[Cleanup] Starting expired live shares cleanup...');
    const supabase = getSupabaseAdmin(env);
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('live_shares')
      .delete()
      .lt('expires_at', now);

    if (error) {
      console.error('[Cleanup] Failed to delete expired live shares:', error.message);
    } else {
      console.log('[Cleanup] Expired live shares cleaned up successfully.');
    }
  } catch (e: any) {
    console.error('[Cleanup] Expired live shares cleanup error:', e?.message || e);
  }
}
