export { OPERATION_CODES, STREET_TIME_CODES, OFFICE_TIME_CODES, LEAVE_CODES } from './uspsConstants';

export const DAY_TYPES = {
  NORMAL: 'normal',
  MONDAY: 'monday',
};

export const DEFAULT_ROUTE_CONFIG = {
  startTime: '07:30',
  tourLength: 8.5,
  lunchDuration: 30,
  comfortStopDuration: 10,
};

export const PACKAGE_RATIOS = {
  PARCEL_RATIO: 0.42,
};

export const CONFIDENCE_THRESHOLDS = {
  HIGH: { matchScore: 0.85, minMatches: 5 },
  GOOD: { matchScore: 0.70, minMatches: 3 },
  MEDIUM: { matchScore: 0.50, minMatches: 1 },
};

export const TIME_CONSTANTS = {
  FIXED_OFFICE_TIME: 33,
  FLATS_PER_FOOT: 115,
  LETTERS_PER_FOOT: 227,
  FLATS_CASE_RATE: 8,
  LETTERS_CASE_RATE: 18,
  LOAD_TRUCK_TIME: 0.4,
};
