import { Context, Next } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';

/**
 * Middleware that verifies the Supabase JWT by calling supabase.auth.getUser().
 * This validates the token server-side against Supabase Auth, handling key rotation
 * (ECC P-256, HS256) automatically.
 * Sets `c.set('userId', ...)` on success.
 */
export const requireAuth = async (c: Context<{ Bindings: Env; Variables: { userId: string } }>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    // Use Supabase Admin to verify the JWT server-side
    // This handles key rotation (ECC P-256 + Legacy HS256) automatically
    const supabase = getSupabaseAdmin(c.env);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    c.set('userId', data.user.id);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
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
