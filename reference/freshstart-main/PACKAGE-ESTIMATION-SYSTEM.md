# Package Estimation & Tracking System

**Date**: 2026-01-04
**Feature**: Smart Package Estimation with Historical Pattern Analysis
**Status**: IMPLEMENTED

---

## Overview

The package estimation system automatically splits total package counts (from scanner) into Parcels and SPRs based on historical delivery patterns. This eliminates manual counting and provides accurate predictions based on day type (Monday, Peak, Normal).

---

## How It Works

### 1. Scanner Input
Carrier enters total package count from their scanner's "How Am I Doing" screen:
```
Scanner shows: "Pkgs Remaining: 103"
↓
Enter into app: Scanner Total = 103
```

### 2. Automatic Estimation
System analyzes historical data to determine typical Parcels/SPRs split:

**Default Ratios** (no history):
- 42% Parcels
- 58% SPRs

**Historical Ratios** (3+ days of data):
- Uses actual averages from similar day types
- Accounts for Monday 3rd bundles
- Adjusts for peak season (December)

### 3. Day Type Detection

**Normal Days**:
- Tuesday through Saturday
- Standard mail volume patterns
- Uses "normal" historical data

**Monday Days**:
- First day of week
- Optional 3rd bundle checkbox
- Higher SPR ratio typically
- Uses "monday" historical data

**Peak Season**:
- All of December
- Significantly higher package volumes
- Uses "peak" historical data

### 4. Manual Adjustment
Carrier can adjust the split when loading truck:
```
Scanner Total: 103
↓
Estimated: 43 Parcels, 60 SPRs
↓
Manual Adjustment: 45 Parcels, 58 SPRs ✓
(System marks as manually updated)
```

### 5. Package Progress Tracking
During route, system shows:
- Packages remaining (from scanner updates)
- Progress bar and percentage
- Parcels vs SPRs breakdown

---

## User Interface

### Before Route Start: Package Input Card

