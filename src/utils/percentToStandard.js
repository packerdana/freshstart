/**
 * Calculate % to Standard (USPS DOIS formula)
 *
 * USPS Standards:
 * - Letters: 18 pieces per minute
 * - Flats: 8 pieces per minute
 * - Pull-down: 70 pieces per minute
 *
 * Formula: % to Standard = (Actual Time / Standard Time) × 100
 *
 * IMPORTANT:
 * DOIS "% to standard" is based on time to CASE + WITHDRAW mail.
 * RouteWise's "office time" (722) includes other fixed tasks (stand-up, accountables, etc.).
 * If we feed total 722 minutes into this formula, % will look wildly high.
 */

import { TIME_CONSTANTS } from './constants';

const toNum = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Convert feet to pieces using USPS standards
 */
export function convertToMailPieces(lettersFeet, flatsFeet, sprsCount = 0) {
  // RouteWise inputs letters/flats in feet (can be decimals).
  // Converting feet→pieces should NOT always round up, otherwise we inflate volume and skew % to standard.
  // DOIS uses actual piece counts; closest approximation here is rounding to nearest whole piece.
  const letterPieces = Math.round((lettersFeet || 0) * 227);
  const flatPiecesFromFeet = Math.round((flatsFeet || 0) * 115);

  // Dana rule: SPRs count as a "flat piece".
  const sprPieces = Math.max(0, Math.round(toNum(sprsCount)));

  const flatPieces = flatPiecesFromFeet + sprPieces;

  return {
    letterPieces,
    flatPieces,
    sprPieces,
    totalPieces: letterPieces + flatPieces,
  };
}

/**
 * Calculate standard office time based on mail volume (USPS DOIS formula)
 */
export function calculateStandardOfficeTime(lettersFeet, flatsFeet, sprsCount = 0) {
  const { letterPieces, flatPieces, totalPieces, sprPieces } = convertToMailPieces(lettersFeet, flatsFeet, sprsCount);
  
  // USPS casing standards
  const letterMinutes = letterPieces / 18;
  const flatMinutes = flatPieces / 8;
  const pullDownMinutes = totalPieces / 70;
  
  const standardTotal = letterMinutes + flatMinutes + pullDownMinutes;
  
  return {
    letterPieces,
    flatPieces,
    sprPieces,
    totalPieces,
    letterMinutes,
    flatMinutes,
    pullDownMinutes,
    standardTotal
  };
}

/**
 * Calculate % to Standard for office performance (722)
 * 
 * @param {number} lettersFeet - Letters in feet
 * @param {number} flatsFeet - Flats in feet
 * @param {number} actualMinutes - Actual office time in minutes
 * @param {number} predictedMinutes - Predicted office time (including all tasks, not just DOIS)
 * @returns {object} Performance metrics
 */
export function calculatePercentToStandard(lettersFeet, flatsFeet, actualMinutes, sprsCount = 0, predictedMinutes = null) {
  const standard = calculateStandardOfficeTime(lettersFeet, flatsFeet, sprsCount);

  const actual = toNum(actualMinutes);

  // Use provided predicted time as standard if available; otherwise fall back to DOIS formula
  let standardTotal = standard.standardTotal;
  if (predictedMinutes && toNum(predictedMinutes) > 0) {
    standardTotal = toNum(predictedMinutes);
  }

  // Guard against divide-by-zero
  if (!standardTotal || standardTotal <= 0 || actual <= 0) {
    return null;
  }

  // % to Standard: (ACTUAL / STANDARD) × 100
  const percentToStandard = (actual / standardTotal) * 100;

  // Variance (positive = slower, negative = faster)
  const variance = actual - standardTotal;
  const variancePercent = percentToStandard - 100;

  // Interpretation
  let interpretation = 'on-standard';
  let arrow = '➡️';

  if (percentToStandard < 95) {
    interpretation = 'fast';
    arrow = '⬇️';
  } else if (percentToStandard > 105) {
    interpretation = 'slow';
    arrow = '⬆️';
  }

  return {
    // Mail volume
    letterPieces: standard.letterPieces,
    flatPieces: standard.flatPieces,
    sprPieces: standard.sprPieces,
    totalPieces: standard.totalPieces,

    // Standard times (DOIS formula for reference)
    letterMinutes: Math.round(standard.letterMinutes),
    flatMinutes: Math.round(standard.flatMinutes),
    pullDownMinutes: Math.round(standard.pullDownMinutes),
    doisStandardTotal: Math.round(standard.standardTotal),
    
    // Actual standard used (either predicted or DOIS)
    standardTotal: Math.round(standardTotal),

    // Actual time
    actualMinutes: Math.round(actual),

    // Performance metrics
    percentToStandard: Math.round(percentToStandard),
    variance: Math.round(variance),
    variancePercent: Math.round(variancePercent),

    // Display helpers
    interpretation,
    arrow,
    isFast: percentToStandard < 100,
    isSlow: percentToStandard > 100,
    isOnStandard: percentToStandard >= 95 && percentToStandard <= 105,
  };
}

