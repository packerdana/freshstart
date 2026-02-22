import { TIME_CONSTANTS } from '../utils/constants';
import { USPS_STANDARDS } from '../utils/uspsConstants';
import { parseTime, addMinutes, timeDifference } from '../utils/time';
import { getDayType, canExceedStreetTimeLimit } from '../utils/holidays';
import { findSimilarDays } from './similarDayService';
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
  // Use Dana's day-type rules (day-after-holiday, Saturday, Monday, normal)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return getDayType(`${y}-${m}-${d}`);
}

function isWithinLast30Days(date) {
  const now = new Date();
  const daysDiff = (now - date) / (1000 * 60 * 60 * 24);
  return daysDiff <= 30;
}

const MIN_VALID_STREET_MINUTES = 120; // ignore obvious bad data like 5 minutes
const MAX_VALID_STREET_MINUTES = 720; // 12 hour hard limit (normal days)
const MAX_VALID_STREET_MINUTES_PEAK = 840; // 14 hour limit for day-after-holiday or peak season
const MAX_PM_OFFICE_MINUTES = 60; // 1 hour hard limit for PM office (744)
const MAX_AM_OFFICE_MINUTES = 180; // 3 hour hard limit for AM office (722)

function filterValidHistory(history) {
  return (history || []).filter((day) => {
    const st = getStreetTime(day);
    const pm = Number(day.pmOfficeTime ?? day.pm_office_time ?? 0) || 0;
    const am = Number(day.officeTime ?? day.office_time ?? 0) || 0;
    const date = day.date;

    // Reject street time outliers (with exception for day-after-holiday / peak season)
    if (st < MIN_VALID_STREET_MINUTES) return false;
    
    const isExceptionalDay = canExceedStreetTimeLimit(date);
    const maxStreetTime = isExceptionalDay ? MAX_VALID_STREET_MINUTES_PEAK : MAX_VALID_STREET_MINUTES;
    if (st > maxStreetTime) return false;

    // Reject PM office outliers
    if (pm > MAX_PM_OFFICE_MINUTES) return false;

    // Reject AM office outliers
    if (am > MAX_AM_OFFICE_MINUTES) return false;

    // Reject suspicious "PM office only" days (no street time but high PM office)
    if (st === 0 && pm > 30) return false;

    return true;
  });
}

export function calculateSimplePrediction(history) {
  if (!history || history.length === 0) {
    return null;
  }

  const valid = filterValidHistory(history);
  const base = valid.length >= 3 ? valid : history;
  const recentDays = base.slice(-15);
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

function calculateVolumeWeightedPrediction(days, todayMail, dayType, routeConfig) {
  // Keep existing boxholder behavior (if present) to avoid mixing boxholder/non-boxholder days.
  const boxholderFiltered = days.filter(day => day.hasBoxholder === todayMail.hasBoxholder);
  const daysToUse = boxholderFiltered.length >= 3 ? boxholderFiltered : days;

  const similar = findSimilarDays(daysToUse, todayMail, routeConfig, new Date(), { topN: 10, maxCandidates: 120 });

  if (!similar.topMatches.length) return null;

  // Weighted average street time from the matched days
  const byDate = new Map(daysToUse.map((d) => [d.date, d]));
  const totalWeight = similar.topMatches.reduce((s, m) => s + m.weight, 0) || 1;
  const weightedStreetTime = similar.topMatches.reduce((s, m) => {
    const day = byDate.get(m.date);
    const st = day ? getStreetTime(day) : 0;
    return s + (st * m.weight);
  }, 0) / totalWeight;

  const bestScore = similar.topMatches[0]?.matchScore || 0;

  let confidence, badge;
  if (similar.topMatches.length >= 8 && bestScore > 0.85) {
    confidence = 'high';
    badge = '';
  } else if (similar.topMatches.length >= 5 && bestScore > 0.70) {
    confidence = 'good';
    badge = '🍏';
  } else {
    confidence = 'medium';
    badge = '🌱';
  }

  return {
    streetTime: Math.round(weightedStreetTime),
    dayType,
    matchesUsed: similar.topMatches.length,
    confidence,
    badge,
    topMatch: similar.topDay,
    matchedDates: similar.topMatches,
    method: 'volume-similarity',
    boxholderMatched: boxholderFiltered.length >= 3,
  };
}

export function calculateSmartPrediction(todayMail, history, routeConfig) {
  const todayDayType = detectDayType();

  const validHistory = filterValidHistory(history);
  const historyToUse = validHistory.length >= 3 ? validHistory : history;

  if (!historyToUse || historyToUse.length < 3) {
    return calculateSimplePrediction(historyToUse);
  }

  const similarDayTypes = historyToUse
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

    return calculateVolumeWeightedPrediction(recentDays, todayMail, todayDayType, routeConfig);
  }

  return calculateVolumeWeightedPrediction(similarDayTypes, todayMail, todayDayType, routeConfig);
}

