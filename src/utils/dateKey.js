import { getLocalDateString, parseLocalDate } from './time';

// Convert a Date (or date-like) to YYYY-MM-DD in *local* time.
// Use this for Supabase date columns to avoid UTC day-jump bugs.
export function toLocalDateKey(dateLike = new Date()) {
  if (typeof dateLike === 'string') {
    // Already a YYYY-MM-DD key
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateLike)) return dateLike;
    // Try parsing ISO-ish
    const d = new Date(dateLike);
    if (!isNaN(d.getTime())) return toLocalDateKey(d);
  }

  if (dateLike instanceof Date && !isNaN(dateLike.getTime())) {
    const year = dateLike.getFullYear();
    const month = String(dateLike.getMonth() + 1).padStart(2, '0');
    const day = String(dateLike.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fallback: now
  return getLocalDateString();
}

// Local yesterday key (YYYY-MM-DD)
export function getLocalYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateKey(d);
}

// Add N days to a YYYY-MM-DD key (local)
export function addDaysKey(dateKey, days) {
  const d = parseLocalDate(dateKey);
  d.setDate(d.getDate() + days);
  return toLocalDateKey(d);
}
