import { supabase } from '../lib/supabase';

/**
 * Street Time History Service
 * Manages operation codes (722, 721, 736, 732, 744) history retrieval
 * Filters to only packerdana sessions
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
 * Filters to only packerdana sessions
 * @returns {Promise<Array>} Array of date summaries
 */
export async function getStreetTimeSummaryByDate() {
  try {
    // Filter to ONLY packerdana sessions
    const { data, error } = await supabase
      .from('operation_codes')
      .select('date, code, duration_minutes, route_id, session_id')
      .like('session_id', '%packerdana%')  // ← CRITICAL FILTER
      .not('end_time', 'is', null)
      .order('date', { ascending: false });

    if (error) throw error;

    console.log('[STREET TIME SERVICE] Loaded', data.length, 'operation codes for packerdana');

    // Group by date and sum durations by code
    const dateMap = new Map();

    data.forEach(record => {
      if (!dateMap.has(record.date)) {
        dateMap.set(record.date, {
          date: record.date,
          route_id: record.route_id,
          total_minutes: 0,
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
      
      // Update route_id if not set yet
      if (!daySummary.route_id && record.route_id) {
        daySummary.route_id = record.route_id;
      }
    });

    const result = Array.from(dateMap.values());
    console.log('[STREET TIME SERVICE] Grouped into', result.length, 'days');
    
    return result;
  } catch (error) {
    console.error('Failed to load street time summary:', error);
    throw error;
  }
}

/**
 * Get detailed operation codes for a specific date
 * Filters to only packerdana sessions
 * @param {string} sessionId - Ignored (kept for API compatibility)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of operation code records
 */
export async function getOperationCodesForDate(sessionId, date) {
  try {
    // Filter to ONLY packerdana sessions for this date
    const { data, error } = await supabase
      .from('operation_codes')
      .select('*')
      .like('session_id', '%packerdana%')  // ← CRITICAL FILTER
      .eq('date', date)
      .order('start_time', { ascending: true });

    if (error) throw error;

    console.log('[STREET TIME SERVICE] Loaded', data.length, 'codes for date', date);

    // Add code names and format durations
    return data.map(record => ({
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
 * @param {string} sessionId - User's session ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<boolean>} True if day state exists
 */
export async function hasDayStateBackup(sessionId, date) {
  try {
    const { data, error } = await supabase
      .from('day_state_backup')
      .select('id')
      .like('session_id', '%packerdana%')  // ← Filter here too
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
