import { supabase } from '../lib/supabase';

/**
 * Street Time History Service
 * Manages operation codes (722, 721, 736, 732, 744) history retrieval
 * Filters by current route ID to show only relevant data
 */

const CODE_NAMES = {
  '722': 'AM Office',
  '721': 'Street Time',
  '736': 'Relay Assistance',
  '732': 'Collections',
  '744': 'PM Office'
};

/**
 * Get street time summary grouped by date
 * Filters to current route only
 * @param {string} currentRouteId - UUID of current route
 * @returns {Promise<Array>} Array of date summaries
 */
export async function getStreetTimeSummaryByDate(currentRouteId) {
  try {
    if (!currentRouteId) {
      console.warn('[STREET TIME SERVICE] No route ID provided');
      return [];
    }

    // Filter by CURRENT ROUTE only
    const { data, error } = await supabase
      .from('operation_codes')
      .select('date, code, duration_minutes, start_time, route_id, session_id')
      .eq('route_id', currentRouteId)
      .not('end_time', 'is', null)
      .order('date', { ascending: false });

    if (error) throw error;

    console.log('[STREET TIME SERVICE] Loaded', data.length, 'operation codes for route', currentRouteId);

    // Group by date and sum durations by code
    const dateMap = new Map();

    data.forEach(record => {
      if (!dateMap.has(record.date)) {
        dateMap.set(record.date, {
          date: record.date,
          route_id: record.route_id,
          session_id: record.session_id,
          total_minutes: 0,
          first_721_start: null,
          codes: {
            '722': 0,
            '721': 0,
            '736': 0,
            '732': 0,
            '744': 0
          }
        });
      }

      const daySummary = dateMap.get(record.date);
      const duration = parseFloat(record.duration_minutes) || 0;
      
      daySummary.codes[record.code] = (daySummary.codes[record.code] || 0) + duration;
      daySummary.total_minutes += duration;

      // Track earliest street start for derived 722 (office time)
      if (record.code === '721' && record.start_time) {
        const cur = daySummary.first_721_start;
        if (!cur || new Date(record.start_time) < new Date(cur)) {
          daySummary.first_721_start = record.start_time;
        }
      }
    });

    let result = Array.from(dateMap.values());

    // Enrich with route_history.exclude_from_averages so the UI can flag bad days.
    try {
      const dates = result.map((r) => r.date).filter(Boolean);
      if (dates.length) {
        // Some older DBs may not have exclude_from_averages yet; handle gracefully.
        const { data: rh, error: rhErr } = await supabase
          .from('route_history')
          .select('date, exclude_from_averages')
          .eq('route_id', currentRouteId)
          .in('date', dates);

        if (rhErr) {
          const msg = String(rhErr.message || rhErr);
          if (!msg.includes('exclude_from_averages')) {
            throw rhErr;
          }
        }

        const map = new Map((rh || []).map((x) => [x.date, !!x.exclude_from_averages]));
        result = result.map((r) => ({
          ...r,
          exclude_from_averages: map.get(r.date) || false,
        }));
      }
    } catch (e) {
      console.warn('[STREET TIME SERVICE] Could not enrich exclude_from_averages:', e?.message || e);
    }

    console.log('[STREET TIME SERVICE] Grouped into', result.length, 'days');
    
    return result;
  } catch (error) {
    console.error('Failed to load street time summary:', error);
    throw error;
  }
}

/**
 * Get detailed operation codes for a specific date
 * Filters to current route only
 * @param {string} currentRouteId - UUID of current route
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of operation code records
 */
export async function getOperationCodesForDate(currentRouteId, date) {
  try {
    if (!currentRouteId) {
      console.warn('[STREET TIME SERVICE] No route ID provided for date', date);
      return [];
    }

    const { data, error } = await supabase
      .from('operation_codes')
      .select('*')
      .eq('route_id', currentRouteId)
      .eq('date', date)
      .order('start_time', { ascending: true });

    if (error) throw error;

    console.log('[STREET TIME SERVICE] Loaded', data.length, 'codes for route', currentRouteId, 'date', date);

    // Hide noisy 0-minute rows (usually accidental starts/stops).
    return (data || [])
      .filter((record) => (Number(record.duration_minutes) || 0) > 0)
      .map(record => ({
        ...record,
        code_name: CODE_NAMES[record.code] || 'Unknown',
        duration_formatted: formatDuration(record.duration_minutes)
      }));
  } catch (error) {
    console.error('Failed to load operation codes for date:', error);
    throw error;
  }
}

/**
 * Check if day_state_backup exists for a date
 * @param {string} currentRouteId - UUID of current route (not used, kept for compatibility)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<boolean>} True if day state exists
 */
export async function hasDayStateBackup(currentRouteId, date) {
  try {
    // Note: day_state_backup uses session_id, not route_id
    // Check if ANY backup exists for this date
    const { data, error } = await supabase
      .from('day_state_backup')
      .select('id')
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Failed to check day state backup:', error);
    return false;
  }
}

/**
 * Format duration minutes to hours and minutes
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted string like "2:45"
 */
function formatDuration(minutes) {
  if (!minutes) return '0:00';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

export { CODE_NAMES, formatDuration };
