// src/utils/dayHistoryDisplay.js
// Pure helpers for Stats -> Day History display logic.

const CORE_CODES = ['722', '721', '744'];

function minutesFromRow(detailRows = [], code) {
  const row = (detailRows || []).find((r) => String(r?.code) === String(code));
  if (!row) return 0;
  return Number(row.duration_minutes || 0) || 0;
}

function getHistMinutes(hist, code) {
  if (!hist) return 0;
  if (code === '722') return Number(hist.officeTime ?? hist.office_time ?? 0) || 0;
  if (code === '721') {
    return (
      Number(
        hist.streetTimeNormalized ??
          hist.street_time_normalized ??
          hist.streetTime ??
          hist.street_time ??
          0,
      ) || 0
    );
  }
  if (code === '744') return Number(hist.pmOfficeTime ?? hist.pm_office_time ?? 0) || 0;
  return 0;
}

/**
 * Decide whether the expanded Day History rows should show the fixed (route_history) minutes
 * instead of the timer/operation-code timestamp rows.
 *
 * We only flip to "fixed" when we have a route_history record AND it materially disagrees with
 * the detailed operation-code rows (or the detailed rows are missing).
 */
export function shouldUseFixedCoreRows({ hist, detailRows, thresholdMinutes = 5 } = {}) {
  if (!hist) return false;

  // If there are no detail rows, showing fixed is still better than empty.
  if (!detailRows || detailRows.length === 0) return true;

  return CORE_CODES.some((code) => {
    const hm = getHistMinutes(hist, code);
    if (hm <= 0) return false;

    const dm = minutesFromRow(detailRows, code);
    // If the detail row is missing or wildly different, it's likely that the day was manually fixed
    // (or the timers were incomplete). In either case, use the fixed minutes for the breakdown.
    if (dm <= 0) return true;

    return Math.abs(hm - dm) > thresholdMinutes;
  });
}

/**
 * Build rows to render in the expanded Day History panel.
 *
 * If the day appears "fixed", we synthesize core-code rows (722/721/744) using route_history minutes
 * and omit misleading timestamp ranges.
 */
export function buildExpandedDayHistoryRows({
  date,
  detailRows = [],
  hist,
  codeNameByCode = {},
  useFixed,
} = {}) {
  const shouldFix = useFixed ?? shouldUseFixedCoreRows({ hist, detailRows });

  const offRouteRows = (detailRows || []).filter((r) => !CORE_CODES.includes(String(r?.code)));

  if (!shouldFix) {
    return { rows: detailRows || [], mode: 'timers' };
  }

  const fixedCoreRows = CORE_CODES.map((code) => {
    const mins = getHistMinutes(hist, code);
    // Show row even if mins is 0? Better to show 0 explicitly so user sees what's happening.
    return {
      id: `fixed-${code}-${date || ''}`,
      code,
      code_name: codeNameByCode[code] || '',
      duration_minutes: mins,
      _fixed: true,
    };
  });

  return { rows: [...fixedCoreRows, ...offRouteRows], mode: 'fixed' };
}

export const __private = { minutesFromRow, getHistMinutes, CORE_CODES };
