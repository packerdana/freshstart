import { supabase } from '../lib/supabase';
import { getLocalDateString } from '../utils/time';
import { getWaypointsForRoute, bulkCreateWaypoints, deleteAllWaypoints } from './waypointsService';

export const getHistoricalWaypoints = async (routeId, fromDate = null, toDate = null) => {
  try {
    let query = supabase
      .from('waypoints')
      .select('*')
      .eq('route_id', routeId)
      .order('date', { ascending: false })
      .order('sequence_number', { ascending: true });

    if (fromDate) {
      query = query.gte('date', fromDate);
    }
    if (toDate) {
      query = query.lte('date', toDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching historical waypoints:', error);
    throw error;
  }
};

export const getAllUniqueDatesWithWaypoints = async (routeId) => {
  try {
    const { data, error } = await supabase
      .from('waypoints')
      .select('date')
      .eq('route_id', routeId)
      .order('date', { ascending: false });

    if (error) throw error;

    const uniqueDates = [...new Set(data.map(item => item.date))];
    return uniqueDates;
  } catch (error) {
    console.error('Error fetching unique dates:', error);
    throw error;
  }
};

export const getWaypointSummaryByDate = async (routeId) => {
  try {
    const { data, error } = await supabase
      .from('waypoints')
      .select('date, status')
      .eq('route_id', routeId)
      .order('date', { ascending: false });

    if (error) throw error;

    const summaryMap = {};

    data.forEach(item => {
      if (!summaryMap[item.date]) {
        summaryMap[item.date] = {
          date: item.date,
          total: 0,
          completed: 0,
          pending: 0
        };
      }

      summaryMap[item.date].total += 1;
      if (item.status === 'completed') {
        summaryMap[item.date].completed += 1;
      } else if (item.status === 'pending') {
        summaryMap[item.date].pending += 1;
      }
    });

    return Object.values(summaryMap);
  } catch (error) {
    console.error('Error fetching waypoint summary:', error);
    throw error;
  }
};

export const recoverWaypointsFromDate = async (routeId, sourceDate, targetDate = null) => {
  try {
    const today = targetDate || getLocalDateString();

    const historicalWaypoints = await getWaypointsForRoute(routeId, sourceDate);

    if (historicalWaypoints.length === 0) {
      throw new Error(`No waypoints found for ${sourceDate}`);
    }

    await deleteAllWaypoints(routeId, today);

    const recoveredWaypoints = historicalWaypoints.map(waypoint => ({
      route_id: routeId,
      date: today,
      sequence_number: waypoint.sequence_number,
      address: waypoint.address,
      notes: waypoint.notes,
      status: 'pending',
      delivery_time: null
    }));

    const created = await bulkCreateWaypoints(recoveredWaypoints);

    return {
      success: true,
      count: created.length,
      waypoints: created
    };
  } catch (error) {
    console.error('Error recovering waypoints:', error);
    throw error;
  }
};

export const copyWaypointsToToday = async (routeId, sourceDate) => {
  return recoverWaypointsFromDate(routeId, sourceDate);
};

export const getWaypointStatsByDateRange = async (routeId, fromDate, toDate) => {
  try {
    const { data, error } = await supabase
      .from('waypoints')
      .select('date, status, delivery_time')
      .eq('route_id', routeId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true });

    if (error) throw error;

    const stats = {
      totalDays: 0,
      totalWaypoints: data.length,
      totalCompleted: 0,
      averageCompletionRate: 0,
      dateRange: { from: fromDate, to: toDate }
    };

    const dateMap = {};
    data.forEach(waypoint => {
      if (!dateMap[waypoint.date]) {
        dateMap[waypoint.date] = { total: 0, completed: 0 };
      }
      dateMap[waypoint.date].total += 1;
      if (waypoint.status === 'completed') {
        dateMap[waypoint.date].completed += 1;
        stats.totalCompleted += 1;
      }
    });

    stats.totalDays = Object.keys(dateMap).length;
    stats.averageCompletionRate = stats.totalWaypoints > 0
      ? ((stats.totalCompleted / stats.totalWaypoints) * 100).toFixed(1)
      : 0;

    return stats;
  } catch (error) {
    console.error('Error fetching waypoint stats:', error);
    throw error;
  }
};

export const verifyHistoricalDataExists = async (routeId, date) => {
  try {
    const waypoints = await getWaypointsForRoute(routeId, date);

    const { data: historyData, error: historyError } = await supabase
      .from('route_history')
      .select('id, waypoint_timings')
      .eq('route_id', routeId)
      .eq('date', date)
      .maybeSingle();

    if (historyError && historyError.code !== 'PGRST116') {
      throw historyError;
    }

    return {
      hasWaypoints: waypoints.length > 0,
      waypointCount: waypoints.length,
      hasHistory: !!historyData,
      hasTimingData: !!(historyData?.waypoint_timings)
    };
  } catch (error) {
    console.error('Error verifying historical data:', error);
    throw error;
  }
};
