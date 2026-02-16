# RouteWise Launch HQ (working doc)

**Hard rule:** Nothing gets launched/published without Dana explicitly saying so.

## Single source of truth
- App: RouteWise (USPS city letter carrier app)
- Target: iOS + Android
- Positioning: reduce mental load / calmer day / more confidence (no medical claims)
- Pricing: **$4.99/mo**, **$39.99/yr**, **30‑day free trial on yearly only**
- Crash reporting: Sentry
- Accounts: Yes

---

## Workstreams (the 4 roles)

### 1) Mobile Release Lead
**Goal:** Ship-ready iOS/Android builds + store submission assets + release checklist.
**Deliverables:**
- Store submission checklist (iOS + Android)
- Capacitor build/release steps + CI notes (if any)
- App icon/splash/screenshots requirements
- TestFlight/Internal Testing plan
- Preflight QA checklist (devices/OS versions)

### 2) Payments / Entitlements Lead
**Goal:** Subscription flow + entitlements are bulletproof.
**Deliverables:**
- RevenueCat products setup map (monthly/yearly + trial on yearly)
- Paywall UX copy + required disclosures
- Restore purchases + manage subscription
- Edge cases matrix (trial cancel, billing issues, restore, switching plans)
- Test plan (sandbox, StoreKit test, Play test)

### 3) Legal / Compliance Lead
**Goal:** Don’t get rejected; don’t create legal/privacy debt.
**Deliverables:**
- Privacy Policy (accounts + Sentry + subscriptions) draft text
- Terms of Service draft text
- USPS non‑affiliation + trademark-safe language blocks
- Subscription disclosures and refund language (Apple/Google realities)
- Data deletion workflow requirements
- Store form disclosure checklist (Apple privacy labels + Play data safety)

### 4) Marketing / ASO Lead
**Goal:** Listing converts; messaging fits carriers.
**Deliverables:**
- App Store + Play listing copy (title/subtitle/short desc/long desc)
- Keyword set + competitor positioning
- Screenshot storyboard (6–8 frames) + headline copy
- Launch content plan (Reddit/FB/TikTok/YouTube style posts)
- Brand voice guardrails (no USPS endorsement, no medical claims)

---

## Engineering / bug-free push (Larry)
**Goal:** bug‑free + fast + simple + accurate.
- Run through app end-to-end and create a bug list with priorities.
- Fix critical bugs first, then polish.
- Add guardrails: error handling, empty states, offline-ish behavior where needed.
- Verify: auth, data persistence, predictions logic, timers, history.

---

## Current status (to be filled)
- [ ] Roles deliver their checklists/drafts
- [ ] Central punchlist created
- [ ] App QA run + bug triage
- [ ] Legal docs hosted + linked in-app
- [ ] Subscription flow implemented + tested
- [ ] Store assets ready
- [ ] Final Dana sign-off before any submission/publish
