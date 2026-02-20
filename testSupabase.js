import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('bug_reports').select('*').limit(1);
  if (error) {
    console.error('Supabase error:', error);
  } else {
    console.log('Supabase test query result:', data);
  }
}

test();
