// Shared helpers for when supabase-js hangs in certain browsers.

export function getAccessTokenFromStorage() {
  try {
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

  // Actually abort fetch on timeout (mobile browsers have low concurrent connection limits).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      headers,
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

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
