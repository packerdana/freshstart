# Automatic Street Time (721) Ending Implementation

## Overview

This document describes the automatic street time ending functionality implemented in the RouteWise application. Street time (Operation Code 721) is automatically ended in two scenarios to improve user experience and prevent timing errors.

## Features Implemented

### 1. Auto-End When Starting PM Office (744)

**Location**: `src/components/screens/TodayScreen.jsx` - `handleStartPmOffice()`

**Behavior**:
- When user clicks the "744 PM Office" button, the system automatically checks if there's an active street time session
- If street time (721) is running, it is automatically stopped before starting PM Office time (744)
- User receives a confirmation alert: "✓ Street time (721) automatically stopped and PM Office time (744) started."
- The calculated street time duration is logged to console for debugging

**Code Flow**:
```javascript
1. Check if streetTimeSession exists and is not ended
2. Call streetTimeService.endSession() to stop the timer
3. Calculate total duration in minutes
4. Clear street time session state
5. Start PM Office session
6. Show success notification to user
```

**Edge Cases Handled**:
- If no active street time session exists, PM Office starts normally without notification
- If street time ending fails, error is logged but PM Office still attempts to start
- Prevents duplicate sessions by checking for active sessions before starting

### 2. Auto-End When Completing Route

**Location**: `src/components/screens/TodayScreen.jsx` - `handleCompleteRoute()`

**Behavior**:
- When user opens the "Complete Route" dialog, any active street time session is automatically ended
- The calculated duration is used to populate the street time field in the completion dialog
- User can still manually override the calculated time if needed (manual backup)
- If auto-ending fails, user is alerted to verify their street time entry

**Code Flow**:
```javascript
1. User clicks "Complete Route" button
2. System checks for active street time session
3. If found, automatically end the session
4. Calculate total duration in minutes
5. Pass calculated duration to RouteCompletionDialog
6. Pre-populate the "Actual Street Time" field
7. User can accept or modify the value
8. Save route history with final street time
```

**Edge Cases Handled**:
- If street time was already manually stopped, uses the stopped duration
- If no street time session exists, user must manually enter the time
- If auto-ending fails, shows warning alert and allows manual entry
- Validates that street time is provided before allowing route completion

### 3. Manual Street Time Input (Backup Option)

**Location**: `src/components/shared/RouteCompletionDialog.jsx`

**Behavior**:
- Always displays a manual input field for street time
- When street time is auto-calculated, field is pre-filled but remains editable
- Shows clear visual feedback when time is auto-calculated:
  - Helper text: "✓ Auto-ended and calculated from 721 timer: X.XX hours"
  - Green checkmark message: "✓ Street time was automatically stopped when completing route"
- If no auto-calculation, shows: "REQUIRED: Enter the actual time spent on the street in hours (manual backup)"
- Requires minimum 0.1 hours, maximum 12 hours
- Validates that field is not empty before submission

**User Experience**:
- **Auto-calculated**: Field shows calculated value, user can accept or modify
- **Manual entry**: User must enter the value themselves
- **Override**: User can always change auto-calculated value if incorrect
- **Validation**: Required field with range validation (0.1 - 12 hours)

## Database Schema

No database changes required. Uses existing tables:

**operation_codes table** (for street time tracking):
- `id`: Unique identifier
- `session_id`: Session identifier
- `code`: '721' for street time
- `start_time`: When street time started
- `end_time`: When street time ended (set by auto-end)
- `duration_minutes`: Calculated duration

**route_history table** (for saving completed routes):
- `street_time`: Final street time in minutes (from auto-calc or manual)
- `actual_leave_time`: Timestamp when street time started
- `predicted_leave_time`: Predicted leave time for comparison

## Error Handling

### Scenario 1: Street Time Session Not Found
```
- Behavior: PM Office starts normally OR user manually enters street time
- User Impact: None - normal flow continues
- Logging: No active session found, proceeding with normal flow
```

### Scenario 2: Failed to End Street Time During PM Office Start
```
- Behavior: Error logged, PM Office attempts to start anyway
- User Impact: Alert shown, user should verify timing manually
- Logging: "Error starting PM Office: [error message]"
```

### Scenario 3: Failed to End Street Time During Route Completion
```
- Behavior: Warning alert shown, manual entry required
- User Impact: Must manually enter street time
- Logging: "Error stopping street time during route completion: [error]"
- Alert: "Warning: Failed to automatically stop street time. Please verify your street time entry."
```

### Scenario 4: User Tries to Complete Without Street Time
```
- Behavior: Validation error, cannot submit
- User Impact: Error message: "⚠ Street time is required! Please enter your actual street time in hours."
- Logging: Form validation prevents submission
```

