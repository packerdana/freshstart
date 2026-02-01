import { supabase } from '../lib/supabase';

export async function fetchWaypointHistory(routeId, daysBack = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    console.log(`[WAYPOINT HISTORY] Fetching deliveries for route ${routeId} since ${cutoffDateStr}`);

    const { data: deliveries, error } = await supabase
      .from('waypoints')
      .select('date, address, delivery_time, sequence_number')
      .eq('route_id', routeId)
      .eq('status', 'completed')
      .gte('date', cutoffDateStr)
      .order('date', { ascending: false })
      .order('sequence_number', { ascending: true });

    if (error) {
      console.error('[WAYPOINT HISTORY] Error fetching deliveries:', error);
      return [];
    }

    if (!deliveries || deliveries.length === 0) {
      console.log('[WAYPOINT HISTORY] No historical delivery data found for this route');
      return [];
    }

    console.log(`[WAYPOINT HISTORY] Found ${deliveries.length} delivery records across multiple dates`);

    const historyByDate = groupDeliveriesByDate(deliveries);

    console.log(`[WAYPOINT HISTORY] Processed ${historyByDate.length} days of data`);

    return historyByDate;
  } catch (error) {
    console.error('[WAYPOINT HISTORY] Unexpected error:', error);
    return [];
  }
}

function groupDeliveriesByDate(deliveries) {
  const dateGroups = {};

  deliveries.forEach(delivery => {
    if (!dateGroups[delivery.date]) {
      dateGroups[delivery.date] = [];
    }
    dateGroups[delivery.date].push(delivery);
  });

  const result = [];

  Object.entries(dateGroups).forEach(([date, dayDeliveries]) => {
    // Sort by sequence number to ensure proper order
    dayDeliveries.sort((a, b) => a.sequence_number - b.sequence_number);

    // Filter to only completed deliveries with valid times
    const completedDeliveries = dayDeliveries.filter(d => d.delivery_time);

    if (completedDeliveries.length === 0) {
      console.warn(`[WAYPOINT HISTORY] No completed deliveries for ${date}, skipping`);
      return;
    }

    // Find the start waypoint (sequence 0 or first with "leave"/"post office")
    const startDelivery = completedDeliveries.find(d =>
      d.sequence_number === 0 ||
      d.address.toLowerCase().includes('leave') ||
      d.address.toLowerCase().includes('post office')
    ) || completedDeliveries[0];

    if (!startDelivery || !startDelivery.delivery_time) {
      console.warn(`[WAYPOINT HISTORY] No valid start time for ${date}, skipping`);
      return;
    }

    const startTime = new Date(startDelivery.delivery_time);

    // ✅ FIX: Calculate duration FROM PREVIOUS WAYPOINT, not from start
    const waypoint_timings = [];
    let previousTime = startTime;

    completedDeliveries.forEach((delivery, index) => {
      const deliveryTime = new Date(delivery.delivery_time);
      
      // Calculate duration from PREVIOUS waypoint (not from start!)
      const durationFromPreviousMs = deliveryTime - previousTime;
      const durationFromPreviousMinutes = Math.round(durationFromPreviousMs / (1000 * 60));
      
      // Also calculate cumulative time from start (for reference/debugging)
      const cumulativeMs = deliveryTime - startTime;
      const cumulativeMinutes = Math.round(cumulativeMs / (1000 * 60));

      waypoint_timings.push({
        name: delivery.address,
        durationFromPrevious: Math.max(0, durationFromPreviousMinutes), // ← DURATION!
        cumulativeFromStart: Math.max(0, cumulativeMinutes), // ← For reference
        timestamp: delivery.delivery_time,
        sequence: delivery.sequence_number,
        isStart: index === 0
      });

      // Update previous time for next waypoint
      previousTime = deliveryTime;
    });

    console.log(`[WAYPOINT HISTORY] ${date}: Calculated durations for ${waypoint_timings.length} waypoints`);

    result.push({
      date,
      waypoint_timings
    });
  });

  return result;
}

export function calculateWaypointAveragesFromDeliveries(history, waypointName = null) {
  if (!history || history.length === 0) {
    console.log('[WAYPOINT HISTORY] No history data to calculate averages from');
    return null;
  }

  console.log(`[WAYPOINT HISTORY] Calculating duration averages from ${history.length} days of data`);

  if (waypointName) {
    // Calculate average for single waypoint
    const waypointData = [];

    history.forEach(day => {
      const waypoint = day.waypoint_timings?.find(w => w.name === waypointName);
      if (waypoint && typeof waypoint.durationFromPrevious === 'number') {
        waypointData.push(waypoint.durationFromPrevious);
      }
    });

    if (waypointData.length === 0) {
      return null;
    }

    const avgDuration = waypointData.reduce((sum, time) => sum + time, 0) / waypointData.length;

    return {
      name: waypointName,
      averageDuration: Math.round(avgDuration), // ← DURATION FROM PREVIOUS!
      sampleSize: waypointData.length,
      confidence: waypointData.length >= 10 ? 'high' : waypointData.length >= 5 ? 'medium' : 'low'
    };
  }

  // Calculate averages for all waypoints
  const waypointMap = new Map();

  history.forEach(day => {
    if (!day.waypoint_timings) return;

    day.waypoint_timings.forEach(waypoint => {
      if (!waypointMap.has(waypoint.name)) {
        waypointMap.set(waypoint.name, []);
      }
      if (typeof waypoint.durationFromPrevious === 'number') {
        waypointMap.get(waypoint.name).push(waypoint.durationFromPrevious);
      }
    });
  });

  const averages = [];
  waypointMap.forEach((durations, name) => {
    if (durations.length === 0) return;

    const avgDuration = durations.reduce((sum, time) => sum + time, 0) / durations.length;
    
    averages.push({
      name,
      averageDuration: Math.round(avgDuration), // ← DURATION FROM PREVIOUS!
      sampleSize: durations.length,
      confidence: durations.length >= 10 ? 'high' : durations.length >= 5 ? 'medium' : 'low'
    });
  });

  console.log(`[WAYPOINT HISTORY] Calculated duration averages for ${averages.length} waypoints:`,
    averages.map(a => `${a.name}: ${a.averageDuration}min from prev (n=${a.sampleSize})`).join(', '));

  return averages;
}
