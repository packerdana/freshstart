import { parseLocalDate } from '../utils/time';

export function calculateRouteAverages(history) {
  if (!history || history.length === 0) {
    return {};
  }

  const validHistory = history.filter((d) => {
    if (d.streetTimeNormalized != null && d.streetTimeNormalized > 0) return true;
    if (d.streetTime != null && d.streetTime > 0) return true;
    if (d.streetHours != null && d.streetHours > 0) return true;
    return false;
  });

  const byDayType = {
    normal: [],
    monday: [],
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

    // IMPORTANT: day.date is a YYYY-MM-DD string.
    // new Date('YYYY-MM-DD') is parsed as UTC in many environments and can shift the day.
    // Use parseLocalDate so Monday stays Monday.
    const dayOfWeek = parseLocalDate(day.date).getDay();

    if (dayOfWeek === 1) {
      byDayType.monday.push(streetTimeMinutes);
    } else {
      byDayType.normal.push(streetTimeMinutes);
    }
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

