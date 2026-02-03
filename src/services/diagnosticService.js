import { supabase } from '../lib/supabase';
import { getLocalDateString } from '../utils/time';

export async function runDiagnostics() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    overallStatus: 'unknown',
    criticalIssues: [],
    warnings: [],
    recommendations: []
  };

  console.log('🔍 Starting RouteWise Diagnostics...\n');

  try {
    results.tests.push(await testSupabaseConnection());
  } catch (error) {
    results.tests.push({
      name: 'Supabase Connection',
      status: 'fail',
      error: error.message
    });
  }

  try {
    results.tests.push(await testAuthentication());
  } catch (error) {
    results.tests.push({
      name: 'Authentication',
      status: 'fail',
      error: error.message
    });
  }

  try {
    results.tests.push(await testUserRoutes());
  } catch (error) {
    results.tests.push({
      name: 'User Routes',
      status: 'fail',
      error: error.message
    });
  }

  try {
    results.tests.push(await testWaypointsAccess());
  } catch (error) {
    results.tests.push({
      name: 'Waypoints Access',
      status: 'fail',
      error: error.message
    });
  }

  try {
    results.tests.push(await testRLSPolicies());
  } catch (error) {
    results.tests.push({
      name: 'RLS Policies',
      status: 'fail',
      error: error.message
    });
  }

  const failedTests = results.tests.filter(t => t.status === 'fail');
  const passedTests = results.tests.filter(t => t.status === 'pass');
  const warningTests = results.tests.filter(t => t.status === 'warning');

  results.overallStatus = failedTests.length === 0 ?
    (warningTests.length > 0 ? 'warning' : 'pass') :
    'fail';

  results.criticalIssues = failedTests.map(t => ({
    test: t.name,
    issue: t.error || t.details,
    recommendation: t.recommendation
  }));

  results.warnings = warningTests.map(t => ({
    test: t.name,
    warning: t.details,
    recommendation: t.recommendation
  }));

  console.log('\n📊 DIAGNOSTIC SUMMARY:');
  console.log(`✅ Passed: ${passedTests.length}`);
  console.log(`⚠️  Warnings: ${warningTests.length}`);
  console.log(`❌ Failed: ${failedTests.length}`);
  console.log(`Overall Status: ${results.overallStatus.toUpperCase()}\n`);

  if (results.criticalIssues.length > 0) {
    console.log('🚨 CRITICAL ISSUES:');
    results.criticalIssues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.test}: ${issue.issue}`);
      if (issue.recommendation) {
        console.log(`   → ${issue.recommendation}`);
      }
    });
  }

  return results;
}

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      name: 'Supabase Connection',
      status: 'fail',
      error: 'Missing environment variables',
      details: `VITE_SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}, VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'MISSING'}`,
      recommendation: 'Check .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set'
    };
  }

  try {
    const { data, error } = await supabase.from('routes').select('count').limit(1);

    if (error) {
      return {
        name: 'Supabase Connection',
        status: 'fail',
        error: error.message,
        details: `Error code: ${error.code}`,
        recommendation: 'Verify Supabase URL and API key are correct'
      };
    }

    console.log('✅ Supabase connection successful');
    return {
      name: 'Supabase Connection',
      status: 'pass',
      details: `Connected to: ${supabaseUrl}`
    };
  } catch (error) {
    return {
      name: 'Supabase Connection',
      status: 'fail',
      error: error.message,
      recommendation: 'Check network connection and Supabase service status'
    };
  }
}

async function testAuthentication() {
  console.log('Testing authentication...');

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      return {
        name: 'Authentication',
        status: 'fail',
        error: error.message,
        recommendation: 'Try logging out and logging back in'
      };
    }

    if (!session) {
      return {
        name: 'Authentication',
        status: 'fail',
        error: 'No active session',
        details: 'User is not authenticated',
        recommendation: 'Log in to access your routes and waypoints'
      };
    }

    const user = session.user;
    console.log(`✅ Authenticated as: ${user.email} (ID: ${user.id})`);

    return {
      name: 'Authentication',
      status: 'pass',
      details: `Logged in as: ${user.email}`,
      userId: user.id
    };
  } catch (error) {
    return {
      name: 'Authentication',
      status: 'fail',
      error: error.message,
      recommendation: 'Clear browser cache and try logging in again'
    };
  }
}

async function testUserRoutes() {
  console.log('Testing user routes access...');

  try {
    const { data: routes, error } = await supabase
      .from('routes')
      .select('id, route_number, created_at');

    if (error) {
      return {
        name: 'User Routes',
        status: 'fail',
        error: error.message,
        details: `Database error: ${error.code}`,
        recommendation: 'Check RLS policies on routes table'
      };
    }

    if (!routes || routes.length === 0) {
      return {
        name: 'User Routes',
        status: 'warning',
        details: 'No routes found for this user',
        recommendation: 'Create a route in Settings to start tracking waypoints'
      };
    }

    console.log(`✅ Found ${routes.length} route(s):`, routes.map(r => `Route ${r.route_number} (${r.id})`).join(', '));

    return {
      name: 'User Routes',
      status: 'pass',
      details: `Found ${routes.length} route(s)`,
      routes: routes
    };
  } catch (error) {
    return {
      name: 'User Routes',
      status: 'fail',
      error: error.message,
      recommendation: 'Check database permissions and RLS policies'
    };
  }
}

async function testWaypointsAccess() {
  console.log('Testing waypoints access...');

  try {
    const today = getLocalDateString();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        name: 'Waypoints Access',
        status: 'fail',
        error: 'Not authenticated',
        recommendation: 'Log in first'
      };
    }

    const { data: routes, error: routesError } = await supabase
      .from('routes')
      .select('id, route_number');

    if (routesError) {
      return {
        name: 'Waypoints Access',
        status: 'fail',
        error: routesError.message,
        recommendation: 'Cannot access routes to check waypoints'
      };
    }

    if (!routes || routes.length === 0) {
      return {
        name: 'Waypoints Access',
        status: 'warning',
        details: 'No routes available to query waypoints',
        recommendation: 'Create a route first'
      };
    }

    const routeId = routes[0].id;
    console.log(`Checking waypoints for route ${routes[0].route_number} (${routeId}) on ${today}...`);

    const { data: waypoints, error: waypointsError } = await supabase
      .from('waypoints')
      .select('id, address, status, date')
      .eq('route_id', routeId)
      .eq('date', today);

    if (waypointsError) {
      return {
        name: 'Waypoints Access',
        status: 'fail',
        error: waypointsError.message,
        details: `Error accessing waypoints: ${waypointsError.code}`,
        recommendation: 'Check RLS policies on waypoints table'
      };
    }

    if (!waypoints || waypoints.length === 0) {
      console.log(`⚠️  No waypoints found for today (${today})`);

      const { data: allWaypoints } = await supabase
        .from('waypoints')
        .select('date, route_id')
        .eq('route_id', routeId)
        .order('date', { ascending: false })
        .limit(1);

      if (allWaypoints && allWaypoints.length > 0) {
        return {
          name: 'Waypoints Access',
          status: 'warning',
          details: `No waypoints for today, but found waypoints for ${allWaypoints[0].date}`,
          recommendation: 'Copy waypoints from previous day or create new ones'
        };
      }

      return {
        name: 'Waypoints Access',
        status: 'warning',
        details: 'No waypoints found for any date',
        recommendation: 'Add waypoints on the Waypoints screen'
      };
    }

    console.log(`✅ Found ${waypoints.length} waypoint(s) for today`);

    return {
      name: 'Waypoints Access',
      status: 'pass',
      details: `Found ${waypoints.length} waypoint(s) for ${today}`,
      waypoints: waypoints
    };
  } catch (error) {
    return {
      name: 'Waypoints Access',
      status: 'fail',
      error: error.message,
      recommendation: 'Check database connection and permissions'
    };
  }
}

async function testRLSPolicies() {
  console.log('Testing RLS policies...');

  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return {
        name: 'RLS Policies',
        status: 'fail',
        error: 'Cannot test RLS without authentication',
        recommendation: 'Log in first'
      };
    }

    const tests = [];

    try {
      const { data, error } = await supabase
        .from('routes')
        .select('id')
        .limit(1);
      tests.push({ table: 'routes', operation: 'SELECT', success: !error });
    } catch (e) {
      tests.push({ table: 'routes', operation: 'SELECT', success: false, error: e.message });
    }

    try {
      const { data, error } = await supabase
        .from('waypoints')
        .select('id')
        .limit(1);
      tests.push({ table: 'waypoints', operation: 'SELECT', success: !error });
    } catch (e) {
      tests.push({ table: 'waypoints', operation: 'SELECT', success: false, error: e.message });
    }

    try {
      const { data, error } = await supabase
        .from('route_history')
        .select('id')
        .limit(1);
      tests.push({ table: 'route_history', operation: 'SELECT', success: !error });
    } catch (e) {
      tests.push({ table: 'route_history', operation: 'SELECT', success: false, error: e.message });
    }

    const failedPolicies = tests.filter(t => !t.success);

    if (failedPolicies.length > 0) {
      console.log(`⚠️  RLS policy issues found:`, failedPolicies);
      return {
        name: 'RLS Policies',
        status: 'warning',
        details: `${failedPolicies.length} table(s) have RLS issues`,
        failedPolicies: failedPolicies,
        recommendation: 'Some tables may not be accessible. Contact support if issues persist.'
      };
    }

    console.log('✅ All RLS policies working correctly');

    return {
      name: 'RLS Policies',
      status: 'pass',
      details: 'All RLS policies passed'
    };
  } catch (error) {
    return {
      name: 'RLS Policies',
      status: 'fail',
      error: error.message,
      recommendation: 'Database configuration may need review'
    };
  }
}

export async function testWaypointQuery(routeId, date) {
  console.log(`\n🔍 Testing specific waypoint query for route ${routeId} on ${date}...`);

  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.log('❌ Not authenticated');
      return { success: false, error: 'Not authenticated' };
    }

    console.log(`User: ${session.user.email} (${session.user.id})`);

    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('id, route_number, user_id')
      .eq('id', routeId)
      .maybeSingle();

    if (routeError) {
      console.log(`❌ Route query error: ${routeError.message}`);
      return { success: false, error: routeError.message };
    }

    if (!route) {
      console.log(`❌ Route ${routeId} not found or not accessible`);
      return { success: false, error: 'Route not found or access denied' };
    }

    console.log(`✅ Route found: Route ${route.route_number}`);
    console.log(`   Owner: ${route.user_id}`);
    console.log(`   Match: ${route.user_id === session.user.id ? 'YES' : 'NO'}`);

    const { data: waypoints, error: waypointsError } = await supabase
      .from('waypoints')
      .select('*')
      .eq('route_id', routeId)
      .eq('date', date)
      .order('sequence_number', { ascending: true });

    if (waypointsError) {
      console.log(`❌ Waypoints query error: ${waypointsError.message}`);
      return { success: false, error: waypointsError.message, route: route };
    }

    console.log(`✅ Query successful: Found ${waypoints?.length || 0} waypoints`);

    return {
      success: true,
      route: route,
      waypoints: waypoints || [],
      count: waypoints?.length || 0
    };
  } catch (error) {
    console.log(`❌ Unexpected error: ${error.message}`);
    return { success: false, error: error.message };
  }
}
