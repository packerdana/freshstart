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

  let lastCompletedIndex = -1;
  let lastCompletedTime = baseStartTime;
  let paceAdjustment = 0;

  waypoints.forEach((wp, index) => {
    if (wp.status === 'completed' && wp.delivery_time) {
      lastCompletedIndex = index;
      lastCompletedTime = new Date(wp.delivery_time);
    }
  });

  if (lastCompletedIndex >= 0) {
    const lastWaypoint = waypoints[lastCompletedIndex];
    const lastWaypointName = lastWaypoint.address || lastWaypoint.name;
    const lastAverage = allAverages.find(avg => avg.name === lastWaypointName);

    if (lastAverage) {
      const actualElapsed = timeDifference(baseStartTime, lastCompletedTime);
      const expectedElapsed = lastAverage.averageMinutes;
      paceAdjustment = actualElapsed - expectedElapsed;
      console.log(`Pace adjustment: ${paceAdjustment > 0 ? 'behind' : 'ahead'} by ${Math.abs(paceAdjustment)} minutes`);
    }
  }

  const predictions = waypoints.map((waypoint, index) => {
    if (waypoint.status === 'completed' && waypoint.delivery_time) {
      const deliveryTime = new Date(waypoint.delivery_time);
      const elapsed = timeDifference(baseStartTime, deliveryTime);
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

    if (!average) {
      console.log(`No historical average found for waypoint: "${waypointName}"`);

      if (index > lastCompletedIndex && lastCompletedIndex >= 0) {
        const defaultIncrement = 6;
        const stopsFromLast = index - lastCompletedIndex;
        const predictedMinutes = timeDifference(baseStartTime, lastCompletedTime) + (defaultIncrement * stopsFromLast);
        
        const predictedTime = new Date(baseStartTime.getTime() + predictedMinutes * 60 * 1000);

        return {
          ...waypoint,
          predictedTime,
          predictedMinutes,
          confidence: 'low'
        };
      }

      return {
        ...waypoint,
        predictedTime: null,
        predictedMinutes: null,
        confidence: 'none'
      };
    }

    const historicalMinutesFromStart = average.averageMinutes;
    const adjustedMinutesFromStart = historicalMinutesFromStart + paceAdjustment;
    
    // Calculate initial predicted time
    let predictedTime = new Date(baseStartTime.getTime() + adjustedMinutesFromStart * 60 * 1000);
    let finalMinutesFromStart = adjustedMinutesFromStart;

    // CRITICAL FIX: Ensure predicted time is AFTER last completed waypoint
    if (lastCompletedIndex >= 0 && predictedTime <= lastCompletedTime) {
      // Time would go backwards - use last completed time + reasonable increment
      const minutesSinceLastCompleted = 6 * (index - lastCompletedIndex); // 6 min per stop
      predictedTime = new Date(lastCompletedTime.getTime() + minutesSinceLastCompleted * 60 * 1000);
      finalMinutesFromStart = timeDifference(baseStartTime, predictedTime);
      
      console.warn(`[WAYPOINT FIX] ${waypointName}: Would have been ${new Date(baseStartTime.getTime() + adjustedMinutesFromStart * 60 * 1000).toLocaleTimeString()} (before last completed), adjusted to ${predictedTime.toLocaleTimeString()}`);
    }

    console.log(`[PREDICTION] ${waypointName}: ${historicalMinutesFromStart} min from start (adjusted: ${adjustedMinutesFromStart}) → ${predictedTime.toLocaleTimeString()}`);

    return {
      ...waypoint,
      predictedTime,
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
