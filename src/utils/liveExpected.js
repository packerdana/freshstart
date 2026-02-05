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
