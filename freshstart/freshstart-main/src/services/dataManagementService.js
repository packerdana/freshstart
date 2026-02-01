import { supabase } from '../lib/supabase';

/**
 * Service for managing test data and data cleanup operations
 */

/**
 * Delete all route history data for the current user
 * WARNING: This is destructive and cannot be undone
 */
export async function deleteAllRouteHistory() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User must be authenticated');
  }

  const user = session.user;

  const { data: routes } = await supabase
    .from('routes')
    .select('id')
    .eq('user_id', user.id);

  if (!routes || routes.length === 0) {
    return { deleted: 0 };
  }

  const routeIds = routes.map(r => r.id);

  const { error, count } = await supabase
    .from('route_history')
    .delete()
    .in('route_id', routeIds);

  if (error) {
    console.error('Error deleting route history:', error);
    throw error;
  }

  return { deleted: count || 0 };
}

/**
 * Delete all waypoints for the current user
 * WARNING: This is destructive and cannot be undone
 */
export async function deleteAllWaypoints() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User must be authenticated');
  }

  const user = session.user;

  const { data: routes } = await supabase
    .from('routes')
    .select('id')
    .eq('user_id', user.id);

  if (!routes || routes.length === 0) {
    return { deleted: 0 };
  }

  const routeIds = routes.map(r => r.id);

  const { error, count } = await supabase
    .from('waypoints')
    .delete()
    .in('route_id', routeIds);

  if (error) {
    console.error('Error deleting waypoints:', error);
    throw error;
  }

  return { deleted: count || 0 };
}

/**
 * Delete all PM office sessions for the current user
 * WARNING: This is destructive and cannot be undone
 */
export async function deleteAllPmOfficeSessions() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User must be authenticated');
  }

  const user = session.user;

  const { error, count } = await supabase
    .from('pm_office_sessions')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting PM office sessions:', error);
    throw error;
  }

  return { deleted: count || 0 };
}

/**
 * Delete all test data for the current user
 * This includes: route history, waypoints, and PM office sessions
 * Routes themselves are NOT deleted
 * WARNING: This is destructive and cannot be undone
 */
export async function deleteAllTestData() {
  const results = {
    routeHistory: 0,
    waypoints: 0,
    pmOfficeSessions: 0,
  };

  try {
    const historyResult = await deleteAllRouteHistory();
    results.routeHistory = historyResult.deleted;

    const waypointsResult = await deleteAllWaypoints();
    results.waypoints = waypointsResult.deleted;

    const pmOfficeResult = await deleteAllPmOfficeSessions();
    results.pmOfficeSessions = pmOfficeResult.deleted;

    return results;
  } catch (error) {
    console.error('Error deleting test data:', error);
    throw error;
  }
}

/**
 * Get count of data items for the current user
 * Useful for showing users what will be deleted
 */
export async function getDataCounts() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { routeHistory: 0, waypoints: 0, pmOfficeSessions: 0 };
  }

  const user = session.user;

  const { data: routes } = await supabase
    .from('routes')
    .select('id')
    .eq('user_id', user.id);

  if (!routes || routes.length === 0) {
    return { routeHistory: 0, waypoints: 0, pmOfficeSessions: 0 };
  }

  const routeIds = routes.map(r => r.id);

  const [historyCount, waypointsCount, pmOfficeCount] = await Promise.all([
    supabase
      .from('route_history')
      .select('id', { count: 'exact', head: true })
      .in('route_id', routeIds),
    supabase
      .from('waypoints')
      .select('id', { count: 'exact', head: true })
      .in('route_id', routeIds),
    supabase
      .from('pm_office_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);

  return {
    routeHistory: historyCount.count || 0,
    waypoints: waypointsCount.count || 0,
    pmOfficeSessions: pmOfficeCount.count || 0,
  };
}