### Scenario 5: Multiple Auto-End Attempts
```
- Behavior: Subsequent attempts are ignored (session already ended)
- User Impact: None - idempotent behavior
- Logging: Session not found or already ended
```

## Testing Scenarios

### Happy Path Tests

1. **Complete route with active street time**:
   - Start route (721 starts)
   - Click "Complete Route"
   - Verify street time auto-ends
   - Verify calculated time appears in dialog
   - Accept and save

2. **Start PM Office with active street time**:
   - Start route (721 starts)
   - Click "744 PM Office"
   - Verify street time auto-ends
   - Verify PM Office starts
   - Verify confirmation alert shown

3. **Manual override of auto-calculated time**:
   - Start route (721 starts)
   - Click "Complete Route"
   - Modify the auto-calculated street time
   - Save route
   - Verify modified value is saved

### Edge Case Tests

4. **Complete route without starting street time**:
   - DO NOT start route timer
   - Click "Complete Route"
   - Verify no auto-calculation
   - Manually enter street time
   - Save successfully

5. **Start PM Office without street time running**:
   - Start PM Office directly
   - Verify no alert shown
   - Verify PM Office starts normally

6. **Network error during auto-end**:
   - Simulate network failure
   - Attempt to complete route
   - Verify warning alert
   - Verify manual entry is possible

## User Documentation

### For Regular Use:

**Starting Your Route**:
1. Enter mail volume data
2. Click "Start Route" - this starts your 721 street time tracking
3. The timer will run in the background

**Ending Your Route**:
1. When finished, click "Complete Route"
2. Your street time will **automatically stop** and be calculated
3. Review the calculated time (you can change it if needed)
4. Add any notes and submit

**Using PM Office Time**:
1. If you need to go back to the office mid-route
2. Click "744 PM Office"
3. Your street time will **automatically stop** before PM Office starts
4. When done with PM Office, you can resume or complete your route

### If You Forget to Track Time:

- The "Actual Street Time" field always allows manual entry
- If the automatic timer didn't run, simply type in your actual street time
- The system will still save your data correctly

## Benefits

1. **Prevents Timing Errors**: Automatically stops street time to prevent over-counting
2. **Improves Accuracy**: Uses actual timer data when available
3. **Maintains Flexibility**: Manual override always available
4. **Better UX**: Clear feedback and confirmations
5. **Data Integrity**: Ensures operation codes don't overlap or run indefinitely
6. **USPS Compliance**: Proper separation of 721, 722, and 744 operation codes

## Future Enhancements

Potential improvements for future versions:

1. **Toast Notifications**: Replace alerts with non-intrusive toast messages
2. **Undo Functionality**: Allow users to undo auto-end within a time window
3. **Smart Detection**: Detect when user forgets to start timer and suggest correction
4. **Bulk Operations**: Handle multiple street time sessions in one day
5. **Audit Trail**: Track when times were auto-ended vs manually entered
6. **Pause/Resume**: Add ability to pause street time without ending it
7. **Warning Thresholds**: Alert user if street time seems unusually long/short

## Code Locations

| Feature | File | Function | Lines |
|---------|------|----------|-------|
| Auto-end on PM Office | `TodayScreen.jsx` | `handleStartPmOffice()` | 162-188 |
| Auto-end on Complete | `TodayScreen.jsx` | `handleCompleteRoute()` | 270-282 |
| Manual Input Field | `RouteCompletionDialog.jsx` | Render method | 92-121 |
| Street Time Service | `streetTimeService.js` | `endSession()` | 36-60 |
| Route History Save | `routeHistoryService.js` | `saveRouteHistory()` | 3-102 |

## Validation Rules

**Street Time Input**:
- Type: Number (decimal)
- Minimum: 0.1 hours (6 minutes)
- Maximum: 12 hours
- Step: 0.01 hours (precision to 0.6 minutes)
- Required: Yes
- Format: Hours with 2 decimal places (e.g., 5.25 = 5 hours 15 minutes)

**Auto-Calculation**:
- Rounds to nearest minute
- Converts to hours for display (minutes / 60)
- Preserves precision in database (stored as minutes)

## Support & Troubleshooting

**Q: The auto-calculated time seems wrong. What should I do?**
A: Simply edit the value in the "Actual Street Time" field. The system allows you to override any auto-calculated value.

**Q: I forgot to start the street time timer. What happens?**
A: No problem! The field will be empty, and you can manually enter your actual street time.

**Q: What if I accidentally start PM Office while still on the street?**
A: Your street time will automatically stop. If this was a mistake, note the stopped time, stop PM Office, and manually enter correct times when completing your route.

**Q: Can I see when my street time was automatically ended?**
A: Check the browser console (F12) for detailed logs of all auto-end events, including timestamps and durations.

---

*Last Updated: January 6, 2026*
*Version: 1.0.0*
