# Street Time Prediction Fallback Logic

**Date**: 2026-01-04
**Feature**: Evaluation Time Fallback for New Users
**Status**: IMPLEMENTED

---

## Overview

The street time prediction system now includes a fallback hierarchy that uses route evaluation data when no historical street time data exists. This ensures new users or routes with no history can still get accurate predictions based on their official route evaluation.

---

## Prediction Hierarchy

The system uses the following priority order to determine street time:

### 1. Historical Data (Primary)
**Source**: `route_history` table
**Method**: Smart prediction using volume-weighted averages
**When Used**: When route has 3+ days of historical data AND street time > 30 minutes
**Confidence Levels**:
- **High**: 5+ matches with 85%+ similarity score
- **Good**: 3+ matches with 70%+ similarity score
- **Medium**: 1+ matches with 50%+ similarity score

**Note**: If historical prediction returns street time ≤ 30 minutes (indicating incomplete/bad data), the system falls back to evaluation time

### 2. Route Evaluation (Fallback #1)
**Source**: `routes.evaluated_street_time` column
**Method**: Official USPS route evaluation time
**When Used**: No historical data exists, but route evaluation has been entered
**Display**:
- Confidence: "Evaluation"
- Badge: 📋
- Shown until historical data accumulates

### 3. Manual Street Time (Fallback #2)
**Source**: `routes.manual_street_time` column
**Method**: User-entered manual estimate
**When Used**: No historical data and no evaluation exists
**Display**:
- Confidence: "Manual"
- Badge: ✋

### 4. System Default (Fallback #3)
**Source**: Hard-coded default
**Method**: 240 minutes (4 hours) estimate
**When Used**: None of the above sources available
**Display**:
- Confidence: "Estimate"
- Badge: 📊

---

## Handling Incomplete Historical Data

### The 30-Minute Threshold

The system includes a validation check: if historical prediction returns street time ≤ 30 minutes, it's treated as unreliable data and the system falls back to evaluation time.

