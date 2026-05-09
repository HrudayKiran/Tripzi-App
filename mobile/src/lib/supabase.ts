import 'react-native-url-polyfill/auto';
import { createMMKV } from 'react-native-mmkv';
import { createClient } from '@supabase/supabase-js';

const storage = createMMKV({
  id: 'supabase-auth-storage'
});

const mmkvStorageAdapter = {
  getItem: (key: string) => {
    return storage.getString(key) || null;
  },
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.remove(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
