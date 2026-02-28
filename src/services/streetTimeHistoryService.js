import { supabase } from '../lib/supabase';
import { fetchRestJSON, getAccessTokenFromStorage, withTimeout } from './supabaseRestFallback';
import { deriveOfficeTimeMinutes, findFirst721 } from '../utils/deriveOfficeTime';

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

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const token = getAccessTokenFromStorage();

    // Fetch the route's configured start time (used to derive 722 when it's not explicitly recorded)
    let routeStartTime = '07:30';
    try {
      const { data: routeRow, error: routeErr } = await withTimeout(
        supabase.from('routes').select('start_time').eq('id', currentRouteId).maybeSingle(),
        6000,
        'routes start_time query'
      );
      if (!routeErr && routeRow?.start_time) routeStartTime = routeRow.start_time;
    } catch (e) {
      // Non-fatal; we'll just fall back to default.
      console.warn('[STREET TIME SERVICE] Could not load route start_time; using default 07:30');
    }

    // Filter by CURRENT ROUTE only
    let data = [];
    try {
      const { data: rows, error } = await withTimeout(
        supabase
          .from('operation_codes')
          .select('date, code, duration_minutes, start_time, route_id, session_id, end_time')
          .eq('route_id', currentRouteId)
          .not('end_time', 'is', null)
          .order('date', { ascending: false }),
        8000,
        'operation_codes summary query'
      );
      if (error) throw error;
      data = rows || [];
    } catch (e) {
      console.warn('[STREET TIME SERVICE] Falling back to REST operation_codes summary:', e?.message || e);
      if (supabaseUrl && anonKey) {
        const rows = await fetchRestJSON({
          supabaseUrl,
          anonKey,
          token,
          path: '/rest/v1/operation_codes',
          timeoutMs: 12000,
          label: 'REST operation_codes summary',
          query: {
            select: 'date,code,duration_minutes,start_time,route_id,session_id,end_time',
            route_id: `eq.${currentRouteId}`,
            end_time: 'is.not.null',
            order: 'date.desc',
          },
        });
        data = Array.isArray(rows) ? rows : [];
      } else {
        throw e;
      }
    }

    console.log('[STREET TIME SERVICE] Loaded', data.length, 'operation codes for route', currentRouteId);

    // Group by date and sum durations by code
    const dateMap = new Map();

    data.forEach((record) => {
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
            '744': 0,
          },
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

    // Enrich from route_history (exclude flag + optional stored 722)
    // Then derive 722 from start_time -> first 721 start if needed.
    try {
      const dates = result.map((r) => r.date).filter(Boolean);
      if (dates.length) {
        let rh = [];
        let rhErr = null;
        try {
          const res = await withTimeout(
            supabase
              .from('route_history')
              .select('date, exclude_from_averages, exclusion_reason, actual_office_time, office_722_time, office_time')
              .eq('route_id', currentRouteId)
              .in('date', dates),
            8000,
            'route_history enrich query'
          );
          rh = res?.data || [];
          rhErr = res?.error || null;
        } catch (e) {
          // REST fallback for enrich (optional)
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          const token = getAccessTokenFromStorage();
          if (supabaseUrl && anonKey) {
            const rows = await fetchRestJSON({
              supabaseUrl,
              anonKey,
              token,
              path: '/rest/v1/route_history',
              timeoutMs: 12000,
              label: 'REST route_history enrich',
              query: {
                select: 'date,exclude_from_averages,exclusion_reason,actual_office_time,office_722_time,office_time',
                route_id: `eq.${currentRouteId}`,
                date: `in.(${dates.join(',')})`,
              },
            });
            rh = Array.isArray(rows) ? rows : [];
            rhErr = null;
          } else {
            throw e;
          }
        }

        // Some older DBs may not have newer columns yet; be tolerant.
        if (rhErr) {
          const msg = String(rhErr.message || rhErr);
          if (!msg.includes('exclude_from_averages') && !msg.includes('actual_office_time') && !msg.includes('office_722_time')) {
            throw rhErr;
          }
        }

        const rhMap = new Map((rh || []).map((x) => [x.date, x]));

        result = result.map((r) => {
          const meta = rhMap.get(r.date) || {};

          // Prefer an explicitly stored office-time value if present.
          const stored722 =
            Number(meta.actual_office_time ?? meta.office_722_time ?? meta.office_time ?? 0) || 0;

          const next = {
            ...r,
            exclude_from_averages: !!meta.exclude_from_averages,
            exclusion_reason: meta.exclusion_reason || null,
          };

          if ((next.codes['722'] || 0) <= 0 && stored722 > 0) {
            next.codes['722'] = stored722;
            next.total_minutes += stored722;
          }

          // If we still don't have a 722 value, derive it from route start -> first 721 start.
          if ((next.codes['722'] || 0) <= 0 && next.first_721_start) {
            const derived = deriveOfficeTimeMinutes(routeStartTime, next.first_721_start);
            if (derived > 0) {
              next.codes['722'] = derived;
              next.total_minutes += derived;
            }
          }

          return next;
        });
      }
    } catch (e) {
      console.warn('[STREET TIME SERVICE] Could not enrich route_history:', e?.message || e);

      // Fallback: still try to derive 722 if we can.
      result = result.map((r) => {
        if ((r.codes?.['722'] || 0) <= 0 && r.first_721_start) {
          const derived = deriveOfficeTimeMinutes(routeStartTime, r.first_721_start);
          if (derived > 0) {
            return {
              ...r,
              codes: { ...r.codes, '722': derived },
              total_minutes: (Number(r.total_minutes) || 0) + derived,
            };
          }
        }
        return r;
      });
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

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const token = getAccessTokenFromStorage();

    // Route start time (for derived 722 row)
    let routeStartTime = '07:30';
    try {
      const { data: routeRow, error: routeErr } = await withTimeout(
        supabase.from('routes').select('start_time').eq('id', currentRouteId).maybeSingle(),
        6000,
        'routes start_time query'
      );
      if (!routeErr && routeRow?.start_time) routeStartTime = routeRow.start_time;
    } catch (e) {
      // ignore
    }

    let data = [];
    try {
      const { data: rows, error } = await withTimeout(
        supabase
          .from('operation_codes')
          .select('*')
          .eq('route_id', currentRouteId)
          .eq('date', date)
          .order('start_time', { ascending: true }),
        8000,
        'operation_codes day history query'
      );
      if (error) throw error;
      data = rows || [];
    } catch (e) {
      console.warn('[STREET TIME SERVICE] Falling back to REST operation_codes day history:', e?.message || e);
      if (supabaseUrl && anonKey) {
        const rows = await fetchRestJSON({
          supabaseUrl,
          anonKey,
          token,
          path: '/rest/v1/operation_codes',
          timeoutMs: 12000,
          label: 'REST operation_codes day history',
          query: {
            select: '*',
            route_id: `eq.${currentRouteId}`,
            date: `eq.${date}`,
            order: 'start_time.asc',
          },
        });
        data = Array.isArray(rows) ? rows : [];
      } else {
        throw e;
      }
    }

    console.log('[STREET TIME SERVICE] Loaded', data.length, 'codes for route', currentRouteId, 'date', date);

    // Hide noisy 0-minute rows (usually accidental starts/stops).
    let rows = (data || []).filter((record) => (Number(record.duration_minutes) || 0) > 0);

    // If 722 isn't recorded, synthesize it from route start -> first 721 start.
    const has722 = rows.some((r) => r?.code === '722');
    if (!has722) {
      const first721 = findFirst721(rows);
      if (first721?.start_time) {
        const derived = deriveOfficeTimeMinutes(routeStartTime, first721.start_time);
        if (derived > 0) {
          const endUtc = new Date(first721.start_time);
          const startUtc = new Date(endUtc.getTime() - derived * 60 * 1000);
          rows = [
            {
              id: `derived-722-${date}`,
              route_id: currentRouteId,
              date,
              code: '722',
              start_time: startUtc.toISOString(),
              end_time: endUtc.toISOString(),
              duration_minutes: derived,
              created_at: null,
              updated_at: null,
            },
            ...rows,
          ].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        }
      }
    }

    return rows.map((record) => ({
      ...record,
      code_name: record.code_name || CODE_NAMES[record.code] || 'Unknown',
      duration_formatted: formatDuration(record.duration_minutes),
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