**Why This Matters**:
- Users may have logged incomplete days (started but didn't finish)
- Early test data might have zero street time recorded
- Route might have been abandoned mid-day
- Data entry errors could result in missing street time

**Example**:
```
User has 1 historical day with 0 minutes street time
↓
System calculates: streetPrediction.streetTime = 0
↓
Check: 0 <= 30? Yes, unreliable
↓
Falls back to: Evaluation time (6h 42m)
Badge: 📋 Evaluation
```

This ensures users always see meaningful predictions even with bad historical data.

---

## Implementation Details

### Data Flow

1. **Route Loading** (`routeStore.js:47-62`)
   ```javascript
   evaluatedStreetTime: route.evaluated_street_time,
   evaluatedOfficeTime: route.evaluated_office_time,
   evaluationDate: route.evaluation_date,
   ```
   Evaluation data is loaded from database and stored in route configuration.

2. **Prediction Calculation** (`predictionService.js:143-182`)
   ```javascript
   let streetPrediction = calculateSmartPrediction(todayMail, history);
   const useHistoricalPrediction = streetPrediction && streetPrediction.streetTime > 30;

   if (!useHistoricalPrediction) {
     if (routeConfig?.evaluatedStreetTime) {
       estimatedStreetTime = routeConfig.evaluatedStreetTime * 60;
       confidence = 'evaluation';
       badge = '📋';
     }
     // ... other fallbacks
   }
   ```
   Validates historical prediction (>30 minutes), then checks evaluation time.

3. **Display** (`TodayScreen.jsx:476-484`)
   ```javascript
   Confidence: {prediction.prediction.confidence}
   ```
   Shows confidence level with appropriate badge.

### Database Schema

**Routes Table**:
```sql
evaluated_street_time numeric  -- Official evaluation time in decimal hours
evaluated_office_time numeric  -- Official office time in decimal hours
evaluation_date date           -- Date of official evaluation
evaluation_notes text          -- Notes from route evaluation
```

**Data Storage**:
- Evaluation times stored in **decimal hours** (e.g., 6.25 for 6 hours 15 minutes)
- Converted to **minutes** in prediction service (multiply by 60)
- Historical times stored in **minutes**

---

## User Experience

### New User Flow

**Step 1: No Data**
```
User creates new route
↓
No history exists
↓
No evaluation entered
↓
Shows: "Street Time: 4h 0m" (default estimate)
Confidence: Estimate 📊
```

**Step 2: After Evaluation Entry**
```
User enters route evaluation (e.g., 6.5 hours street time)
↓
No history exists yet
↓
Evaluation data available
↓
Shows: "Street Time: 6h 30m" (from evaluation)
Confidence: Evaluation 📋
```

**Step 3: After Building History**
```
User logs 3+ days of actual work
↓
Historical data exists
↓
Smart prediction calculates from history
↓
Shows: "Street Time: 6h 15m" (actual average)
Confidence: Good 🍏
```

### Transition Behavior

- **Evaluation → History**: Once sufficient historical data exists (3+ days), the system automatically switches from evaluation-based to history-based predictions
- **Seamless**: No user action required
- **Permanent**: Once history is established, evaluation time is no longer used for predictions (but remains stored for route protection documentation)

---

## Benefits

### 1. Immediate Accuracy for New Users
- New carriers can enter their official route evaluation
- Get accurate predictions from day one
- No need to wait for historical data to accumulate

### 2. Route Protection Documentation
- Evaluation time stored permanently
- Used for overburdened route analysis
- Compared against actual times to identify route problems

### 3. Multiple Fallback Options
- Graceful degradation when data unavailable
- Always shows some prediction (never blank)
- Clear indication of confidence level

### 4. USPS Compliance
- Evaluation times from official PS Forms 3999/1838-C
- Matches USPS route evaluation methodology
- Supports grievance documentation

---

## Example Scenarios

### Scenario 1: Brand New Route
```
Route created: No data exists
↓
Prediction: 4h 0m (default)
Badge: 📊 Estimate
↓
Action: User should enter route evaluation
```

### Scenario 2: New Carrier with Evaluation
```
Carrier transfers to route with known evaluation
↓
Enters evaluation: 6.5 hours street time
↓
Prediction: 6h 30m (evaluation)
Badge: 📋 Evaluation
↓
Gradually builds history over 2-3 weeks
↓
Prediction: 6h 18m (history-based)
Badge: 🍏 Good (using actual data)
```

### Scenario 3: Temporary Route Change
```
Regular carrier: Has 30 days of history
↓
Prediction: 6h 15m (history)
Badge: 🍏 Good
↓
Route gets split/adjusted
↓
History still exists but may be less relevant
↓
Can update evaluation to reflect new route structure
↓
System uses both for comparison/validation
```

---

## Technical Notes

### Time Format Conversions

**Database Storage**:
- Evaluation: Decimal hours (6.5 = 6h 30m)
- History: Integer minutes (390 = 6h 30m)

**Display**:
- Always shown as HH:MM format (6h 30m)
- Uses `decimalHoursToHHMM()` utility function

**Calculation**:
- All internal calculations use minutes
- Evaluation converted: `evaluatedStreetTime * 60`

### Confidence Level Priority

1. Historical prediction (from actual data)
2. Evaluation (from official USPS form)
3. Manual (from user estimate)
4. Default (system fallback)

Each level clearly labeled with appropriate badge.

---

## Files Modified

1. **`src/stores/routeStore.js`**
   - Added `evaluatedStreetTime`, `evaluatedOfficeTime`, `evaluationDate` to route configuration
   - Loaded from database in `loadUserRoutes()`
   - Available via `getCurrentRouteConfig()`

2. **`src/services/predictionService.js`**
   - Updated `calculateFullDayPrediction()` fallback logic
   - Added evaluation check before manual time check
   - Set appropriate confidence/badge for evaluation mode

3. **Database Schema** (already existed)
   - `routes.evaluated_street_time` column
   - Created in migration `20260104180449_add_route_evaluation_and_penalty_ot.sql`

---

## Testing

### Test Cases

**Test 1: No Data**
- Create new route
- Don't enter any times
- Expected: Shows 4h 0m default with "Estimate" confidence

**Test 2: Evaluation Only**
- Create new route
- Enter evaluation: 6.5 hours street time
- Enter mail volumes
- Expected: Shows 6h 30m with "Evaluation 📋" confidence

**Test 3: With History**
- Route with 5+ days of history
- Enter mail volumes
- Expected: Shows history-based prediction with "Good 🍏" confidence

**Test 4: Evaluation + History**
- Route has both evaluation and history
- Expected: Uses history, ignores evaluation (evaluation still available for route protection analysis)

---

## Future Enhancements

### Potential Improvements

1. **Smart Comparison**
   - Compare actual average vs. evaluation
   - Alert if consistently over evaluation by 5+ minutes
   - Automatic overburdened route detection

2. **Evaluation Expiration**
   - Flag evaluations older than 2 years
   - Prompt user to update if route has changed
   - Track evaluation history over time

3. **Weighted Transition**
   - Gradually blend evaluation + early history
   - First few days: 70% evaluation, 30% history
   - Build confidence as more data accumulates

4. **Route Change Detection**
   - Detect significant changes in route structure
   - Suggest updating evaluation
   - Compare before/after metrics

---

## Troubleshooting

### Issue: "I saved evaluation time but still see 0h 0m"

**Cause**: You have historical data with 0 or very low street time (≤30 minutes), which was being used instead of your evaluation.

**Solution**: The system now automatically detects unreliable historical data (≤30 minutes) and falls back to your evaluation time.

**Steps**:
1. Refresh the page after saving evaluation
2. Enter your mail volumes
3. You should now see your evaluation time displayed with "Confidence: Evaluation 📋"

**Alternative**: Delete the bad historical entry:
1. Go to Stats screen
2. Find the day with 0 street time
3. Delete that entry
4. System will use evaluation time until you build better history

### Issue: "System uses evaluation instead of my actual data"

**Cause**: Your historical street times are all ≤30 minutes or you have less than 3 days of data.

**Solution**:
- Log complete days with realistic street times (>30 minutes)
- Build at least 3 days of quality historical data
- System will automatically switch to history-based predictions

---

## Related Documentation

- `OFFICE-TIME-COMPONENTS-IMPLEMENTATION.md` - Office time calculation details
- `PULLDOWN-TIME-CORRECTION.md` - Pull-down time standards
- `usps-compliance-reference.md` - USPS standards reference
- Route Protection feature documentation

---

**Document Version**: 1.0
**Last Updated**: 2026-01-04
**Status**: IMPLEMENTED AND TESTED
