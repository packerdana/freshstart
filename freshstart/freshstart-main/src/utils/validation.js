export function validateMailInputs(inputs) {
  const errors = {};

  if (inputs.dps < 0) errors.dps = 'Cannot be negative';
  if (inputs.flats < 0) errors.flats = 'Cannot be negative';
  if (inputs.letters < 0) errors.letters = 'Cannot be negative';
  if (inputs.parcels < 0) errors.parcels = 'Cannot be negative';
  if (inputs.spurs < 0) errors.spurs = 'Cannot be negative';

  if (inputs.dps > 9999) errors.dps = 'Value too large';
  if (inputs.flats > 999) errors.flats = 'Value too large';
  if (inputs.parcels > 999) errors.parcels = 'Value too large';

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateRouteConfig(config) {
  const errors = {};

  if (!config.routeNumber) {
    errors.routeNumber = 'Route number required';
  }

  if (!config.startTime || !/^\d{2}:\d{2}$/.test(config.startTime)) {
    errors.startTime = 'Invalid time format (use HH:MM)';
  }

  if (config.tourLength < 4 || config.tourLength > 12) {
    errors.tourLength = 'Tour length must be between 4 and 12 hours';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function sanitizeNumber(value, defaultValue = 0) {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : Math.max(0, num);
}
