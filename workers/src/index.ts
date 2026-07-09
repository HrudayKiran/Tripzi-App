import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, getSupabaseAdmin } from './lib/supabase';
import { requireAuth } from './middleware/auth';
import { globalRateLimit, aiRateLimit, mediaRateLimit, publicRateLimit } from './middleware/rateLimit';
import accountRoutes from './routes/account';
import aiRoutes from './routes/ai';
import kbRoutes from './routes/kb';
import mediaRoutes from './routes/media';
import groupChatsRoutes from './routes/group_chats';
import chatNotificationRoutes from './routes/chat';
import publicRoutes from './routes/public';
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

// Public routes — no auth, IP rate limited (must be before auth middleware)
app.use('/public/*', publicRateLimit);

// All authenticated routes — auth first, then rate limiting
app.use('/account/*', requireAuth, globalRateLimit);
app.use('/ai/*', requireAuth, aiRateLimit);
app.use('/media/*', requireAuth, mediaRateLimit);
app.use('/group_chats/*', requireAuth, globalRateLimit);
app.use('/chat/*', requireAuth, globalRateLimit);

// Mount routes
app.route('/public', publicRoutes);
app.route('/account', accountRoutes);
app.route('/ai', aiRoutes);
app.route('/ai/kb', kbRoutes);
app.route('/media', mediaRoutes);
app.route('/group_chats', groupChatsRoutes);
app.route('/chat', chatNotificationRoutes);

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,

  // Cron trigger handler:
  //   "30 2 * * *"   — daily cron (trip lifecycle + AI chat cleanup + R2 cleanup)
  //   "*/10 * * * *" — frequent cron (R2 deleted media cleanup only)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const isDailyCron = event.cron === '30 2 * * *';
    const isFrequentCron = event.cron === '*/10 * * * *';

    if (isDailyCron) {
      ctx.waitUntil(Promise.all([
        handleDailyTripLifecycle(env),
        cleanupExpiredChats(env),
        cleanupDeletedMedia(env),
        cleanupExpiredLiveShares(env),
      ]));
    } else if (isFrequentCron) {
      // Only R2 cleanup runs every 10 minutes — keep daily tasks on daily cron
      ctx.waitUntil(cleanupDeletedMedia(env));
    }
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
 * Runs as part of the scheduled cron trigger (every 10 minutes).
 *
 * Reliability guarantee:
 * - Only processes rows WHERE processed_at IS NULL
 * - Marks each row processed_at = NOW() AFTER confirmed R2 deletion
 * - Per-item error handling: if R2 delete fails for one item, the row
 *   stays in queue and is retried on the next cron run
 * - If DB update fails after R2 delete, the next run will attempt R2 delete
 *   again (idempotent — R2 delete on a non-existent key is a no-op)
 */
async function cleanupDeletedMedia(env: Env): Promise<void> {
  try {
    console.log('[Cleanup] Starting deleted media cleanup...');
    const supabase = getSupabaseAdmin(env);

    // Only fetch unprocessed rows (processed_at IS NULL)
    const { data: mediaItems, error } = await supabase
      .from('deleted_media')
      .select('id, object_key')
      .is('processed_at', null)
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
    let successCount = 0;
    let failCount = 0;

    // Process each item individually for reliable per-item error handling
    for (const item of mediaItems) {
      try {
        // Step 1: Delete from R2
        await deleteR2Objects(env, [item.object_key]);

        // Step 2: Mark as processed ONLY after confirmed R2 deletion
        const { error: updateError } = await supabase
          .from('deleted_media')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', item.id);

        if (updateError) {
          console.error(`[Cleanup] Failed to mark item ${item.id} processed:`, updateError.message);
          // Row stays unprocessed — R2 delete was idempotent, next run will retry
          failCount++;
        } else {
          successCount++;
        }
      } catch (itemError: any) {
        console.error(`[Cleanup] R2 delete failed for key ${item.object_key}:`, itemError?.message || itemError);
        // Row stays unprocessed — will be retried on next cron run
        failCount++;
      }
    }

    console.log(`[Cleanup] Deleted media: ${successCount} succeeded, ${failCount} failed (will retry).`);
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
