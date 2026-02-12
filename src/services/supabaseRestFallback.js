// Shared helpers for when supabase-js hangs in certain browsers.

export function getAccessTokenFromStorage() {
  try {
    // First check Supabase default storage keys, in case config changes.
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
          if (token) return token;
        }
      }
    } catch {
      // ignore
    }

    // Our configured key (see src/lib/supabase.js storageKey)
    const raw = localStorage.getItem('routewise-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (
      parsed?.access_token ||
      parsed?.currentSession?.access_token ||
      parsed?.session?.access_token ||
      null
    );
  } catch {
    return null;
  }
}

export function withTimeout(p, ms, label = 'Operation') {
  return Promise.race([
    p,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

export async function fetchRestJSON({
  supabaseUrl,
  anonKey,
  path,
  query = {},
  token = null,
  timeoutMs = 12000,
  label = 'REST request',
}) {
  return restWrite({
    supabaseUrl,
    anonKey,
    token,
    path,
    method: 'GET',
    query,
    timeoutMs,
    label,
  });
}

export async function restWrite({
  supabaseUrl,
  anonKey,
  path,
  method = 'GET',
  query = {},
  body = null,
  token = null,
  timeoutMs = 12000,
  label = 'REST request',
  prefer = 'return=representation',
}) {
  const url = new URL(path, supabaseUrl);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === null || v === undefined || v === '') continue;
    url.searchParams.set(k, String(v));
  }

  const headers = {
    apikey: anonKey,
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const hasBody = body !== null && body !== undefined && method !== 'GET' && method !== 'HEAD';
  if (hasBody) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${label} failed (${res.status}): ${text}`);
    // @ts-ignore
    err.status = res.status;
    throw err;
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function restUpsert({
  supabaseUrl,
  anonKey,
  path,
  body,
  onConflict,
  token = null,
  timeoutMs = 12000,
  label = 'REST upsert',
}) {
  // PostgREST upsert pattern
  const query = {};
  if (onConflict) query.on_conflict = onConflict;

  return restWrite({
    supabaseUrl,
    anonKey,
    token,
    path,
    method: 'POST',
    query,
    body,
    timeoutMs,
    label,
    prefer: 'resolution=merge-duplicates,return=representation',
  });
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    // base64url -> base64
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function safeGetSession(supabase, timeoutMs = 5000) {
  try {
    const res = await withTimeout(supabase.auth.getSession(), timeoutMs, 'getSession');
    const session = res?.data?.session || null;
    const user = session?.user || null;
    return { session, user, source: 'supabase-js' };
  } catch {
    const token = getAccessTokenFromStorage();
    if (!token) return { session: null, user: null, source: 'storage' };

    const payload = decodeJwtPayload(token);
    const userId = payload?.sub || null;

    return {
      session: { access_token: token },
      user: userId ? { id: userId } : null,
      source: 'storage',
    };
  }
}
