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

  const baseStartTime = new Date(startTime);

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

  waypoints.forEach((wp, index) => {
    if (wp.status === 'completed' && wp.delivery_time) {
      lastCompletedIndex = index;
      lastCompletedTime = new Date(wp.delivery_time);
    }
  });

  const completedWaypoints = waypoints.filter((wp, idx) => idx <= lastCompletedIndex && wp.status === 'completed' && wp.delivery_time);
  let averagePaceMinutes = 6;

  if (completedWaypoints.length >= 2) {
    const times = completedWaypoints.map(wp => new Date(wp.delivery_time));
    const totalTimeMinutes = timeDifference(times[0], times[times.length - 1]);
    averagePaceMinutes = totalTimeMinutes / (completedWaypoints.length - 1);
    console.log(`Calculated pace from ${completedWaypoints.length} completed waypoints: ${averagePaceMinutes.toFixed(1)} min/stop`);
  } else if (completedWaypoints.length === 1) {
    const firstWaypointName = completedWaypoints[0].address || completedWaypoints[0].name;
    const firstAvg = allAverages.find(avg => avg.name === firstWaypointName);
    if (firstAvg && firstAvg.averageMinutes > 0) {
      averagePaceMinutes = firstAvg.averageMinutes;
      console.log(`Using historical average for first waypoint as pace: ${averagePaceMinutes} min`);
    }
  }

  const predictions = [];
  let cumulativeTime = lastCompletedTime;

  for (let index = 0; index < waypoints.length; index++) {
    const waypoint = waypoints[index];

    if (waypoint.status === 'completed' && waypoint.delivery_time) {
      const deliveryTime = new Date(waypoint.delivery_time);
      const elapsed = timeDifference(baseStartTime, deliveryTime);
      predictions.push({
        ...waypoint,
        predictedTime: deliveryTime,
        predictedMinutes: elapsed,
        actualMinutes: elapsed,
        confidence: 'actual',
        variance: 0
      });
      cumulativeTime = deliveryTime;
      continue;
    }

    if (index <= lastCompletedIndex) {
      predictions.push({
        ...waypoint,
        predictedTime: null,
        predictedMinutes: null,
        confidence: 'none'
      });
      continue;
    }

    const waypointName = waypoint.address || waypoint.name;
    const average = allAverages.find(avg => avg.name === waypointName);

    if (index === 0 && lastCompletedIndex === -1) {
      const predictedTime = average ? addMinutes(baseStartTime, average.averageMinutes) : addMinutes(baseStartTime, averagePaceMinutes);
      predictions.push({
        ...waypoint,
        predictedTime,
        predictedMinutes: average?.averageMinutes || averagePaceMinutes,
        confidence: average?.confidence || 'low',
        sampleSize: average?.sampleSize
      });
      cumulativeTime = predictedTime;
    } else {
      const prevWaypoint = waypoints[index - 1];
      const prevWaypointName = prevWaypoint.address || prevWaypoint.name;
      const prevAvg = allAverages.find(avg => avg.name === prevWaypointName);
      const currentAvg = allAverages.find(avg => avg.name === waypointName);

      let incrementMinutes = averagePaceMinutes;

      if (prevAvg && currentAvg && currentAvg.averageMinutes > prevAvg.averageMinutes) {
        incrementMinutes = currentAvg.averageMinutes - prevAvg.averageMinutes;
      } else if (!prevAvg && currentAvg) {
        incrementMinutes = currentAvg.averageMinutes;
      }

      const predictedTime = addMinutes(cumulativeTime, incrementMinutes);
      predictions.push({
        ...waypoint,
        predictedTime,
        predictedMinutes: incrementMinutes,
        confidence: currentAvg?.confidence || 'low',
        sampleSize: currentAvg?.sampleSize
      });
      cumulativeTime = predictedTime;
    }
  }

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
