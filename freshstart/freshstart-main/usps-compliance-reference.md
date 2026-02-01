# USPS Compliance Reference - RouteWise V2

**Purpose:** Developer reference for USPS operational rules, timekeeping standards, and contract provisions

**Sources:**
- USPS M-39 Management of Delivery Services (June 2019)
- USPS M-41 City Delivery Carriers Duties and Responsibilities (June 2019)
- USPS F-21 Timekeeping Guidelines
- NALC National Agreement (Article 34)

**Note:** This document extracts rules relevant to RouteWise functionality. When in doubt, consult official manuals. Mark contractual items with "Verify with steward/official sources."

---

## 📋 TABLE OF CONTENTS

1. [Operation Codes](#operation-codes)
2. [Workweek & Pay Period Structure](#workweek--pay-period-structure)
3. [Time Classification Rules](#time-classification-rules)
4. [Calculation Formulas](#calculation-formulas)
5. [Route Protection Thresholds](#route-protection-thresholds)
6. [Overtime & Penalty Time](#overtime--penalty-time)
7. [Break & Lunch Requirements](#break--lunch-requirements)
8. [Route Evaluation Rules](#route-evaluation-rules)

---

## 1. OPERATION CODES

**Source:** USPS F-21 Timekeeping, RouteWise operation_codes table

### Core Timekeeping Codes

| Code | Name | Description | When to Use |
|------|------|-------------|-------------|
| **722** | **Office Time - AM** | Casing, pulling down, safety talk, pre-trip | Before leaving for street |
| **721** | **Street Time** | Motorized delivery time including load truck | After leaving office until return |
| **744** | **Office Time - PM** | Post-trip, vehicle inspection, closing duties | After returning from street |
| **736** | **Relay/Transfer** | Receiving or delivering relay mail | During relay operations |
| **732** | **Collections** | Collection box pickups | During collection activities |

### Leave Codes

| Code | Name | Description |
|------|------|-------------|
| **080** | Annual Leave | Scheduled vacation time |
| **086** | Sick Leave | Sick or medical leave |
| **088** | Holiday Leave | Paid holidays |
| **082** | LWOP | Leave without pay |
| **085** | FMLA | Family Medical Leave Act |

### Special Codes

| Code | Name | Description | Route Protection Impact |
|------|------|-------------|-------------------------|
| **734** | Route Inspection | Official route count/inspection | ✅ Used for route adjustments |
| **735** | Mail Count | Special mail volume count | ✅ Used for route protection |
| **743** | Training | Carrier training time | ❌ Not counted in route eval |
| **063** | NS Day - Scheduled | Regular scheduled day off | ❌ Not worked |
| **066** | NS Day - Rotating | Rotating scheduled day off | ❌ Not worked |

### Implementation Notes

**In RouteWise V2:**

```javascript
// src/utils/constants.js
export const OPERATION_CODES = {
  // Office Time
  '722': { name: 'Office Time - AM', category: 'office', color: '#3B82F6' },
  '744': { name: 'Office Time - PM', category: 'office', color: '#3B82F6' },
  
  // Street Time
  '721': { name: 'Street Time', category: 'street', color: '#10B981' },
  '736': { name: 'Relay/Transfer', category: 'street', color: '#10B981' },
  '732': { name: 'Collections', category: 'street', color: '#10B981' },
  
  // Leave
  '080': { name: 'Annual Leave', category: 'leave', color: '#F59E0B' },
  '086': { name: 'Sick Leave', category: 'leave', color: '#EF4444' },
  '088': { name: 'Holiday Leave', category: 'leave', color: '#8B5CF6' },
  
  // Special
  '734': { name: 'Route Inspection', category: 'special', color: '#EC4899' },
  '735': { name: 'Mail Count', category: 'special', color: '#EC4899' },
};

export const STREET_TIME_CODES = ['721', '736', '732'];
export const OFFICE_TIME_CODES = ['722', '744'];
export const LEAVE_CODES = ['080', '086', '088', '082', '085'];
```

---

## 2. WORKWEEK & PAY PERIOD STRUCTURE

**Source:** USPS M-39, RouteWise operational corrections spec

### USPS Workweek Definition

**CRITICAL:** USPS workweek is **Saturday through Friday**, NOT Monday through Sunday.

```
Workweek Structure:
Day 1: Saturday (start of workweek)
Day 2: Sunday
Day 3: Monday
Day 4: Tuesday
Day 5: Wednesday
Day 6: Thursday
Day 7: Friday (end of workweek)
```

**JavaScript Implementation:**

```javascript
// Get workweek start (most recent Saturday at 00:00)
function getWorkweekStart(date) {
  const d = new Date(date);
  const day = d.getDay();  // 0=Sunday, 1=Monday, ..., 6=Saturday
  
  // Days back to most recent Saturday
  const diff = day === 6 ? 0 : -(day + 1);
  
  const weekStart = new Date(d.getTime() + diff * 86400000);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Get workweek end (following Friday at 23:59:59)
function getWorkweekEnd(date) {
  const weekStart = getWorkweekStart(date);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}
```

### Pay Period Structure

**CRITICAL:** Pay periods are **2 weeks** (14 days), starting on Saturday.

```
Pay Period #1: Saturday Week 1 through Friday Week 2
Pay Period #2: Saturday Week 3 through Friday Week 4
(Repeats)
```

**Why This Matters:**
- ✅ Overtime calculated per **workweek** (not pay period)
- ✅ Route evaluations use **workweek** boundaries
- ✅ Weekly stats must align with Saturday-Friday
- ✅ Special inspection counts use workweek data

**Pay Period Reference Dates:**
```javascript
// Known pay period start (reference point)
const PAY_PERIOD_REFERENCE = new Date('2024-12-14'); // Saturday, PP start

function getPayPeriodStart(date) {
  const d = new Date(date);
  const ref = new Date(PAY_PERIOD_REFERENCE);
  
  // Calculate weeks since reference
  const daysDiff = Math.floor((d - ref) / 86400000);
  const weeksSinceRef = Math.floor(daysDiff / 14) * 14;
  
  const ppStart = new Date(ref.getTime() + weeksSinceRef * 86400000);
  ppStart.setHours(0, 0, 0, 0);
  return ppStart;
}
```

---

## 3. TIME CLASSIFICATION RULES

**Source:** USPS M-39, M-41

### Office Time (Code 722/744)

**Includes:**
- ✅ Casing DPS and flats
- ✅ Pulling down mail from case
- ✅ Safety talks and stand-up meetings
- ✅ Pre-trip vehicle inspection
- ✅ Scanning packages (preparing for delivery)
- ✅ Loading equipment and supplies
- ✅ Administrative tasks at office

**Does NOT Include:**
- ❌ Loading truck with mail/parcels (this is street time!)
- ❌ Any activity after leaving office
- ❌ Lunch break (unpaid)
- ❌ Authorized breaks taken at office

### Street Time (Code 721)

**CRITICAL:** Street time starts when carrier **leaves office to load truck**, NOT when delivery starts.

**Includes:**
- ✅ **Loading truck** (gathering parcels, loading vehicle, securing load)
- ✅ Driving to route
- ✅ Delivering mail and packages
- ✅ Walking/driving between deliveries
- ✅ Collections
- ✅ Customer interactions
- ✅ Driving back to office
- ✅ Unloading vehicle
- ✅ Post-trip vehicle activities

**Does NOT Include:**
- ❌ Lunch break (unpaid, deducted from total)
- ❌ Authorized breaks (if taken, still counted as work time)
- ❌ Unauthorized breaks

### Load Truck Time Classification

**CRITICAL RULE:** Load truck time is **STREET TIME** (motorized time), NOT office time.

**Official Definition:**
> "Load time begins when the carrier starts loading the vehicle and ends when the vehicle is secured and ready to depart. This is classified as motorized time (street time), not office time."

**Why This Matters:**
- Office time predictions should **exclude** load time
- Street time predictions should **include** load time
- Route evaluations classify load time as street time
- DOIS reporting must show load time in street category

**Implementation:**

```javascript
// CORRECT - Load time as street time
const officeTime = caseTime + pullDownTime + safetyTalk + scanPackages;
const loadTruckTime = (parcels + spurs) * 0.4;  // Separate calculation
const streetTime = loadTruckTime + deliveryTime;

// Leave office time = when office work ends (before loading truck)
const leaveOfficeTime = startTime + officeTime;

// Clock out time = leave office + total street time (including load)
const clockOutTime = leaveOfficeTime + streetTime;
```

```javascript
// INCORRECT - Do NOT do this
const officeTime = caseTime + pullDownTime + loadTruckTime;  // ❌ WRONG!
```

---

## 4. CALCULATION FORMULAS

**Source:** USPS M-39, M-41, RouteWise operational experience

### Office Time Components

**Casing Time:**
```javascript
const caseTime = (flats * 3) + (letters * 2);

// Where:
// - DPS: NOT CASED (DPS is pre-sorted - only pull-down time applies)
// - Flats: 3 minutes per flat (more handling required)
// - Letters: 2 minutes per letter (manual casing)
```

**Pull Down Time:**
```javascript
const pullDownTime = (dps / 500) * 4;

// Where:
// - 500 letters = 4 minutes to pull down
// - Rate: ~125 letters per minute pull down rate
```

**Package Scanning Time:**
```javascript
const scanTime = totalPackages * 0.75;

// Where:
// - totalPackages = parcels + SPRs
// - 0.75 minutes (45 seconds) per package scan
```

**Safety Talk Time:**
```javascript
const safetyTalkTime = safetyTalk || 0;  // User-entered, typically 5-15 minutes
```

**Total Office Time:**
```javascript
const totalOfficeTime = caseTime + pullDownTime + safetyTalkTime + scanTime;
// NOTE: Does NOT include load truck time!
```

### Street Time Components

**Load Truck Time:**
```javascript
const loadTruckTime = (parcels + spurs) * 0.4;

// Where:
// - 0.4 minutes (24 seconds) per package to load
// - Includes gathering, loading, securing
```

**Delivery Time:**
```javascript
// This comes from route averages and prediction algorithm
// See RouteWise hybrid prediction (BUSINESS-LOGIC-EXTRACTION.md)
const deliveryTime = calculateSmartPrediction(todayMail, history);
```

**Total Street Time:**
```javascript
const totalStreetTime = loadTruckTime + deliveryTime;
```

### Full Day Calculation

**Leave Office Time:**
```javascript
const leaveOfficeTime = startTime + totalOfficeTime;
// When carrier finishes office work and heads to truck
```

**Clock Out Time:**
```javascript
const clockOutTime = leaveOfficeTime + totalStreetTime;
// When carrier returns and clocks out
```

**Overtime Calculation:**
```javascript
const tourLength = 8.5 * 60;  // Default tour in minutes
const scheduledEndTime = startTime + tourLength;
const overtime = Math.max(0, clockOutTime - scheduledEndTime);
```

---

## 5. ROUTE PROTECTION THRESHOLDS

**Source:** USPS M-39 Section 271g, NALC Article 34

### M-39 Section 271g - Overburdened Route Inspection

**Triggers Special Inspection:**

**ANY of the following for 3+ days in a 5-consecutive-day period:**

1. ✅ **Overtime exceeds 1 hour**
   - Not including authorized breaks
   - Must be actual street time overtime

2. ✅ **Auxiliary assistance required**
   - Route needs help to finish
   - T-6 carrier helps
   - CCA helps deliver part of route

3. ✅ **Carrier unable to deliver all mail**
   - Parcels brought back
   - DPS/flats not delivered
   - Route incomplete

**5-Minute Rule (CRITICAL):**

**From M-39 271g:**
> "A route is considered overburdened if average street time exceeds evaluation by 5 or more minutes."

**Implementation:**

```javascript
function checkOverburdened(routeAverages, routeEvaluation) {
  const actualStreetTime = routeAverages.normal;  // Hours
  const evaluatedStreetTime = routeEvaluation.streetTime;  // Hours
  
  const difference = (actualStreetTime - evaluatedStreetTime) * 60;  // Convert to minutes
  
  return {
    isOverburdened: difference >= 5,
    variance: difference,
    threshold: 5,
    message: difference >= 5 
      ? `Route is overburdened by ${difference.toFixed(0)} minutes`
      : `Route is within evaluation (${difference.toFixed(0)} min variance)`
  };
}
```

### Article 34 - Route Protections

**Verify with steward/official sources**

**Key Provisions:**

1. **Regular Carrier Rights:**
   - Regular carrier owns their route assignment
   - Route adjustments require consultation
   - Carrier can request inspection if overburdened

2. **Special Inspection Request:**
   - Carrier can request after 3/5 rule violation
   - Management must respond within reasonable time
   - Inspection must follow M-39 procedures

3. **Temporary Route Changes:**
   - Management can make temporary adjustments
   - Must notify carrier
   - Permanent changes require route evaluation

**RouteWise Support:**
```javascript
// Track 3/5 rule violations
function check3of5Rule(last5Days) {
  const violations = last5Days.filter(day => 
    day.overtime >= 60 ||  // 60+ minutes OT
    day.auxiliaryAssistance === true ||
    day.mailNotDelivered === true
  );
  
  return {
    qualifies: violations.length >= 3,
    violationCount: violations.length,
    daysCounted: last5Days.length,
    message: violations.length >= 3
      ? '✅ Qualifies for Special Inspection (3/5 rule)'
      : `${violations.length}/3 days - Need ${3 - violations.length} more`
  };
}
```

---

## 6. OVERTIME & PENALTY TIME

**Source:** USPS M-39, NALC National Agreement

### Overtime Definition

**Overtime (OT):**
- Time worked **beyond scheduled tour**
- Calculated per **workweek** (not pay period)
- Paid at 1.5x base rate

**Example:**
```
Scheduled tour: 8.5 hours (7:30 AM - 4:30 PM with 30 min lunch)
Actual work: 9.5 hours
Overtime: 1.0 hour
```

### Penalty Overtime

**Verify with steward/official sources**

**Penalty OT Triggers:**

1. **Work beyond 10 hours in a day** → 2.0x rate
2. **Work beyond 56 hours in a week** → 2.0x rate
3. **Work on NS day** → 1.5x rate (or 2.0x if beyond 10 hours)
4. **Work on 6th consecutive day** → Varies by circumstance

**Implementation:**

```javascript
function calculateOvertimePay(hoursWorked, scheduledHours, weeklyHours, isNSDay) {
  let regularOT = 0;   // 1.5x rate
  let penaltyOT = 0;   // 2.0x rate
  
  const dailyOT = Math.max(0, hoursWorked - scheduledHours);
  
  if (isNSDay) {
    // NS day work
    if (hoursWorked > 10) {
      regularOT = 10;
      penaltyOT = hoursWorked - 10;
    } else {
      regularOT = hoursWorked;
    }
  } else {
    // Regular work day
    if (hoursWorked > 10) {
      regularOT = 10 - scheduledHours;
      penaltyOT = hoursWorked - 10;
    } else {
      regularOT = dailyOT;
    }
  }
  
  // Weekly penalty threshold
  if (weeklyHours > 56) {
    const weeklyPenalty = weeklyHours - 56;
    // Adjust based on daily calculations
    // (Complex - consult contract for exact rules)
  }
  
  return { regularOT, penaltyOT };
}
```

---

## 7. BREAK & LUNCH REQUIREMENTS

**Source:** USPS M-41

### Lunch Break

**Requirements:**
- **Duration:** 30 minutes (minimum)
- **Timing:** Between 3rd and 6th hour of tour
- **Status:** **UNPAID** (deducted from total time)
- **Location:** Off route, seated position
- **Restrictions:** Cannot be at end of route, cannot be combined with other breaks

**Implementation:**
```javascript
const LUNCH_DURATION = 30;  // minutes
const LUNCH_EARLIEST = 180;  // 3 hours after start (minutes)
const LUNCH_LATEST = 360;    // 6 hours after start (minutes)

function validateLunchTime(startTime, lunchStartTime) {
  const elapsed = (lunchStartTime - startTime) / 60000;  // minutes
  
  return {
    valid: elapsed >= LUNCH_EARLIEST && elapsed <= LUNCH_LATEST,
    elapsed: elapsed,
    message: elapsed < LUNCH_EARLIEST 
      ? 'Lunch too early (must be after 3 hours)'
      : elapsed > LUNCH_LATEST
        ? 'Lunch too late (must be before 6 hours)'
        : 'Lunch timing valid'
  };
}
```

### Comfort Stops (10-Minute Breaks)

**Requirements:**
- **Duration:** 10 minutes each
- **Frequency:** 2 per day (typically)
  - First 10-minute break in first half of route
  - Second 10-minute break in second half of route
- **Status:** **PAID** (counted as work time)
- **Flexibility:** Can be taken as needed for restroom, water, etc.

**Implementation:**
```javascript
const COMFORT_STOP_DURATION = 10;  // minutes
const COMFORT_STOPS_PER_DAY = 2;

// Comfort stops are paid work time, so they're included in total time
// but tracked separately for route evaluation purposes
```

### Break Tracking

**RouteWise Implementation:**
```javascript
const breakTracking = {
  lunch: {
    duration: 30,
    paid: false,
    required: true,
    earliestStart: startTime + (3 * 60),  // 3 hours
    latestStart: startTime + (6 * 60),    // 6 hours
  },
  comfortStop: {
    duration: 10,
    paid: true,
    required: false,  // Allowed, not required
    count: 2,
  }
};

// Time calculations
const totalWorkTime = clockOutTime - startTime;
const paidTime = totalWorkTime - lunch.duration;  // Lunch is unpaid
const streetTime = totalWorkTime - officeTime - lunch.duration;
```

---

## 8. ROUTE EVALUATION RULES

**Source:** USPS M-39 Section 243, 271

### Route Evaluation Standards

**Evaluated Route Components:**

1. **Office Time:**
   - Casing time (based on average mail volume)
   - Pull down time
   - Pre-trip activities
   - Does NOT include load truck time

2. **Street Time:**
   - Load truck time
   - Drive time to route
   - Delivery time
   - Collections (if applicable)
   - Drive time return

3. **Total Route Time:**
   - Office + Street = Total evaluated time
   - Should equal scheduled tour (8.5 hours typically)

### Evaluation vs. Actual

**Route is properly evaluated when:**
```
Actual Average Time ≈ Evaluated Time (within 5 minutes)
```

**Route needs adjustment when:**
```
Actual Average Time > Evaluated Time + 5 minutes
```

**Implementation:**

```javascript
function compareToEvaluation(routeData) {
  const evaluation = routeData.evaluation;  // From route inspection
  const averages = routeData.averages;      // From actual work history
  
  const officeVariance = (averages.office - evaluation.office) * 60;
  const streetVariance = (averages.street - evaluation.street) * 60;
  const totalVariance = (averages.total - evaluation.total) * 60;
  
  return {
    office: {
      actual: averages.office,
      evaluated: evaluation.office,
      variance: officeVariance,
      status: Math.abs(officeVariance) <= 5 ? 'good' : 'variance'
    },
    street: {
      actual: averages.street,
      evaluated: evaluation.street,
      variance: streetVariance,
      status: Math.abs(streetVariance) <= 5 ? 'good' : 'variance'
    },
    total: {
      actual: averages.total,
      evaluated: evaluation.total,
      variance: totalVariance,
      overburdened: totalVariance >= 5,
      status: totalVariance >= 5 ? '⚠️ OVERBURDENED' : '✅ Within Eval'
    }
  };
}
```

### Special Inspection Triggers

**From M-39 271g:**

RouteWise should flag when special inspection may be warranted:

```javascript
function checkSpecialInspectionQualification(routeHistory) {
  const last5Days = getLastWorkDays(routeHistory, 5);
  
  const triggers = {
    overtime1Hour: 0,
    auxiliaryHelp: 0,
    mailNotDelivered: 0
  };
  
  last5Days.forEach(day => {
    if (day.overtime >= 60) triggers.overtime1Hour++;
    if (day.auxiliaryAssistance) triggers.auxiliaryHelp++;
    if (day.mailNotDelivered) triggers.mailNotDelivered++;
  });
  
  const qualifies = 
    triggers.overtime1Hour >= 3 ||
    triggers.auxiliaryHelp >= 3 ||
    triggers.mailNotDelivered >= 3;
  
  return {
    qualifies,
    triggers,
    message: qualifies 
      ? '✅ Route qualifies for Special Inspection (M-39 271g)'
      : 'Does not currently meet 3/5 rule criteria'
  };
}
```

---

## 9. IMPLEMENTATION CHECKLIST FOR V2

### Core Constants to Define

```javascript
// src/utils/uspsConstants.js

export const USPS_STANDARDS = {
  // Workweek
  WORKWEEK_START_DAY: 6,  // Saturday

  // Time rates (DPS is NOT cased - only pull-down time applies)
  FLATS_MULTIPLIER: 3,    // minutes per flat
  LETTERS_MULTIPLIER: 2,  // minutes per letter
  PULLDOWN_RATE: 70,      // DPS pieces per minute (M-41 standard)
  PACKAGE_SCAN_TIME: 0.75,  // minutes per package
  LOAD_TRUCK_TIME: 0.4,     // minutes per package
  
  // Break requirements
  LUNCH_DURATION: 30,       // minutes, unpaid
  LUNCH_MIN_START: 180,     // 3 hours after start
  LUNCH_MAX_START: 360,     // 6 hours after start
  COMFORT_STOP_DURATION: 10,  // minutes, paid
  
  // Overtime thresholds
  DAILY_OT_THRESHOLD: 8.5,   // hours (typical tour)
  PENALTY_OT_THRESHOLD: 10,  // hours
  WEEKLY_PENALTY_THRESHOLD: 56,  // hours
  
  // Route protection
  OVERBURDENED_THRESHOLD: 5,  // minutes variance
  SPECIAL_INSPECTION_DAYS: 3, // violations in 5-day period
  SPECIAL_INSPECTION_OT: 60,  // minutes
};
```

### Validation Rules

```javascript
// src/utils/uspsValidation.js

export function validateUSPSCompliance(dayData) {
  const errors = [];
  const warnings = [];
  
  // Check lunch timing
  if (dayData.lunchStart) {
    const lunchValidation = validateLunchTime(
      dayData.startTime,
      dayData.lunchStart
    );
    if (!lunchValidation.valid) {
      warnings.push(lunchValidation.message);
    }
  }
  
  // Check overtime thresholds
  if (dayData.totalHours > 10) {
    warnings.push('Penalty OT threshold exceeded (10 hours)');
  }
  
  // Check workweek alignment
  if (!isWorkweekAligned(dayData.date)) {
    errors.push('Date not aligned to USPS workweek (Sat-Fri)');
  }
  
  return { errors, warnings, isValid: errors.length === 0 };
}
```

---

## 10. CRITICAL REMINDERS FOR V2

### DO:
- ✅ Use Saturday-Friday workweek structure
- ✅ Classify load truck time as street time
- ✅ Deduct lunch from total time (unpaid)
- ✅ Include comfort stops in paid time
- ✅ Track 3/5 rule for special inspections
- ✅ Compare actuals to route evaluation
- ✅ Provide M-39 section citations

### DON'T:
- ❌ Use Monday-Sunday workweek
- ❌ Add load time to office time
- ❌ Count lunch as paid time
- ❌ Ignore route evaluation variance
- ❌ Make contractual claims (mark as "verify with steward")
- ❌ Deviate from official USPS formulas

---

## 11. LEGAL DISCLAIMER

**IMPORTANT:** RouteWise is a route tracking and documentation tool. It is NOT:
- Legal advice
- Official USPS software
- A substitute for contract knowledge
- Guaranteed to be accurate for grievances

**Users should:**
- Verify all calculations against USPS manuals
- Consult with union steward for contract questions
- Use RouteWise data as supporting documentation only
- Understand that rules may vary by local agreement

**Developers should:**
- Mark contractual provisions as "Verify with steward/official sources"
- Provide citations to source manuals (M-39, M-41, Article 34)
- Allow users to override calculations if needed
- Include disclaimers in app documentation

---

## 12. SOURCES & REFERENCES

### Official Manuals
- **M-39:** Management of Delivery Services (June 2019)
  - Section 243: Route Evaluations
  - Section 271: Route Adjustments
  - Section 271g: Overburdened Route Inspections

- **M-41:** City Delivery Carriers Duties and Responsibilities (June 2019)
  - Section on breaks and lunch
  - Time classification standards

- **F-21:** Timekeeping Guidelines
  - Operation code definitions
  - Clock ring procedures

### Contract Documents
- **NALC National Agreement**
  - Article 34: Route Protection
  - Article 8: Hours of Work
  - Article 41: Route Evaluation

### Implementation Notes
- RouteWise V1 operational corrections spec
- RouteWise V1 operation codes table schema
- Real-world carrier feedback and testing

---

**END OF USPS COMPLIANCE REFERENCE**

**For RouteWise V2 Development:**
Copy relevant sections into:
- `src/utils/uspsConstants.js`
- `src/utils/uspsValidation.js`
- `src/services/calculationService.js`

Use this document as authoritative reference during development.
