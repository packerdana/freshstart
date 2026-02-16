function getDayType(date = new Date()) {
  const dayOfWeek = date.getDay();
  const month = date.getMonth();

  if (month === 11) return 'peak';

  if (dayOfWeek === 1) return 'monday';

  return 'normal';
}

function calculatePackagePattern(history) {
  if (!history || history.length === 0) {
    return {};
  }

  const patterns = {
    monday: { totalParcels: 0, totalSprs: 0, count: 0 },
    peak: { totalParcels: 0, totalSprs: 0, count: 0 },
    normal: { totalParcels: 0, totalSprs: 0, count: 0 }
  };

  history.forEach(day => {
    const parcels = day.parcels || 0;
    const sprs = day.spurs || day.sprs || 0;
    const totalPackages = parcels + sprs;

    if (totalPackages === 0) return;

    const dayDate = new Date(day.date);
    const dayType = getDayType(dayDate);

    patterns[dayType].totalParcels += parcels;
    patterns[dayType].totalSprs += sprs;
    patterns[dayType].count += 1;
  });

  const result = {};
  Object.keys(patterns).forEach(dayType => {
    const pattern = patterns[dayType];
    if (pattern.count >= 3) {
      const totalPackages = pattern.totalParcels + pattern.totalSprs;
      result[dayType] = {
        parcelRatio: pattern.totalParcels / totalPackages,
        spurRatio: pattern.totalSprs / totalPackages,
        avgParcels: Math.round(pattern.totalParcels / pattern.count),
        avgSprs: Math.round(pattern.totalSprs / pattern.count),
        count: pattern.count
      };
    }
  });

  return result;
}

export function estimatePackageSplit(scannerTotal, history) {
  if (scannerTotal === 0 || !scannerTotal) {
    return {
      parcels: 0,
      sprs: 0,
      confidence: 'none',
      dayType: 'normal',
      source: 'none'
    };
  }

  const dayType = getDayType();
  const patterns = calculatePackagePattern(history);
  const dayPattern = patterns[dayType];

  let parcelRatio = 0.42;
  let spurRatio = 0.58;
  let confidence = 'default';
  let source = 'default';

  if (dayPattern && dayPattern.count >= 3) {
    parcelRatio = dayPattern.parcelRatio;
    spurRatio = dayPattern.spurRatio;
    confidence = dayPattern.count >= 10 ? 'high' : dayPattern.count >= 5 ? 'good' : 'medium';
    source = 'history';
  }

  const estimatedParcels = Math.round(scannerTotal * parcelRatio);
  const estimatedSprs = scannerTotal - estimatedParcels;

  return {
    parcels: estimatedParcels,
    sprs: estimatedSprs,
    parcelRatio,
    spurRatio,
    confidence,
    dayType,
    source,
    patternCount: dayPattern?.count || 0
  };
}

export function getPackageEstimationMessage(estimation) {
  if (!estimation || estimation.source === 'none') {
    return 'Enter scanner total to estimate package split';
  }

  if (estimation.source === 'default') {
    const percent = Math.round(estimation.parcelRatio * 100);
    return `Using default split (${percent}% parcels, ${Math.round(estimation.spurRatio * 100)}% SPRs)`;
  }

  const percent = Math.round(estimation.parcelRatio * 100);
  const confidenceText = estimation.confidence === 'high' ? 'accurate' : estimation.confidence === 'good' ? 'reliable' : 'reasonable';
  return `${confidenceText.charAt(0).toUpperCase() + confidenceText.slice(1)} estimate based on ${estimation.patternCount} ${estimation.dayType} days (${percent}% parcels)`;
}

export { getDayType, calculatePackagePattern };
