# Nightly UI Polish Checklist

1) Pull latest repo state
- `cd ~/clawd/packerdana-freshstart && git fetch && git pull`

2) Pick ONE UI polish task
- Prefer: spacing, typography, button consistency, contrast, tap targets, loading states
- Avoid: big refactors, data model changes

3) Implement on a new branch
- `git checkout -b ui-polish/YYYY-MM-DD-<slug>`

4) Verify
- `npm run build`

5) Record
- Write a short entry to `larry-os/nightly-log.md`
- Save a patch: `git diff main > larry-os/patches/YYYY-MM-DD-<slug>.patch`

6) Stop
- Do not deploy automatically.
- Optionally push branch + open PR only if Dana explicitly asks.
