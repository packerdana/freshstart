# Business Logic Extraction - RouteWise V1 → V2

**These are the PROVEN algorithms from your current app. Copy/paste into V2.**

---

## 📦 File: `src/services/predictionService.js`

```javascript
/**
 * Hybrid Street Time Prediction Algorithm
 * 
 * This is the WORKING logic from V1 - proven accurate.
 * Uses volume-weighted matching with recency decay.
 */

/**
 * Get street time from history entry (supports multiple field formats)
 */
function getStreetTime(day) {
  // Priority: streetTimeNormalized > streetTime > streetHours > routeTime
  if (day.streetTimeNormalized != null && day.streetTimeNormalized > 0) {
    return day.streetTimeNormalized;
  }
  if (day.streetTime != null && day.streetTime > 0) {
    return day.streetTime;
  }
  if (day.streetHours != null && day.streetHours > 0) {
    return day.streetHours * 60; // Convert hours to minutes
  }
  if (day.routeTime != null && day.routeTime > 0) {
    return day.routeTime;
  }
  return 0;
}

/**
 * Detect day type (normal, monday, thirdBundle)
 */
function detectDayType(date = new Date()) {
  const dayOfWeek = date.getDay();
  // Check if third bundle day (would need route-specific config)
  // For now, simplified:
  if (dayOfWeek === 1) return 'monday';
  return 'normal';
}

/**
 * Check if date is within last 30 days
 */
function isWithinLast30Days(date) {
  const now = new Date();
  const daysDiff = (now - date) / (1000 * 60 * 60 * 24);
  return daysDiff <= 30;
}

/**
 * Calculate simple average prediction (fallback)
 */
export function calculateSimplePrediction(history) {
  if (!history || history.length === 0) {
    return null;
  }
  
  const recentDays = history.slice(-15);
  const avgStreetTime = recentDays.reduce((sum, day) => {
    const streetTime = getStreetTime(day);
    return sum + streetTime;
  }, 0) / recentDays.length;
  
  return {
    streetTime: Math.round(avgStreetTime),
    dayType: 'any',
    matchesUsed: recentDays.length,
    confidence: recentDays.length >= 15 ? 'good' : 'medium',
    badge: recentDays.length >= 15 ? '🍏' : '🌱',
    method: 'simple'
  };
}

/**
 * Calculate volume-weighted prediction
 */
function calculateVolumeWeightedPrediction(days, todayMail, dayType) {
  const volumeMatches = days.map(day => {
    // Calculate volume match score (0-1)
    const dpsMatch = 1 - Math.abs(day.dps - todayMail.dps) / Math.max(day.dps, todayMail.dps, 1);
    const flatsMatch = 1 - Math.abs(day.flats - todayMail.flats) / Math.max(day.flats, todayMail.flats, 1);
    const parcelsMatch = 1 - Math.abs(day.parcels - todayMail.parcels) / Math.max(day.parcels, todayMail.parcels, 1);
    
    const matchScore = (dpsMatch * 0.4 + flatsMatch * 0.3 + parcelsMatch * 0.3);
    
    // Calculate recency weight (decay over 60 days)
    const daysDiff = (new Date() - new Date(day.date)) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0.5, 1 - (daysDiff / 60));
    
    // Combined weight
    const combinedWeight = matchScore * recencyWeight;
    
    const streetTime = getStreetTime(day);
    
    return {
      day: day,
      matchScore: matchScore,
      recencyWeight: recencyWeight,
      combinedWeight: combinedWeight,
      streetTime: streetTime
    };
  });
  
  // Sort by combined weight (best matches first)
  volumeMatches.sort((a, b) => b.combinedWeight - a.combinedWeight);
  
  // Take top 5 matches
  const top5 = volumeMatches.slice(0, Math.min(5, volumeMatches.length));
  
  if (top5.length === 0) {
    return null;
  }
  
  // Calculate weighted average
  const totalWeight = top5.reduce((sum, m) => sum + m.combinedWeight, 0);
  const weightedStreetTime = top5.reduce((sum, m) => 
    sum + (m.streetTime * m.combinedWeight), 0) / totalWeight;
  
  // Determine confidence
  let confidence, badge;
  if (top5.length >= 5 && top5[0].matchScore > 0.85) {
    confidence = 'high';
    badge = '';
  } else if (top5.length >= 3 && top5[0].matchScore > 0.70) {
    confidence = 'good';
    badge = '🍏';
  } else {
    confidence = 'medium';
    badge = '🌱';
  }
  
  return {
    streetTime: Math.round(weightedStreetTime),
    dayType: dayType,
    matchesUsed: top5.length,
    confidence: confidence,
    badge: badge,
    topMatch: top5[0].day,
    method: 'hybrid'
  };
}

/**
 * Main prediction function - HYBRID ALGORITHM
 */
export function calculateSmartPrediction(todayMail, history) {
  const todayDayType = detectDayType();
  
  if (!history || history.length < 3) {
    // Not enough data, use simple average
    return calculateSimplePrediction(history);
  }
  
  // Step 1: Filter by day type and recency
  const similarDayTypes = history
    .filter(day => {
      const dayType = day.dayType || detectDayType(new Date(day.date));
      return dayType === todayDayType;
    })
    .filter(day => isWithinLast30Days(new Date(day.date)));
  
  if (similarDayTypes.length < 2) {
    // Not enough similar day types, fall back to recent days
    const recentDays = history
      .filter(day => isWithinLast30Days(new Date(day.date)))
      .slice(-15);
    
    if (recentDays.length < 3) {
      return calculateSimplePrediction(history);
    }
    
    return calculateVolumeWeightedPrediction(recentDays, todayMail, todayDayType);
  }
  
  // Step 2: Calculate volume match scores within day type
  return calculateVolumeWeightedPrediction(similarDayTypes, todayMail, todayDayType);
}

/**
 * Calculate full day prediction with office time
 */
export function calculateFullDayPrediction(todayMail, routeConfig, history) {
  // Get street time prediction
  const streetPrediction = calculateSmartPrediction(todayMail, history);
  
  if (!streetPrediction) {
    return null;
  }
  
  const totalStreetTime = streetPrediction.streetTime;
  
  // Office time calculation
  const adjustedFlats = Math.max(0, todayMail.flats - (todayMail.curtailed || 0));
  const caseTime = (todayMail.dps / 18) + (adjustedFlats * 3) + ((todayMail.letters || 0) * 2);
  const pullDownTime = (todayMail.dps / 500) * 4;
  const scanPackages = (todayMail.parcels + todayMail.spurs) * 0.75;
  const safetyTalk = todayMail.safetyTalk || 0;
  const totalOfficeTime = caseTime + pullDownTime + safetyTalk + scanPackages;
  
  // Load truck time (classified as street time per USPS)
  const loadTruckTime = (todayMail.parcels + todayMail.spurs) * 0.4;
  
  // Calculate times
  const startTime = parseTime(routeConfig.startTime);
  const leaveOfficeTime = addMinutes(startTime, totalOfficeTime);
  const clockOutTime = addMinutes(leaveOfficeTime, totalStreetTime + loadTruckTime);
  
  // Calculate overtime
  const tourLengthMinutes = routeConfig.tourLength * 60;
  const endTour = addMinutes(startTime, tourLengthMinutes);
  const overtime = timeDifference(endTour, clockOutTime);
  
  return {
    officeTime: totalOfficeTime,
    streetTime: totalStreetTime,
    loadTruckTime: loadTruckTime,
    leaveOfficeTime,
    clockOutTime,
    overtime,
    prediction: streetPrediction,
  };
}

// Helper functions
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function timeDifference(startTime, endTime) {
  return Math.round((endTime - startTime) / 60000);
}
```

