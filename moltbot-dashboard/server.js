import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';

const execFileAsync = promisify(execFile);

const app = express();
const PORT = process.env.PORT || 8787;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

async function runMoltbot(args) {
  // Keep this allowlisted. Don’t expose arbitrary shell.
  const allow = new Set([
    'status',
    'gateway status',
    'gateway restart',
    'gateway start',
    'gateway stop',
    'doctor --non-interactive',
    'dashboard --no-open',
    'sessions --json',
  ]);

  const key = args.join(' ');
  if (!allow.has(key)) {
    const err = new Error(`Command not allowed: moltbot ${key}`);
    err.status = 400;
    throw err;
  }

  // Use execFile (no shell) for safety.
  // Prefer an explicit path so the dashboard works even when PATH is minimal.
  const moltbotBin = process.env.MOLTBOT_BIN || '/home/dana/.local/bin/moltbot';
  try {
    const { stdout, stderr } = await execFileAsync(moltbotBin, args, {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });

    return {
      ok: true,
      cmd: ['moltbot', ...args].join(' '),
      stdout: stdout?.trim() || '',
      stderr: stderr?.trim() || '',
    };
  } catch (e) {
    return {
      ok: false,
      cmd: ['moltbot', ...args].join(' '),
      error: String(e?.message || e),
      // Common case: command timeout
      code: e?.code,
      signal: e?.signal,
    };
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

async function readRoles() {
  const rolesPath = path.join(process.cwd(), 'roles.json');
  try {
    const raw = await fs.readFile(rolesPath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    if (e?.code === 'ENOENT') return {};
    throw e;
  }
}

async function writeRoles(roles) {
  const rolesPath = path.join(process.cwd(), 'roles.json');
  await fs.writeFile(rolesPath, JSON.stringify(roles || {}, null, 2) + '\n', 'utf8');
}

app.get('/api/roles', async (req, res) => {
  try {
    const roles = await readRoles();
    res.json({ ok: true, roles, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/api/roles', async (req, res) => {
  try {
    const allowed = new Set([
      'role-mobile-release',
      'role-payments',
      'role-legal-compliance',
      'role-marketing-aso',
    ]);

    const update = req.body?.roles;
    if (!update || typeof update !== 'object') {
      return res.status(400).json({ ok: false, error: 'Body must be { roles: { ... } }' });
    }

    const roles = await readRoles();

    for (const [k, v] of Object.entries(update)) {
      if (!allowed.has(k)) {
        return res.status(400).json({ ok: false, error: `Unknown role key: ${k}` });
      }
      if (v == null || v === '') {
        delete roles[k];
      } else if (typeof v === 'string') {
        roles[k] = v;
      } else {
        return res.status(400).json({ ok: false, error: `Role value for ${k} must be a string` });
      }
    }

    await writeRoles(roles);
    res.json({ ok: true, roles, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get('/api/status', async (req, res) => {
  const [status, gateway] = await Promise.all([
    runMoltbot(['status']),
    runMoltbot(['gateway', 'status']),
  ]);

  res.json({
    ok: true,
    status,
    gateway,
    ts: new Date().toISOString(),
  });
});

app.post('/api/gateway/:action', async (req, res) => {
  try {
    const action = req.params.action;
    if (!['start', 'stop', 'restart'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'Invalid action' });
    }
    const result = await runMoltbot(['gateway', action]);
    res.json({ ok: true, result, ts: new Date().toISOString() });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post('/api/doctor', async (req, res) => {
  try {
    const result = await runMoltbot(['doctor', '--non-interactive']);
    res.json({ ok: true, result, ts: new Date().toISOString() });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: String(e.message || e) });
  }
});

async function getTokenizedControlUiUrl() {
  // Moltbot prints a tokenized Control UI URL when running dashboard with --no-open
  const result = await runMoltbot(['dashboard', '--no-open']);
  const m = result.stdout.match(/https?:\/\/[^\s]+/);
  const url = m ? m[0] : null;
  return { url, raw: result.stdout };
}

app.get('/api/control-ui-url', async (req, res) => {
  try {
    // Prefer local token construction for reliability.
    const token = await getGatewayTokenFromConfig();
    if (token) {
      const url = `http://127.0.0.1:18789/?token=${encodeURIComponent(token)}`;
      return res.json({ ok: true, url, ts: new Date().toISOString(), source: 'config' });
    }

    const { url, raw } = await getTokenizedControlUiUrl();
    res.json({ ok: true, url, raw, ts: new Date().toISOString(), source: 'cli' });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: String(e.message || e) });
  }
});

async function getGatewayTokenFromConfig() {
  // Read directly from Moltbot config so the dashboard works even if `moltbot dashboard` is slow.
  // Token source per docs: gateway.auth.token
  const cfgPath = process.env.MOLTBOT_CONFIG_FILE || '/home/dana/.clawdbot/moltbot.json';
  const raw = await fs.readFile(cfgPath, 'utf8');
  const cfg = JSON.parse(raw || '{}');
  const token = cfg?.gateway?.auth?.token;
  return typeof token === 'string' && token.length ? token : null;
}

// Stable URL you can bookmark: always redirects to a tokenized Control UI URL.
// This sets the token via query param (?token=...) so the UI stores it in localStorage.
app.get('/control', async (req, res) => {
  try {
    const token = await getGatewayTokenFromConfig();
    if (token) {
      const url = `http://127.0.0.1:18789/?token=${encodeURIComponent(token)}`;
      return res.redirect(302, url);
    }

    // Fallback: ask the CLI (may fail if the gateway is unhealthy)
    const { url, raw } = await getTokenizedControlUiUrl();
    if (!url) return res.status(500).send('Could not resolve tokenized Control UI URL.\n\n' + raw);
    res.redirect(302, url);
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    // Avoid spawning the moltbot CLI here; listing sessions can be large and slow.
    // Read the sessions file directly for speed.
    const sessionsPath = process.env.MOLTBOT_SESSIONS_FILE || '/home/dana/.clawdbot/agents/main/sessions/sessions.json';
    const raw = await fs.readFile(sessionsPath, 'utf8');
    const parsed = JSON.parse(raw || '{}');

    // sessions.json shape:
    // - map form (current): { "agent:...": { sessionId, updatedAt, ... }, ... }
    // - array form (older): [ { key, ... }, ... ]
    // - wrapper form: { sessions: [ ... ] }
    let sessions;
    if (Array.isArray(parsed)) {
      sessions = parsed;
    } else if (Array.isArray(parsed?.sessions)) {
      sessions = parsed.sessions;
    } else if (parsed && typeof parsed === 'object') {
      sessions = Object.entries(parsed).map(([key, meta]) => ({ key, ...(meta || {}) }));
      // Sort newest first when reading from map form
      sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else {
      sessions = [];
    }

    // Optional limiting to keep the payload small
    const limit = req.query.limit ? Number(req.query.limit) : null;
    const limited = Number.isFinite(limit) && limit > 0 ? sessions.slice(0, limit) : sessions;

    // Keep payload small for the dashboard UI.
    const lite = limited.map((s) => ({
      key: s.key,
      kind: s.kind,
      updatedAt: s.updatedAt,
      sessionId: s.sessionId,
    }));

    res.json({ ok: true, sessions: lite, count: sessions.length, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// Larry OS: nightly UI polish summaries (daily + weekly)
app.get('/api/cron/jobs', async (req, res) => {
  try {
    const cronPath = process.env.MOLTBOT_CRON_FILE || '/home/dana/.clawdbot/cron/jobs.json';
    const raw = await fs.readFile(cronPath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    res.json({ ok: true, jobs, count: jobs.length, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get('/api/routewise/org', async (req, res) => {
  try {
    const orgPath = process.env.ROUTEWISE_ORG_FILE || '/home/dana/clawd/larry-os/routewise-org.json';
    const raw = await fs.readFile(orgPath, 'utf8');
    const data = JSON.parse(raw || '{}');
    res.json({ ok: true, org: data, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.get('/api/larry-os/summary', async (req, res) => {
  try {
    const base = process.env.LARRY_OS_DIR || '/home/dana/clawd/larry-os';
    const logPath = path.join(base, 'nightly-log.md');
    const patchesDir = path.join(base, 'patches');

    const days = req.query.days ? Math.max(1, Math.min(30, Number(req.query.days))) : 7;

    let rawLog = '';
    try {
      rawLog = await fs.readFile(logPath, 'utf8');
    } catch (e) {
      if (e?.code !== 'ENOENT') throw e;
      rawLog = '# Nightly Log\n\n';
    }

    // Parse "## YYYY-MM-DD — title" blocks
    const blocks = [];
    const parts = rawLog.split(/\n(?=##\s)/g);
    for (const part of parts) {
      const m = part.match(/^##\s+(\d{4}-\d{2}-\d{2})\s+—\s+(.+)$/m);
      if (!m) continue;
      const date = m[1];
      const title = m[2].trim();
      const body = part.split(/\n/).slice(1).join('\n').trim();
      blocks.push({ date, title, body });
    }
    blocks.sort((a, b) => (a.date < b.date ? 1 : -1));

    // Patch files list
    let patchFiles = [];
    try {
      const names = await fs.readdir(patchesDir);
      patchFiles = (names || [])
        .filter((n) => n.endsWith('.patch'))
        .sort()
        .reverse()
        .slice(0, 50);
    } catch (e) {
      if (e?.code !== 'ENOENT') throw e;
    }

    const recent = blocks.slice(0, days);
    const weeklyCount = blocks.filter((b) => {
      // naive: last 7 distinct dates
      const d = new Date(b.date + 'T00:00:00Z').getTime();
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return d >= cutoff;
    }).length;

    res.json({
      ok: true,
      recent,
      weeklyCount,
      patchFiles,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`Moltbot Dashboard running on http://localhost:${PORT}`);
});
