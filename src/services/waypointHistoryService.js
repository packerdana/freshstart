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
    dayDeliveries.sort((a, b) => a.sequence_number - b.sequence_number);

    const startDelivery = dayDeliveries.find(d =>
      d.address.toLowerCase().includes('leave') ||
      d.address.toLowerCase().includes('post office')
    ) || dayDeliveries[0];

    if (!startDelivery || !startDelivery.delivery_time) {
      console.warn(`[WAYPOINT HISTORY] No valid start time for ${date}, skipping`);
      return;
    }

    const startTime = new Date(startDelivery.delivery_time);

    const waypoint_timings = dayDeliveries
      .filter(d => d.delivery_time)
      .map(delivery => {
        const deliveryTime = new Date(delivery.delivery_time);
        const elapsedMs = deliveryTime - startTime;
        const elapsedMinutes = Math.round(elapsedMs / (1000 * 60));

        return {
          name: delivery.address,
          elapsedMinutes: Math.max(0, elapsedMinutes),
          timestamp: delivery.delivery_time,
          sequence: delivery.sequence_number
        };
      });

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

  console.log(`[WAYPOINT HISTORY] Calculating averages from ${history.length} days of data`);

  if (waypointName) {
    const waypointData = [];

    history.forEach(day => {
      const waypoint = day.waypoint_timings?.find(w => w.name === waypointName);
      if (waypoint && typeof waypoint.elapsedMinutes === 'number') {
        waypointData.push(waypoint.elapsedMinutes);
      }
    });

    if (waypointData.length === 0) {
      return null;
    }

    const avgTime = waypointData.reduce((sum, time) => sum + time, 0) / waypointData.length;

    return {
      name: waypointName,
      averageMinutes: Math.round(avgTime),
      sampleSize: waypointData.length,
      confidence: waypointData.length >= 10 ? 'high' : waypointData.length >= 5 ? 'medium' : 'low'
    };
  }

  const waypointMap = new Map();

  history.forEach(day => {
    if (!day.waypoint_timings) return;

    day.waypoint_timings.forEach(waypoint => {
      if (!waypointMap.has(waypoint.name)) {
        waypointMap.set(waypoint.name, []);
      }
      if (typeof waypoint.elapsedMinutes === 'number') {
        waypointMap.get(waypoint.name).push(waypoint.elapsedMinutes);
      }
    });
  });

  const averages = [];
  waypointMap.forEach((times, name) => {
    if (times.length === 0) return;

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    averages.push({
      name,
      averageMinutes: Math.round(avgTime),
      sampleSize: times.length,
      confidence: times.length >= 10 ? 'high' : times.length >= 5 ? 'medium' : 'low'
    });
  });

  console.log(`[WAYPOINT HISTORY] Calculated averages for ${averages.length} waypoints:`,
    averages.map(a => `${a.name}: ${a.averageMinutes}min (n=${a.sampleSize})`).join(', '));

  return averages;
}
