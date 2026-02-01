# Overtime Calculation Guide

## How the App Currently Tracks Time

### Current System (src/components/screens/TodayScreen.jsx:302-305)

The app **does not track an actual clock-out time**. Instead, it calculates total time worked by summing:

1. **Office Time (722)** - Predicted based on mail volumes using historical data
2. **Street Time (721)** - User starts/stops a timer manually
3. **PM Office Time (744)** - User starts/stops a timer for post-delivery tasks

**Current Overtime Calculation:**
```javascript
const actualTotalMinutes = actualOfficeTime + actualStreetTime + pmOfficeTimeMinutes;
const tourLengthMinutes = (currentRoute?.tourLength || 8.5) * 60;
const actualOvertime = Math.max(0, actualTotalMinutes - tourLengthMinutes);
```

**Overtime = Total Time Worked - Tour Length**

### The Gap

The `actualClockOut` field in RouteCompletionDialog.jsx (line 124-129) collects the clock-out time but:
- It's **not stored** in the database
- It's **not used** for overtime calculation
- It appears in the End of Day Report but has no functional purpose

---

## New Time-Based Overtime Calculator

A new utility function calculates overtime based on actual clock times instead of accumulated timer durations.

### Location
`src/utils/overtimeCalculator.js`

### Core Function

```javascript
calculateOvertime(startTime, tourLengthHours, actualEndTime)
```

### Parameters

| Parameter | Type | Format | Example |
|-----------|------|--------|---------|
| `startTime` | string | "HH:MM" or "HH:MM AM/PM" | "07:30" or "7:30 AM" |
| `tourLengthHours` | number | Decimal hours | 8.5 |
| `actualEndTime` | string | "HH:MM" or "HH:MM AM/PM" | "16:07" or "4:07 PM" |

### Return Object

```javascript
{
  minutes: 7,                    // Overtime in minutes (0 if finished early)
  decimalHours: 0.12,           // Overtime in decimal hours
  formatted: "0:07",            // Human-readable format (H:MM)
  scheduledEndTime: "16:00",    // Calculated scheduled end time
  isOvertime: true              // Boolean flag
}
```

### Calculation Logic

1. **Calculate scheduled end time**
   ```
   Scheduled End = Start Time + Tour Length
   ```

2. **Calculate overtime**
   ```
   Overtime = Actual End Time - Scheduled End Time
   ```

3. **Handle early completion**
   ```
   If Actual End < Scheduled End, then Overtime = 0
   ```

---

## Usage Examples

### Example 1: Basic Overtime
```javascript
import { calculateOvertime } from './src/utils/overtimeCalculator.js';

const result = calculateOvertime('07:30', 8.5, '16:07');

// Scheduled end: 07:30 + 8.5 hours = 16:00 (4:00 PM)
// Actual end: 16:07 (4:07 PM)
// Overtime: 7 minutes

console.log(result);
// {
//   minutes: 7,
//   decimalHours: 0.12,
//   formatted: "0:07",
//   scheduledEndTime: "16:00",
//   isOvertime: true
// }
```

### Example 2: No Overtime (Finished Early)
```javascript
const result = calculateOvertime('07:30', 8.5, '15:45');

// Scheduled end: 16:00 (4:00 PM)
// Actual end: 15:45 (3:45 PM)
// Overtime: 0 (finished 15 minutes early)

console.log(result);
// {
//   minutes: 0,
//   decimalHours: 0.00,
//   formatted: "0:00",
//   scheduledEndTime: "16:00",
//   isOvertime: false
// }
```

### Example 3: Significant Overtime
```javascript
const result = calculateOvertime('07:30', 8.5, '17:30');

// Scheduled end: 16:00 (4:00 PM)
// Actual end: 17:30 (5:30 PM)
// Overtime: 90 minutes (1.5 hours)

console.log(result);
// {
//   minutes: 90,
//   decimalHours: 1.50,
//   formatted: "1:30",
//   scheduledEndTime: "16:00",
//   isOvertime: true
// }
```

### Example 4: Using 12-Hour Format
```javascript
const result = calculateOvertime('7:30 AM', 8.5, '4:07 PM');

// Same calculation, different input format
console.log(result);
// {
//   minutes: 7,
//   decimalHours: 0.12,
//   formatted: "0:07",
//   scheduledEndTime: "16:00",
//   isOvertime: true
// }
```

---

## Advanced Usage

### Full Details with AM/PM Formatting

