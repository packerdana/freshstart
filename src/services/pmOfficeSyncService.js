import { supabase } from '../lib/supabase';
import { getAccessTokenFromStorage, restUpsert, withTimeout } from './supabaseRestFallback';

/**
 * Persist 744 PM Office time to route_history immediately (so refreshes can't lose it).
 * Also write a 744 row into operation_codes so the Stats -> Day History can display it.
 */
export async function syncPmOfficeToHistory({
  routeId,
  date,
  minutes,
  startedAt,
  endedAt,
}) {
  if (!routeId) throw new Error('Missing routeId');
  if (!date) throw new Error('Missing date');
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // 1) Upsert route_history.pm_office_time
  // (creates a minimal row if End Tour hasn't run yet)
  let rhRes;
  try {
    rhRes = await withTimeout(
      supabase
        .from('route_history')
        .upsert(
          {
            route_id: routeId,
            date,
            pm_office_time: safeMinutes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'route_id,date' }
        )
        .select('id')
        .maybeSingle(),
      10000,
      'syncPmOfficeToHistory route_history upsert'
    );
  } catch (e) {
    console.warn('[syncPmOfficeToHistory] Falling back to REST route_history upsert:', e?.message || e);
    if (!supabaseUrl || !supabaseAnonKey) throw e;
    const token = getAccessTokenFromStorage();
    const rows = await restUpsert({
      supabaseUrl,
      anonKey: supabaseAnonKey,
      token,
      path: '/rest/v1/route_history',
      onConflict: 'route_id,date',
      body: [
        {
          route_id: routeId,
          date,
          pm_office_time: safeMinutes,
          updated_at: new Date().toISOString(),
        },
      ],
      timeoutMs: 12000,
      label: 'REST syncPmOfficeToHistory route_history',
    });
    rhRes = { data: Array.isArray(rows) ? rows[0] : rows, error: null };
  }

  if (rhRes?.error) {
    throw rhRes.error;
  }

  // 2) Upsert operation_codes 744 row for day history display.
  // We use a deterministic session_id so repeated syncs update the same row.
  const sessionId = `rw_744_${routeId}_${date}`;
  // History screens currently only query rows with non-null end_time.
  // If we are backfilling from a "fixed" value (no real timestamps), synthesize
  // a reasonable start/end so the row appears in History -> Daily Timeline.
  let startIso = startedAt || null;
  if (!startIso) {
    try {
      startIso = new Date(`${date}T00:00:00`).toISOString();
    } catch {
      startIso = new Date().toISOString();
    }
  }

  let endIso = endedAt || null;
  if (!endIso) {
    try {
      const base = new Date(startIso).getTime();
      const delta = Math.max(1, safeMinutes) * 60 * 1000;
      endIso = new Date(base + delta).toISOString();
    } catch {
      endIso = new Date().toISOString();
    }
  }

  const opPayload = {
    session_id: sessionId,
    date,
    code: '744',
    code_name: 'PM Office',
    start_time: startIso,
    end_time: endIso,
    duration_minutes: safeMinutes,
    route_id: routeId,
    updated_at: new Date().toISOString(),
  };

  // If timestamps are missing, still save duration.
  // Some DBs may require start_time; keep null-friendly and tolerate schema variance.
  let opRes;
  try {
    opRes = await withTimeout(
      supabase.from('operation_codes').upsert(opPayload, { onConflict: 'session_id' }).select('id').maybeSingle(),
      10000,
      'syncPmOfficeToHistory operation_codes upsert'
    );

    // If upsert returned an error (some clients return {error} instead of throwing), handle below.
    if (opRes?.error) throw opRes.error;
  } catch (e) {
    const msg = String(e?.message || e || '');
    console.warn('[syncPmOfficeToHistory] operation_codes upsert failed (falling back to REST):', msg);
    
    // Try REST API as fallback
    if (supabaseUrl && supabaseAnonKey) {
      const token = getAccessTokenFromStorage();
      try {
        const rows = await restUpsert({
          supabaseUrl,
          anonKey: supabaseAnonKey,
          token,
          path: '/rest/v1/operation_codes',
          onConflict: 'session_id',
          body: [opPayload],
          timeoutMs: 12000,
          label: 'REST syncPmOfficeToHistory operation_codes',
        });
        opRes = { data: Array.isArray(rows) ? rows[0] : rows, error: null };
      } catch (e2) {
        opRes = { data: null, error: e2 };
      }
    } else {
      opRes = { data: null, error: e };
    }
  }

  if (opRes?.error) {
    // Non-fatal: route_history is the bigger win for totals; log and continue.
    console.warn('[syncPmOfficeToHistory] operation_codes write failed:', opRes.error?.message || opRes.error);
  }

  return {
    routeHistoryId: rhRes?.data?.id || null,
    operationCodeId: opRes?.data?.id || null,
  };
}
