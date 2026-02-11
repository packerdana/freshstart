// Single source of truth for "live" expected waypoint times.
// The rules here are intentionally simple and testable.

export function isValidPredictedMinutes(value) {
  if (value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n);
}

export function shouldApplyLiveOffset(seqNum, scheduleOffset) {
  const seq = Number(seqNum);
  if (!Number.isFinite(seq)) return false;
  const fromSeq = scheduleOffset?.fromSeq;
  if (fromSeq == null) return false;
  const from = Number(fromSeq);
  if (!Number.isFinite(from)) return false;
  return seq > from;
}

export function applyLiveOffsetToPredictedTime(predTime, seqNum, scheduleOffset) {
  if (!(predTime instanceof Date) || isNaN(predTime.getTime())) return predTime;
  if (!shouldApplyLiveOffset(seqNum, scheduleOffset)) return predTime;
  const minutes = Number(scheduleOffset?.minutes || 0);
  if (!Number.isFinite(minutes) || minutes === 0) return predTime;
  return new Date(predTime.getTime() + Math.round(minutes) * 60_000);
}

// Day-rollover sanity check for expected times.
//
// Problem: we often only have a time-of-day anchor (e.g., "07:30") and build Date objects
// from it. If the UI is opened after midnight or the base date is off, computed expected
// times can appear to be "yesterday" (earlier than now by many hours).
//
// Rule: if an expected time is earlier than now by > maxPastMinutes, roll it forward by
// 24h until it is no longer "too far in the past" (bounded by maxDays).
export function applyExpectedTimeRolloverSanity(expectedTime, now = new Date(), opts = {}) {
  const maxPastMinutes = Number(opts?.maxPastMinutes ?? 60);
  const maxDays = Number(opts?.maxDays ?? 2);

  if (!(expectedTime instanceof Date) || isNaN(expectedTime.getTime())) {
    return { time: expectedTime, rolledDays: 0, didAdjust: false, reason: 'invalid' };
  }

  const n = now instanceof Date ? now : new Date(now);
  if (!(n instanceof Date) || isNaN(n.getTime())) {
    return { time: expectedTime, rolledDays: 0, didAdjust: false, reason: 'invalid-now' };
  }

  if (!Number.isFinite(maxPastMinutes) || maxPastMinutes < 0) {
    return { time: expectedTime, rolledDays: 0, didAdjust: false, reason: 'bad-opts' };
  }

  const pastThresholdMs = Math.round(maxPastMinutes) * 60_000;

  let rolledDays = 0;
  let t = new Date(expectedTime);

  // Roll forward while the time is "too far" behind now.
  // We cap to avoid infinite loops and weird multi-day jumps.
  while ((n.getTime() - t.getTime()) > pastThresholdMs && rolledDays < (Number.isFinite(maxDays) ? maxDays : 2)) {
    t = new Date(t.getTime() + 24 * 60 * 60_000);
    rolledDays += 1;
  }

  return {
    time: t,
    rolledDays,
    didAdjust: rolledDays > 0,
    reason: rolledDays > 0 ? 'rolled-forward' : 'ok',
  };
}
