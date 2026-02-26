import { supabase } from '../lib/supabase';

/**
 * Persist critical "Today" volumes early so mobile refresh/storage-eviction can't wipe them.
 * This writes into route_history (durable storage) keyed by (route_id, date).
 *
 * NOTE: DB column is spurs; app calls it sprs.
 */
export async function upsertTodayVolumes({
  routeId,
  date,
  dps,
  flats,
  letters,
  parcels,
  sprs,
  safetyTalk,
  hasBoxholder,
  casedBoxholder,
  casedBoxholderType,
  curtailedLetters,
  curtailedFlats,
  dailyLog,
}) {
  if (!routeId) throw new Error('Missing routeId');
  if (!date) throw new Error('Missing date');

  const payload = {
    route_id: routeId,
    date,
    dps: Math.round(Number(dps || 0)) || 0,
    flats: Number(flats || 0) || 0,
    letters: Number(letters || 0) || 0,
    parcels: Math.round(Number(parcels || 0)) || 0,
    spurs: Math.round(Number(sprs || 0)) || 0,
    safety_talk: Math.round(Number(safetyTalk || 0)) || 0,
    has_boxholder: !!hasBoxholder,
    cased_boxholder: !!casedBoxholder,
    cased_boxholder_type: casedBoxholderType || null,
    curtailed_letters: Number(curtailedLetters || 0) || 0,
    curtailed_flats: Number(curtailedFlats || 0) || 0,
    // daily_log exists on newer DBs; if missing we will retry without it.
    daily_log: dailyLog ?? null,
    updated_at: new Date().toISOString(),
  };

  const doUpsert = async (p, skipCols = []) => {
    // Build select list dynamically to avoid columns that don't exist
    let selectCols = ['id', 'route_id', 'date', 'dps', 'flats', 'letters', 'parcels', 'spurs', 'safety_talk', 'has_boxholder', 'cased_boxholder', 'cased_boxholder_type', 'curtailed_letters', 'curtailed_flats', 'daily_log', 'updated_at'];
    selectCols = selectCols.filter(col => !skipCols.includes(col));
    
    return supabase
      .from('route_history')
      .upsert(p, { onConflict: 'route_id,date' })
      .select(selectCols.join(', '))
      .maybeSingle();
  };

  let res = await doUpsert(payload);

  if (res.error) {
    const msg = String(res.error.message || res.error);
    const missingDailyLog = msg.includes('daily_log') && msg.includes('does not exist');
    const missingHasBoxholder = msg.includes('has_boxholder') && msg.includes('does not exist');
    const missingCurtailedLetters = msg.includes('curtailed_letters') && msg.includes('does not exist');
    const missingCurtailedFlats = msg.includes('curtailed_flats') && msg.includes('does not exist');
    const missingCasedBoxholder = msg.includes('cased_boxholder') && msg.includes('does not exist');
    const missingCasedBoxholderType = msg.includes('cased_boxholder_type') && msg.includes('does not exist');

    if (missingDailyLog || missingHasBoxholder || missingCurtailedLetters || missingCurtailedFlats || missingCasedBoxholder || missingCasedBoxholderType) {
      const fallback = { ...payload };
      const skipCols = [];
      if (missingDailyLog) { delete fallback.daily_log; skipCols.push('daily_log'); }
      if (missingHasBoxholder) { delete fallback.has_boxholder; skipCols.push('has_boxholder'); }
      if (missingCurtailedLetters) { delete fallback.curtailed_letters; skipCols.push('curtailed_letters'); }
      if (missingCurtailedFlats) { delete fallback.curtailed_flats; skipCols.push('curtailed_flats'); }
      if (missingCasedBoxholder) { delete fallback.cased_boxholder; skipCols.push('cased_boxholder'); }
      if (missingCasedBoxholderType) { delete fallback.cased_boxholder_type; skipCols.push('cased_boxholder_type'); }
      res = await doUpsert(fallback, skipCols);
    }
  }

  if (res.error) throw res.error;
  return res.data;
}
