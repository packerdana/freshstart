import { create } from 'zustand';
import { supabase, supabaseEnvOk } from '../lib/supabase';

const missingEnvMessage =
  'RouteWise is missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel Environment Variables, then redeploy.';

const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,
  error: null,
  
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
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
      // FIXED: Only clear if there's a specific invalid token error
      // Don't clear blindly - let Supabase handle existing sessions
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // If error is about existing session being invalid, clear and retry
        if (error.message?.includes('Invalid Refresh Token') || 
            error.message?.includes('refresh_token_not_found')) {
          console.log('Clearing stale session and retrying...');
          await supabase.auth.signOut({ scope: 'local' });
          
          // Retry sign in after clearing
          const retryResult = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
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

    if (!supabaseEnvOk || !supabase) {
      // If we're not configured, just clear local state.
      set({ user: null, session: null, loading: false, error: null });
      window.location.href = '/';
      return { error: null };
    }
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      // Clear ALL state on logout
      set({
        user: null,
        session: null,
        loading: false,
        error: null,
      });
      
      // Force a full page reload to clear all app state
      window.location.href = '/';
      
      return { error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { error };
    }
  },
  
  initializeAuth: () => {
    if (!supabaseEnvOk || !supabase) {
      set({ session: null, user: null, loading: false, error: missingEnvMessage });
      return () => {};
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
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
          loading: false 
        });
        return;
      }
      
      set({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });
    
    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        // FIXED: Don't auto-clear on token refresh failures
        // Let the retry logic in signIn handle it
        if (event === 'SIGNED_OUT') {
          set({
            session: null,
            user: null,
            loading: false,
          });
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          set({
            session,
            user: session?.user ?? null,
            loading: false,
          });
        } else if (event === 'USER_UPDATED') {
          set({
            user: session?.user ?? null,
            loading: false,
          });
        } else {
          // For any other event, just update the session
          set({
            session,
            user: session?.user ?? null,
            loading: false,
          });
        }
      }
    );
    
    // Return unsubscribe function for cleanup
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  },
}));

export default useAuthStore;
