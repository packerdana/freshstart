import { addMinutes, timeDifference } from '../utils/time';
import { fetchWaypointHistory, calculateWaypointAveragesFromDeliveries } from './waypointHistoryService';

export async function calculateWaypointAverages(routeId, waypointName = null, dateFilter = null) {
  const history = await fetchWaypointHistory(routeId, 30, dateFilter);

  if (!history || history.length === 0) {
    console.log('No waypoint history available for this route');
    return null;
  }

  return calculateWaypointAveragesFromDeliveries(history, waypointName);
}

export async function predictWaypointTimes(waypoints, startTime, routeId, waypointPauseMinutes = 0, similarDates = null) {
  if (!waypoints || waypoints.length === 0) {
    return [];
  }

  if (!startTime) {
    console.log('No start time provided for predictions');
    return waypoints.map(wp => ({
      ...wp,
      predictedTime: null,
      predictedMinutes: null,
      confidence: 'none'
    }));
  }

  let baseStartTime = new Date(startTime);

  if (isNaN(baseStartTime.getTime())) {
    const timeMatch = startTime.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const today = new Date();
      today.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
      baseStartTime = today;
      console.log(`Converted time string "${startTime}" to full date:`, baseStartTime);
    } else {
      console.error('Invalid start time format:', startTime);
      return waypoints.map(wp => ({
        ...wp,
        predictedTime: null,
        predictedMinutes: null,
        confidence: 'none'
      }));
    }
  }

  const allAverages = await calculateWaypointAverages(routeId, null, similarDates);

  if (!allAverages || allAverages.length === 0) {
    console.log('No averages calculated from history - predictions unavailable');
    return waypoints.map(wp => ({
      ...wp,
      predictedTime: null,
      predictedMinutes: null,
      confidence: 'none'
    }));
  }

  console.log('Calculated waypoint duration averages:', allAverages);

  // Waypoint predictions should pause for breaks/lunch.
  // We do NOT alter the between-waypoint duration logic; we just shift future predicted clock times.
  const pauseMs = Math.max(0, Math.round(Number(waypointPauseMinutes) || 0)) * 60 * 1000;

  // ✅ FIX: Track PREVIOUS waypoint's time for chaining
  // This is the anchor time that each prediction builds from
  let previousWaypointTime = baseStartTime;

  const predictions = waypoints.map((waypoint, index) => {
    const waypointName = waypoint.address || waypoint.name;

    // If waypoint is already completed, use actual time
    if (waypoint.status === 'completed' && waypoint.delivery_time) {
      const deliveryTime = new Date(waypoint.delivery_time);
      const elapsed = timeDifference(baseStartTime, deliveryTime);
      
      // ✅ Update previous time for next waypoint chaining
      previousWaypointTime = deliveryTime;
      
      console.log(`[ACTUAL] ${waypointName}: Completed at ${deliveryTime.toLocaleTimeString()}`);
      
      return {
        ...waypoint,
        predictedTime: deliveryTime,
        predictedMinutes: elapsed,
        actualMinutes: elapsed,
        confidence: 'actual',
        variance: 0
      };
    }

    // Look up historical average DURATION from previous waypoint
    const average = allAverages.find(avg => avg.name === waypointName);

    // No historical data for this waypoint
    if (!average || !average.averageDuration) {
      console.log(`[NO HISTORY] ${waypointName}: Using default 6 min increment`);

      // Default: 6 minutes from previous waypoint
      const defaultDuration = 6;
      const basePredictedTime = new Date(previousWaypointTime.getTime() + defaultDuration * 60 * 1000);
      const predictedTime = pauseMs > 0 ? new Date(basePredictedTime.getTime() + pauseMs) : basePredictedTime;
      const predictedMinutes = timeDifference(baseStartTime, predictedTime);
      
      // ✅ Update previous time for next waypoint chaining (UNPAUSED)
      previousWaypointTime = basePredictedTime;

      return {
        ...waypoint,
        predictedTime,
        predictedMinutes,
        confidence: 'low'
      };
    }

    // ✅ KEY FIX: Calculate prediction as:
    // previous waypoint time + average duration to this waypoint
    const durationFromPrevious = average.averageDuration;
    const basePredictedTime = new Date(previousWaypointTime.getTime() + durationFromPrevious * 60 * 1000);
    const predictedTime = pauseMs > 0 ? new Date(basePredictedTime.getTime() + pauseMs) : basePredictedTime;
    const predictedMinutes = timeDifference(baseStartTime, predictedTime);
    
    console.log(
      `[PREDICTION] ${waypointName}: ` +
      `Previous @ ${previousWaypointTime.toLocaleTimeString()} + ` +
      `${durationFromPrevious} min = ` +
      `${predictedTime.toLocaleTimeString()}`
    );
    
    // ✅ Update previous time for next waypoint chaining (UNPAUSED)
    previousWaypointTime = basePredictedTime;

    return {
      ...waypoint,
      predictedTime,
      predictedMinutes,
      durationFromPrevious, // Include for debugging
      confidence: average.confidence,
      sampleSize: average.sampleSize
    };
  });

  console.log('Generated duration-based chained predictions:', predictions.map(p => ({
    id: p.id,
    address: p.address || p.name,
    predictedTime: p.predictedTime ? p.predictedTime.toLocaleTimeString() : 'none',
    durationFromPrev: p.durationFromPrevious,
    confidence: p.confidence
  })));

  return predictions;
}

