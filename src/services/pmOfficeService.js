import { supabase } from '../lib/supabase';
import { getWorkweekStart, getWorkweekEnd } from '../utils/uspsConstants';

export const pmOfficeService = {
  async startSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not authenticated');

    const user = session.user;

    const activeSession = await this.getActiveSession();
    if (activeSession) {
      throw new Error('A PM Office session is already active');
    }

    const { data, error } = await supabase
      .from('pm_office_sessions')
      .insert({
        user_id: user.id,
        started_at: new Date().toISOString(),
        is_paused: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async endSession(sessionId, notes = null) {
    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error('Session not found');

    const endedAt = new Date();
    const startedAt = new Date(session.started_at);
    let totalSeconds = Math.floor((endedAt - startedAt) / 1000);

    if (session.is_paused && session.paused_at) {
      const pausedDuration = Math.floor((endedAt - new Date(session.paused_at)) / 1000);
      totalSeconds -= pausedDuration;
    }

    totalSeconds -= session.total_paused_seconds;
    totalSeconds = Math.max(0, totalSeconds);

    const { data, error } = await supabase
      .from('pm_office_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: totalSeconds,
        notes: notes || session.notes,
        is_paused: false,
        paused_at: null
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async pauseSession(sessionId) {
    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.is_paused) throw new Error('Session is already paused');

    const { data, error } = await supabase
      .from('pm_office_sessions')
      .update({
        is_paused: true,
        paused_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async resumeSession(sessionId) {
    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error('Session not found');
    if (!session.is_paused) throw new Error('Session is not paused');

    const now = new Date();
    const pausedAt = new Date(session.paused_at);
    const pausedDuration = Math.floor((now - pausedAt) / 1000);
    const newTotalPaused = session.total_paused_seconds + pausedDuration;

    const { data, error } = await supabase
      .from('pm_office_sessions')
      .update({
        is_paused: false,
        paused_at: null,
        total_paused_seconds: newTotalPaused
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateNotes(sessionId, notes) {
    const { data, error } = await supabase
      .from('pm_office_sessions')
      .update({ notes })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getActiveSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const user = session.user;

    const { data, error } = await supabase
      .from('pm_office_sessions')
      .select('*')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getSessionById(sessionId) {
    const { data, error } = await supabase
      .from('pm_office_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getSessionsForDateRange(startDate, endDate) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];

    const user = session.user;

    const { data, error } = await supabase
      .from('pm_office_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .order('started_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getTodayTotal() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sessions = await this.getSessionsForDateRange(today, tomorrow);
    return sessions.reduce((total, session) => {
      if (session.ended_at) {
        return total + session.duration_seconds;
      }
      return total;
    }, 0);
  },

  async getWeekTotal() {
    const today = new Date();
    const startOfWeek = getWorkweekStart(today);
    const endOfWeek = getWorkweekEnd(today);

    const sessions = await this.getSessionsForDateRange(startOfWeek, endOfWeek);
    return sessions.reduce((total, session) => {
      if (session.ended_at) {
        return total + session.duration_seconds;
      }
      return total;
    }, 0);
  },

  async getMonthTotal() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const sessions = await this.getSessionsForDateRange(startOfMonth, endOfMonth);
    return sessions.reduce((total, session) => {
      if (session.ended_at) {
        return total + session.duration_seconds;
      }
      return total;
    }, 0);
  },

  async getStatistics(days = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const sessions = await this.getSessionsForDateRange(startDate, endDate);

    const completedSessions = sessions.filter(s => s.ended_at);
    const totalSeconds = completedSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
    const avgSeconds = completedSessions.length > 0 ? totalSeconds / completedSessions.length : 0;

    const dailyTotals = {};
    completedSessions.forEach(session => {
      const date = new Date(session.started_at).toLocaleDateString();
      dailyTotals[date] = (dailyTotals[date] || 0) + session.duration_seconds;
    });

    return {
      totalSessions: completedSessions.length,
      totalSeconds,
      averageSeconds: avgSeconds,
      dailyTotals,
      sessions: completedSessions
    };
  },

  calculateCurrentDuration(session) {
    if (!session) return 0;

    const now = new Date();
    const startedAt = new Date(session.started_at);
    let elapsed = Math.floor((now - startedAt) / 1000);

    if (session.is_paused && session.paused_at) {
      const pausedAt = new Date(session.paused_at);
      const currentPauseDuration = Math.floor((now - pausedAt) / 1000);
      elapsed -= currentPauseDuration;
    }

    elapsed -= session.total_paused_seconds;
    return Math.max(0, elapsed);
  }
};
