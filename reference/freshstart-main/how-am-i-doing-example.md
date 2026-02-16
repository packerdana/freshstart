# "How Am I Doing" Feature - Usage Examples

## Visual UI Layout

```
┌─────────────────────────────────────────────────┐
│  How Am I Doing                                 │
│  ──────────────────────────────────────────── │
│                                                 │
│  Packages Remaining                             │
│  ┌───────────────────────────────────────────┐ │
│  │ Pkgs Remaining                            │ │
│  │ [          50          ]                  │ │
│  └───────────────────────────────────────────┘ │
│  Enter total package count from scanner        │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Parcels                                   │ │
│  │ [          45          ]                  │ │
│  └───────────────────────────────────────────┘ │
│  Enter packages actually loaded on truck       │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ SPRs (Auto-calculated)                    │ │
│  │                                           │ │
│  │ Packages Remaining - Parcels              │ │
│  │                                      5    │ │
│  │                                           │ │
│  │ 50 - 45 = 5                               │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │  Total    │  On Truck  │    SPRs        │  │
│  │    50     │     45     │      5         │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Real-World Example Scenarios

### Scenario 1: Normal Day

**Morning Scanner Reading:**
```
Scanner Display: "Package Count: 68"
```

**User Action:**
1. Opens RouteWise app
2. Taps "Packages Remaining" field
3. Enters: `68`

**Loading Truck:**
```
Driver counts packages on truck: 1, 2, 3... 62
```

**User Action:**
1. Taps "Parcels" field
2. Enters: `62`

**Result:**
```
SPRs Auto-calculated: 6

Summary Display:
- Total: 68
- On Truck: 62
- SPRs: 6

Interpretation: 6 packages remain at office for separate delivery
```

---

### Scenario 2: Light Package Day

**Morning Scanner Reading:**
```
Scanner Display: "Package Count: 25"
```

**User Input:**
- Packages Remaining: `25`

**After Loading:**
- Parcels: `25`

**Result:**
```
SPRs: 0

Summary:
- Total: 25
- On Truck: 25
- SPRs: 0

Interpretation: All packages loaded, nothing remaining
```

---

### Scenario 3: Heavy SPR Day

**Morning Scanner Reading:**
```
Scanner Display: "Package Count: 95"
```

**User Input:**
- Packages Remaining: `95`

**After Loading (Truck Full):**
- Parcels: `70`

**Result:**
```
SPRs: 25

Summary:
- Total: 95
- On Truck: 70
- SPRs: 25

Interpretation: 25 packages couldn't fit, will be delivered later or by another carrier
```

---

## Formula Integration Example

### Complete Route Time Calculation

**Given Data:**
- Packages Remaining: `65`
- Parcels: `60`
- SPRs: `5` (auto-calculated)

**Time Formula Application:**

```
1. Fixed Office Time
   33 × 1 M-39 = 33 minutes

2. Variable Casing Time
   (Includes SPRs in calculation)
   Flats: 8.5 ft × 115 ÷ 8 = 122.19 min
   Letters: 12.0 ft × 227 ÷ 18 = 151.33 min
   SPRs: 5 ÷ 8 = 0.63 min
   Subtotal: 274.15 minutes

3. Load Truck Time
   Parcels × 1.5 min/package
   60 × 1.5 = 90 minutes

4. Street Time
   240 minutes (route average)

5. Additional Time
   15 minutes (safety talk)

Total Time = 33 + 274.15 + 90 + 240 + 15
          = 652.15 minutes
          = 10 hours 52 minutes
```

**Key Insight:**
- The "How Am I Doing" feature provides accurate **Parcels** (60) for load time
- Provides accurate **SPRs** (5) for casing time
- Eliminates manual counting errors

---

## Mobile Workflow Step-by-Step

### Morning Routine Integration

**Step 1: Arrive at Office (7:00 AM)**
```
[ ] Clock in
[ ] Check scanner device
[✓] Scanner shows: 78 packages
```

**Step 2: Open RouteWise App**
```
[✓] Navigate to "Today" screen
[✓] Enter 78 in "Packages Remaining"
```

**Step 3: Case Mail (7:15 AM - 9:30 AM)**
```
[✓] Sort DPS
[✓] Case flats
[✓] Case letters
```

**Step 4: Load Truck (9:30 AM - 10:15 AM)**
```
[✓] Load mail trays
[✓] Load packages (counting: 1, 2, 3... 72)
[✓] Secure load
```

**Step 5: Update RouteWise**
```
[✓] Enter 72 in "Parcels"
[✓] App shows SPRs: 6
[✓] Confirm 6 packages still in office
```

**Step 6: Departure**
```
[✓] Review route
[✓] Check clock-out time estimate
[✓] Notify supervisor of 6 SPRs
[✓] Begin route
```

---

## Validation Examples

### Example 1: Preventing Negative Results

**Input:**
- Packages Remaining: `40`
- Parcels: `45` (Driver miscounted)

**Expected Behavior:**
```
Calculation: 40 - 45 = -5
Display: 0 (negative prevented)

