import { addMinutes, timeDifference } from '../utils/time';

export function calculateWaypointAverages(history, waypointName = null) {
  if (!history || history.length === 0) {
    return null;
  }

  const recentHistory = history
    .filter(day => day.waypoint_timings && day.waypoint_timings.length > 0)
    .slice(-30);

  if (recentHistory.length === 0) {
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

  const allAverages = calculateWaypointAverages(history);

  if (!allAverages || allAverages.length === 0) {
    return waypoints.map(wp => ({
      ...wp,
      predictedTime: null,
      predictedMinutes: null,
      confidence: 'none'
    }));
  }

  let currentTime = startTime;
  let lastCompletedIndex = -1;

  waypoints.forEach((wp, index) => {
    if (wp.status === 'completed' && wp.delivery_time) {
      lastCompletedIndex = index;
      currentTime = wp.delivery_time;
    }
  });

  const predictions = waypoints.map((waypoint, index) => {
    if (waypoint.status === 'completed' && waypoint.delivery_time) {
      const elapsed = timeDifference(startTime, waypoint.delivery_time);
      return {
        ...waypoint,
        predictedTime: waypoint.delivery_time,
        predictedMinutes: elapsed,
        actualMinutes: elapsed,
        confidence: 'actual',
        variance: 0
      };
    }

    const average = allAverages.find(avg => avg.name === waypoint.name);

    if (!average) {
      return {
        ...waypoint,
        predictedTime: null,
        predictedMinutes: null,
        confidence: 'none'
      };
    }

    let baseTime = startTime;
    let elapsedSoFar = 0;

    if (lastCompletedIndex >= 0) {
      baseTime = currentTime;

      const remainingWaypoints = waypoints.slice(lastCompletedIndex + 1, index + 1);
      elapsedSoFar = remainingWaypoints.reduce((sum, wp) => {
        const wpAvg = allAverages.find(avg => avg.name === wp.name);
        if (!wpAvg) return sum;

        const lastWpAvg = lastCompletedIndex >= 0
          ? allAverages.find(avg => avg.name === waypoints[lastCompletedIndex].name)
          : null;

        const increment = lastWpAvg
          ? Math.max(0, wpAvg.averageMinutes - lastWpAvg.averageMinutes)
          : wpAvg.averageMinutes;

        return sum + increment;
      }, 0);
    } else {
      elapsedSoFar = average.averageMinutes;
    }

    const predictedTime = addMinutes(baseTime, elapsedSoFar);

    return {
      ...waypoint,
      predictedTime,
      predictedMinutes: average.averageMinutes,
      confidence: average.confidence,
      sampleSize: average.sampleSize
    };
  });

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

  const variance = timeDifference(prediction.predictedTime, lastCompleted.delivery_time);

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
    lastWaypoint: lastCompleted.name,
    completedAt: lastCompleted.delivery_time
  };
}

export function estimateReturnTime(waypoints, predictions, startTime) {
  const returnWaypoint = predictions.find(p =>
    p.name === 'Return to PO' || p.name.toLowerCase().includes('return')
  );

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
