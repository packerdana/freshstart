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

  // Only for fatal/setup-level errors (ex: missing env). Do NOT use for normal sign-in failures.
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
      set({ loading: true });

      // Clear browser storage keys that commonly wedge mobile auth (sync, best-effort)
      try {
        const keys = Object.keys(localStorage || {});
        for (const k of keys) {
          if (
            k === 'routewise-storage' ||
            k === 'routewise-auth' ||
            k.startsWith('sb-') ||
            k.includes('supabase') ||
            k.includes('routewise-auth')
          ) {
            try {
              localStorage.removeItem(k);
            } catch {}
          }
        }
      } catch {}

      try {
        sessionStorage?.clear?.();
      } catch {}

      // Fire-and-forget sign out + state clears (do not await)
      try {
        supabase?.auth?.signOut?.({ scope: 'local' })?.catch?.(() => {});
      } catch {}
      try {
        clearUserScopedState?.();
      } catch {}

      set({ user: null, session: null, loading: false, error: null, initializing: false });

      // Cache-bust reload (some browsers keep serving stale bundles)
      try {
        window.location.replace(`/?reset=0&v=${Date.now()}`);
      } catch {
        window.location.href = '/';
      }

      return { error: null };
    } catch (e) {
      set({ user: null, session: null, loading: false, error: null, initializing: false });
      try {
        window.location.href = '/';
      } catch {}
      return { error: e };
    }
  },

  signUp: async (email, password) => {
    set({ loading: true });

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
      // Let SignupScreen show the message; don't trigger App.tsx global error screen.
      set({ loading: false });
      return { data: null, error };
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });

    if (!supabaseEnvOk || !supabase) {
      set({ error: missingEnvMessage, loading: false });
      return { data: null, error: new Error(missingEnvMessage) };
    }

    try {
      const withTimeout = (p, ms) =>
        Promise.race([
          p,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Sign in timed out — tap Reset login')), ms)
          ),
        ]);

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        20000
      );

      if (error) {
        if (
          error.message?.includes('Invalid Refresh Token') ||
          error.message?.includes('refresh_token_not_found')
        ) {
          console.log('Clearing stale session and retrying...');
          await supabase.auth.signOut({ scope: 'local' });

          const retryResult = await withTimeout(
            supabase.auth.signInWithPassword({ email, password }),
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
      // If the sign-in call timed out, Supabase may STILL have completed sign-in
      // (we've seen SIGNED_IN events despite the promise stalling). Verify with getSession.
      try {
        const msg = String(error?.message || error || '');
        const isTimeout = msg.toLowerCase().includes('timed out');
        if (isTimeout) {
          const withTimeout2 = (p, ms) =>
            Promise.race([
              p,
              new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timed out')), ms)),
            ]);

          const res = await withTimeout2(supabase.auth.getSession(), 6000);
          const session = res?.data?.session || null;
          if (session?.user) {
            set({ user: session.user, session, loading: false, error: null });
            return { data: { session, user: session.user }, error: null };
          }
        }
      } catch {}

      // Let LoginScreen show the message; don't trigger App.tsx global error screen.
      set({ loading: false });
      return { data: null, error };
    }
  },

  signOut: async () => {
    set({ loading: true });

    try {
      useRouteStore.getState().clearTodayTimingOverrides?.();
    } catch {}

    if (!supabaseEnvOk || !supabase) {
      set({ user: null, session: null, loading: false, error: null, initializing: false });
      window.location.href = '/';
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      await clearUserScopedState();

      set({ user: null, session: null, loading: false, error: null, initializing: false });
      window.location.href = '/';
      return { error: null };
    } catch (error) {
      // Let the UI surface this as needed; don't show the global "Setup needed" screen.
      set({ loading: false });
      return { error };
    }
  },

  initializeAuth: () => {
    try {
      set({ initializing: true });

      if (!supabaseEnvOk || !supabase) {
        set({ session: null, user: null, initializing: false, loading: false, error: missingEnvMessage });
        return () => {};
      }

      // Watchdog: never allow infinite startup spinner.
      const watchdog = setTimeout(() => {
        try {
          if (!get().initializing) return;
          console.warn('[authStore] Auth init watchdog fired; forcing signed-out state');
          try {
            supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          } catch {}
          set({ session: null, user: null, initializing: false, loading: false, error: null });
        } catch {}
      }, 25000);

      // Listener first (Supabase emits INITIAL_SESSION)
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          clearTimeout(watchdog);
        } catch {}

        console.log('Auth state changed:', event);

        // Clear persisted user-scoped state when user changes.
        try {
          const prevUserId = get().user?.id ?? null;
          const nextUserId = session?.user?.id ?? null;
          const userChanged =
            (prevUserId && nextUserId && prevUserId !== nextUserId) ||
            (event === 'SIGNED_IN' && prevUserId !== nextUserId);
          const signedOut = event === 'SIGNED_OUT';

          if (signedOut || userChanged) {
            try {
              useRouteStore.getState().clearTodayTimingOverrides?.();
            } catch {}
            await clearUserScopedState();
          }
        } catch {}

        if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, initializing: false, loading: false });
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          set({ session, user: session?.user ?? null, initializing: false, loading: false });
          return;
        }

        if (event === 'USER_UPDATED') {
          set({ user: session?.user ?? null, initializing: false, loading: false });
          return;
        }

        set({ session, user: session?.user ?? null, initializing: false, loading: false });
      });

      // Best-effort initial session fetch; never block UI on this.
      try {
        const withTimeout = (p, ms) =>
          Promise.race([
            p,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Supabase session check timed out')), ms)
            ),
          ]);

        withTimeout(supabase.auth.getSession(), 8000)
          .then(({ data: { session } }) => {
            if (!get().initializing) return;
            set({ session, user: session?.user ?? null, initializing: false, loading: false, error: null });
          })
          .catch((err) => {
            console.warn('[authStore] Initial getSession failed (non-fatal):', err?.message || err);
            if (!get().initializing) return;
            set({ session: null, user: null, initializing: false, loading: false, error: null });
          });
      } catch {
        set({ session: null, user: null, initializing: false, loading: false, error: null });
      }

      return () => {
        try {
          clearTimeout(watchdog);
        } catch {}
        authListener?.subscription?.unsubscribe();
      };
    } catch (e) {
      console.error('[authStore] initializeAuth crashed:', e);
      set({ session: null, user: null, initializing: false, loading: false, error: null });
      return () => {};
    }
  },
}));

export default useAuthStore;