```
┌─────────────────────────────────────┐
│ 📦 Package Tracking                 │
├─────────────────────────────────────┤
│                                     │
│ 📱 Scanner Total                    │
│ ("How Am I Doing" → Pkgs Remaining) │
│ [  103  ]                           │
│ Check your scanner for total pkgs   │
│                                     │
│ ☑ 3rd Bundle Today (Monday)         │
│                                     │
│ ℹ Reliable estimate based on 8     │
│   monday days (42% parcels)         │
│                                     │
│ ┌─ Package Breakdown ─────────────┐ │
│ │                                 │ │
│ │ Parcels        SPRs             │ │
│ │ [  43  ]      [  60  ]          │ │
│ │                                 │ │
│ │ 💡 Adjust when loading truck    │ │
│ │                                 │ │
│ │ Total  Parcels  SPRs            │ │
│ │  103     43      60             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### During Route: Package Progress Card

```
┌─────────────────────────────────────┐
│ Package Progress              📦    │
├─────────────────────────────────────┤
│                                     │
│  103  / 103                         │
│                                     │
│ ████████████████████░░░░░░  75%     │
│                                     │
│ 0 delivered                   75%   │
│                                     │
│ Update Remaining Count              │
│ [  103  ]                           │
│ Check "How Am I Doing" on scanner   │
│                                     │
│ Parcels      SPRs                   │
│   43          60                    │
└─────────────────────────────────────┘
```

---

## Implementation Details

### Package Estimation Service

**File**: `src/services/packageEstimationService.js`

**Key Functions**:

1. `getDayType(date)` - Determines day type (monday, peak, normal)
2. `calculatePackagePattern(history)` - Analyzes historical patterns
3. `estimatePackageSplit(scannerTotal, history, thirdBundle)` - Main estimation function
4. `getPackageEstimationMessage(estimation)` - Generates user-friendly message

**Pattern Calculation Logic**:
```javascript
// For each day type (monday, peak, normal):
{
  parcelRatio: 0.42,           // % of total that are parcels
  spurRatio: 0.58,             // % of total that are SPRs
  avgParcels: 43,              // Average parcel count
  avgSprs: 60,                 // Average SPR count
  count: 8                     // Days in sample
}
```

**Confidence Levels**:
- **High**: 10+ days of data for this day type
- **Good**: 5-9 days of data
- **Medium**: 3-4 days of data
- **Default**: Less than 3 days, uses 42/58 split

### Route Store Updates

**File**: `src/stores/routeStore.js`

**New Fields**:
```javascript
todayInputs: {
  scannerTotal: 0,              // Total from scanner
  parcels: 0,                   // Estimated/manual parcels
  sprs: 0,                      // Estimated/manual SPRs
  packagesManuallyUpdated: false, // User adjusted split
  thirdBundle: false,           // Monday 3rd bundle flag
  // ... other fields
}
```

**Behavior**:
- `scannerTotal` = Total packages from "How Am I Doing"
- When `scannerTotal` changes, auto-estimates parcels/sprs
- When user manually adjusts, sets `packagesManuallyUpdated = true`
- Manual updates prevent auto-re-estimation

### UI Components

#### HowAmIDoingSection Component

**File**: `src/components/shared/HowAmIDoingSection.jsx`

**Before Route Start**:
- Shows scanner total input
- Shows 3rd bundle checkbox (Mondays only)
- Shows estimation message with confidence
- Shows parcels/SPRs inputs with auto-fill
- Allows manual adjustment

**Features**:
- Auto-estimation when scanner total changes
- Smart sync: adjusting parcels recalculates SPRs
- Shows "(Manual)" indicator when user adjusts
- Real-time pattern analysis

#### PackageProgressCard Component

**File**: `src/components/shared/PackageProgressCard.jsx`

**During Active Route**:
- Shows packages remaining counter
- Shows progress bar and percentage
- Allows updating remaining count
- Shows parcels/SPRs breakdown

**Features**:
- Real-time progress calculation
- Visual progress bar with smooth transitions
- Quick scanner update input
- Persistent package totals

### TodayScreen Integration

**File**: `src/components/screens/TodayScreen.jsx`

**Conditional Rendering**:
```javascript
{!routeStarted && <HowAmIDoingSection />}
{routeStarted && <PackageProgressCard />}
```

**Before Route**: Full package estimation interface
**During Route**: Simplified progress tracker

---

## Historical Pattern Analysis

### Pattern Storage

Package patterns are calculated from `route_history` table:
```sql
SELECT parcels, spurs, date FROM route_history
WHERE route_id = ?
ORDER BY date DESC
LIMIT 90
```

### Pattern Calculation

**Step 1**: Group by day type
```javascript
monday: { totalParcels: 344, totalSprs: 480, count: 8 }
peak: { totalParcels: 520, totalSprs: 780, count: 5 }
normal: { totalParcels: 387, totalSprs: 543, count: 15 }
```

**Step 2**: Calculate ratios
```javascript
monday: {
  parcelRatio: 344 / (344 + 480) = 0.417 (42%)
  spurRatio: 480 / (344 + 480) = 0.583 (58%)
  avgParcels: 344 / 8 = 43
  avgSprs: 480 / 8 = 60
}
```

**Step 3**: Apply to today's total
```javascript
scannerTotal = 103
dayType = 'monday'
pattern = patterns['monday']

