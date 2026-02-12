import { supabase } from '../lib/supabase';

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

  // 1) Upsert route_history.pm_office_time
  // (creates a minimal row if End Tour hasn't run yet)
  const rhRes = await supabase
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
    .maybeSingle();

  if (rhRes.error) {
    throw rhRes.error;
  }

  // 2) Upsert operation_codes 744 row for day history display.
  // We use a deterministic session_id so repeated syncs update the same row.
  const sessionId = `rw_744_${routeId}_${date}`;
  const opPayload = {
    session_id: sessionId,
    date,
    code: '744',
    code_name: 'PM Office',
    start_time: startedAt || null,
    end_time: endedAt || null,
    duration_minutes: safeMinutes,
    route_id: routeId,
    updated_at: new Date().toISOString(),
  };

  // If timestamps are missing, still save duration.
  // Some DBs may require start_time; keep null-friendly and tolerate schema variance.
  const opRes = await supabase
    .from('operation_codes')
    .upsert(opPayload, { onConflict: 'session_id' })
    .select('id')
    .maybeSingle();

  if (opRes.error) {
    // Non-fatal: route_history is the bigger win for totals; log and continue.
    console.warn('[syncPmOfficeToHistory] operation_codes upsert failed:', opRes.error?.message || opRes.error);
  }

  return { routeHistoryId: rhRes.data?.id || null, operationCodeId: opRes.data?.id || null };
}
