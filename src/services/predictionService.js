import { TIME_CONSTANTS } from '../utils/constants';
import { USPS_STANDARDS } from '../utils/uspsConstants';
import { parseTime, addMinutes, timeDifference } from '../utils/time';
import { estimateReturnTime, predictWaypointTimes } from './waypointPredictionService';

function getStreetTime(day) {
  if (day.streetTimeNormalized != null && day.streetTimeNormalized > 0) {
    return day.streetTimeNormalized;
  }
  if (day.streetTime != null && day.streetTime > 0) {
    return day.streetTime;
  }
  if (day.streetHours != null && day.streetHours > 0) {
    return day.streetHours * 60;
  }
  if (day.routeTime != null && day.routeTime > 0) {
    return day.routeTime;
  }
  return 0;
}

function detectDayType(date = new Date()) {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 1) return 'monday';
  return 'normal';
}

function isWithinLast30Days(date) {
  const now = new Date();
  const daysDiff = (now - date) / (1000 * 60 * 60 * 24);
  return daysDiff <= 30;
}

export function calculateSimplePrediction(history) {
  if (!history || history.length === 0) {
    return null;
  }

  const recentDays = history.slice(-15);
  const avgStreetTime = recentDays.reduce((sum, day) => {
    const streetTime = getStreetTime(day);
    return sum + streetTime;
  }, 0) / recentDays.length;

  return {
    streetTime: Math.round(avgStreetTime),
    dayType: 'any',
    matchesUsed: recentDays.length,
    confidence: recentDays.length >= 15 ? 'good' : 'medium',
    badge: recentDays.length >= 15 ? '🍏' : '🌱',
    method: 'simple'
  };
}

function calculateVolumeWeightedPrediction(days, todayMail, dayType) {
  // UPDATED: Filter by boxholder status first
  const boxholderFiltered = days.filter(day => {
    // Match boxholder status - boxholder days should only match boxholder days
    return day.hasBoxholder === todayMail.hasBoxholder;
  });

  // Use filtered days if we have enough, otherwise use all days
  const daysToUse = boxholderFiltered.length >= 3 ? boxholderFiltered : days;

  const volumeMatches = daysToUse.map(day => {
    const dpsMatch = 1 - Math.abs(day.dps - todayMail.dps) / Math.max(day.dps, todayMail.dps, 1);
    const flatsMatch = 1 - Math.abs(day.flats - todayMail.flats) / Math.max(day.flats, todayMail.flats, 1);
    const parcelsMatch = 1 - Math.abs(day.parcels - todayMail.parcels) / Math.max(day.parcels, todayMail.parcels, 1);

    const matchScore = (dpsMatch * 0.4 + flatsMatch * 0.3 + parcelsMatch * 0.3);

    const daysDiff = (new Date() - new Date(day.date)) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0.5, 1 - (daysDiff / 60));

    const combinedWeight = matchScore * recencyWeight;

    const streetTime = getStreetTime(day);

    return {
      day: day,
      matchScore: matchScore,
      recencyWeight: recencyWeight,
      combinedWeight: combinedWeight,
      streetTime: streetTime
    };
  });

  volumeMatches.sort((a, b) => b.combinedWeight - a.combinedWeight);

  const top5 = volumeMatches.slice(0, Math.min(5, volumeMatches.length));

  if (top5.length === 0) {
    return null;
  }

  const totalWeight = top5.reduce((sum, m) => sum + m.combinedWeight, 0);
  const weightedStreetTime = top5.reduce((sum, m) =>
    sum + (m.streetTime * m.combinedWeight), 0) / totalWeight;

  let confidence, badge;
  if (top5.length >= 5 && top5[0].matchScore > 0.85) {
    confidence = 'high';
    badge = '';
  } else if (top5.length >= 3 && top5[0].matchScore > 0.70) {
    confidence = 'good';
    badge = '🍏';
  } else {
    confidence = 'medium';
    badge = '🌱';
  }

  return {
    streetTime: Math.round(weightedStreetTime),
    dayType: dayType,
    matchesUsed: top5.length,
    confidence: confidence,
    badge: badge,
    topMatch: top5[0].day,
    method: 'hybrid',
    boxholderMatched: boxholderFiltered.length >= 3 // Indicate if boxholder was factored in
  };
}

export function calculateSmartPrediction(todayMail, history) {
  const todayDayType = detectDayType();

  if (!history || history.length < 3) {
    return calculateSimplePrediction(history);
  }

  const similarDayTypes = history
    .filter(day => {
      const dayType = day.dayType || detectDayType(new Date(day.date));
      return dayType === todayDayType;
    })
    .filter(day => isWithinLast30Days(new Date(day.date)));

  if (similarDayTypes.length < 2) {
    const recentDays = history
      .filter(day => isWithinLast30Days(new Date(day.date)))
      .slice(-15);

    if (recentDays.length < 3) {
      return calculateSimplePrediction(history);
    }

    return calculateVolumeWeightedPrediction(recentDays, todayMail, todayDayType);
  }

  return calculateVolumeWeightedPrediction(similarDayTypes, todayMail, todayDayType);
}

