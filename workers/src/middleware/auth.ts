import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { Env, getSupabaseAdmin } from '../lib/supabase';

/**
 * Middleware that verifies the Supabase JWT.
 * 
 * Performance Optimization (Production Grade):
 * 1. Attempts to verify the JWT locally using Hono's JWT library and the
 *    shared `SUPABASE_JWT_SECRET`. This requires 0 network calls (~1ms).
 * 2. If local verification fails (e.g. key rotation or signature mismatch),
 *    falls back to calling `supabase.auth.getUser(token)` server-side.
 * 
 * Sets `c.set('userId', ...)` on success.
 */
export const requireAuth = async (c: Context<{ Bindings: Env; Variables: { userId: string } }>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    // Fast path: Local JWT verification (0 network latency)
    const payload = await verify(token, c.env.SUPABASE_JWT_SECRET, 'HS256');
    
    if (!payload?.sub || typeof payload.sub !== 'string') {
      return c.json({ error: 'Invalid token payload' }, 401);
    }

    c.set('userId', payload.sub);
    await next();
  } catch (localError) {
    // Slow path fallback: Server-side validation via Supabase
    try {
      const supabase = getSupabaseAdmin(c.env);
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data?.user) {
        return c.json({ error: 'Invalid or expired token' }, 401);
      }

      c.set('userId', data.user.id);
      await next();
    } catch (remoteError) {
      return c.json({ error: 'Invalid token' }, 401);
    }
  }
};


/**
 * Admin-only middleware.
 * Checks if the authenticated user's ID is in the ADMIN_USER_IDS env var (comma-separated).
 * Must be used AFTER requireAuth.
 */
export const requireAdmin = async (c: Context<{ Bindings: Env; Variables: { userId: string } }>, next: Next) => {
  const userId = c.get('userId');
  const adminIds = (c.env as any).ADMIN_USER_IDS;

  if (!adminIds) {
    return c.json({ error: 'Admin access not configured.' }, 403);
  }

  const adminList = adminIds.split(',').map((id: string) => id.trim());

  if (!adminList.includes(userId)) {
    return c.json({ error: 'Admin access required.' }, 403);
  }

  await next();
};
