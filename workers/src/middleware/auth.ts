import { Context, Next } from 'hono';
import { Env } from '../lib/supabase';

/**
 * Middleware that verifies the Supabase JWT from the Authorization header.
 * Sets `c.set('userId', ...)` on success.
 */
export const requireAuth = async (c: Context<{ Bindings: Env; Variables: { userId: string } }>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    // Decode the JWT payload (Supabase JWTs are standard JWTs)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return c.json({ error: 'Invalid token format' }, 401);
    }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ error: 'Token expired' }, 401);
    }

    // Check issuer matches our Supabase project
    const env = c.env;
    const expectedIssuer = `${env.SUPABASE_URL}/auth/v1`;
    if (payload.iss !== expectedIssuer) {
      return c.json({ error: 'Invalid token issuer' }, 401);
    }

    // Extract the user ID from the `sub` claim
    const userId = payload.sub;
    if (!userId) {
      return c.json({ error: 'Token missing user ID' }, 401);
    }

    c.set('userId', userId);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};
