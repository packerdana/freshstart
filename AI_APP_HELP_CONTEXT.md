# RouteWise App Help Context (for AI)

This file is a **ground-truth map of RouteWise UI + features** extracted from the codebase, so App Help can answer without inventing UI.

## Bottom tabs (actual labels)
These are the bottom nav tabs shown once a route is set up:
- Today
- Routes
- Waypts
- History
- Time
- Timers
- Assist
- Stats
- Settings

## Tab → Screen mapping (App.tsx)
- today → `TodayScreen`
- routes → `RoutesScreen`
- waypoints → `WaypointsScreen`
- history → `WaypointHistoryScreen`
- street-time-history → `StreetTimeHistoryScreen`
- timers → `BreaksScreen`
- assistant → `AssistantScreen`
- stats → `StatsScreen`
- settings → `SettingsScreen`

### Route setup gate
If the user has no routes or no current route selected, the app forces them to `RoutesScreen` (even if they tap other tabs).

---

## What exists (high confidence)

### Routes (RoutesScreen)
- Create route: **"New Route"** button (opens `CreateRouteModal`)
- Edit route: edit icon (opens `EditRouteModal`)
- Delete route: delete icon with a 2-tap confirm behavior
- Set active route: tapping a route card calls `switchToRoute(routeId)`

### Waypts (WaypointsScreen)
Features referenced in code:
- Add waypoint (`AddWaypointModal`)
- Edit waypoint (same modal with an existing waypoint)
- Delete waypoint
- Clear all waypoints
- Templates: save as template / load from template / load templates
- Export waypoints to JSON
- Remove duplicate waypoints
- Quick setup waypoints
- Mark waypoint completed / pending (services: `markWaypointCompleted`, `markWaypointPending`)
- View modes include **today** and a **selected date** (historical)
- Forgot waypoint flow (Spec v1): `showForgotModal` / `forgotWaypoint` / manual time entry
- Debug modal: `WaypointDebugModal`

### History (WaypointHistoryScreen)
- Shows waypoint history (defaults to 90 days)
- Search + date filter
- Expanding days
- Deletes are **only allowed for empty days** (days with 0 completed waypoints). Otherwise it shows an alert.

### Time (StreetTimeHistoryScreen)
- Shows street time history summaries by date
- Expand a date to see operation codes
- Search + date filter
- Delete a day with confirmation
- "Exclude from averages" toggle exists (calls `setExcludeFromAverages`)

### Timers (BreaksScreen)
- Lunch timer
- Break timer (10-min break is count-down type in UI list)
- Load Truck timer with package count + expected time

### Assist (AssistantScreen)
- Two modes: **Union Steward** and **App Help**
- Threads list + New thread

---

## What NOT to assume
- Do not claim a button exists unless it’s named above or the user confirms it.
- If unsure where something is, ask: (1) which bottom tab they’re on, (2) what they see on the screen.

---

## Recommended App Help answer style
When answering App Help questions:
1) Ask 1 clarifying question if needed (which tab/screen?)
2) Give 3–7 steps using the real bottom tab names
3) Provide a fallback section if the UI differs

(If you add/rename tabs or screens, update this file.)
