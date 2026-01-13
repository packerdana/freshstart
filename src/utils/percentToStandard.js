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
  const letterPieces = Math.ceil(lettersFeet * 227);
  const flatPieces = Math.ceil(flatsFeet * 115);
  
  return {
    letterPieces,
    flatPieces,
    totalPieces: letterPieces + flatPieces
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
  
  // % to Standard (DOIS formula)
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
    isOnStandard: percentToStandard >= 95 && percentToStandard <= 105
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
  
  const validRecords = historyRecords.filter(day => 
    day.letters > 0 && 
    day.flats > 0 && 
    day.office_time > 0
  );
  
  if (validRecords.length === 0) {
    return null;
  }
  
  const performances = validRecords.map(day => {
    const officeTime = day.office_time || day.officeTime || 0;
    return calculatePercentToStandard(day.letters, day.flats, officeTime);
  });
  
  const avgPercent = performances.reduce((sum, p) => sum + p.percentToStandard, 0) / performances.length;
  
  const best = performances.reduce((best, current) => 
    current.percentToStandard < best.percentToStandard ? current : best
  );
  
  const worst = performances.reduce((worst, current) => 
    current.percentToStandard > worst.percentToStandard ? current : worst
  );
  
  const daysUnder100 = performances.filter(p => p.percentToStandard < 100).length;
  
  return {
    avgPercent: Math.round(avgPercent),
    best: Math.round(best.percentToStandard),
    worst: Math.round(worst.percentToStandard),
    daysUnder100,
    totalDays: performances.length,
    consistency: Math.round((daysUnder100 / performances.length) * 100)
  };
}
