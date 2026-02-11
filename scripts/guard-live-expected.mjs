import assert from 'node:assert/strict';
import {
  isValidPredictedMinutes,
  shouldApplyLiveOffset,
  applyLiveOffsetToPredictedTime,
  applyExpectedTimeRolloverSanity,
} from '../src/utils/liveExpected.js';

// predictedMinutes should treat 0 as valid
assert.equal(isValidPredictedMinutes(0), true);
assert.equal(isValidPredictedMinutes('0'), true);
assert.equal(isValidPredictedMinutes(null), false);
assert.equal(isValidPredictedMinutes(undefined), false);
assert.equal(isValidPredictedMinutes(NaN), false);

// live offset apply rules
const offset = { minutes: 7, fromSeq: 1 };
assert.equal(shouldApplyLiveOffset(2, offset), true);
assert.equal(shouldApplyLiveOffset(1, offset), false);
assert.equal(shouldApplyLiveOffset(0, offset), false);
assert.equal(shouldApplyLiveOffset('3', offset), true);

// applyLiveOffsetToPredictedTime should not crash and should shift when applicable
const base = new Date('2026-02-05T12:00:00.000Z');
const shifted = applyLiveOffsetToPredictedTime(base, 2, offset);
assert.equal(shifted.getTime(), base.getTime() + 7 * 60_000);

const unchanged = applyLiveOffsetToPredictedTime(base, 1, offset);
assert.equal(unchanged.getTime(), base.getTime());

// rollover sanity
{
  const now = new Date('2026-02-05T23:30:00.000Z');
  const expected = new Date('2026-02-05T01:00:00.000Z'); // clearly "in the past" relative to now
  const res = applyExpectedTimeRolloverSanity(expected, now, { maxPastMinutes: 60 });
  assert.equal(res.didAdjust, true);
  assert.equal(res.rolledDays, 1);
  assert.equal(res.time.getTime(), expected.getTime() + 24 * 60 * 60_000);
}

{
  const now = new Date('2026-02-05T10:00:00.000Z');
  const expected = new Date('2026-02-05T09:30:00.000Z'); // 30m in past => ok
  const res = applyExpectedTimeRolloverSanity(expected, now, { maxPastMinutes: 60 });
  assert.equal(res.didAdjust, false);
  assert.equal(res.time.getTime(), expected.getTime());
}

console.log('guard-live-expected: ok');
