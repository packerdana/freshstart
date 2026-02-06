/**
 * Derive office time (722) from route start time and first 721 start.
 *
 * 722 (AM Office Time) = time from route start (clock-in) until leaving for street (721 start).
 * The route start is typically 07:30 local Chicago time.
 * The first 721 start is stored as UTC ISO timestamp.
 */

import { utcToChicagoMinutes, parseHHMMToMinutes } from './timezone.js';

/**
 * Derive 722 (AM office time) minutes from route start time and first 721 start timestamp.
 *
 * @param {string} routeStartTimeHHMM - Route start time as HH:MM string in Chicago local time (e.g., "07:30")
 * @param {string} first721StartUtc - First 721 start timestamp as UTC ISO string (e.g., "2026-02-05T14:29:39Z")
 * @returns {number} Derived 722 minutes, or 0 if inputs are invalid
 *
 * @example
 * // Route starts at 07:30 Chicago time
 * // First 721 starts at 14:29:39 UTC = 08:29:39 CST (Central Standard Time, UTC-6)
 * // Derived 722 = 08:29 - 07:30 = 59 minutes
 * deriveOfficeTimeMinutes('07:30', '2026-02-05T14:29:39Z') // returns 59
 */
export function deriveOfficeTimeMinutes(routeStartTimeHHMM, first721StartUtc) {
  if (!routeStartTimeHHMM || !first721StartUtc) {
    return 0;
  }

  const routeStartMinutes = parseHHMMToMinutes(routeStartTimeHHMM);
  const first721ChicagoMinutes = utcToChicagoMinutes(first721StartUtc);

  if (routeStartMinutes === 0 && !routeStartTimeHHMM.startsWith('00:')) {
    // Invalid parse
    return 0;
  }

  // 722 = time from route start until 721 start
  let officeMinutes = first721ChicagoMinutes - routeStartMinutes;

  // Handle edge case: if negative (shouldn't happen in normal ops), return 0
  if (officeMinutes < 0) {
    // Could be clock rollover edge case, add a day
    officeMinutes += 24 * 60;
    // If still unreasonable (> 12 hours), just return 0
    if (officeMinutes > 12 * 60) {
      return 0;
    }
  }

  return Math.round(officeMinutes);
}

/**
 * Find the first 721 operation code record from an array of operation code records.
 * @param {Array} operationCodes - Array of operation code records with code and start_time
 * @returns {Object|null} The first 721 record, or null if none found
 */
export function findFirst721(operationCodes) {
  if (!Array.isArray(operationCodes)) return null;

  return operationCodes
    .filter((r) => r?.code === '721' && r?.start_time)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0] || null;
}
