import { getDayType } from '../utils/holidays';

export function calculateRouteAverages(history) {
  if (!history || history.length === 0) {
    return {};
  }

  const validHistory = history.filter((d) => {
    // Exclude flagged "bad data" days from averages by default.
    if (d.excludeFromAverages) return false;

    if (d.streetTimeNormalized != null && d.streetTimeNormalized > 0) return true;
    if (d.streetTime != null && d.streetTime > 0) return true;
    if (d.streetHours != null && d.streetHours > 0) return true;
    return false;
  });

  // G4 fix: include all four day types so saturday and day-after-holiday
  // don't contaminate the normal average in StatsScreen.
  const byDayType = {
    normal: [],
    monday: [],
    saturday: [],
    'day-after-holiday': [],
  };

  validHistory.forEach((day) => {
    let streetTimeMinutes;

    if (day.streetTimeNormalized != null && day.streetTimeNormalized > 0) {
      streetTimeMinutes = day.streetTimeNormalized;
    } else if (day.streetTime != null && day.streetTime > 0) {
      streetTimeMinutes = day.streetTime;
    } else if (day.streetHours != null && day.streetHours > 0) {
      streetTimeMinutes = day.streetHours * 60;
    }

    if (!streetTimeMinutes || streetTimeMinutes <= 0) return;

    // G4 fix: use getDayType() (the same classifier used for predictions) instead of
    // a raw dayOfWeek === 1 check.  This ensures day-after-holiday and saturday are
    // classified correctly and don't bleed into the normal/monday buckets.
    const dayType = day.dayType || getDayType(day.date);
    const bucket = Object.prototype.hasOwnProperty.call(byDayType, dayType) ? dayType : 'normal';
    byDayType[bucket].push(streetTimeMinutes);
  });

  const averages = {};

  Object.keys(byDayType).forEach((type) => {
    if (byDayType[type].length > 0) {
      const avgMinutes = byDayType[type].reduce((a, b) => a + b, 0) / byDayType[type].length;
      // Store minutes to avoid confusing decimals like "7.6 hrs".
      averages[type] = Math.round(avgMinutes);
    }
  });

  return averages;
}