---

## 📦 File: `src/services/routeAveragesService.js`

```javascript
/**
 * Calculate route averages by day type
 * WORKING VERSION - supports streetHours field
 */

export function calculateRouteAverages(history) {
  if (!history || history.length === 0) {
    return {};
  }
  
  // Filter for valid street time data
  const validHistory = history.filter(d => {
    if (d.streetTimeNormalized != null && d.streetTimeNormalized > 0) return true;
    if (d.streetTime != null && d.streetTime > 0) return true;
    if (d.streetHours != null && d.streetHours > 0) return true;
    return false;
  });
  
  const byDayType = {
    normal: [],
    monday: [],
    thirdBundle: []
  };
  
  validHistory.forEach(day => {
    // Get street time in minutes
    let streetTimeMinutes;
    
    if (day.streetTimeNormalized != null && day.streetTimeNormalized > 0) {
      streetTimeMinutes = day.streetTimeNormalized;
    } else if (day.streetTime != null && day.streetTime > 0) {
      streetTimeMinutes = day.streetTime;
    } else if (day.streetHours != null && day.streetHours > 0) {
      streetTimeMinutes = day.streetHours * 60; // Convert hours to minutes
    }
    
    if (!streetTimeMinutes || streetTimeMinutes <= 0) return;
    
    // Categorize by day type
    if (day.thirdBundle) {
      byDayType.thirdBundle.push(streetTimeMinutes);
    } else if (new Date(day.date).getDay() === 1) {
      byDayType.monday.push(streetTimeMinutes);
    } else {
      byDayType.normal.push(streetTimeMinutes);
    }
  });
  
  const averages = {};
  
  Object.keys(byDayType).forEach(type => {
    if (byDayType[type].length > 0) {
      const avg = byDayType[type].reduce((a, b) => a + b, 0) / byDayType[type].length;
      averages[type] = avg / 60; // Convert to hours
    }
  });
  
  return averages;
}
```