/**
 * Format % to Standard for display
 */
export function formatPercentToStandard(percentToStandard, variance) {
  const arrow = percentToStandard < 95 ? '⬇️' : 
                percentToStandard > 105 ? '⬆️' : '➡️';
  
  const description = percentToStandard < 100 ? 
    `${Math.abs(variance)} min faster` :
    percentToStandard > 100 ?
    `${Math.abs(variance)} min slower` :
    'on standard';
  
  return {
    arrow,
    description,
    display: `${percentToStandard}% ${arrow}`,
    fullDisplay: `${percentToStandard}% ${arrow} (${description})`
  };
}

/**
 * Calculate average % to Standard from history
 */
export function calculateAveragePerformance(historyRecords) {
  if (!historyRecords || historyRecords.length === 0) {
    return null;
  }

  // Use captured actual 722 (AM office) minutes as the "actual" time for % to standard.
  // This is simple and requires no extra user input.
  const getOfficeMinutes = (day) => {
    const actual = toNum(day.actualOfficeTime ?? day.actual_office_time);
    if (actual > 0) return actual;

    const office = toNum(day.officeTime ?? day.office_time);
    return office;
  };

  const validRecords = historyRecords.filter((day) => {
    const lettersFeet = toNum(day.letters);
    const flatsFeet = toNum(day.flats);
    const sprs = toNum(day.sprs ?? day.spurs);
    const officeMinutes = getOfficeMinutes(day);

    return (lettersFeet > 0 || flatsFeet > 0 || sprs > 0) && officeMinutes > 0;
  });

  if (validRecords.length === 0) {
    return null;
  }

  const performances = validRecords
    .map((day) => {
      const lettersFeet = toNum(day.letters);
      const flatsFeet = toNum(day.flats);
      const sprs = toNum(day.sprs ?? day.spurs);
      const officeMinutes = Math.max(1, Math.round(getOfficeMinutes(day)));

      const perf = calculatePercentToStandard(lettersFeet, flatsFeet, officeMinutes, sprs);
      if (!perf) return null;

      if (!Number.isFinite(perf.percentToStandard)) return null;
      return perf;
    })
    .filter(Boolean);

  if (performances.length === 0) return null;

  const avgPercent = performances.reduce((sum, p) => sum + p.percentToStandard, 0) / performances.length;

  const best = performances.reduce((best, current) =>
    current.percentToStandard < best.percentToStandard ? current : best
  );

  const worst = performances.reduce((worst, current) =>
    current.percentToStandard > worst.percentToStandard ? current : worst
  );

  const daysUnder100 = performances.filter((p) => p.percentToStandard < 100).length;

  return {
    avgPercent: Math.round(avgPercent),
    best: Math.round(best.percentToStandard),
    worst: Math.round(worst.percentToStandard),
    daysUnder100,
    totalDays: performances.length,
    consistency: Math.round((daysUnder100 / performances.length) * 100),
  };
}
