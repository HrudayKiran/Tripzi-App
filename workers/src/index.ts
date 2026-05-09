import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './lib/supabase';
import { requireAuth } from './middleware/auth';
import accountRoutes from './routes/account';
import aiRoutes from './routes/ai';
import mediaRoutes from './routes/media';
import tripsRoutes from './routes/trips';
import groupsRoutes from './routes/groups';
import verificationRoutes from './routes/verification';
import { handleDailyTripLifecycle } from './scheduled/daily';

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// Global CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check (no auth)
app.get('/', (c) => c.json({ status: 'ok', service: 'tripzi-workers' }));

// All authenticated routes
app.use('/account/*', requireAuth);
app.use('/ai/*', requireAuth);
app.use('/media/*', requireAuth);
app.use('/trips/*', requireAuth);
app.use('/groups/*', requireAuth);
app.use('/verify-age', requireAuth);

// Mount routes
app.route('/account', accountRoutes);
app.route('/ai', aiRoutes);
app.route('/media', mediaRoutes);
app.route('/trips', tripsRoutes);
app.route('/groups', groupsRoutes);
app.route('/verify-age', verificationRoutes);

// Export for Cloudflare Workers
export default {
  fetch: app.fetch,
  // Cron trigger handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleDailyTripLifecycle(env));
  },
};