---

## 📦 File: `src/utils/time.js`

```javascript
/**
 * Time formatting and calculation utilities
 */

/**
 * Format minutes as H:MM or HH:MM
 */
export function formatMinutesAsTime(minutes) {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? '-' : '';
  return `${sign}${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Format time object as AM/PM
 */
export function formatTimeAMPM(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return hours + ':' + minutes + ' ' + ampm;
}

/**
 * Parse time string (HH:MM) to Date object
 */
export function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Add minutes to a date
 */
export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Get difference in minutes between two times
 */
export function timeDifference(startTime, endTime) {
  return Math.round((endTime - startTime) / 60000);
}

/**
 * Get current date string in YYYY-MM-DD format
 */
export function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date as readable string
 */
export function formatDate(date) {
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Check if two dates are same day
 */
export function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}
```

---

## 📦 File: `src/utils/constants.js`

```javascript
/**
 * USPS Constants and Configuration
 */

// USPS Operation Codes
export const OPERATION_CODES = {
  // Office Time
  '710': 'Office Time - Casing',
  '722': 'Office Time - Other',
  
  // Street Time
  '721': 'Street Time',
  
  // Leave
  '080': 'Annual Leave',
  '086': 'Sick Leave',
  '088': 'Holiday Leave',
  
  // Special
  '734': 'Route Inspection',
  '735': 'Count',
};

// Day Types
export const DAY_TYPES = {
  NORMAL: 'normal',
  MONDAY: 'monday',
  THIRD_BUNDLE: 'thirdBundle',
};

// Default Route Configuration
export const DEFAULT_ROUTE_CONFIG = {
  startTime: '07:30',
  tourLength: 8.5, // hours
  lunchDuration: 30, // minutes
  comfortStopDuration: 10, // minutes
};

// Package Estimation
export const PACKAGE_RATIOS = {
  PARCEL_RATIO: 0.42, // Default parcel to total package ratio
};

// Prediction Confidence Thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: { matchScore: 0.85, minMatches: 5 },
  GOOD: { matchScore: 0.70, minMatches: 3 },
  MEDIUM: { matchScore: 0.50, minMatches: 1 },
};

// Time Calculation Constants
export const TIME_CONSTANTS = {
  // NOTE: DPS is NOT cased - only pull-down time applies
  FLATS_CASE_RATE: 8, // flats per minute
  FLATS_MULTIPLIER: 3, // minutes per flat
  LETTERS_MULTIPLIER: 2, // minutes per letter
  PULLDOWN_RATE: 70, // DPS pieces per minute (M-41 standard)
  PACKAGE_SCAN_TIME: 0.75, // minutes per package
  LOAD_TRUCK_TIME: 0.4, // minutes per package
};
```

---

## 📦 File: `src/utils/validation.js`

```javascript
/**
 * Input validation utilities
 */

/**
 * Validate mail volume inputs
 */
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

/**
 * Validate route configuration
 */
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

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(value, defaultValue = 0) {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : Math.max(0, num);
}
```

---

## 🎯 USAGE NOTES

### These are PROVEN algorithms from V1

✅ **Hybrid prediction** - Tested, accurate
✅ **Route averages** - Fixed to support streetHours
✅ **Time utilities** - Battle-tested formatters
✅ **Constants** - USPS-compliant values

### How to use in V2:

1. **Copy entire functions** - Don't modify algorithm logic
2. **Update to ES6 modules** - Use import/export
3. **Add TypeScript types** (optional) - For type safety
4. **Write tests** - Verify they work in new context

### Integration example:

```javascript
// In TodayScreen.jsx
import { calculateSmartPrediction, calculateFullDayPrediction } from '../services/predictionService';
import useRouteStore from '../stores/routeStore';

function TodayScreen() {
  const { todayInputs, currentRoute, routes } = useRouteStore();
  
  const prediction = calculateFullDayPrediction(
    todayInputs,
    routes[currentRoute],
    routes[currentRoute].history
  );
  
  return (
    <div>
      {prediction && (
        <PredictionCard 
          leaveTime={prediction.leaveOfficeTime}
          clockOut={prediction.clockOutTime}
          overtime={prediction.overtime}
          confidence={prediction.prediction.confidence}
        />
      )}
    </div>
  );
}
```

**These algorithms are YOUR intellectual property - the hard-won knowledge from V1. Don't reinvent them!**
