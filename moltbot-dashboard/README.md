# Moltbot Dashboard (local)

Lightweight web dashboard that runs on your laptop and calls the `moltbot` CLI (no shell).

## Run

```bash
cd /home/dana/clawd/moltbot-dashboard
npm install
npm start
```

Then open:
- http://localhost:8787

## What it shows
- `moltbot status`
- `moltbot gateway status`
- Button to restart the gateway.

## Notes
- This is designed for **manual** Moltbot installs (not systemd).
- If your `moltbot` binary isn’t on PATH, tell me where it is and I’ll adjust.