```javascript
import { calculateOvertimeFromClockTimes } from './src/utils/overtimeCalculator.js';

const result = calculateOvertimeFromClockTimes('07:30', 8.5, '16:07');

console.log(result);
// {
//   startTime: "7:30 AM",
//   tourLength: "8.5 hours",
//   scheduledEndTime: "4:00 PM",
//   actualEndTime: "4:07 PM",
//   overtime: {
//     minutes: 7,
//     decimalHours: "0.12",
//     formatted: "0:07",
//     isOvertime: true
//   }
// }
```

### Integration with Route Completion

```javascript
// In TodayScreen.jsx handleCompleteRoute function:
import { calculateOvertime } from '../../utils/overtimeCalculator';

const handleCompleteRoute = async (completionData) => {
  const currentRoute = getCurrentRouteConfig();

  // If user provides actual clock out time
  if (completionData.actualClockOut) {
    const overtimeResult = calculateOvertime(
      currentRoute.startTime,        // "07:30"
      currentRoute.tourLength,       // 8.5
      completionData.actualClockOut  // "16:07"
    );

    const actualOvertime = overtimeResult.minutes;
    const scheduledEndTime = overtimeResult.scheduledEndTime;

    // Use actualOvertime for database storage
    const historyData = {
      // ... other fields
      overtime: actualOvertime,
      scheduled_end_time: scheduledEndTime,
      actual_clock_out: completionData.actualClockOut
    };
  }
};
```

---

## Time Format Support

The calculator accepts multiple time formats:

### 24-Hour Format
- `"07:30"` → 7:30 AM
- `"16:07"` → 4:07 PM
- `"23:45"` → 11:45 PM

### 12-Hour Format
- `"7:30 AM"` → 7:30 AM
- `"4:07 PM"` → 4:07 PM
- `"11:45 PM"` → 11:45 PM

---

## Utility Functions

### parseTimeString(timeStr)
Parses time strings into hours and minutes.

```javascript
parseTimeString("7:30 AM");  // { hours: 7, minutes: 30 }
parseTimeString("16:07");    // { hours: 16, minutes: 7 }
```

### addHoursToTime(timeStr, hoursToAdd)
Adds hours to a time string.

```javascript
addHoursToTime("07:30", 8.5);  // { hours: 16, minutes: 0 }
```

### calculateTimeDifferenceMinutes(startTime, endTime)
Calculates the difference between two times in minutes.

```javascript
calculateTimeDifferenceMinutes("16:00", "16:07");  // 7
```

### formatTimeToAMPM(hours, minutes)
Formats 24-hour time to 12-hour AM/PM format.

```javascript
formatTimeToAMPM(16, 7);  // "4:07 PM"
```

---

## Error Handling

The calculator throws descriptive errors for invalid inputs:

```javascript
try {
  calculateOvertime('25:00', 8.5, '16:00');  // Invalid hour
} catch (error) {
  console.error(error.message);
  // "Overtime calculation failed: Invalid time values: 25:00"
}

try {
  calculateOvertime('abc', 8.5, '16:00');  // Invalid format
} catch (error) {
  console.error(error.message);
  // "Overtime calculation failed: Invalid time format: abc"
}
```

---

## Testing

Run the examples file to see all use cases:

```bash
node overtime-calculator-examples.js
```

---

## Next Steps: Database Integration

To fully integrate time-based overtime calculation:

1. **Add database column** (via migration):
   ```sql
   ALTER TABLE route_history
   ADD COLUMN actual_clock_out TEXT,
   ADD COLUMN scheduled_end_time TEXT;
   ```

2. **Update RouteCompletionDialog.jsx** to make clock-out time required (currently optional)

3. **Modify TodayScreen.jsx** to use `calculateOvertime()` instead of the current calculation

4. **Update End of Day Report** to display scheduled vs actual end times

---

## Comparison: Current vs Time-Based

| Aspect | Current System | Time-Based Calculator |
|--------|---------------|----------------------|
| **Input** | Timer durations | Clock times |
| **Calculation** | Sum of all timers | End time - Scheduled end |
| **Accuracy** | Depends on timer usage | Direct from clock times |
| **User Action** | Start/stop multiple timers | Enter clock-out time |
| **Complexity** | Multiple moving parts | Single calculation |
| **USPS Compliance** | Tracks operations (722, 721, 744) | Tracks total work time |

---

## Recommendation

**Current System:** Best for detailed tracking of USPS operation codes (722, 721, 744) and understanding time distribution.

**Time-Based Calculator:** Best for simple, accurate overtime calculation when you know start and end times.

**Hybrid Approach:** Use both:
- Keep current system for operational tracking
- Add time-based calculator as a verification/alternative method
- Store both calculations for comparison and accuracy validation
