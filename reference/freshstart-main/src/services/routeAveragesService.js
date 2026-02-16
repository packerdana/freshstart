export function calculateRouteAverages(history) {
  if (!history || history.length === 0) {
    return {};
  }

  const validHistory = history.filter(d => {
    if (d.streetTimeNormalized != null && d.streetTimeNormalized > 0) return true;
    if (d.streetTime != null && d.streetTime > 0) return true;
    if (d.streetHours != null && d.streetHours > 0) return true;
    return false;
  });

  const byDayType = {
    normal: [],
    monday: []
  };

  validHistory.forEach(day => {
    let streetTimeMinutes;

    if (day.streetTimeNormalized != null && day.streetTimeNormalized > 0) {
      streetTimeMinutes = day.streetTimeNormalized;
    } else if (day.streetTime != null && day.streetTime > 0) {
      streetTimeMinutes = day.streetTime;
    } else if (day.streetHours != null && day.streetHours > 0) {
      streetTimeMinutes = day.streetHours * 60;
    }

    if (!streetTimeMinutes || streetTimeMinutes <= 0) return;

    if (new Date(day.date).getDay() === 1) {
      byDayType.monday.push(streetTimeMinutes);
    } else {
      byDayType.normal.push(streetTimeMinutes);
    }
  });

  const averages = {};

  Object.keys(byDayType).forEach(type => {
    if (byDayType[type].length > 0) {
      const avg = byDayType[type].reduce((a, b) => a + b, 0) / byDayType[type].length;
      averages[type] = avg / 60;
    }
  });

  return averages;
}
