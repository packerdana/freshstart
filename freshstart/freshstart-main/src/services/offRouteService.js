import { supabase } from '../lib/supabase';
import { getLocalDateString } from '../utils/time';

export const offRouteService = {
  /**
   * Start an off-route activity (732 Collections or 736 Relay Assistance)
   * This will:
   * 1. Pause the active 721 street timer (end current segment)
   * 2. Start the off-route timer (732 or 736)
   * 
   * @param {string} activityType - 'collections' (732) or 'relay' (736)
   * @param {number} expectedDurationMinutes - Expected duration in minutes
   * @param {string} routeId - Route ID for reference
   * @param {Object} metadata - Additional info (location for collections, helping_route for relay)
   * @returns {Object} { pausedStreetSession, offRouteSession }
   */
  async startOffRouteActivity(activityType, expectedDurationMinutes, routeId, metadata = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');
    
    const user = session.user;
    const today = getLocalDateString();
    const sessionId = `rw_${Date.now()}_${user.email?.split('@')[0] || user.id}`;
    
    // Step 1: Pause active 721 street timer (end current segment)
    const pausedStreetSession = await this._pauseStreetTimer();
    
    if (!pausedStreetSession) {
      console.warn('No active street timer to pause - starting off-route anyway');
    } else {
      console.log(`✓ Paused 721 street timer (segment ended at ${new Date().toLocaleTimeString()})`);
    }
    
    // Step 2: Start off-route timer (732 or 736)
    const code = activityType === 'collections' ? '732' : '736';
    const codeName = activityType === 'collections' ? 'Collections' : 'Relay Assistance';
    
    const { data: offRouteSession, error } = await supabase
      .from('operation_codes')
      .insert({
        session_id: sessionId,
        date: today,
        code: code,
        code_name: codeName,
        start_time: new Date().toISOString(),
        route_id: routeId,
        expected_duration_minutes: expectedDurationMinutes,
        metadata: metadata, // Store location or helping_route
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`✓ Started ${code} ${codeName} (expected: ${expectedDurationMinutes} min)`);
    
    return {
      pausedStreetSession,
      offRouteSession
    };
  },
  
  /**
   * End the active off-route activity and resume the 721 street timer
   * 
   * @returns {Object} { endedOffRouteSession, resumedStreetSession }
   */
  async endOffRouteActivity() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');
    
    // Step 1: End active off-route timer (732 or 736)
    const endedOffRouteSession = await this._endActiveOffRouteTimer();
    
    if (!endedOffRouteSession) {
      throw new Error('No active off-route timer found');
    }
    
    console.log(`✓ Ended ${endedOffRouteSession.code} timer (duration: ${endedOffRouteSession.duration_minutes} min)`);
    
    // Step 2: Resume 721 street timer (start new segment)
    const resumedStreetSession = await this._resumeStreetTimer(endedOffRouteSession.route_id);
    
    console.log(`✓ Resumed 721 street timer (new segment started at ${new Date().toLocaleTimeString()})`);
    
    return {
      endedOffRouteSession,
      resumedStreetSession
    };
  },
  
  /**
   * Get the currently active off-route session (732 or 736)
   */
  async getActiveOffRouteSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    
    const user = session.user;
    const today = getLocalDateString();
    const sessionPattern = `rw_%_${user.email?.split('@')[0] || user.id}`;
    
    const { data, error } = await supabase
      .from('operation_codes')
      .select('*')
      .eq('date', today)
      .like('session_id', sessionPattern)
      .in('code', ['732', '736'])
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Calculate current duration of active off-route session
   */
  calculateCurrentDuration(session) {
    if (!session) return 0;
    
    const now = new Date();
    const startedAt = new Date(session.start_time);
    const elapsed = Math.floor((now - startedAt) / 1000);
    
    return Math.max(0, elapsed);
  },
  
  /**
   * PRIVATE: Pause active 721 street timer by ending current segment
   */
  async _pauseStreetTimer() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    
    const user = session.user;
    const today = getLocalDateString();
    const sessionPattern = `rw_%_${user.email?.split('@')[0] || user.id}`;
    
    // Find active 721 session
    const { data: activeStreetSession } = await supabase
      .from('operation_codes')
      .select('*')
      .eq('code', '721')
      .eq('date', today)
      .like('session_id', sessionPattern)
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .maybeSingle();
    
    if (!activeStreetSession) return null;
    
    // End this segment
    const endedAt = new Date();
    const startedAt = new Date(activeStreetSession.start_time);
    const durationMinutes = Math.round((endedAt - startedAt) / 1000 / 60);
    
    const { data: pausedSession, error } = await supabase
      .from('operation_codes')
      .update({
        end_time: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        code_name: `${activeStreetSession.code_name} (paused for off-route work)`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeStreetSession.id)
      .select()
      .single();
    
    if (error) throw error;
    return pausedSession;
  },
  
  /**
   * PRIVATE: Resume 721 street timer by starting new segment
   */
  async _resumeStreetTimer(routeId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');
    
    const user = session.user;
    const today = getLocalDateString();
    const sessionId = `rw_${Date.now()}_${user.email?.split('@')[0] || user.id}`;
    
    const { data: newStreetSession, error } = await supabase
      .from('operation_codes')
      .insert({
        session_id: sessionId,
        date: today,
        code: '721',
        code_name: 'Street Time (resumed after off-route work)',
        start_time: new Date().toISOString(),
        route_id: routeId,
      })
      .select()
      .single();
    
    if (error) throw error;
    return newStreetSession;
  },
  
  /**
   * PRIVATE: End active off-route timer (732 or 736)
   */
  async _endActiveOffRouteTimer() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    
    const user = session.user;
    const today = getLocalDateString();
    const sessionPattern = `rw_%_${user.email?.split('@')[0] || user.id}`;
    
    // Find active off-route session
    const { data: activeOffRouteSession } = await supabase
      .from('operation_codes')
      .select('*')
      .eq('date', today)
      .like('session_id', sessionPattern)
      .in('code', ['732', '736'])
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .maybeSingle();
    
    if (!activeOffRouteSession) return null;
    
    // End this session
    const endedAt = new Date();
    const startedAt = new Date(activeOffRouteSession.start_time);
    const durationMinutes = Math.round((endedAt - startedAt) / 1000 / 60);
    
    const { data: endedSession, error } = await supabase
      .from('operation_codes')
      .update({
        end_time: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeOffRouteSession.id)
      .select()
      .single();
    
    if (error) throw error;
    return endedSession;
  },
  
  /**
   * Get all 721 segments for today and calculate total street time
   * (Excludes time spent on 732/736)
   */
  async getTotalStreetTimeToday() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return 0;
    
    const user = session.user;
    const today = getLocalDateString();
    const sessionPattern = `rw_%_${user.email?.split('@')[0] || user.id}`;
    
    const { data: streetSegments } = await supabase
      .from('operation_codes')
      .select('duration_minutes, start_time, end_time')
      .eq('code', '721')
      .eq('date', today)
      .like('session_id', sessionPattern)
      .order('start_time', { ascending: true });
    
    if (!streetSegments || streetSegments.length === 0) return 0;
    
    // Sum completed segments
    let totalMinutes = 0;
    let hasActiveSegment = false;
    
    for (const segment of streetSegments) {
      if (segment.end_time) {
        // Completed segment
        totalMinutes += segment.duration_minutes || 0;
      } else {
        // Active segment - calculate current duration
        hasActiveSegment = true;
        const now = new Date();
        const startedAt = new Date(segment.start_time);
        const currentDuration = Math.round((now - startedAt) / 1000 / 60);
        totalMinutes += currentDuration;
      }
    }
    
    return totalMinutes;
  },
  
  /**
   * Format seconds as time display
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
};
