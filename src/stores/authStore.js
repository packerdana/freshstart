import { create } from 'zustand';
import { supabase, supabaseEnvOk } from '../lib/supabase';
import useRouteStore from './routeStore';
import useBreakStore from './breakStore';

const missingEnvMessage =
  'RouteWise is missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel Environment Variables, then redeploy.';


async function clearUserScopedState() {
  // Clear persisted + in-memory state that should never carry across accounts.
  try {
    // Route store
    try {
      useRouteStore.persist?.clearStorage?.();
    } catch {}
    try {
      useRouteStore.getState().resetStore?.();
    } catch {}

    // Break store
    try {
      useBreakStore.persist?.clearStorage?.();
    } catch {}
    try {
      await useBreakStore.getState().resetStore?.();
    } catch {}
  } catch {
    // ignore
  }
}

const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  // initializing: app startup auth/session check
  initializing: true,
  // loading: user-initiated auth actions (sign in/out/up)
  loading: false,
  error: null,
  
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setInitializing: (initializing) => set({ initializing }),
  setError: (error) => set({ error }),

  // Escape hatch: if auth gets wedged on mobile, let the user reset without clearing browser cookies.
  hardResetAuth: async () => {
    // IMPORTANT: This must never hang.
    try {
      set({ loading: true, error: null });

      // Clear browser storage keys that commonly wedge mobile auth (sync, best-effort)
      try {
        const keys = Object.keys(localStorage || {});
        for (const k of keys) {
          if (k === 'routewise-storage' || k === 'routewise-auth' || k.startsWith('sb-') || k.includes('supabase') || k.includes('routewise-auth')) {
            try { localStorage.removeItem(k); } catch {}
          }
        }
      } catch {}

      try { sessionStorage?.clear?.(); } catch {}

      // Fire-and-forget sign out + state clears (do not await)
      try { supabase?.auth?.signOut?.({ scope: 'local' })?.catch?.(() => {}); } catch {}
      try { clearUserScopedState?.(); } catch {}

      set({ user: null, session: null, loading: false, error: null });

      // Cache-bust reload (some browsers keep serving stale bundles)
      try {
        window.location.replace(`/?reset=0&v=${Date.now()}`);
      } catch {
        window.location.href = '/';
      }
      return { error: null };
    } catch (e) {
      set({ user: null, session: null, loading: false, error: null });
      try { window.location.href = '/'; } catch {}
      return { error: e };
    }
  },
  
  signUp: async (email, password) => {
    set({ loading: true, error: null });

    if (!supabaseEnvOk || !supabase) {
      set({ error: missingEnvMessage, loading: false });
      return { data: null, error: new Error(missingEnvMessage) };
    }
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // After email confirmation, redirect to a RouteWise page that shows a clear success message.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) throw error;
      
      set({
        user: data.user,
        session: data.session,
        loading: false,
      });
      
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },
  
  signIn: async (email, password) => {
    set({ loading: true, error: null });

    if (!supabaseEnvOk || !supabase) {
      set({ error: missingEnvMessage, loading: false });
      return { data: null, error: new Error(missingEnvMessage) };
    }
    
    try {
      const withTimeout = (p, ms) =>
        Promise.race([
          p,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Sign in timed out — tap Reset login')), ms)),
        ]);

      // FIXED: Only clear if there's a specific invalid token error
      // Don't clear blindly - let Supabase handle existing sessions
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        20000
      );
      
      if (error) {
        // If error is about existing session being invalid, clear and retry
        if (error.message?.includes('Invalid Refresh Token') || 
            error.message?.includes('refresh_token_not_found')) {
          console.log('Clearing stale session and retrying...');
          await supabase.auth.signOut({ scope: 'local' });
          
          // Retry sign in after clearing
          const retryResult = await withTimeout(
            supabase.auth.signInWithPassword({
              email,
              password,
            }),
            20000
          );
          
          if (retryResult.error) throw retryResult.error;
          
          set({
            user: retryResult.data.user,
            session: retryResult.data.session,
            loading: false,
            error: null,
          });
          
          return { data: retryResult.data, error: null };
        }
        
        throw error;
      }
      
      set({
        user: data.user,
        session: data.session,
        loading: false,
        error: null,
      });
      
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },
  
  signOut: async () => {
    set({ loading: true, error: null });

    // Ensure persisted per-day timing overrides never carry across accounts.
    try {
      useRouteStore.getState().clearTodayTimingOverrides?.();
    } catch {
      // ignore
    }

    if (!supabaseEnvOk || !supabase) {
      // If we're not configured, just clear local state.
      set({ user: null, session: null, loading: false, error: null });
      window.location.href = '/';
      return { error: null };
    }
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      // Clear persisted + in-memory app state on logout
      await clearUserScopedState();

      set({
        user: null,
        session: null,
        loading: false,
        error: null,
      });

      // Also clear persisted Today timing overrides.
      try {
        useRouteStore.getState().clearTodayTimingOverrides?.();
      } catch {
        // ignore
      }
      
      // Force a full page reload to clear all app state
      window.location.href = '/';
      
      return { error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { error };
    }
  },
  
  initializeAuth: () => {
    try {
      // Mark startup auth check as running
      set({ initializing: true });

      if (!supabaseEnvOk || !supabase) {
        set({ session: null, user: null, initializing: false, loading: false, error: missingEnvMessage });
        return () => {};
      }

      // Absolute watchdog: never allow an infinite "Loading..." screen.
      // If auth init gets wedged (storage corruption, browser bug, etc.), fall back to signed-out.
      const watchdog = setTimeout(() => {
        try {
          if (!get().initializing) return;
          console.warn('[authStore] Auth init watchdog fired; forcing signed-out state');

          // Do NOT await anything here — if the browser/network is wedged, awaits can hang forever.
          try {
            supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          } catch {}

          set({ session: null, user: null, initializing: false, loading: false, error: null });
        } catch {}
      }, 25000);


    // Get initial session (with a timeout so the app doesn't spin forever if Supabase/network hangs)
    const withTimeout = (p, ms) =>
      Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase session check timed out')), ms)),
      ]);

    // Mobile networks can be slow; retry once before giving up.
    const getSessionWithRetries = async () => {
      const attempts = [20000, 20000]; // ms
      let lastErr = null;

      for (let i = 0; i < attempts.length; i++) {
        try {
          // eslint-disable-next-line no-await-in-loop
          return await withTimeout(supabase.auth.getSession(), attempts[i]);
        } catch (e) {
          lastErr = e;
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 600 + i * 900));
        }
      }

      throw lastErr || new Error('Supabase session check timed out');
    };

    getSessionWithRetries()
      .then(({ data: { session }, error }) => {
        clearTimeout(watchdog);
        // FIXED: Only clear on specific token errors, not all errors
        if (error) {
        console.error('Error getting session:', error);
        
        // Only clear if it's a token-related error
        if (error.message?.includes('Invalid Refresh Token') || 
            error.message?.includes('refresh_token_not_found') ||
            error.message?.includes('invalid_grant')) {
          console.log('Clearing invalid session...');
          supabase.auth.signOut({ scope: 'local' });
        }
        
        set({ 
          session: null, 
          user: null, 
          initializing: false,
          loading: false 
        });
        return;
      }
      
      set({
        session,
        user: session?.user ?? null,
        initializing: false,
        loading: false,
      });
    })
    .catch((err) => {
      clearTimeout(watchdog);
      // IMPORTANT: Don't brick the whole app UI on transient mobile network issues.
      // If Supabase is temporarily slow/unreachable, fall back to signed-out state
      // (Login screen) instead of a full-page "Setup needed" error.
      console.error('Auth init timed out or failed:', err);
      set({
        session: null,
        user: null,
        initializing: false,
        loading: false,
        error: null,
      });
    });
    
    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);

        // If the authenticated user changes (logout/login, or switching accounts),
        // clear persisted user-scoped state so it doesn't stick across accounts.
        try {
          const prevUserId = get().user?.id ?? null;
          const nextUserId = session?.user?.id ?? null;

          const userChanged = (prevUserId && nextUserId && prevUserId !== nextUserId) || (event === 'SIGNED_IN' && prevUserId !== nextUserId);
          const signedOut = event === 'SIGNED_OUT';

          if (signedOut || userChanged) {
            // Clear per-day timing overrides too
            try {
              useRouteStore.getState().clearTodayTimingOverrides?.();
            } catch {}

            await clearUserScopedState();
          }
        } catch {
          // ignore
        }
        
        // FIXED: Don't auto-clear on token refresh failures
        // Let the retry logic in signIn handle it
        if (event === 'SIGNED_OUT') {
          set({
            session: null,
            user: null,
            initializing: false,
            loading: false,
          });
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          set({
            session,
            user: session?.user ?? null,
            initializing: false,
            loading: false,
          });
        } else if (event === 'USER_UPDATED') {
          set({
            user: session?.user ?? null,
            initializing: false,
            loading: false,
          });
        } else {
          // For any other event, just update the session
          set({
            session,
            user: session?.user ?? null,
            initializing: false,
            loading: false,
          });
        }
      }
    );
    
    // Return unsubscribe function for cleanup
    return () => {
      try {
        clearTimeout(watchdog);
      } catch {}
      authListener?.subscription?.unsubscribe();
    };
  } catch (e) {
    console.error('[authStore] initializeAuth crashed:', e);
    set({ session: null, user: null, loading: false, error: null });
    return () => {};
  }
  },
}));

export default useAuthStore;
