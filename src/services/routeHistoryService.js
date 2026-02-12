import { supabase } from '../lib/supabase';
import { fetchRestJSON, getAccessTokenFromStorage, withTimeout } from './supabaseRestFallback';

import { calculatePenaltyOT, getWorkweekStart, getWorkweekEnd } from '../utils/uspsConstants';
import { toLocalDateKey } from '../utils/dateKey';

/**
 * Convert snake_case database fields to camelCase for prediction service
 * This ensures historical data works with calculateSmartPrediction()
 */
function convertHistoryFieldNames(dbRecord) {
  if (!dbRecord) return null;
  
  return {
    id: dbRecord.id,
    routeId: dbRecord.route_id,
    date: dbRecord.date,
    dps: dbRecord.dps,
    flats: dbRecord.flats,
    letters: dbRecord.letters,
    parcels: dbRecord.parcels,
    sprs: dbRecord.spurs, // Note: database uses 'spurs', code uses 'sprs'
    curtailed: dbRecord.curtailed,
    curtailedLetters: dbRecord.curtailed_letters,
    curtailedFlats: dbRecord.curtailed_flats,
    safetyTalk: dbRecord.safety_talk,
    streetTime: dbRecord.street_time,
    streetTimeNormalized: dbRecord.street_time_normalized,
    officeTime: dbRecord.office_time,
    dayType: dbRecord.day_type,
    overtime: dbRecord.overtime,
    auxiliaryAssistance: dbRecord.auxiliary_assistance,
    mailNotDelivered: dbRecord.mail_not_delivered,
    notes: dbRecord.notes,
    pmOfficeTime: dbRecord.pm_office_time,
    waypointTimings: dbRecord.waypoint_timings,
    penaltyOvertime: dbRecord.penalty_overtime,
    isNsDay: dbRecord.is_ns_day,
    weeklyHours: dbRecord.weekly_hours,
    predictedLeaveTime: dbRecord.predicted_leave_time,
    actualLeaveTime: dbRecord.actual_leave_time,
    predictedOfficeTime: dbRecord.predicted_office_time,
    actualOfficeTime: dbRecord.actual_office_time,
    casingWithdrawalMinutes: dbRecord.casing_withdrawal_minutes,
    dailyLog: dbRecord.daily_log,
    hasBoxholder: dbRecord.has_boxholder,
    casedBoxholder: dbRecord.cased_boxholder,
    casedBoxholderType: dbRecord.cased_boxholder_type,
    predictedReturnTime: dbRecord.predicted_return_time,
    actualClockOut: dbRecord.actual_clock_out,
    assistanceMinutes: dbRecord.assistance_minutes,
    excludeFromAverages: !!dbRecord.exclude_from_averages,
    createdAt: dbRecord.created_at,
    updatedAt: dbRecord.updated_at,
  };
}

