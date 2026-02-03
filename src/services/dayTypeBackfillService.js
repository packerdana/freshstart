import { supabase } from '../lib/supabase';
import { getDayType } from '../utils/holidays';
import { toLocalDateKey } from '../utils/dateKey';

function ymd(dateLike) {
  // route_history.date comes back as YYYY-MM-DD string
  if (typeof dateLike === 'string') return dateLike;
  return toLocalDateKey(dateLike);
}

/**
 * Backfill route_history.day_type using our deterministic getDayType(date).
 *
 * Safe:
 * - only updates rows where the computed type differs from stored day_type
 * - uses RLS-protected updates (only affects the signed-in user's routes)
 */
export async function backfillDayTypesForRoute(routeId, daysBack = 365) {
  if (!routeId) return { updated: 0 };

  // One-time per route per device (avoids doing work every load)
  const key = `rw_daytype_backfill_v1:${routeId}`;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(key) === 'done') {
      return { updated: 0, skipped: true };
    }
  } catch {
    // ignore localStorage failures
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = ymd(cutoff);

  const { data: rows, error } = await supabase
    .from('route_history')
    .select('date, day_type')
    .eq('route_id', routeId)
    .gte('date', cutoffStr)
    .order('date', { ascending: false });

  if (error) throw error;
  if (!rows || rows.length === 0) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, 'done');
    } catch {}
    return { updated: 0 };
  }

  const updates = [];
  for (const r of rows) {
    const dateStr = ymd(r.date);
    const computed = getDayType(dateStr);
    const stored = r.day_type || 'normal';
    if (computed !== stored) {
      updates.push({ date: dateStr, day_type: computed, from: stored });
    }
  }

  if (updates.length === 0) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, 'done');
    } catch {}
    return { updated: 0 };
  }

  // Apply updates sequentially to stay friendly to Supabase + mobile networks.
  let updated = 0;
  for (const u of updates) {
    const { error: upErr } = await supabase
      .from('route_history')
      .update({ day_type: u.day_type })
      .eq('route_id', routeId)
      .eq('date', u.date);

    if (upErr) throw upErr;
    updated += 1;
  }

  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, 'done');
  } catch {}

  return { updated };
}
