# RouteWise — Carrier Manual (AI Reference)

> **Purpose:** This manual is written for **carriers**. It’s also structured so the RouteWise AI Assistant can reference it directly, using the same words you use on the job.

---

## 1) What RouteWise does (in plain English)

RouteWise helps you:
- **Plan your day** with a realistic **return time estimate** based on your own history.
- **Track actual time** using USPS-style operation codes (721/722/744).
- **Improve predictions** over time by saving your real results.

### The promise (and the truth)
- RouteWise will **not** be perfect on day 1.
- **Predictions improve over the next 2–3 weeks** as it learns your route and your pace.

---

## 2) Terms RouteWise uses (and what they mean)

### Tour vs. Route
- **Tour** = your full workday (office + street + PM office).
- **Route** = the street portion + your route setup (Route 25, etc.).

In the app:
- The blue button says **End Tour** when you’re done and want to save the day.

### 721 / 722 / 744
- **721 (Street Time):** the time you’re out delivering.
- **722 (AM Office):** office time *before* you leave to the street.
- **744 (PM Office):** office time after you return.

### “Return time” vs “Clock out time”
- RouteWise focuses on **projected return** (what you’d tell the supervisor for your return-to-office estimate).
- Clock-out depends on PM office, extra work, instructions, etc.

---

## 3) What to enter each day (and why it matters)

### Mail volumes (the biggest prediction driver)
Enter these on the **Today** screen:
- **DPS** (pieces)
- **Flats** (feet)
- **Letters** (feet)
- **Packages total** (scanner total)
  - RouteWise splits packages into **Parcels** + **SPRs** (or you can manually set parcels).

**Why it matters:** Your volumes are the strongest signal for street-time predictions.

### Daily Log (optional but useful)
The Daily Log explains why today ran long/short:
- Late mail / late Amazon
- Waiting on parcels (minutes)
- Accountables (minutes)
- Other delays + notes

---

## 4) Typical workflow (recommended)

### A) Start of day
1) Open **Today**
2) Enter volumes (DPS / flats / letters / packages)
3) If needed, set **Start Time Override** (only affects today’s prediction)

### B) When you leave the office
- Tap **Start Route (721 Time)**

RouteWise will capture:
- Your **actual 721 start time** (leave office time)
- Your **722 AM office minutes** (based on start time → leave time)

### C) During the day
- Track waypoints if you use that feature.
- Predictions update as you complete waypoints.

### D) End of day
1) Start **744 PM Office** when appropriate
2) Tap **End Tour** when you’re done
3) Enter completion details if asked (notes, assistance, etc.)

**Why End Tour matters:** It’s what saves the “truth” that makes future predictions better.

---

## 5) Confidence meter (what it means)

RouteWise shows a **Confidence** bar on the prediction card.

It increases as RouteWise learns from your saved days:
- **Low:** just started / not enough history yet
- **Medium:** you have a decent set of saved days
- **High:** you have consistent history (about 2–3 weeks of normal days)

If confidence is low, the estimate is still useful—but treat it as a **starting point**, not a guarantee.

---

## 6) Bad data days (don’t let one day poison your averages)

Some days are not “normal” and can wreck predictions if they’re treated like normal:
- forced in / NS day
- heavy assistance or being pulled off route
- major breakdowns
- you forgot to stop a timer

### Best practice
- If a day is bad data, **exclude it from averages**.

RouteWise includes an **Exclude from averages** option in history screens.

---

## 7) Assistance vs. Work Off Route vs. Load Truck (don’t mix these up)

### A) “I got help today” (assistance received)
Use this when someone helped **your** route (they carried part of your work).
- Record it at **End Tour** as **Assistance = Yes**
- Enter **Assistance minutes** (about how long the help saved you)

**Why:** A helper can make your day look “fast” and can confuse predictions if it’s treated like a normal day.

### B) “I helped someone else” (you did extra)
Use **Work Off Route** when you are doing work that isn’t your normal route.
- This is **not** “assistance received”
- It’s extra work you did (which can make your day longer)

### C) When to use the Load Truck timer
Use **Load Truck** when you’re loading parcels **before** you start 721.
- Start Load Truck when you begin loading
- Finish Load Truck when done
- Tap **Start Route (721)** when you actually leave the office

**Why:** Load Truck time is real work time, but it shouldn’t backdate your 721 start or make it look like you left early.

---

## 8) Common problems + what to do

### Problem: “My volumes disappeared mid-day”
What happened: your phone/browser can sometimes drop temporary state.

What to do:
- Re-enter volumes.
- Update the app when a fix is available (RouteWise autosaves volumes to prevent this).

### Problem: “My break history disappeared after refresh”
What happened: the break history list wasn’t being persisted.

What to do:
- Update the app when a fix is available.

### Problem: “My prediction looks way off”
Checklist:
1) Are today’s volumes correct?
2) Did you accidentally save a bad day? (exclude it)
3) Are you comparing return-to-office vs clock-out?
4) Did you have unusual delays? (use Daily Log)

---

## 9) What RouteWise stores (for trust + transparency)

RouteWise stores data so it can learn your route:
- Daily totals (volumes, times)
- Timer entries (721/722/744 sessions)
- Optional notes/daily log

It’s built so **you can correct or exclude bad days**.

---

## 10) How to talk to the RouteWise Assistant (so it helps you)

When asking the assistant, include:
- Your route type (CCA/PTF/Regular)
- ODL/WAL status if relevant
- The day type (Monday, NS day, etc.)
- What happened (assistance, late parcels, etc.)

The assistant should answer in carrier language, with practical steps.

---

## 11) Safety + compliance note

RouteWise is a **personal planning tool**. Always follow local instructions and USPS/NALC guidance.

---

# Appendix: Quick definitions
- **DPS:** letters in DPS trays (pieces)
- **Flats/Letters (ft):** feet of flats/letters you cased or pulled down
- **SPRs:** small parcels/rolls that aren’t full-size parcels
- **Exclude from averages:** mark a day as bad data so it doesn’t affect your “normal” prediction baseline
