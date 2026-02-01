export function parseTimeString(timeStr) {
  if (!timeStr) return null;

  const time24Format = /^(\d{1,2}):(\d{2})$/;
  const time12Format = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

  let hours, minutes, isPM = false;

  if (time24Format.test(timeStr)) {
    const match = timeStr.match(time24Format);
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
  } else if (time12Format.test(timeStr)) {
    const match = timeStr.match(time12Format);
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    isPM = match[3].toUpperCase() === 'PM';

    if (hours === 12) {
      hours = isPM ? 12 : 0;
    } else if (isPM) {
      hours += 12;
    }
  } else {
    throw new Error(`Invalid time format: ${timeStr}. Use HH:MM or HH:MM AM/PM`);
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time values: ${timeStr}`);
  }

  return { hours, minutes };
}

export function addHoursToTime(timeStr, hoursToAdd) {
  const parsed = parseTimeString(timeStr);
  if (!parsed) return null;

  const totalMinutes = (parsed.hours * 60) + parsed.minutes + (hoursToAdd * 60);
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = Math.floor(totalMinutes % 60);

  return { hours: newHours, minutes: newMinutes };
}

export function calculateTimeDifferenceMinutes(startTime, endTime) {
  const start = parseTimeString(startTime);
  const end = parseTimeString(endTime);

  if (!start || !end) return null;

  let startMinutes = start.hours * 60 + start.minutes;
  let endMinutes = end.hours * 60 + end.minutes;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
}

export function calculateOvertime(startTime, tourLengthHours, actualEndTime) {
  try {
    const scheduledEndTime = addHoursToTime(startTime, tourLengthHours);

    if (!scheduledEndTime) {
      throw new Error('Failed to calculate scheduled end time');
    }

    const scheduledEndStr = `${String(scheduledEndTime.hours).padStart(2, '0')}:${String(scheduledEndTime.minutes).padStart(2, '0')}`;

    const actualEnd = parseTimeString(actualEndTime);
    const scheduledEnd = parseTimeString(scheduledEndStr);

    const actualEndMinutes = actualEnd.hours * 60 + actualEnd.minutes;
    const scheduledEndMinutes = scheduledEnd.hours * 60 + scheduledEnd.minutes;

    const overtimeMinutes = actualEndMinutes - scheduledEndMinutes;

    const overtimeDecimalHours = overtimeMinutes / 60;

    const hours = Math.floor(Math.abs(overtimeMinutes) / 60);
    const minutes = Math.abs(overtimeMinutes) % 60;
    const sign = overtimeMinutes < 0 ? '-' : '';
    const overtimeFormatted = `${sign}${hours}:${String(minutes).padStart(2, '0')}`;

    return {
      minutes: Math.max(0, overtimeMinutes),
      decimalHours: Math.max(0, overtimeDecimalHours),
      formatted: overtimeMinutes > 0 ? overtimeFormatted : '0:00',
      scheduledEndTime: scheduledEndStr,
      isOvertime: overtimeMinutes > 0
    };
  } catch (error) {
    throw new Error(`Overtime calculation failed: ${error.message}`);
  }
}

export function formatTimeToAMPM(hours, minutes) {
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function calculateOvertimeFromClockTimes(startTime, tourLengthHours, actualEndTime) {
  const result = calculateOvertime(startTime, tourLengthHours, actualEndTime);

  const start = parseTimeString(startTime);
  const scheduledEnd = parseTimeString(result.scheduledEndTime);
  const actualEnd = parseTimeString(actualEndTime);

  return {
    startTime: formatTimeToAMPM(start.hours, start.minutes),
    tourLength: `${tourLengthHours} hours`,
    scheduledEndTime: formatTimeToAMPM(scheduledEnd.hours, scheduledEnd.minutes),
    actualEndTime: formatTimeToAMPM(actualEnd.hours, actualEnd.minutes),
    overtime: {
      minutes: result.minutes,
      decimalHours: result.decimalHours.toFixed(2),
      formatted: result.formatted,
      isOvertime: result.isOvertime
    }
  };
}
