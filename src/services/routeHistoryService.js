import { supabase } from '../lib/supabase';
import { calculatePenaltyOT, getWorkweekStart, getWorkweekEnd } from '../utils/uspsConstants';

export async function saveRouteHistory(routeId, historyData, waypoints = null) {
  if (!routeId || routeId === 'temp-route-id') {
    console.warn('No valid route ID - route history not saved to database');
    return null;
  }

  let waypointTimings = [];
  if (waypoints && waypoints.length > 0) {
    const startTime = historyData.startTime || historyData.leaveOfficeTime;
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
    .gte('date', weekStart.toISOString().split('T')[0])
    .lt('date', weekEnd.toISOString().split('T')[0])
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

  const { data, error } = await supabase
    .from('route_history')
    .upsert({
      route_id: routeId,
      date: historyData.date,
      dps: historyData.dps || 0,
      flats: historyData.flats || 0,
      letters: historyData.letters || 0,
      parcels: historyData.parcels || 0,
      spurs: historyData.sprs || 0,
      curtailed: historyData.curtailed || 0,
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
      waypoint_timings: waypointTimings,
      penalty_overtime: penaltyOvertimeMinutes,
      is_ns_day: isNSDay,
      weekly_hours: weeklyHours,
    }, {
      onConflict: 'route_id,date'
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error saving route history:', error);
    throw error;
  }

  return data;
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

  return data;
}

export async function getRouteHistory(routeId, limit = 30) {
  const { data, error } = await supabase
    .from('route_history')
    .select('*')
    .eq('route_id', routeId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching route history:', error);
    throw error;
  }

  return data || [];
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

  return data;
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated to create a route');
  }

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

export async function getUserRoutes() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user routes:', error);
    throw error;
  }

  return data || [];
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const today = new Date();
  const weekStart = getWorkweekStart(today);
  const weekEnd = getWorkweekEnd(today);

  const startDateStr = weekStart.toISOString().split('T')[0];
  const endDateStr = weekEnd.toISOString().split('T')[0];

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
