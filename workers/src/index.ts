import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, getSupabaseAdmin } from './lib/supabase';
import { requireAuth } from './middleware/auth';
import accountRoutes from './routes/account';
import aiRoutes from './routes/ai';
import kbRoutes from './routes/kb';
import mediaRoutes from './routes/media';
import groupChatsRoutes from './routes/group_chats';
import { handleDailyTripLifecycle } from './scheduled/daily';
import { deleteR2Objects } from './lib/r2';

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// Global CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check (no auth)
app.get('/', (c) => c.json({ status: 'ok', service: 'nxtvibes-workers' }));

// All authenticated routes
app.use('/account/*', requireAuth);
app.use('/ai/*', requireAuth);
app.use('/media/*', requireAuth);
app.use('/group_chats/*', requireAuth);

// Mount routes
app.route('/account', accountRoutes);
app.route('/ai', aiRoutes);
app.route('/ai/kb', kbRoutes);
app.route('/media', mediaRoutes);
app.route('/group_chats', groupChatsRoutes);

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,

  // Cron trigger handler — runs daily at 2:30 AM UTC (8:00 AM IST)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([
      handleDailyTripLifecycle(env),
      cleanupExpiredChats(env),
      cleanupDeletedMedia(env),
    ]));
  },
};

/**
 * Cleanup AI conversations older than 30 days.
 * Runs as part of the daily cron trigger.
 */
async function cleanupExpiredChats(env: Env): Promise<void> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get expired conversation IDs
    const expired = await env.DB.prepare(
      `SELECT id FROM ai_conversations WHERE updated_at < ?`
    ).bind(thirtyDaysAgo).all();

    const ids = (expired.results || []).map((r: any) => r.id);

    if (ids.length === 0) return;

    // Delete messages first, then conversations (batch)
    for (const id of ids) {
      await env.DB.prepare(`DELETE FROM ai_messages WHERE conversation_id = ?`).bind(id).run();
      await env.DB.prepare(`DELETE FROM ai_conversations WHERE id = ?`).bind(id).run();
    }
  } catch {
    // Silently fail — cleanup will retry next day
  }
}

/**
 * Cleanup deleted media queue from Supabase and delete R2 assets.
 * Runs as part of the daily cron trigger.
 */
async function cleanupDeletedMedia(env: Env): Promise<void> {
  try {
    const supabase = getSupabaseAdmin(env);
    
    // Fetch up to 100 media records to delete
    const { data: mediaItems, error } = await supabase
      .from('deleted_media')
      .select('id, object_key')
      .limit(100);

    if (error || !mediaItems || mediaItems.length === 0) return;

    const keys = mediaItems.map((item: any) => item.object_key);
    
    // Delete the objects from R2
    await deleteR2Objects(env, keys);

    // Remove the records from the deleted_media queue
    const ids = mediaItems.map((item: any) => item.id);
    await supabase
      .from('deleted_media')
      .delete()
      .in('id', ids);
  } catch {
    // Silently fail — cleanup will retry next day
  }
}