Warning: This indicates counting error
- Driver should recount packages
- Or update scanner total
```

### Example 2: Handling Empty Fields

**Input:**
- Packages Remaining: (empty)
- Parcels: `30`

**Behavior:**
```
Empty field = 0
Calculation: 0 - 30 = -30
Display: 0

Summary: Not shown (incomplete data)
```

### Example 3: Large Numbers

**Input:**
- Packages Remaining: `250`
- Parcels: `180`

**Result:**
```
SPRs: 70

Summary:
- Total: 250
- On Truck: 180
- SPRs: 70

Note: Unusually high SPR count - may need additional carriers
```

---

## Troubleshooting Guide

### Issue 1: SPRs Not Calculating

**Symptoms:**
- SPRs shows 0 when should show value

**Solutions:**
1. Check both fields have values entered
2. Verify values are numeric (no letters)
3. Ensure Packages Remaining ≥ Parcels
4. Refresh app if needed

### Issue 2: Wrong Calculation

**Symptoms:**
- SPRs doesn't match manual calculation

**Solutions:**
1. Verify Packages Remaining is scanner total
2. Verify Parcels is actual truck count
3. Check for typos in input
4. Re-enter values

### Issue 3: Can't Enter Values

**Symptoms:**
- Input fields not accepting numbers

**Solutions:**
1. Tap directly on input field
2. Use numeric keyboard
3. Avoid special characters
4. Check browser compatibility

---

## Data Flow Diagram

```
┌─────────────────┐
│  Scanner Device │
│   "78 packages" │
└────────┬────────┘
         │
         ↓ (Manual Entry)
┌─────────────────────┐
│ Packages Remaining  │
│        78           │
└─────────────────────┘
         │
         ↓
┌─────────────────┐
│  Load Truck &   │
│  Count Packages │
│    = 72 pkgs    │
└────────┬────────┘
         │
         ↓ (Manual Entry)
┌─────────────────────┐
│      Parcels        │
│        72           │
└─────────────────────┘
         │
         ↓
┌─────────────────────┐
│  Auto-Calculate     │
│  78 - 72 = 6        │
└────────┬────────────┘
         │
         ↓
┌─────────────────────┐
│    SPRs: 6          │
│  (Read-only)        │
└─────────────────────┘
         │
         ↓
┌─────────────────────┐
│   Summary Box       │
│  Total  │ Truck│SPR │
│   78   │  72  │ 6  │
└─────────────────────┘
```

---

## Best Practices

### For Accurate SPR Tracking

1. **Scanner First**
   - Always check scanner before entering data
   - Use most recent scan count
   - Verify count with supervisor if unusual

2. **Count Carefully**
   - Count packages methodically on truck
   - Double-check if number seems wrong
   - Don't rush the count

3. **Update Immediately**
   - Enter values right after loading
   - Don't wait until later
   - Fresh data is accurate data

4. **Verify SPRs**
   - Check calculated SPRs match reality
   - Physically verify packages remaining
   - Report discrepancies

5. **Daily Reset**
   - Clear values at end of route
   - Start fresh each morning
   - Don't carry over previous day's data

---

## Quick Reference Card

### Formula
```
SPRs = Packages Remaining - Parcels
```

### Minimum Values
```
All fields: 0 or greater
SPRs: Always ≥ 0 (never negative)
```

### Typical Ranges
```
Packages Remaining: 20-150
Parcels: 20-120
SPRs: 0-30
```

### When to Use
```
✓ Every morning after scanner check
✓ After loading truck
✓ Before departing on route
✓ When packages redistributed
```

### When NOT to Use
```
✗ During route (dynamic count)
✗ For historical data
✗ For other carriers' packages
```

---

## Summary

The "How Am I Doing" feature streamlines package tracking by:

1. **Capturing scanner data** - Total assigned packages
2. **Recording actual load** - Packages on truck
3. **Auto-calculating SPRs** - Difference between totals
4. **Providing clear summary** - At-a-glance overview

**Time Saved:** 2-3 minutes per day (no manual calculation)
**Errors Reduced:** Eliminates math mistakes
**Accuracy Improved:** Real-time validation and feedback