export async function saveRouteHistory(routeId, historyData, waypoints = null) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error('Not authenticated (cannot save route history). Please sign in again.');
  }

  if (!routeId || routeId === 'temp-route-id') {
    console.warn('No valid route ID - route history not saved to database');
    return null;
  }

  let waypointTimings = [];
  if (waypoints && waypoints.length > 0) {
    // Choose a reliable "leave office" timestamp to compute waypoint elapsed minutes.
    // Prefer ISO timestamps when available.
    const startTime =
      historyData.startTime ||
      historyData.leaveOfficeTime ||
      historyData.actualLeaveTime ||
      historyData.streetTimerStartTime;
    waypointTimings = waypoints
      .filter(wp => wp.status === 'completed' && wp.completedAt)
      .map(wp => {
        const elapsedMinutes = startTime
          ? Math.round((new Date(wp.completedAt) - new Date(startTime)) / (1000 * 60))
          : 0;

        return {
          id: wp.id,
          name: wp.name,
          order: wp.order,
          completedAt: wp.completedAt,
          elapsedMinutes
        };
      });
  }

  const { data: route } = await supabase
    .from('routes')
    .select('tour_length')
    .eq('id', routeId)
    .maybeSingle();

  const tourLength = route?.tour_length || 8.5;
  const officeTime = (historyData.officeTime || 0) + (historyData.pmOfficeTime || 0);
  const streetTime = historyData.streetTime || 0;
  const totalHours = (officeTime + streetTime) / 60;

  const weekStart = getWorkweekStart(new Date(historyData.date));
  const weekEnd = getWorkweekEnd(new Date(historyData.date));

  const { data: weekHistory } = await supabase
    .from('route_history')
    .select('office_time, pm_office_time, street_time, street_time_normalized')
    .eq('route_id', routeId)
    .gte('date', toLocalDateKey(weekStart))
    .lt('date', toLocalDateKey(weekEnd))
    .neq('date', historyData.date);

  let weeklyHours = totalHours;
  if (weekHistory && weekHistory.length > 0) {
    weeklyHours += weekHistory.reduce((sum, day) => {
      const dayOffice = (day.office_time || 0) + (day.pm_office_time || 0);
      const dayStreet = day.street_time_normalized || day.street_time || 0;
      return sum + (dayOffice + dayStreet) / 60;
    }, 0);
  }

  const isNSDay = historyData.isNSDay || false;
  const penaltyCalc = calculatePenaltyOT(totalHours, tourLength, weeklyHours, isNSDay);
  const penaltyOvertimeMinutes = Math.round(penaltyCalc.penaltyOT * 60);

  const basePayload = {
    route_id: routeId,
    date: historyData.date,
    dps: historyData.dps || 0,
    flats: historyData.flats || 0,
    letters: historyData.letters || 0,
    parcels: historyData.parcels || 0,
    spurs: historyData.sprs || 0,
    curtailed: historyData.curtailed || 0,
    curtailed_letters: Number(historyData.curtailedLetters || 0) || 0,
    curtailed_flats: Number(historyData.curtailedFlats || 0) || 0,
    safety_talk: historyData.safetyTalk || 0,
    street_time: Math.round(historyData.streetTime || 0),
    street_time_normalized: historyData.streetTimeNormalized ? Math.round(historyData.streetTimeNormalized) : null,
    office_time: Math.round(historyData.officeTime || 0),
    day_type: historyData.dayType || 'normal',
    overtime: Math.round(historyData.overtime || 0),
    auxiliary_assistance: historyData.auxiliaryAssistance || false,
    mail_not_delivered: historyData.mailNotDelivered || false,
    notes: historyData.notes || null,
    pm_office_time: Math.round(historyData.pmOfficeTime || 0),
    has_boxholder: !!historyData.hasBoxholder,
    cased_boxholder: !!historyData.casedBoxholder,
    cased_boxholder_type: historyData.casedBoxholderType || null,
    waypoint_timings: waypointTimings,
    penalty_overtime: penaltyOvertimeMinutes,
    is_ns_day: isNSDay,
    weekly_hours: weeklyHours,
    predicted_leave_time: historyData.predictedLeaveTime || null,
    actual_leave_time: historyData.actualLeaveTime || null,
    predicted_office_time: historyData.predictedOfficeTime ? Math.round(historyData.predictedOfficeTime) : null,
    actual_office_time: historyData.actualOfficeTime ? Math.round(historyData.actualOfficeTime) : null,

    // Prediction accuracy chart support (stored as HH:MM)
    predicted_return_time: historyData.predictedReturnTime || null,
    actual_clock_out: historyData.actualClockOut || null,

    // Assistance tracking
    assistance_minutes: historyData.assistanceMinutes != null ? Math.round(Number(historyData.assistanceMinutes) || 0) : null,
  };

  const extendedPayload = {
    ...basePayload,
    casing_withdrawal_minutes: historyData.casingWithdrawalMinutes != null ? Math.round(historyData.casingWithdrawalMinutes) : null,
    daily_log: historyData.dailyLog ?? null,
  };

  const tryUpsert = async (payload) => {
    return supabase
      .from('route_history')
      .upsert(payload, { onConflict: 'route_id,date' })
      .select()
      .maybeSingle();
  };

  let data;
  let error;

  // First try with extended columns.
  ({ data, error } = await tryUpsert(extendedPayload));

  // If the DB schema hasn't been migrated yet (common in early testing), retry without new columns.
  if (error) {
    const msg = String(error.message || error);
    const missingCasingCol = msg.includes("casing_withdrawal_minutes") && msg.includes('schema cache');
    const missingDailyLogCol = msg.includes("daily_log") && msg.includes('schema cache');

    if (missingCasingCol || missingDailyLogCol) {
      console.warn('Route history save: DB missing new column(s); retrying without them. Error:', msg);
      ({ data, error } = await tryUpsert(basePayload));
    }
  }

  if (error) {
    console.error('Error saving route history:', error);
    throw error;
  }

  return convertHistoryFieldNames(data);
}

