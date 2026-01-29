import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnvOk = Boolean(supabaseUrl && supabaseAnonKey);

// IMPORTANT: Don't hard-crash the whole app if env vars are missing.
// Instead, let the UI show a helpful message.
export const supabase = supabaseEnvOk
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'routewise-auth'
      }
    })
  : null;