parcels = 103 × 0.417 = 43
sprs = 103 - 43 = 60
```

### Minimum Data Requirements

- **3+ days** required for historical estimation
- **10+ days** for "high" confidence
- **Less than 3 days** falls back to default 42/58 split

---

## Example Scenarios

### Scenario 1: New Route (No History)

```
User enters scanner total: 103
↓
No historical data available
↓
Uses default ratio (42% parcels)
↓
Estimated: 43 parcels, 60 SPRs
Message: "Using default split (42% parcels, 58% SPRs)"
```

### Scenario 2: Monday with History

```
User enters scanner total: 103
Day: Monday (3rd bundle checked)
History: 8 Monday days available
↓
Analyzes 8 previous Mondays
Average: 42% parcels, 58% SPRs
↓
Estimated: 43 parcels, 60 SPRs
Message: "Reliable estimate based on 8 monday days (42% parcels)"
```

### Scenario 3: Peak Season

```
User enters scanner total: 150
Day: December 15 (peak season)
History: 5 peak days available
↓
Analyzes 5 previous December days
Average: 35% parcels, 65% SPRs
↓
Estimated: 53 parcels, 97 SPRs
Message: "Reasonable estimate based on 5 peak days (35% parcels)"
```

### Scenario 4: Manual Adjustment

```
User enters scanner total: 103
System estimates: 43 parcels, 60 SPRs
↓
User counts while loading truck
Actual: 45 parcels
↓
User changes parcels input to 45
System auto-adjusts SPRs to 58
Marks as "Manual" override
↓
Final: 45 parcels, 58 SPRs (Manual)
```

### Scenario 5: Mid-Route Scanner Update

```
Route started with: 103 packages
↓
User delivers packages
Scanner now shows: 75 remaining
↓
User updates in PackageProgressCard
Progress bar updates: 27% delivered
↓
Shows: 75 / 103 packages
```

---

## Data Flow

### 1. Input Phase (Before Route Start)

```
Scanner Device → User Input
         ↓
   scannerTotal
         ↓
   Historical Data Analysis
         ↓
   Pattern Calculation
         ↓
   Auto-fill parcels/sprs
         ↓
   (Optional) Manual Adjustment
         ↓
   Final Values Stored
```

### 2. Active Route Phase

```
Initial Values (parcels, sprs, scannerTotal)
         ↓
   Route Started
         ↓
   PackageProgressCard Displayed
         ↓
   User Updates scannerTotal
         ↓
   Progress Calculation
         ↓
   Visual Feedback (progress bar)
```

### 3. Route Completion Phase

```
Final scannerTotal Value
   parcels Value
   sprs Value
         ↓
   Save to route_history
         ↓
   Update Pattern Data
         ↓
   Used for Future Estimations
