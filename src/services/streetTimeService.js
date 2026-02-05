import { supabase } from '../lib/supabase';
import { getLocalDateString } from '../utils/time';

export const streetTimeService = {
  async startSession(routeId, preRouteLoadingMinutes = 0) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');
    
    const user = session.user;
    
    const activeSession = await this.getActiveSession();
    if (activeSession) {
      throw new Error('A street time session is already active');
    }
    
    const sessionId = `rw_${Date.now()}_${user.email?.split('@')[0] || user.id}`;
    const today = getLocalDateString();
    
    // Start time is the actual moment the carrier goes "out to the street" (721 starts).
    // We do NOT backdate the 721 start time for load-truck/pre-route work; that caused the
    // "Actual Leave" time to appear earlier than the button press.
    const startTime = new Date();

    const { data, error } = await supabase
      .from('operation_codes')
      .insert({
        session_id: sessionId,
        date: today,
        code: '721',
        code_name: 'Street Time',
        start_time: startTime.toISOString(),
        route_id: routeId,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async endSession(sessionId = null) {
    const session = sessionId
      ? await this.getSessionById(sessionId)
      : await this.getActiveSession();
    
    if (!session) throw new Error('No active street time session found');
    
    const endedAt = new Date();
    const startedAt = new Date(session.start_time);
    // Prevent noisy 0-minute sessions (often caused by accidental double-taps or quick start/stop).
    const rawMinutes = (endedAt - startedAt) / 1000 / 60;
    const durationMinutes = Math.max(1, Math.round(rawMinutes));
    
    const { data, error } = await supabase
      .from('operation_codes')
      .update({
        end_time: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async getActiveSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    
    const user = session.user;
    const today = getLocalDateString();
    const sessionPattern = `rw_%_${user.email?.split('@')[0] || user.id}`;
    
    const { data, error } = await supabase
      .from('operation_codes')
      .select('*')
      .eq('code', '721')
      .eq('date', today)
      .like('session_id', sessionPattern)
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  async getSessionById(sessionId) {
    const { data, error } = await supabase
      .from('operation_codes')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  async getTodaySession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    
    const user = session.user;
    const today = getLocalDateString();
    const sessionPattern = `rw_%_${user.email?.split('@')[0] || user.id}`;
    
    const { data, error } = await supabase
      .from('operation_codes')
      .select('*')
      .eq('code', '721')
      .eq('date', today)
      .like('session_id', sessionPattern)
      .order('start_time', { ascending: false })
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
  
  calculateCurrentDuration(session) {
    if (!session) return 0;
    
    const now = new Date();
    const startedAt = new Date(session.start_time);
    const elapsed = Math.floor((now - startedAt) / 1000);
    
    return Math.max(0, elapsed);
  },
  
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