export async function calculateFullDayPrediction(todayMail, routeConfig, history, waypoints = null, routeId = null, waypointPauseMinutes = 0, breakStatus = null) {
  let streetPrediction = calculateSmartPrediction(todayMail, history, routeConfig);
  let totalStreetTime;

  // Dana requirement: keep a stable default street-time until we have at least 3 days of CLEAN history.
  // "Clean" = passes filterValidHistory() (valid, non-excluded, sane values).
  const cleanHistoryCount = (filterValidHistory(history) || []).length;
  const useHistoricalPrediction = cleanHistoryCount >= 3 && streetPrediction && streetPrediction.streetTime > 30;

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
      // Default street-time estimate when we have no usable history (or not enough clean history)
      // and no route-specific defaults.
      // 7.5 hours = 450 minutes
      estimatedStreetTime = 450;
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

  const effectiveFlatsFeet = Math.max(0, Number(todayMail.flats || 0) - Number(todayMail.curtailedFlats || 0));
  const effectiveLettersFeet = Math.max(0, Number(todayMail.letters || 0) - Number(todayMail.curtailedLetters || 0));

  let flatsInPieces = effectiveFlatsFeet * TIME_CONSTANTS.FLATS_PER_FOOT;
  let lettersInPieces = effectiveLettersFeet * TIME_CONSTANTS.LETTERS_PER_FOOT;

  // Cased boxholder credit: if the carrier cased an EDDM/boxholder, count one piece per stop.
  // This is merged into letters/flats piece totals so Office Time Breakdown reflects it.
  const stops = Math.max(0, Math.round(Number(todayMail.routeStops || 0) || 0));
  if (stops > 0 && todayMail.casedBoxholder) {
    const t = String(todayMail.casedBoxholderType || '').toLowerCase();
    if (t === 'flats' || t === 'flat') {
      flatsInPieces += stops;
    } else if (t === 'letters' || t === 'letter') {
      lettersInPieces += stops;
    }
  }

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
      feet: effectiveFlatsFeet,
      pieces: Math.round(flatsInPieces),
      time: flatsCaseTime,
    },
    letters: {
      feet: effectiveLettersFeet,
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
  let clockOutTime = addMinutes(leaveOfficeTime, totalStreetTime);

  // Estimate PM office (744) from history, but cap it at P85 so "helping others" outliers
  // don't inflate the route prediction.
  // CRITICAL FIX (Feb 2026): If all breaks have been taken during the route,
  // do NOT add any PM office buffer time. This prevents the 60+ minute gap issue
  // where End of Tour shows way too late (e.g., 6:10 PM instead of 5:00 PM).
  const breaksAlreadyTaken = breakStatus && breakStatus.allBreaksDone;
  
  let pmOfficeAvg = 0;
  let pmOfficeP85 = 0;
  let pmOfficeUsed = 0;

  if (!breaksAlreadyTaken) {
    // Only include historical 744 time if breaks HAVEN'T been taken yet
    const pmOfficeSamples = (history || [])
      .filter((d) => {
        const v = Number(d.pmOfficeTime ?? d.pm_office_time ?? 0) || 0;
        return v > 0;
      })
      // history is already limited upstream in many calls, but we enforce last ~30 records here.
      .slice(0, 30)
      .map((d) => Number(d.pmOfficeTime ?? d.pm_office_time ?? 0) || 0);

    if (pmOfficeSamples.length) {
      const sorted = [...pmOfficeSamples].sort((a, b) => a - b);
      const avg = sorted.reduce((s, n) => s + n, 0) / sorted.length;
      const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(0.85 * sorted.length) - 1));
      const p85 = sorted[idx];

      pmOfficeAvg = Math.round(avg);
      pmOfficeP85 = Math.round(p85);
      pmOfficeUsed = Math.min(pmOfficeAvg, pmOfficeP85);
    }
  }

  let waypointEnhanced = false;
  let returnTimeEstimate = null;

  if (waypoints && waypoints.length > 0 && routeId) {
    const similarDates = streetPrediction?.matchedDates?.map((m) => m.date) || null;
    const predictions = await predictWaypointTimes(waypoints, leaveOfficeTime, routeId, waypointPauseMinutes, similarDates);
    returnTimeEstimate = estimateReturnTime(waypoints, predictions, leaveOfficeTime);

    if (returnTimeEstimate && returnTimeEstimate.predictedReturnTime) {
      const hasCompletedWaypoints = waypoints.some(wp => wp.status === 'completed');

      // DEFENSIVE FIX: Validate waypoint prediction before using it
      // NOTE: predictedReturnTime is a "return to office" estimate (not ET). We'll add PM office later.
      const waypointReturn = returnTimeEstimate.predictedReturnTime;
      const timeBasedClockOut = clockOutTime;

      const isBeforeLeave = waypointReturn < leaveOfficeTime;
      const isSuspiciouslyEarly = (timeBasedClockOut - waypointReturn) > (120 * 60 * 1000); // 2 hours in ms

      if (isBeforeLeave || isSuspiciouslyEarly) {
        console.warn('[PREDICTION] Rejecting waypoint prediction - unreasonable time:', {
          waypointPrediction: waypointReturn.toLocaleTimeString(),
          timeBasedPrediction: timeBasedClockOut.toLocaleTimeString(),
          leaveTime: leaveOfficeTime.toLocaleTimeString(),
          isBeforeLeave,
          isSuspiciouslyEarly
        });
      } else if (hasCompletedWaypoints || returnTimeEstimate.confidence !== 'low') {
        clockOutTime = waypointReturn;
        waypointEnhanced = true;
      }
    }
  }

  // Add capped PM office time (744) at the end.
  if (pmOfficeUsed > 0) {
    clockOutTime = addMinutes(clockOutTime, pmOfficeUsed);
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
    pmOfficeTime: pmOfficeUsed,
    pmOfficeTimeAvg: pmOfficeAvg,
    pmOfficeTimeP85: pmOfficeP85,
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
