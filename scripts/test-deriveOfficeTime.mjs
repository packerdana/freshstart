import assert from 'node:assert/strict';

import { deriveOfficeTimeMinutes } from '../src/utils/deriveOfficeTime.js';

// Route starts at 07:30 Chicago local time.
// First 721 starts at 14:29:39 UTC = 08:29:39 CST (UTC-6).
// Derived 722 should be 59 minutes.
const minutes = deriveOfficeTimeMinutes('07:30', '2026-02-05T14:29:39Z');
assert.equal(minutes, 59);

console.log('OK: deriveOfficeTimeMinutes basic CST conversion');
