# Larry OS (RouteWise + Moltbot)

A small, repeatable system to improve RouteWise (starting with UI polish) without surprises.

## Nightly automation (12:00 AM CST)
Goal: produce *one* safe UI polish improvement per night.

Rules:
- No secrets in git.
- Small change only.
- Must pass `npm run build`.
- Do NOT deploy to production automatically.
- Output: summary + patch/diff + suggested next step.

## What gets tracked
- `larry-os/nightly-log.md` — nightly notes
- `larry-os/ui-polish-backlog.md` — small UI tasks to pick from
- `larry-os/checklist.md` — the routine
