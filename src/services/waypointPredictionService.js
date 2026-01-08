import { addMinutes, timeDifference } from '../utils/time';

export function calculateWaypointAverages(history, waypointName = null) {
  if (!history || history.length === 0) {
    return null;
  }

  const recentHistory = history
    .filter(day => day.waypoint_timings && day.waypoint_timings.length > 0)
    .slice(-30);

  console.log(`Found ${recentHistory.length} days with waypoint timing data out of ${history.length} total history entries`);

  if (recentHistory.length === 0) {
    console.log('No waypoint timing data in history');
    return null;
  }

  if (waypointName) {
    const waypointData = recentHistory
      .map(day => {
        const waypoint = day.waypoint_timings.find(w => w.name === waypointName);
        return waypoint ? waypoint.elapsedMinutes : null;
      })
      .filter(time => time !== null);

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

  recentHistory.forEach(day => {
    day.waypoint_timings.forEach(waypoint => {
      if (!waypointMap.has(waypoint.name)) {
        waypointMap.set(waypoint.name, []);
      }
      waypointMap.get(waypoint.name).push(waypoint.elapsedMinutes);
    });
  });

  const averages = [];
  waypointMap.forEach((times, name) => {
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    averages.push({
      name,
      averageMinutes: Math.round(avgTime),
      sampleSize: times.length,
      confidence: times.length >= 10 ? 'high' : times.length >= 5 ? 'medium' : 'low'
    });
  });

  return averages;
}

export function predictWaypointTimes(waypoints, startTime, history) {
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

  const allAverages = calculateWaypointAverages(history);

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
        
        // FIX: Use native Date math instead of addMinutes utility
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
    
    // FIX: Use native Date math instead of potentially broken addMinutes utility
    // This creates a new Date by adding milliseconds to the base start time
    const predictedTime = new Date(baseStartTime.getTime() + adjustedMinutesFromStart * 60 * 1000);

    console.log(`[PREDICTION] ${waypointName}: ${historicalMinutesFromStart} min from start (adjusted: ${adjustedMinutesFromStart}) → ${predictedTime.toLocaleTimeString()}`);

    return {
      ...waypoint,
      predictedTime,
      predictedMinutes: adjustedMinutesFromStart,
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