export function calculateProgressStatus(waypoints, predictions, currentTime) {
  const lastCompleted = waypoints
    .filter(wp => wp.status === 'completed')
    .sort((a, b) => b.order - a.order)[0];

  if (!lastCompleted) {
    return {
      status: 'on-schedule',
      variance: 0,
      message: 'Not started'
    };
  }

  const prediction = predictions.find(p => p.id === lastCompleted.id);

  if (!prediction || !prediction.predictedTime || !lastCompleted.delivery_time) {
    return {
      status: 'on-schedule',
      variance: 0,
      message: 'No prediction data'
    };
  }

  const completedTime = new Date(lastCompleted.delivery_time);
  const variance = timeDifference(prediction.predictedTime, completedTime);

  let status, message;
  if (variance <= -10) {
    status = 'ahead';
    message = `${Math.abs(variance)} min ahead`;
  } else if (variance >= 10) {
    status = 'behind';
    message = `${variance} min behind`;
  } else {
    status = 'on-schedule';
    message = 'On schedule';
  }

  return {
    status,
    variance,
    message,
    lastWaypoint: lastCompleted.address || lastCompleted.name,
    completedAt: completedTime
  };
}

export function estimateReturnTime(waypoints, predictions, startTime) {
  const returnWaypoint = predictions.find(p => {
    const name = p.address || p.name;
    const lower = name?.toLowerCase?.() || '';
    return name === 'Return to PO' || name === 'Return to Post Office' || lower.includes('return');
  });

  if (!returnWaypoint || !returnWaypoint.predictedTime) {
    return null;
  }

  const lastCompleted = waypoints
    .filter(wp => wp.status === 'completed')
    .sort((a, b) => b.order - a.order)[0];

  if (!lastCompleted) {
    return {
      predictedReturnTime: returnWaypoint.predictedTime,
      confidence: returnWaypoint.confidence
    };
  }

  const completedCount = waypoints.filter(wp => wp.status === 'completed').length;
  const totalCount = waypoints.length;
  const progressRatio = completedCount / totalCount;

  let adjustedConfidence = returnWaypoint.confidence;
  if (progressRatio >= 0.75) {
    adjustedConfidence = 'high';
  } else if (progressRatio >= 0.5) {
    adjustedConfidence = 'medium';
  }

  return {
    predictedReturnTime: returnWaypoint.predictedTime,
    confidence: adjustedConfidence,
    progress: Math.round(progressRatio * 100)
  };
}