export async function updateRouteHistory(id, updates) {
  const { data, error } = await supabase
    .from('route_history')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating route history:', error);
    throw error;
  }

  // Convert to camelCase before returning
  return convertHistoryFieldNames(data);
}

export async function getRouteHistory(routeId, limit = 30) {
  // supabase-js can hang in some browsers; use a timeout + REST fallback.
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('route_history')
        .select('*')
        .eq('route_id', routeId)
        .order('date', { ascending: false })
        .limit(limit),
      8000,
      'route_history query'
    );

    if (error) throw error;
    return (data || []).map(convertHistoryFieldNames);
  } catch (e) {
    console.warn('[getRouteHistory] Falling back to REST:', e?.message || e);
    if (!supabaseUrl || !supabaseAnonKey) throw e;

    const token = getAccessTokenFromStorage();
    const rows = await fetchRestJSON({
      supabaseUrl,
      anonKey: supabaseAnonKey,
      path: '/rest/v1/route_history',
      token,
      timeoutMs: 12000,
      label: 'REST route_history fetch',
      query: {
        select: '*',
        route_id: `eq.${routeId}`,
        order: 'date.desc',
        limit: String(limit),
      },
    });

    return (Array.isArray(rows) ? rows : []).map(convertHistoryFieldNames);
  }
}

export async function getTodayRouteHistory(routeId, date) {
  const { data, error } = await supabase
    .from('route_history')
    .select('*')
    .eq('route_id', routeId)
    .eq('date', date)
    .maybeSingle();

  if (error) {
    console.error('Error fetching today route history:', error);
    throw error;
  }

  // Convert to camelCase before returning
  return convertHistoryFieldNames(data);
}

export async function ensureRouteHistoryDay(routeId, date) {
  if (!routeId || !date) throw new Error('Missing routeId/date');

  // Create a minimal record so Fix-a-Day works even if End Tour never ran.
  const { data, error } = await supabase
    .from('route_history')
    .upsert(
      {
        route_id: routeId,
        date,
      },
      { onConflict: 'route_id,date' }
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error ensuring route history day:', error);
    throw error;
  }

  return convertHistoryFieldNames(data);
}

export async function deleteRouteHistory(id) {
  const { error } = await supabase
    .from('route_history')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting route history:', error);
    throw error;
  }

  return true;
}

export async function createRoute(routeData) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User must be authenticated to create a route');
  }

  const user = session.user;

  const { data, error } = await supabase
    .from('routes')
    .insert({
      user_id: user.id,
      route_number: routeData.routeNumber,
      start_time: routeData.startTime || '07:30',
      tour_length: parseFloat(routeData.tourLength) || 8.5,
      lunch_duration: parseInt(routeData.lunchDuration) || 30,
      comfort_stop_duration: parseInt(routeData.comfortStopDuration) || 10,
      manual_street_time: routeData.manualStreetTime ? parseInt(routeData.manualStreetTime) : null,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating route:', error);
    throw error;
  }

  return data;
}

