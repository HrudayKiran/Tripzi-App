import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  GROQ_API_KEY: string;
  UNSPLASH_ACCESS_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_PUBLIC_BASE_URL: string;
  FIREBASE_SERVICE_ACCOUNT_JSON: string;
};

let supabaseAdmin: SupabaseClient | null = null;

export const getSupabaseAdmin = (env: Env): SupabaseClient => {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
};
