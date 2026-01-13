import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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
    
    try {
      // CRITICAL FIX: Clear any stale auth data before signing in
      // This prevents "Invalid Refresh Token" errors
      await supabase.auth.signOut({ scope: 'local' });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
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
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      // FIXED: Clear ALL state on logout
      set({
        user: null,
        session: null,
        loading: false,
        error: null,
      });
      
      // FIXED: Force a full page reload to clear all app state
      // This ensures all Zustand stores and component state are reset
      window.location.href = '/';
      
      return { error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { error };
    }
  },
  
  initializeAuth: () => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // CRITICAL FIX: If error getting session (stale token), clear it
      if (error) {
        console.error('Error getting session:', error);
        supabase.auth.signOut({ scope: 'local' });
        set({ session: null, user: null, loading: false });
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
        
        // CRITICAL FIX: Handle token refresh errors
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.error('Token refresh failed, clearing session');
          await supabase.auth.signOut({ scope: 'local' });
          set({ session: null, user: null, loading: false });
          return;
        }
        
        // FIXED: Handle different auth events explicitly
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
        } else {
          set({
            session,
            user: session?.user ?? null,
            loading: false,
          });
        }
      }
    );
    
    // FIXED: Return unsubscribe function for cleanup
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  },
}));

export default useAuthStore;
