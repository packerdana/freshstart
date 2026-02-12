import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnvOk = Boolean(supabaseUrl && supabaseAnonKey);

// IMPORTANT: Don't hard-crash the whole app if env vars are missing.
// Instead, let the UI show a helpful message.
// Safe storage wrapper: mobile browsers occasionally corrupt/lock session storage.
// If the stored session JSON is invalid, treat it as signed-out instead of bricking the app.
const memoryStore = new Map();
const safeStorage = {
  getItem: (key) => {
    try {
      const v = localStorage.getItem(key);
      if (v == null) return null;
      // Validate JSON (Supabase stores JSON strings). If corrupted, clear it.
      try {
        JSON.parse(v);
      } catch {
        try { localStorage.removeItem(key); } catch {}
        return null;
      }
      return v;
    } catch {
      return memoryStore.get(key) ?? null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      memoryStore.set(key, value);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      memoryStore.delete(key);
    }
  },
};

export const supabase = supabaseEnvOk
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'routewise-auth',
        storage: safeStorage,
      },
    })
  : null;
