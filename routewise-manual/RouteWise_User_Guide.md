# RouteWise — User Guide (Begin Tour → End Tour)

> Audience: USPS city carriers.  
> Goal: help you run RouteWise smoothly every day without “poisoning” your predictions.

---

## 1) First-time setup (do this once)

### 1.1 Create your route
1) Open **Settings**
2) Tap **Create Route**
3) Fill in:
   - **Route Number** (ex: 25)
   - **Start Time** (your normal clock-in / begin tour time)
   - **Tour Length** (default is usually **8.5**) 
   - **Lunch** (default **30**) 
   - **Comfort Stop** (optional)
   - **Stops** (optional but recommended — improves pace estimates)
4) Save

**Tip:** If you have a route evaluation (or you know your evaluated street time), enter it in Settings when available—this improves accuracy. Most of the time this number doesn't include your lunch so add 30 minutes to it.

---

## 2) Waypoints setup (anchors + your custom stops)

Waypoints are your “checkpoints” for the day. They power live expected times and “ahead/behind” pacing.

### 2.1 Quick Setup (recommended)
1) Go to **Waypts**
2) Tap **Quick Setup (4 Waypoints)**

This creates your 4 anchors:
- **#0 Leave Post Office**
- **#1 1st Stop**
- **#98 Last Stop**
- **#99 Return to Post Office**

### 2.2 Add your own waypoints (as many as you want)
1) Go to **Waypts**
2) Tap **Add Waypoint**
3) Enter address/label
4) Save

RouteWise will automatically pick a good next sequence number (so you don’t have to).

### 2.3 Save as Template (so they auto-populate daily)
After you’ve built a good waypoint list:
1) Go to **Waypts**
2) Tap **Save as Template**

From then on, RouteWise can auto-populate your waypoints each workday.

---

## 3) Begin Tour (morning routine)

### 3.1 Enter today’s mail volumes (Today tab)
Go to **Today** and enter what you know.

Typical fields:
- **DPS** (pieces)
- **Flats** (often entered as *feet*)
- **Letters** (often entered as *feet*)
- **Parcels / SPRs**
- **Scanner Total** (if you use that as your main package count)

**If Today’s Stats looks empty:** make sure you entered at least one of these (DPS/flats/letters/parcels/sprs/scanner total).

### 3.2 How to measure flats/letters (feet)
If your office measures by feet:
- Use a ruler/yardstick method or case count estimate (whatever is consistent for you).
- Consistency beats perfection.
- One full bucket of flats = 1 Foot.
### 3.3 Where to find total packages to enter
Use the most reliable source you have *every day*:
- **Scanner “Package Lookahead / Package Total”** (if your office uses it)
- **Load Truck / Package count** (if available)
- Your **manifest / clerk count**

**Rule:** pick one source and stick to it. Switching sources makes history noisy.

---

## 4) Start Street Time (721) — leaving the office

When you physically leave the office to the street:
1) On **Today**, tap **Start Route**

RouteWise will:
- start the **721 timer**
- capture **Leave Office Time**
- compute **722 (AM office)** as: start time → leave office

**Important:** If you refresh mid-day and 722 looks missing later, RouteWise will recover 722 at end-of-day using your start time and leave time.

---

## 5) On the street — using Waypoints

### 5.1 Completing a waypoint
On **Waypts**, tap **Complete** on a waypoint when you actually hit it.

### 5.2 Expected times (“live”)
Once you complete at least one real waypoint, RouteWise will show **Expected: time (live)** for later waypoints.
- “Live” means it adjusts forward/back based on how you’re doing.

### 5.3 Forgot a waypoint?
If you forgot to tap Complete at the time:
- Use **Forgot?** and pick an expected time / enter a manual time (if prompted)

---

## 6) Assistance / giving away part of the route (VERY IMPORTANT)

This is the #1 way predictions get “poisoned” if it’s not recorded.

### 6.1 If you gave away the rest of your route mid-day
On **Waypts**:
1) Tap **Gave away rest of route (skip remaining)**
2) Enter the **last waypoint number you personally delivered**

RouteWise will mark everything after that as **Skipped (assistance)**.

**Rule:** If you didn’t personally deliver it, **don’t complete it**.

### 6.2 At End-of-Day, mark assistance
On **Complete Route / End Day**:
- Check **Assistance / Gave Away Part of Route**
- Enter **minutes given away/assisted** (estimate)

This flags the day so it won’t be treated like a clean baseline.

---

## 7) PM Office (744)

When you return and do PM office duties:
- Use the PM office flow in the app (if enabled) or record it at end-of-day if that’s your current workflow.

---

## 8) End Tour — completing the day

On **Today** tap **Complete Route** and enter:
- **Actual street time** (hours/minutes)
- **Actual clock-out** (optional but recommended)
- Assistance (if applicable)
- Notes (anything that explains a weird day)

RouteWise saves your day into history so:
- Stats improve
- Predictions improve
- Waypoint expected times improve

---

## 9) Stats — what to look at

### 9.1 Prediction Accuracy
- After you complete days with actual clock-out saved, you’ll see predicted vs actual accuracy.

### 9.2 Day History (time codes)
- Shows each day’s totals and (when expanded) the time codes recorded that day.

---

## 10) Troubleshooting (quick fixes)

### “My inputs disappeared after refresh”
- Make sure you’re on the **same URL** as usual (different domains don’t share storage).
- If it happened after a deploy, the latest build includes migration to preserve today inputs.

### “Expected times aren’t live”
- You need at least one completed waypoint for live adjustment.
- Check **Settings → About → App Version** and include it when reporting.

---

## Appendix: Daily quick checklist

1) **Today**: enter mail volumes + packages
2) **Waypts**: Quick Setup / confirm anchors exist
3) **Start Route** when you actually leave (721)
4) Complete waypoints as you go
5) If you give away part of route: **Skip remaining** + mark assistance at end-of-day
6) End day: enter actuals, clock-out, notes

