import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './lib/supabase';
import { requireAuth } from './middleware/auth';
import accountRoutes from './routes/account';
import aiRoutes from './routes/ai';
import kbRoutes from './routes/kb';
import mediaRoutes from './routes/media';
import tripsRoutes from './routes/trips';
import groupsRoutes from './routes/groups';
import { handleDailyTripLifecycle } from './scheduled/daily';

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
app.use('/trips/*', requireAuth);
app.use('/groups/*', requireAuth);

// Mount routes
app.route('/account', accountRoutes);
app.route('/ai', aiRoutes);
app.route('/ai/kb', kbRoutes);
app.route('/media', mediaRoutes);
app.route('/trips', tripsRoutes);
app.route('/groups', groupsRoutes);

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,

  // Cron trigger handler — runs daily at 2:30 AM UTC (8:00 AM IST)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([
      handleDailyTripLifecycle(env),
      cleanupExpiredChats(env),
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
