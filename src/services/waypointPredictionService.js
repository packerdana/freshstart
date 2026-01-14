import { addMinutes, timeDifference } from '../utils/time';
import { fetchWaypointHistory, calculateWaypointAveragesFromDeliveries } from './waypointHistoryService';

export async function calculateWaypointAverages(routeId, waypointName = null) {
  const history = await fetchWaypointHistory(routeId, 30);

  if (!history || history.length === 0) {
    console.log('No waypoint history available for this route');
    return null;
  }

  return calculateWaypointAveragesFromDeliveries(history, waypointName);
}

export async function predictWaypointTimes(waypoints, startTime, routeId) {
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

  const allAverages = await calculateWaypointAverages(routeId);

  if (!allAverages || allAverages.length === 0) {
    console.log('No averages calculated from history - predictions unavailable');
    return waypoints.map(wp => ({
      ...wp,
      predictedTime: null,
      predictedMinutes: null,
      confidence: 'none'
    }));
  }

  console.log('Calculated waypoint averages:', allAverages);

  // Find last completed waypoint for pace adjustment
  let lastCompletedIndex = -1;
  let lastCompletedTime = baseStartTime;
  let paceAdjustment = 0;

  waypoints.forEach((wp, index) => {
    if (wp.status === 'completed' && wp.delivery_time) {
      lastCompletedIndex = index;
      lastCompletedTime = new Date(wp.delivery_time);
    }
  });

  // Calculate pace adjustment if we have completed waypoints
  if (lastCompletedIndex >= 0) {
    const lastWaypoint = waypoints[lastCompletedIndex];
    const lastWaypointName = lastWaypoint.address || lastWaypoint.name;
    const lastAverage = allAverages.find(avg => avg.name === lastWaypointName);

    if (lastAverage) {
      const actualElapsed = timeDifference(baseStartTime, lastCompletedTime);
      const expectedElapsed = lastAverage.averageMinutes;
      
      // CONSERVATIVE: Only apply 50% of variance to prevent cascade errors
      const rawVariance = actualElapsed - expectedElapsed;
      paceAdjustment = Math.round(rawVariance * 0.5);
      
      console.log(`Pace adjustment: ${paceAdjustment > 0 ? 'behind' : 'ahead'} by ${Math.abs(paceAdjustment)} minutes (50% of ${rawVariance} min variance)`);
    }
  }

  // CRITICAL: Track the PREVIOUS waypoint's time to enforce monotonic ordering
  // This applies to BOTH completed AND predicted waypoints
  let previousWaypointTime = baseStartTime;

  const predictions = waypoints.map((waypoint, index) => {
    // If waypoint is already completed, use actual time
    if (waypoint.status === 'completed' && waypoint.delivery_time) {
      const deliveryTime = new Date(waypoint.delivery_time);
      const elapsed = timeDifference(baseStartTime, deliveryTime);
      
      // Update previous time for next waypoint
      previousWaypointTime = deliveryTime;
      
      return {
        ...waypoint,
        predictedTime: deliveryTime,
        predictedMinutes: elapsed,
        actualMinutes: elapsed,
        confidence: 'actual',
        variance: 0
      };
    }

    const waypointName = waypoint.address || waypoint.name;
    const average = allAverages.find(avg => avg.name === waypointName);

    // No historical data for this waypoint
    if (!average) {
      console.log(`No historical average found for waypoint: "${waypointName}"`);

      // Use default increment from previous waypoint
      const defaultIncrement = 6; // 6 minutes per stop
      const predictedTime = new Date(previousWaypointTime.getTime() + defaultIncrement * 60 * 1000);
      const predictedMinutes = timeDifference(baseStartTime, predictedTime);
      
      // Update previous time for next waypoint
      previousWaypointTime = predictedTime;

      return {
        ...waypoint,
        predictedTime,
        predictedMinutes,
        confidence: 'low'
      };
    }

    // Calculate prediction from historical average
    const historicalMinutesFromStart = average.averageMinutes;
    const adjustedMinutesFromStart = historicalMinutesFromStart + paceAdjustment;
    
    // Calculate initial predicted time from historical data
    let calculatedTime = new Date(baseStartTime.getTime() + adjustedMinutesFromStart * 60 * 1000);

    // ✅ FIX: ENFORCE MONOTONIC TIME
    // Prediction MUST be after the previous waypoint (completed OR predicted)
    const minimumIncrement = 3; // At least 3 minutes between waypoints
    const earliestAllowedTime = new Date(previousWaypointTime.getTime() + minimumIncrement * 60 * 1000);
    
    if (calculatedTime < earliestAllowedTime) {
      const originalTime = new Date(calculatedTime);
      calculatedTime = earliestAllowedTime;
      
      console.warn(
        `[MONOTONIC FIX] ${waypointName}: ` +
        `Historical prediction ${originalTime.toLocaleTimeString()} ` +
        `would be before previous waypoint ${previousWaypointTime.toLocaleTimeString()}, ` +
        `adjusted to ${calculatedTime.toLocaleTimeString()}`
      );
    }
    
    const finalMinutesFromStart = timeDifference(baseStartTime, calculatedTime);
    
    // Update previous time for next waypoint
    previousWaypointTime = calculatedTime;

    console.log(
      `[PREDICTION] ${waypointName}: ` +
      `${historicalMinutesFromStart} min from start ` +
      `(pace adjusted: ${adjustedMinutesFromStart}) → ` +
      `${calculatedTime.toLocaleTimeString()} (${finalMinutesFromStart} min)`
    );

    return {
      ...waypoint,
      predictedTime: calculatedTime,
      predictedMinutes: finalMinutesFromStart,
      confidence: average.confidence,
      sampleSize: average.sampleSize
    };
  });

  console.log('Generated predictions:', predictions.map(p => ({
    id: p.id,
    address: p.address || p.name,
    predictedTime: p.predictedTime ? p.predictedTime.toLocaleTimeString() : 'none',
    predictedMinutes: p.predictedMinutes,
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
    return name === 'Return to PO' || name?.toLowerCase().includes('return');
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
