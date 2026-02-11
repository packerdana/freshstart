#!/usr/bin/env node
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readSecret(path) {
  return fs.readFileSync(path, 'utf8').trim();
}

const urlPath = '/home/dana/clawd/secrets/routewise_supabase_url';
const keyPath = '/home/dana/clawd/secrets/routewise_supabase_service_role_key';

if (!fs.existsSync(urlPath) || !fs.existsSync(keyPath)) {
  console.error('Missing secrets. Create files:\n' + urlPath + '\n' + keyPath);
  process.exit(1);
}

const supabaseUrl = readSecret(urlPath);
const serviceKey = readSecret(keyPath);

if (!supabaseUrl || !serviceKey) {
  console.error('Secrets are empty. Paste your SUPABASE_URL and service_role key into the secret files.');
  process.exit(1);
}

const routeNumber = process.argv[2] || '25';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function main() {
  // Get route_id for this route number
  const { data: routes, error: routeErr } = await supabase
    .from('routes')
    .select('id, route_number')
    .eq('route_number', routeNumber)
    .limit(10);

  if (routeErr) throw routeErr;
  const routeId = routes?.[0]?.id;
  if (!routeId) {
    console.log(`No route found for route_number=${routeNumber}`);
    return;
  }

  console.log(`Route ${routeNumber} -> route_id ${routeId}`);

  // A) open segments
  const { data: openSegs, error: openErr } = await supabase
    .from('operation_codes')
    .select('id,date,code,code_name,start_time,end_time,duration_minutes,session_id')
    .eq('route_id', routeId)
    .is('end_time', null)
    .order('start_time', { ascending: false })
    .limit(50);
  if (openErr) throw openErr;

  // B) insane durations
  const { data: insane, error: insaneErr } = await supabase
    .from('operation_codes')
    .select('id,date,code,code_name,start_time,end_time,duration_minutes,session_id')
    .eq('route_id', routeId)
    .not('duration_minutes', 'is', null)
    .or('duration_minutes.lt.0,duration_minutes.gt.900')
    .order('duration_minutes', { ascending: false })
    .limit(50);
  if (insaneErr) throw insaneErr;

  // C) recent route_history totals
  const { data: rh, error: rhErr } = await supabase
    .from('route_history')
    .select('id,date,office_time,street_time,street_time_normalized,pm_office_time,exclude_from_averages,updated_at')
    .eq('route_id', routeId)
    .order('date', { ascending: false })
    .limit(60);
  if (rhErr) throw rhErr;

  console.log('\n=== Open operation segments (end_time NULL) ===');
  console.table(openSegs || []);

  console.log('\n=== Insane durations (<0 or >900 minutes) ===');
  console.table(insane || []);

  console.log('\n=== Recent route_history totals ===');
  console.table(rh || []);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
