import { Hono } from 'hono';
import { Env, getSupabaseAdmin } from '../lib/supabase';

const verification = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

const MINIMUM_AGE = 18;

const calculateAge = (dob: Date, now: Date): number => {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
};

/** POST /verify-age — Body: { dateOfBirth: string (ISO) } */
verification.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ dateOfBirth?: string }>();

  if (typeof body.dateOfBirth !== 'string') {
    return c.json({ error: 'dateOfBirth must be an ISO date string.' }, 400);
  }

  const dob = new Date(body.dateOfBirth);
  if (Number.isNaN(dob.getTime())) {
    return c.json({ error: 'Invalid dateOfBirth value.' }, 400);
  }

  const now = new Date();
  if (dob > now) {
    return c.json({ error: 'dateOfBirth cannot be in the future.' }, 400);
  }

  const age = calculateAge(dob, now);
  if (age < MINIMUM_AGE) {
    return c.json({ error: 'You must be at least 18 years old.' }, 400);
  }

  const supabase = getSupabaseAdmin(c.env);

  const { error } = await supabase
    .from('profiles')
    .update({
      age_verified: true,
      date_of_birth: dob.toISOString().split('T')[0],
      age_verified_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) return c.json({ error: error.message }, 500);

  return c.json({ verified: true, age });
});

export default verification;
