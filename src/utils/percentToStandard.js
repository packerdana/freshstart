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
 * Interpretation:
 * - <100% = Faster than standard (efficient)
 * - =100% = Exactly on standard
 * - >100% = Slower than standard
 */

/**
 * Convert feet to pieces using USPS standards
 */
export function convertToMailPieces(lettersFeet, flatsFeet) {
  // RouteWise inputs letters/flats in feet (can be decimals).
  // Converting feet→pieces should NOT always round up, otherwise we inflate volume and skew % to standard.
  // DOIS uses actual piece counts; closest approximation here is rounding to nearest whole piece.
  const letterPieces = Math.round((lettersFeet || 0) * 227);
  const flatPieces = Math.round((flatsFeet || 0) * 115);

  return {
    letterPieces,
    flatPieces,
    totalPieces: letterPieces + flatPieces,
  };
}

/**
 * Calculate standard office time based on mail volume (USPS DOIS formula)
 */
export function calculateStandardOfficeTime(lettersFeet, flatsFeet) {
  const { letterPieces, flatPieces, totalPieces } = convertToMailPieces(lettersFeet, flatsFeet);
  
  // USPS casing standards
  const letterMinutes = letterPieces / 18;
  const flatMinutes = flatPieces / 8;
  const pullDownMinutes = totalPieces / 70;
  
  const standardTotal = letterMinutes + flatMinutes + pullDownMinutes;
  
  return {
    letterPieces,
    flatPieces,
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
 * @returns {object} Performance metrics
 */
export function calculatePercentToStandard(lettersFeet, flatsFeet, actualMinutes) {
  const standard = calculateStandardOfficeTime(lettersFeet, flatsFeet);

  // Guard against divide-by-zero (e.g., if volume is 0)
  if (!standard.standardTotal || standard.standardTotal <= 0) {
    return null;
  }

  // % to Standard (DOIS formula): (ACTUAL / STANDARD) × 100
  const percentToStandard = (actualMinutes / standard.standardTotal) * 100;

  // Variance (positive = slower, negative = faster)
  const variance = actualMinutes - standard.standardTotal;
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
    totalPieces: standard.totalPieces,

    // Standard times (what DOIS expects)
    letterMinutes: Math.round(standard.letterMinutes),
    flatMinutes: Math.round(standard.flatMinutes),
    pullDownMinutes: Math.round(standard.pullDownMinutes),
    standardTotal: Math.round(standard.standardTotal),

    // Actual time
    actualMinutes: Math.round(actualMinutes),

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

  const toNum = (v) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : 0;
  };

  // Prefer the most "true" office time if present.
  // - actualOfficeTime: user-entered actual office time (if tracked)
  // - officeTime: route_history.office_time (AM office time)
  // - office_time: legacy snake_case
  const getOfficeMinutes = (day) => {
    const actual = toNum(day.actualOfficeTime ?? day.actual_office_time);
    if (actual > 0) return actual;

    const office = toNum(day.officeTime ?? day.office_time);
    return office;
  };

  const validRecords = historyRecords.filter((day) => {
    const lettersFeet = toNum(day.letters);
    const flatsFeet = toNum(day.flats);
    const officeMinutes = getOfficeMinutes(day);

    // Need some mail volume (otherwise standard time is ~0) and an actual office time.
    return (lettersFeet > 0 || flatsFeet > 0) && officeMinutes > 0;
  });

  if (validRecords.length === 0) {
    return null;
  }

  const performances = validRecords
    .map((day) => {
      const lettersFeet = toNum(day.letters);
      const flatsFeet = toNum(day.flats);
      const officeMinutes = getOfficeMinutes(day);

      const perf = calculatePercentToStandard(lettersFeet, flatsFeet, officeMinutes);
      if (!perf) return null;

      // Guard against NaN if something weird slips in.
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
