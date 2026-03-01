const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tkmvirdyshxlegzmhrse.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbXZpcmR5c2h4bGVnem1ocnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjMyOTM1OCwiZXhwIjoyMDgxOTA1MzU4fQ.k-ugGuSgfM5M7dvJF5xZsBcwIl5oHYgliyNxrGJvGbQ';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: {
    schema: 'public',
  },
});

async function applyMigration() {
  try {
    console.log('Checking if exclusion_reason column exists...');

    // Try to select from the column
    const { data, error: checkErr } = await supabase
      .from('route_history')
      .select('exclusion_reason')
      .limit(1);

    if (!checkErr) {
      console.log('✅ Column exclusion_reason already exists!');
      process.exit(0);
    }

    if (checkErr?.code === 'PGRST103') {
      console.log('❌ Column exclusion_reason does NOT exist.');
      console.log('\nAttempting to add column via RPC function...');
      
      // Try calling a stored procedure if it exists
      const { data: rpcData, error: rpcErr } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE route_history ADD COLUMN IF NOT EXISTS exclusion_reason text DEFAULT NULL;'
      });

      if (!rpcErr) {
        console.log('✅ Migration applied successfully!');
        process.exit(0);
      }

      if (rpcErr?.code === 'PGRST204') {
        console.log('⚠️  No RPC function available to execute SQL.');
        console.log('\n🔧 Manual Fix Required:');
        console.log('1. Go to: https://supabase.com/dashboard/project/tkmvirdyshxlegzmhrse/sql');
        console.log('2. Create a new query');
        console.log('3. Paste this SQL:');
        console.log(`
ALTER TABLE route_history
ADD COLUMN IF NOT EXISTS exclusion_reason text DEFAULT NULL;
        `);
        console.log('4. Click "Run"');
        console.log('5. Then redeploy the app');
        process.exit(1);
      }

      throw rpcErr;
    }

    throw checkErr;
  } catch (err) {
    console.error('❌ Error:', err?.message || err);
    process.exit(1);
  }
}

applyMigration();
