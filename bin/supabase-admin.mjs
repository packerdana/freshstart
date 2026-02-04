#!/usr/bin/env node
import fs from 'node:fs/promises';

const secretsPath = process.env.SUPABASE_ADMIN_SECRETS || '/home/dana/clawd/secrets/supabase-admin.json';
const raw = await fs.readFile(secretsPath, 'utf8');
const { functionUrl, adminToken, anonKey } = JSON.parse(raw);

const [action, email, arg3, arg4] = process.argv.slice(2);
if (!action || !email) {
  console.error('Usage: supabase-admin.mjs <status|confirm-email|route-history|route-history-delete> <email> [routeNumber] [days|date]');
  process.exit(2);
}

const res = await fetch(functionUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    // Supabase Edge Functions require Authorization
    ...(anonKey ? { authorization: `Bearer ${anonKey}` } : {}),
    'x-admin-token': adminToken,
  },
  body: JSON.stringify({ action, email, routeNumber: arg3, days: arg4 ? Number(arg4) : undefined }),
});

const text = await res.text();
let data;
try { data = JSON.parse(text); } catch { data = { raw: text }; }

if (!res.ok) {
  console.error(JSON.stringify({ ok: false, status: res.status, ...data }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
