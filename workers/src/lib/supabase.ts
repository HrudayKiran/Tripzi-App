import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type Env = {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;

  // Admin
  ADMIN_USER_IDS: string;

  // AI Providers
  GROQ_API_KEY: string;
  TAVILY_API_KEY: string;

  // Unsplash
  UNSPLASH_ACCESS_KEY: string;

  // R2 Storage
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_PUBLIC_BASE_URL: string;

  // Firebase (legacy — for push notifications)
  FIREBASE_SERVICE_ACCOUNT_JSON: string;

  // Workers AI binding
  AI: any;

  // Cloudflare D1 binding (chat history)
  DB: D1Database;

  // Zilliz Cloud (vector database)
  ZILLIZ_ENDPOINT: string;
  ZILLIZ_API_KEY: string;

  // Cloudflare AI Gateway
  CF_ACCOUNT_ID: string;
  AI_GATEWAY_SLUG: string;

  // Rate Limiting bindings
  AI_RATE_LIMITER: RateLimit;
  MEDIA_RATE_LIMITER: RateLimit;
  GLOBAL_RATE_LIMITER: RateLimit;
  PUBLIC_RATE_LIMITER: RateLimit;
};

interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

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
