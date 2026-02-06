/**
 * Timezone utilities for America/Chicago (Central Time).
 * USPS route times are in local Chicago time, but timestamps in DB are UTC.
 */

const CHICAGO_TZ = 'America/Chicago';

/**
 * Convert a UTC ISO string to a Date object representing Chicago local time components.
 * @param {string|Date} utcInput - UTC ISO string or Date object
 * @returns {{ hours: number, minutes: number, dateKey: string }} Chicago local time parts
 */
export function utcToChicago(utcInput) {
  const date = utcInput instanceof Date ? utcInput : new Date(utcInput);
  if (isNaN(date.getTime())) {
    return { hours: 0, minutes: 0, dateKey: '' };
  }

  // Use Intl.DateTimeFormat to extract Chicago local components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '0';

  const hours = parseInt(get('hour'), 10);
  const minutes = parseInt(get('minute'), 10);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const dateKey = `${year}-${month}-${day}`;

  return { hours, minutes, dateKey };
}

/**
 * Convert a UTC ISO string to total minutes since midnight in Chicago time.
 * @param {string|Date} utcInput - UTC ISO string or Date object
 * @returns {number} Minutes since midnight in America/Chicago
 */
export function utcToChicagoMinutes(utcInput) {
  const { hours, minutes } = utcToChicago(utcInput);
  return hours * 60 + minutes;
}

/**
 * Format a UTC timestamp as Chicago local time string (h:mm a).
 * @param {string|Date} utcInput - UTC ISO string or Date object
 * @returns {string} Formatted time like "8:29 AM"
 */
export function formatUtcAsChicago(utcInput) {
  const date = utcInput instanceof Date ? utcInput : new Date(utcInput);
  if (isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Parse an HH:MM string to total minutes since midnight.
 * @param {string} hhmmStr - Time string like "07:30"
 * @returns {number} Minutes since midnight
 */
export function parseHHMMToMinutes(hhmmStr) {
  if (!hhmmStr || typeof hhmmStr !== 'string') return 0;
  const [h, m] = hhmmStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}
