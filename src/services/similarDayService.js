import { getDayType } from '../utils/holidays';

function safeNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function match01(a, b) {
  const x = safeNum(a, 0);
  const y = safeNum(b, 0);
  const denom = Math.max(Math.abs(x), Math.abs(y), 1);
  return 1 - (Math.abs(x - y) / denom);
}

function getRouteType(routeConfig) {
  const rt = (routeConfig?.routeType || routeConfig?.route_type || '').toLowerCase();
  if (rt.includes('mount')) return 'mounted';
  if (rt.includes('walk')) return 'walking';
  if (rt.includes('mix')) return 'mixed';
  return 'mixed';
}

function getWeights(routeType) {
  // Base weights (sum ~= 1). Flats/letters are feet.
  let w = {
    dps: 0.30,
    flats: 0.20,
    letters: 0.15,
    parcels: 0.25,
    sprs: 0.10,
  };

  // DPS hurts mounted/mixed more (can't sort while driving).
  if (routeType === 'mounted') {
    w = { ...w, dps: 0.38, parcels: 0.23, flats: 0.18, letters: 0.13, sprs: 0.08 };
  } else if (routeType === 'mixed') {
    w = { ...w, dps: 0.34, parcels: 0.24, flats: 0.19, letters: 0.14, sprs: 0.09 };
  } else {
    // walking
    w = { ...w, dps: 0.26, parcels: 0.27, flats: 0.20, letters: 0.17, sprs: 0.10 };
  }

  return w;
}

export function findSimilarDays(historyDays, todayMail, routeConfig, targetDate = new Date(), options = {}) {
  const {
    maxCandidates = 90,
    topN = 10,
    minDays = 3,
  } = options;

  const routeType = getRouteType(routeConfig);
  const weights = getWeights(routeType);

  const targetDayType = getDayType(
    typeof targetDate === 'string'
      ? targetDate
      : `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
  );

  const clean = (historyDays || []).filter((d) => {
    const aux = !!(d.auxiliaryAssistance ?? d.auxiliary_assistance);
    const mnd = !!(d.mailNotDelivered ?? d.mail_not_delivered);
    const ns = !!(d.isNsDay ?? d.is_ns_day);
    return !aux && !mnd && !ns;
  });

  // Prefer same day type, else fall back to all clean.
  const sameType = clean.filter((d) => {
    const dt = d.dayType || getDayType(d.date);
    return dt === targetDayType;
  });

  const pool = (sameType.length >= minDays ? sameType : clean)
    .filter((d) => d.date)
    .slice(0, maxCandidates);

  const matches = pool.map((day) => {
    const dpsScore = match01(day.dps, todayMail.dps);
    const flatsScore = match01(day.flats, todayMail.flats);
    const lettersScore = match01(day.letters, todayMail.letters);
    const parcelsScore = match01(day.parcels, todayMail.parcels);
    const sprsScore = match01(day.sprs ?? day.spurs, todayMail.sprs ?? todayMail.spurs);

    const matchScore =
      (dpsScore * weights.dps) +
      (flatsScore * weights.flats) +
      (lettersScore * weights.letters) +
      (parcelsScore * weights.parcels) +
      (sprsScore * weights.sprs);

    const daysDiff = (new Date() - new Date(day.date)) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0.55, 1 - (daysDiff / 75));
    const combinedWeight = Math.max(0.0001, matchScore * recencyWeight);

    return {
      day,
      matchScore,
      recencyWeight,
      combinedWeight,
    };
  });

  matches.sort((a, b) => b.combinedWeight - a.combinedWeight);

  const top = matches.slice(0, Math.min(topN, matches.length));

  const totalWeight = top.reduce((s, m) => s + m.combinedWeight, 0) || 1;

  return {
    targetDayType,
    routeType,
    weights,
    topMatches: top.map((m) => ({
      date: m.day.date,
      weight: m.combinedWeight,
      matchScore: m.matchScore,
    })),
    topDay: top[0]?.day || null,
    confidenceHint: top[0]?.matchScore || 0,
    poolSize: pool.length,
  };
}
