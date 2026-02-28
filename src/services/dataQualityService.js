import { supabase } from '../lib/supabase';

/**
 * Mark a day as excluded/included for averages.
 * Uses route_history as the durable storage.
 *
 * If the route_history row doesn't exist for that date, we create a minimal row.
 *
 * @param {string} routeId - Route UUID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {boolean} exclude - Whether to exclude (true) or include (false)
 * @param {string} [reason] - Reason for exclusion (e.g., "maintenance", "sick", etc.)
 */
export async function setExcludeFromAverages({ routeId, date, exclude, reason = null }) {
  if (!supabase) throw new Error('Supabase not configured');
  if (!routeId) throw new Error('Missing routeId');
  if (!date) throw new Error('Missing date');

  // If excluding, ensure a reason is provided
  const finalReason = exclude ? reason : null;

  // Try update first.
  const { data: updated, error: updErr } = await supabase
    .from('route_history')
    .update({
      exclude_from_averages: !!exclude,
      exclusion_reason: finalReason,
      updated_at: new Date().toISOString(),
    })
    .eq('route_id', routeId)
    .eq('date', date)
    .select('id, route_id, date, exclude_from_averages, exclusion_reason')
    .maybeSingle();

  if (!updErr && updated) return updated;

  // If row doesn't exist, create minimal record.
  // (Route history schema has defaults for most columns.)
  const { data: inserted, error: insErr } = await supabase
    .from('route_history')
    .insert({
      route_id: routeId,
      date,
      exclude_from_averages: !!exclude,
      exclusion_reason: finalReason,
    })
    .select('id, route_id, date, exclude_from_averages, exclusion_reason')
    .maybeSingle();

  if (insErr) {
    // If schema not migrated yet, give a clearer message.
    const msg = String(insErr.message || insErr);
    if (msg.includes('exclude_from_averages')) {
      throw new Error('App update needed: database missing exclude_from_averages column');
    }
    if (msg.includes('exclusion_reason')) {
      throw new Error('App update needed: database missing exclusion_reason column. Please redeploy.');
    }
    throw insErr;
  }

  return inserted;
}