export async function getUserRoutes(explicitUserId = null) {
  // IMPORTANT: Do not block route loading on supabase.auth.getSession().
  // On some devices/browsers, getSession can hang or time out.
  // Use getUser() (local) to get the user id, then query routes.

  const withTimeoutUser = (p, ms) => withTimeout(p, ms, 'getUser');

  let userId = explicitUserId || null;

  if (!userId) {
    try {
      const res = await withTimeoutUser(supabase.auth.getUser(), 6000);
      userId = res?.data?.user?.id || null;
    } catch {
      userId = null;
    }
  }

  if (!userId) {
    console.warn('[getUserRoutes] No userId available; returning empty routes');
    return [];
  }

  console.log('[getUserRoutes] Loading routes for userId:', userId);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Prefer supabase-js, but it has been hanging for some users even while REST works.
  const withTimeoutRoutes = (p, ms) => withTimeout(p, ms, 'routes query');

  try {
    const { data, error, status } = await withTimeoutRoutes(
      supabase
        .from('routes')
        .select('*')
        .eq('user_id', userId)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false }),
      8000
    );

    console.log('[getUserRoutes] supabase-js routes response:', {
      status: status || error?.status || null,
      count: Array.isArray(data) ? data.length : null,
      error: error?.message || null,
    });

    if (error) throw error;
    return data || [];
  } catch (e) {
    // Fallback to direct REST fetch using the stored access token.
    console.warn('[getUserRoutes] Falling back to REST:', e?.message || e);

    if (!supabaseUrl || !supabaseAnonKey) throw e;

    const token = getAccessTokenFromStorage();
    const rows = await fetchRestJSON({
      supabaseUrl,
      anonKey: supabaseAnonKey,
      path: '/rest/v1/routes',
      token,
      timeoutMs: 12000,
      label: 'REST routes fetch',
      query: {
        select: '*',
        user_id: `eq.${userId}`,
        order: 'is_active.desc,created_at.desc',
      },
    });
    console.log('[getUserRoutes] REST routes response:', { count: Array.isArray(rows) ? rows.length : null });
    return Array.isArray(rows) ? rows : [];
  }
}

export async function updateRoute(routeId, updates) {
  const updateData = {
    updated_at: new Date().toISOString(),
  };

  if (updates.routeNumber !== undefined) updateData.route_number = updates.routeNumber;
  if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
  if (updates.tourLength !== undefined) updateData.tour_length = parseFloat(updates.tourLength);
  if (updates.lunchDuration !== undefined) updateData.lunch_duration = parseInt(updates.lunchDuration);
  if (updates.comfortStopDuration !== undefined) updateData.comfort_stop_duration = parseInt(updates.comfortStopDuration);
  if (updates.manualStreetTime !== undefined) updateData.manual_street_time = updates.manualStreetTime ? parseInt(updates.manualStreetTime) : null;

  const { data, error } = await supabase
    .from('routes')
    .update(updateData)
    .eq('id', routeId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating route:', error);
    throw error;
  }

  return data;
}

export async function deleteRoute(routeId) {
  const { error } = await supabase
    .from('routes')
    .delete()
    .eq('id', routeId);

  if (error) {
    console.error('Error deleting route:', error);
    throw error;
  }

  return true;
}

export async function getWeekTotalMinutes() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return 0;

  const user = session.user;

  const today = new Date();
  const weekStart = getWorkweekStart(today);
  const weekEnd = getWorkweekEnd(today);

  const startDateStr = toLocalDateKey(weekStart);
  const endDateStr = toLocalDateKey(weekEnd);

  const { data, error } = await supabase
    .from('route_history')
    .select('office_time, street_time, pm_office_time')
    .gte('date', startDateStr)
    .lt('date', endDateStr);

  if (error) {
    console.error('Error fetching week total:', error);
    return 0;
  }

  const totalMinutes = (data || []).reduce((sum, day) => {
    const officeTime = day.office_time || 0;
    const streetTime = day.street_time || 0;
    const pmOfficeTime = day.pm_office_time || 0;
    return sum + officeTime + streetTime + pmOfficeTime;
  }, 0);

  return totalMinutes;
}
