import { supabase } from '../lib/supabase';

/**
 * Mark a day as excluded/included for averages.
 * Uses route_history as the durable storage.
 *
 * If the route_history row doesn't exist for that date, we create a minimal row.
 */
export async function setExcludeFromAverages({ routeId, date, exclude }) {
  if (!supabase) throw new Error('Supabase not configured');
  if (!routeId) throw new Error('Missing routeId');
  if (!date) throw new Error('Missing date');

  // Try update first.
  const { data: updated, error: updErr } = await supabase
    .from('route_history')
    .update({
      exclude_from_averages: !!exclude,
      updated_at: new Date().toISOString(),
    })
    .eq('route_id', routeId)
    .eq('date', date)
    .select('id, route_id, date, exclude_from_averages')
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
    })
    .select('id, route_id, date, exclude_from_averages')
    .maybeSingle();

  if (insErr) {
    // If schema not migrated yet, give a clearer message.
    const msg = String(insErr.message || insErr);
    if (msg.includes('exclude_from_averages')) {
      throw new Error('App update needed: database missing exclude_from_averages column');
    }
    throw insErr;
  }

  return inserted;
}
