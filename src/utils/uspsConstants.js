export const USPS_STANDARDS = {
  WORKWEEK_START_DAY: 6,

  FLATS_MULTIPLIER: 3,
  LETTERS_MULTIPLIER: 2,
  PULLDOWN_RATE: 70,
  LOAD_TRUCK_TIME: 0.4,

  LUNCH_DURATION: 30,
  LUNCH_MIN_START: 180,
  LUNCH_MAX_START: 360,
  COMFORT_STOP_DURATION: 10,

  DAILY_OT_THRESHOLD: 8.5,
  PENALTY_OT_THRESHOLD: 10,
  WEEKLY_PENALTY_THRESHOLD: 56,

  OVERBURDENED_THRESHOLD: 5,
  SPECIAL_INSPECTION_DAYS: 3,
  SPECIAL_INSPECTION_OT: 60,
};

export const OPERATION_CODES = {
  '722': { name: 'Office Time - AM', category: 'office', color: '#3B82F6', description: 'Casing, pulling down, safety talk, pre-trip' },
  '744': { name: 'Office Time - PM', category: 'office', color: '#3B82F6', description: 'Post-trip, vehicle inspection, closing duties' },

  '721': { name: 'Street Time', category: 'street', color: '#10B981', description: 'Motorized delivery time including load truck' },
  '736': { name: 'Relay/Transfer', category: 'street', color: '#10B981', description: 'Receiving or delivering relay mail' },
  '732': { name: 'Collections', category: 'street', color: '#10B981', description: 'Collection box pickups' },

  '080': { name: 'Annual Leave', category: 'leave', color: '#F59E0B', description: 'Scheduled vacation time' },
  '086': { name: 'Sick Leave', category: 'leave', color: '#EF4444', description: 'Sick or medical leave' },
  '088': { name: 'Holiday Leave', category: 'leave', color: '#8B5CF6', description: 'Paid holidays' },
  '082': { name: 'LWOP', category: 'leave', color: '#6B7280', description: 'Leave without pay' },
  '085': { name: 'FMLA', category: 'leave', color: '#EC4899', description: 'Family Medical Leave Act' },

  '734': { name: 'Route Inspection', category: 'special', color: '#EC4899', description: 'Official route count/inspection' },
  '735': { name: 'Mail Count', category: 'special', color: '#EC4899', description: 'Special mail volume count' },
  '743': { name: 'Training', category: 'special', color: '#06B6D4', description: 'Carrier training time' },

  '063': { name: 'NS Day - Scheduled', category: 'off', color: '#6B7280', description: 'Regular scheduled day off' },
  '066': { name: 'NS Day - Rotating', category: 'off', color: '#6B7280', description: 'Rotating scheduled day off' },
};

export const STREET_TIME_CODES = ['721', '736', '732'];
export const OFFICE_TIME_CODES = ['722', '744'];
export const LEAVE_CODES = ['080', '086', '088', '082', '085'];
export const SPECIAL_CODES = ['734', '735', '743'];
export const NS_DAY_CODES = ['063', '066'];

export function getWorkweekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 6 ? 0 : -(day + 1);
  const weekStart = new Date(d.getTime() + diff * 86400000);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

export function getWorkweekEnd(date) {
  const weekStart = getWorkweekStart(date);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

export function isWorkweekAligned(date) {
  const weekStart = getWorkweekStart(date);
  return weekStart.getDay() === 6;
}

export function getWorkweekDates(date) {
  const start = getWorkweekStart(date);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    dates.push(d);
  }
  return dates;
}

export function validateLunchTime(startTime, lunchStartTime) {
  const elapsed = (lunchStartTime - startTime) / 60000;

  return {
    valid: elapsed >= USPS_STANDARDS.LUNCH_MIN_START && elapsed <= USPS_STANDARDS.LUNCH_MAX_START,
    elapsed: elapsed,
    message: elapsed < USPS_STANDARDS.LUNCH_MIN_START
      ? 'Lunch too early (must be after 3 hours)'
      : elapsed > USPS_STANDARDS.LUNCH_MAX_START
        ? 'Lunch too late (must be before 6 hours)'
        : 'Lunch timing valid'
  };
}

export function calculatePenaltyOT(hoursWorked, scheduledHours, weeklyHours, isNSDay = false) {
  let regularOT = 0;
  let penaltyOT = 0;

  const dailyOT = Math.max(0, hoursWorked - scheduledHours);

  if (isNSDay) {
    if (hoursWorked > USPS_STANDARDS.PENALTY_OT_THRESHOLD) {
      regularOT = USPS_STANDARDS.PENALTY_OT_THRESHOLD;
      penaltyOT = hoursWorked - USPS_STANDARDS.PENALTY_OT_THRESHOLD;
    } else {
      regularOT = hoursWorked;
    }
  } else {
    if (hoursWorked > USPS_STANDARDS.PENALTY_OT_THRESHOLD) {
      regularOT = Math.max(0, USPS_STANDARDS.PENALTY_OT_THRESHOLD - scheduledHours);
      penaltyOT = hoursWorked - USPS_STANDARDS.PENALTY_OT_THRESHOLD;
    } else {
      regularOT = dailyOT;
    }
  }

  if (weeklyHours > USPS_STANDARDS.WEEKLY_PENALTY_THRESHOLD) {
    const weeklyPenalty = weeklyHours - USPS_STANDARDS.WEEKLY_PENALTY_THRESHOLD;
    penaltyOT = Math.max(penaltyOT, weeklyPenalty);
  }

  return {
    regularOT: Math.max(0, regularOT),
    penaltyOT: Math.max(0, penaltyOT),
    totalOT: regularOT + penaltyOT
  };
}
