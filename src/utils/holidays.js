import { parseLocalDate, getLocalDateString } from './time';

function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function observedDate(date) {
  // If the holiday falls on Saturday, it's observed Friday.
  // If it falls on Sunday, it's observed Monday.
  const day = date.getDay(); // 0=Sun ... 6=Sat
  const observed = new Date(date);
  if (day === 6) observed.setDate(observed.getDate() - 1);
  if (day === 0) observed.setDate(observed.getDate() + 1);
  return observed;
}

function nthWeekdayOfMonth(year, monthIndex, weekday, n) {
  // monthIndex: 0-11, weekday: 0-6
  const first = new Date(year, monthIndex, 1);
  const firstWeekdayOffset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + firstWeekdayOffset + (n - 1) * 7;
  return new Date(year, monthIndex, day);
}

function lastWeekdayOfMonth(year, monthIndex, weekday) {
  // Last <weekday> of month
  const last = new Date(year, monthIndex + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  last.setDate(last.getDate() - offset);
  return last;
}

export function getFederalHolidayObservedDates(year) {
  // Returns a Set of YYYY-MM-DD strings for *observed* federal holidays.
  const holidays = [];

  // Fixed-date holidays
  holidays.push(observedDate(new Date(year, 0, 1)));  // New Year's Day
  holidays.push(observedDate(new Date(year, 5, 19))); // Juneteenth
  holidays.push(observedDate(new Date(year, 6, 4)));  // Independence Day
  holidays.push(observedDate(new Date(year, 10, 11))); // Veterans Day
  holidays.push(observedDate(new Date(year, 11, 25))); // Christmas Day

  // Monday/Thursday-based holidays (already observed by definition)
  holidays.push(nthWeekdayOfMonth(year, 0, 1, 3)); // MLK Day: 3rd Monday Jan
  holidays.push(nthWeekdayOfMonth(year, 1, 1, 3)); // Presidents Day: 3rd Monday Feb
  holidays.push(lastWeekdayOfMonth(year, 4, 1));   // Memorial Day: last Monday May
  holidays.push(nthWeekdayOfMonth(year, 8, 1, 1)); // Labor Day: 1st Monday Sep
  holidays.push(nthWeekdayOfMonth(year, 9, 1, 2)); // Columbus/Indigenous Peoples' Day: 2nd Monday Oct
  holidays.push(nthWeekdayOfMonth(year, 10, 4, 4)); // Thanksgiving: 4th Thursday Nov (Thu=4)

  return new Set(holidays.map(formatYMD));
}

export function isFederalHolidayObserved(dateStr) {
  if (!dateStr) return false;
  const date = parseLocalDate(dateStr);
  const year = date.getFullYear();
  // include neighbor years because observed date can spill into prev/next year (e.g., Jan 1 observed on Dec 31)
  const set = new Set([
    ...getFederalHolidayObservedDates(year - 1),
    ...getFederalHolidayObservedDates(year),
    ...getFederalHolidayObservedDates(year + 1)
  ]);
  return set.has(dateStr);
}

export function isDayAfterFederalHoliday(dateStr) {
  if (!dateStr) return false;
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() - 1);
  return isFederalHolidayObserved(formatYMD(date));
}

export function getDayType(dateStr) {
  // Dana decision: day-after-holiday overrides everything.
  // Additional rule: Saturday is its own day type.
  if (!dateStr) return 'normal';
  if (isDayAfterFederalHoliday(dateStr)) return 'day-after-holiday';
  const date = parseLocalDate(dateStr);
  const day = date.getDay();
  if (day === 6) return 'saturday';
  if (day === 1) return 'monday';
  return 'normal';
}

export function getDayTypeLabel(dayType) {
  if (dayType === 'day-after-holiday') return 'day-after-holiday';
  if (dayType === 'saturday') return 'Saturday';
  if (dayType === 'monday') return 'Monday';
  return 'normal';
}

export function getTodayDayType() {
  return getDayType(getLocalDateString());
}

export function isPeakSeason(dateStr) {
  // Peak season: November - December (holiday shopping season)
  if (!dateStr) return false;
  const date = parseLocalDate(dateStr);
  const month = date.getMonth(); // 0-11
  return month >= 10; // November (10) and December (11)
}

export function canExceedStreetTimeLimit(dateStr) {
  // Returns true if this day type allows street time > 12 hours
  const dayType = getDayType(dateStr);
  return dayType === 'day-after-holiday' || isPeakSeason(dateStr);
}
