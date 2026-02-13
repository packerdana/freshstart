import assert from 'node:assert/strict';

import { shouldUseFixedCoreRows, buildExpandedDayHistoryRows } from '../src/utils/dayHistoryDisplay.js';

// Case: user used "Fix this day" and set minutes overrides in route_history, but timer rows are stale.
const histFixed = {
  office_time: 65,
  street_time_normalized: 435,
  pm_office_time: 7,
};
const detailRowsStale = [
  { id: 1, code: '722', duration_minutes: 697, start_time: '2026-02-12T13:30:00Z', end_time: '2026-02-13T01:07:00Z' },
  { id: 2, code: '721', duration_minutes: 0, start_time: '2026-02-13T01:07:00Z', end_time: '2026-02-13T01:07:00Z' },
  { id: 3, code: '744', duration_minutes: 6, start_time: '2026-02-13T01:07:00Z', end_time: '2026-02-13T01:13:00Z' },
  { id: 4, code: '736', code_name: 'Clerk Assist', duration_minutes: 12 },
];

assert.equal(shouldUseFixedCoreRows({ hist: histFixed, detailRows: detailRowsStale }), true);

const built = buildExpandedDayHistoryRows({
  date: '2026-02-12',
  detailRows: detailRowsStale,
  hist: histFixed,
  codeNameByCode: { '722': 'AM Office', '721': 'Street Time', '744': 'PM Office' },
});

assert.equal(built.mode, 'fixed');
assert.equal(built.rows.length, 4);
assert.deepEqual(
  built.rows.slice(0, 3).map((r) => [r.code, r.duration_minutes, !!r._fixed]),
  [
    ['722', 65, true],
    ['721', 435, true],
    ['744', 7, true],
  ],
);
// Off-route rows should be preserved.
assert.equal(built.rows[3].code, '736');

// Case: normal day where history and detail rows match -> do not force fixed.
const histNormal = { office_time: 70, street_time_normalized: 410, pm_office_time: 10 };
const detailRowsNormal = [
  { id: 1, code: '722', duration_minutes: 72 },
  { id: 2, code: '721', duration_minutes: 409 },
  { id: 3, code: '744', duration_minutes: 11 },
];
assert.equal(shouldUseFixedCoreRows({ hist: histNormal, detailRows: detailRowsNormal }), false);

console.log('OK: dayHistoryDisplay fixed-vs-timer row selection');
