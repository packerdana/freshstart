import { supabase } from '../lib/supabase';

/**
 * Break Timer Persistence Service
 * Saves active break/lunch timers to database so they survive app minimize/background
 */

// Get today's date in YYYY-MM-DD format (local timezone)
const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Save break timer state to database
 * Stores in day_state table so timers can be restored after minimize
 */
export const saveBreakState = async (breakState) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('Cannot save break state - no user');
      return false;
    }

    const today = getTodayDate();

    // Get existing day_state
    const { data: existing, error: fetchError } = await supabase
      .from('day_state')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    const dayStateData = existing?.day_state || {};

    // Update break timer state
    const updatedDayState = {
      ...dayStateData,
      breakTimers: {
        lunchActive: breakState.lunchActive || false,
        lunchTime: breakState.lunchTime || 0,
        lunchStartTime: breakState.lunchStartTime || null,
        breakActive: breakState.breakActive || false,
        breakTime: breakState.breakTime || 0,
        breakType: breakState.breakType || null,
        breakStartTime: breakState.breakStartTime || null,
        loadTruckActive: breakState.loadTruckActive || false,
        loadTruckTime: breakState.loadTruckTime || 0,
        loadTruckStartTime: breakState.loadTruckStartTime || null,
        loadTruckPackageCount: breakState.loadTruckPackageCount || 0,
        // Accumulated paused seconds for waypoint predictions (lunch + breaks only)
        waypointPausedSeconds: breakState.waypointPausedSeconds || 0,
        // Detailed events so we can adjust expected times per waypoint
        breakEvents: Array.isArray(breakState.breakEvents) ? breakState.breakEvents : [],
        lastUpdated: Date.now(),
      }
    };

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('day_state')
        .update({
          day_state: updatedDayState,
          updated_at: new Date().toISOString(),
        })
        .eq('date', today);

      if (updateError) throw updateError;
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('day_state')
        .insert({
          date: today,
          day_state: updatedDayState,
        });

      if (insertError) throw insertError;
    }

    console.log('✓ Break state saved to database');
    return true;
  } catch (error) {
    console.error('Error saving break state:', error);
    return false;
  }
};

/**
 * Load break timer state from database
 * Called when app starts/resumes to restore any active timers
 */
export const loadBreakState = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Auth session may not be restored yet on page refresh.
      // Signal caller to retry once auth is ready.
      console.warn('Cannot load break state - no user (yet)');
      return { __noUser: true };
    }

    const today = getTodayDate();

    const { data, error } = await supabase
      .from('day_state')
      .select('day_state')
      .eq('date', today)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data || !data.day_state || !data.day_state.breakTimers) {
      console.log('No saved break state found');
      return null;
    }

    const savedState = data.day_state.breakTimers;

    // Check if saved state is from today and still valid
    if (savedState.lastUpdated) {
      const timeSinceUpdate = Date.now() - savedState.lastUpdated;
      const sixHours = 6 * 60 * 60 * 1000;
      
      if (timeSinceUpdate > sixHours) {
        console.log('Saved break state is too old, ignoring');
        return null;
      }
    }

    console.log('✓ Break state loaded from database:', savedState);
    return savedState;
  } catch (error) {
    console.error('Error loading break state:', error);
    return null;
  }
};

/**
 * Clear break timer state from database
 * Called when timer completes or is cancelled
 */
export const clearBreakState = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const today = getTodayDate();

    const { data: existing, error: fetchError } = await supabase
      .from('day_state')
      .select('day_state')
      .eq('date', today)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (!existing) return true;

    const dayStateData = existing.day_state || {};
    
    // Remove break timers from day_state
    const updatedDayState = {
      ...dayStateData,
      breakTimers: null,
    };

    const { error: updateError } = await supabase
      .from('day_state')
      .update({
        day_state: updatedDayState,
        updated_at: new Date().toISOString(),
      })
      .eq('date', today);

    if (updateError) throw updateError;

    console.log('✓ Break state cleared from database');
    return true;
  } catch (error) {
    console.error('Error clearing break state:', error);
    return false;
  }
};