```

---

## Database Schema

### Routes Table (existing)
```sql
-- No changes needed
```

### Route History Table (existing)
```sql
parcels integer              -- Parcels count (stored)
spurs integer                -- SPRs count (stored)
date date                    -- For day type detection
```

**Pattern Calculation**: Done in JavaScript from historical data
**No new tables**: Uses existing schema

---

## Benefits

### 1. Saves Time
- No manual counting of parcels vs SPRs
- Instant estimation from scanner total
- Historical patterns improve over time

### 2. Improves Accuracy
- Uses actual route history
- Adapts to seasonal variations
- Accounts for day-type differences

### 3. Smart Learning
- Gets better with more data
- Identifies Monday patterns
- Detects peak season changes

### 4. Flexible
- Allows manual override
- Quick adjustments while loading
- No lock-in to estimates

### 5. Route Progress Tracking
- Visual feedback during delivery
- Easy scanner updates
- Clear package breakdown

---

## User Workflow

### Morning Routine

**Step 1**: Check scanner
```
Scanner → "How Am I Doing"
Shows: Pkgs Remaining: 103
```

**Step 2**: Enter into app
```
Open Today screen
Enter scanner total: 103
```

**Step 3**: Review estimation
```
App shows: 43 parcels, 60 SPRs
Based on: 8 similar Monday days
Confidence: Reliable
```

**Step 4**: Adjust if needed
```
(While loading truck)
Count shows: 45 parcels
Adjust in app: 45 parcels
App updates: 58 SPRs
```

**Step 5**: Start route
```
Tap "Start Route"
Package breakdown locked
Progress tracker activated
```

### During Route

**Update packages remaining**:
```
Check scanner periodically
Scanner shows: 75 remaining
Update in PackageProgressCard
Progress bar shows: 27% complete
```

### End of Day

**Route completion**:
```
Complete route
System saves: 45 parcels, 58 SPRs
Historical pattern updated
Future estimations improved
```

---

## Technical Notes

### Estimation Algorithm

**Priority Order**:
1. Historical data for matching day type (if 3+ days)
2. Default 42/58 split (if < 3 days)

**No fallback needed**: Always provides estimation

### State Management

**Package State**:
- `scannerTotal`: Source of truth for total packages
- `parcels`: Estimated or manual value
- `sprs`: Calculated from scannerTotal - parcels
- `packagesManuallyUpdated`: Prevents overwriting manual changes

**Synchronization**:
- Changing `scannerTotal` → Re-estimates (if not manual)
- Changing `parcels` → Recalculates `sprs`, sets manual flag
- Changing `sprs` → Recalculates `parcels`, sets manual flag

### Performance

**Pattern Calculation**:
- Done in-memory from history array
- O(n) where n = history length (max 90 days)
- Cached in useMemo hook
- Re-runs only when history/scannerTotal changes

**No Database Queries**:
- Uses existing history loaded on route load
- No additional API calls needed
- Fast, responsive estimation

---

## Files Modified

1. **`src/services/packageEstimationService.js`** (NEW)
   - Package estimation logic
   - Historical pattern analysis
   - Day type detection
   - Confidence calculation

2. **`src/stores/routeStore.js`**
   - Added `scannerTotal` field
   - Added `packagesManuallyUpdated` field
   - Added `thirdBundle` field
   - Updated `clearTodayInputs()`

3. **`src/components/shared/HowAmIDoingSection.jsx`**
   - Complete redesign
   - Scanner total input
   - Package breakdown with auto-estimation
   - Manual adjustment support
   - Estimation message display

4. **`src/components/shared/PackageProgressCard.jsx`** (NEW)
   - Package progress tracker
   - Progress bar visualization
   - Scanner update input
   - Parcels/SPRs display

5. **`src/components/screens/TodayScreen.jsx`**
   - Conditional component rendering
   - HowAmIDoingSection before route start
   - PackageProgressCard during route

---

## Testing Checklist

### Test 1: Default Estimation (No History)
- [ ] Create new route
- [ ] Enter scanner total: 100
- [ ] Verify: 42 parcels, 58 SPRs
- [ ] Check message: "Using default split"

### Test 2: Historical Estimation
- [ ] Route with 5+ days of history
- [ ] Enter scanner total
- [ ] Verify: Uses historical ratios
- [ ] Check message: Shows confidence and day count

### Test 3: Manual Adjustment
- [ ] Enter scanner total: 100
- [ ] Change parcels to 50
- [ ] Verify: SPRs update to 50
- [ ] Verify: "(Manual)" indicator shows

### Test 4: Monday 3rd Bundle
- [ ] On Monday, check 3rd bundle box
- [ ] Enter scanner total
- [ ] Verify: Uses Monday pattern
- [ ] Uncheck box, verify: Uses normal pattern

### Test 5: Package Progress
- [ ] Start route with packages
- [ ] Verify: PackageProgressCard shows
- [ ] Update scanner total
- [ ] Verify: Progress bar updates

### Test 6: Route Completion
- [ ] Complete route with packages
- [ ] Verify: Data saved to history
- [ ] Start new route next day
- [ ] Verify: Previous day affects estimation

---

## Future Enhancements

### Potential Improvements

1. **SPR Subcategories**
   - Track accountable vs non-accountable
   - Estimate certified mail separately
   - Account for signature requirements

2. **Package Size Analysis**
   - Track small vs large packages
   - Estimate load truck time more accurately
   - Account for oversize items

3. **Time-Based Patterns**
   - Detect Christmas rush vs normal December
   - Account for election mail periods
   - Identify local events affecting volume

4. **Smart Alerts**
   - "Package volume 30% higher than usual"
   - "Consider requesting assistance"
   - "This matches your heaviest day pattern"

5. **Multi-Route Analysis**
   - Compare patterns across different routes
   - Identify office-wide trends
   - Share anonymized pattern data

---

## Related Documentation

- `OFFICE-TIME-COMPONENTS-IMPLEMENTATION.md` - Office time calculations
- `STREET-TIME-PREDICTION-FALLBACK.md` - Street time estimation
- `usps-compliance-reference.md` - USPS standards

---

**Document Version**: 1.0
**Last Updated**: 2026-01-04
**Status**: IMPLEMENTED AND TESTED