export async function calculateFullDayPrediction(todayMail, routeConfig, history, waypoints = null, routeId = null) {
  let streetPrediction = calculateSmartPrediction(todayMail, history);
  let totalStreetTime;

  const useHistoricalPrediction = streetPrediction && streetPrediction.streetTime > 30;

  if (!useHistoricalPrediction) {
    let estimatedStreetTime;
    let confidence;
    let badge;
    let method;

    if (routeConfig?.evaluatedStreetTime) {
      estimatedStreetTime = routeConfig.evaluatedStreetTime * 60;
      confidence = 'evaluation';
      badge = '📋';
      method = 'evaluation';
    } else if (routeConfig?.manualStreetTime) {
      estimatedStreetTime = routeConfig.manualStreetTime;
      confidence = 'manual';
      badge = '✋';
      method = 'manual';
    } else {
      estimatedStreetTime = 240;
      confidence = 'estimate';
      badge = '📊';
      method = 'estimate';
    }

    totalStreetTime = estimatedStreetTime;
    streetPrediction = {
      streetTime: estimatedStreetTime,
      confidence: confidence,
      badge: badge,
      method: method,
      matchesUsed: 0,
    };
  } else {
    totalStreetTime = streetPrediction.streetTime;
  }

  const adjustedFlats = Math.max(0, todayMail.flats - (todayMail.curtailed || 0));

  const flatsInPieces = adjustedFlats * TIME_CONSTANTS.FLATS_PER_FOOT;
  const lettersInPieces = (todayMail.letters || 0) * TIME_CONSTANTS.LETTERS_PER_FOOT;

  const flatsCaseTime = flatsInPieces / TIME_CONSTANTS.FLATS_CASE_RATE;
  const lettersCaseTime = lettersInPieces / TIME_CONSTANTS.LETTERS_CASE_RATE;
  const sprsCaseTime = (todayMail.sprs || 0) / TIME_CONSTANTS.FLATS_CASE_RATE;

  const totalCasedPieces = flatsInPieces + lettersInPieces + (todayMail.sprs || 0);
  const pullDownTime = totalCasedPieces / USPS_STANDARDS.PULLDOWN_RATE;

  const caseTime = flatsCaseTime + lettersCaseTime + sprsCaseTime;

  const fixedOfficeTime = TIME_CONSTANTS.FIXED_OFFICE_TIME;
  const safetyTalk = todayMail.safetyTalk || 0;
  
  // FIXED: Boxholder does NOT add to office time - it affects street time through historical matching
  const totalOfficeTime = fixedOfficeTime + caseTime + pullDownTime + safetyTalk;

  const loadTruckTime = ((todayMail.parcels || 0) + (todayMail.sprs || 0)) * USPS_STANDARDS.LOAD_TRUCK_TIME;

  const breakdown = {
    dps: {
      pieces: todayMail.dps || 0,
      excluded: false,
    },
    flats: {
      feet: adjustedFlats,
      pieces: Math.round(flatsInPieces),
      time: flatsCaseTime,
    },
    letters: {
      feet: todayMail.letters || 0,
      pieces: Math.round(lettersInPieces),
      time: lettersCaseTime,
    },
    sprs: {
      pieces: todayMail.sprs || 0,
      time: sprsCaseTime,
    },
    casedMail: {
      totalPieces: Math.round(totalCasedPieces),
      pullDownTime: pullDownTime,
    },
    parcels: {
      count: todayMail.parcels || 0,
      loadTime: loadTruckTime,
      excluded: false,
    },
  };

  const startTime = parseTime(routeConfig.startTime);
  const leaveOfficeTime = addMinutes(startTime, totalOfficeTime);
  
  // Clock out = leave + street time (load truck is DURING street time, not added separately)
  // PM office time is NOT added to prediction - carriers should drop and go
  let clockOutTime = addMinutes(leaveOfficeTime, totalStreetTime);

  let waypointEnhanced = false;
  let returnTimeEstimate = null;

  if (waypoints && waypoints.length > 0 && routeId) {
    const predictions = await predictWaypointTimes(waypoints, leaveOfficeTime, routeId);
    returnTimeEstimate = estimateReturnTime(waypoints, predictions, leaveOfficeTime);

    if (returnTimeEstimate && returnTimeEstimate.predictedReturnTime) {
      const hasCompletedWaypoints = waypoints.some(wp => wp.status === 'completed');

      // DEFENSIVE FIX: Validate waypoint prediction before using it
      const waypointClockOut = returnTimeEstimate.predictedReturnTime;
      const timeBasedClockOut = clockOutTime;
      
      // Reject waypoint prediction if:
      // 1. It's before leave office time (impossible)
      // 2. It's more than 2 hours before time-based prediction (suspicious)
      const isBeforeLeave = waypointClockOut < leaveOfficeTime;
      const isSuspiciouslyEarly = (timeBasedClockOut - waypointClockOut) > (120 * 60 * 1000); // 2 hours in ms
      
      if (isBeforeLeave || isSuspiciouslyEarly) {
        console.warn('[PREDICTION] Rejecting waypoint prediction - unreasonable time:', {
          waypointPrediction: waypointClockOut.toLocaleTimeString(),
          timeBasedPrediction: timeBasedClockOut.toLocaleTimeString(),
          leaveTime: leaveOfficeTime.toLocaleTimeString(),
          isBeforeLeave,
          isSuspiciouslyEarly
        });
        // Don't use waypoint prediction - stick with time-based
      } else if (hasCompletedWaypoints || returnTimeEstimate.confidence !== 'low') {
        clockOutTime = waypointClockOut;
        waypointEnhanced = true;
      }
    }
  }

  const tourLengthMinutes = routeConfig.tourLength * 60;
  const endTour = addMinutes(startTime, tourLengthMinutes);
  const overtime = timeDifference(endTour, clockOutTime);

  return {
    officeTime: totalOfficeTime,
    streetTime: totalStreetTime,
    loadTruckTime: loadTruckTime,
    leaveOfficeTime,
    clockOutTime,
    overtime,
    prediction: streetPrediction,
    breakdown,
    components: {
      fixedOfficeTime,
      caseTime,
      pullDownTime,
      safetyTalk,
    },
    waypointEnhanced,
    returnTimeEstimate,
  };
}
