import { supabase } from '../lib/supabase';
import { getLocalDateString } from '../utils/time';
import { fetchRestJSON, getAccessTokenFromStorage, withTimeout } from './supabaseRestFallback';

export const getWaypointsForRoute = async (routeId, date = null) => {
  const targetDate = date || getLocalDateString();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('waypoints')
        .select('*')
        .eq('route_id', routeId)
        .eq('date', targetDate)
        .order('sequence_number', { ascending: true }),
      8000,
      'waypoints query'
    );

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn('[getWaypointsForRoute] Falling back to REST:', error?.message || error);
    if (!supabaseUrl || !supabaseAnonKey) throw error;

    const token = getAccessTokenFromStorage();
    const rows = await fetchRestJSON({
      supabaseUrl,
      anonKey: supabaseAnonKey,
      path: '/rest/v1/waypoints',
      token,
      timeoutMs: 12000,
      label: 'REST waypoints fetch',
      query: {
        select: '*',
        route_id: `eq.${routeId}`,
        date: `eq.${targetDate}`,
        order: 'sequence_number.asc',
      },
    });

    return Array.isArray(rows) ? rows : [];
  }
};

export const createWaypoint = async (waypointData) => {
  try {
    const { data, error } = await supabase
      .from('waypoints')
      .insert([waypointData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating waypoint:', error);
    throw error;
  }
};

export const updateWaypoint = async (waypointId, updates) => {
  try {
    const { data, error } = await supabase
      .from('waypoints')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', waypointId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating waypoint:', error);
    throw error;
  }
};

export const deleteWaypoint = async (waypointId) => {
  try {
    const { error } = await supabase
      .from('waypoints')
      .delete()
      .eq('id', waypointId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting waypoint:', error);
    throw error;
  }
};

export const deleteAllWaypoints = async (routeId, date = null) => {
  try {
    const targetDate = date || getLocalDateString();

    const { error } = await supabase
      .from('waypoints')
      .delete()
      .eq('route_id', routeId)
      .eq('date', targetDate);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting all waypoints:', error);
    throw error;
  }
};

export const removeDuplicateWaypoints = async (routeId, date = null) => {
  try {
    const targetDate = date || getLocalDateString();

    const { data: waypoints, error: fetchError } = await supabase
      .from('waypoints')
      .select('*')
      .eq('route_id', routeId)
      .eq('date', targetDate)
      .order('sequence_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    const seen = new Set();
    const duplicates = [];

    waypoints.forEach(wp => {
      if (seen.has(wp.sequence_number)) {
        duplicates.push(wp.id);
      } else {
        seen.add(wp.sequence_number);
      }
    });

    if (duplicates.length > 0) {
      const { error: deleteError } = await supabase
        .from('waypoints')
        .delete()
        .in('id', duplicates);

      if (deleteError) throw deleteError;
    }

    return { removed: duplicates.length, remaining: waypoints.length - duplicates.length };
  } catch (error) {
    console.error('Error removing duplicate waypoints:', error);
    throw error;
  }
};

export const bulkCreateWaypoints = async (waypoints) => {
  try {
    const { data, error } = await supabase
      .from('waypoints')
      .insert(waypoints)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error bulk creating waypoints:', error);
    throw error;
  }
};

/**
 * Quick Setup: create 4 anchor waypoints for today.
 *
 * Creates (if missing):
 * - seq 0: Leave Post Office
 * - seq 1: 1st Stop
 * - seq 98: Last Stop
 * - seq 99: Return to Post Office
 *
 * Safe to run multiple times — it only inserts missing anchors.
 */
export const createQuickSetupWaypoints = async (routeId, date = null, existingWaypoints = null) => {
  try {
    if (!routeId) throw new Error('routeId is required');

    const targetDate = date || getLocalDateString();

    const current = Array.isArray(existingWaypoints)
      ? existingWaypoints
      : await getWaypointsForRoute(routeId, targetDate);

    const hasSeq = new Set((current || []).map(w => w.sequence_number));

    const anchors = [
      { sequence_number: 0, address: 'Leave Post Office' },
      { sequence_number: 1, address: '1st Stop' },
      { sequence_number: 98, address: 'Last Stop' },
      { sequence_number: 99, address: 'Return to Post Office' },
    ];

    const toInsert = anchors
      .filter(a => !hasSeq.has(a.sequence_number))
      .map(a => ({
        route_id: routeId,
        date: targetDate,
        sequence_number: a.sequence_number,
        address: a.address,
        notes: null,
        status: 'pending',
        delivery_time: null,
      }));

    if (toInsert.length === 0) {
      return { created: 0, message: 'Quick setup already exists.' };
    }

    const created = await bulkCreateWaypoints(toInsert);

    return { created: created?.length || 0, message: 'Quick setup created.' };
  } catch (error) {
    console.error('Error creating quick setup waypoints:', error);
    throw error;
  }
};

export const markWaypointCompleted = async (waypointId, deliveryTime = new Date().toISOString()) => {
  try {
    const { data, error } = await supabase
      .from('waypoints')
      .update({
        status: 'completed',
        delivery_time: deliveryTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', waypointId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error marking waypoint completed:', error);
    throw error;
  }
};

export const markWaypointPending = async (waypointId) => {
  try {
    const { data, error } = await supabase
      .from('waypoints')
      .update({
        status: 'pending',
        delivery_time: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', waypointId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error marking waypoint pending:', error);
    throw error;
  }
};

export const exportWaypointsToJSON = async (routeId, date = null) => {
  try {
    const waypoints = await getWaypointsForRoute(routeId, date);

    const exportData = {
      routeId,
      date: date || getLocalDateString(),
      totalWaypoints: waypoints.length,
      completedWaypoints: waypoints.filter(w => w.status === 'completed').length,
      waypoints: waypoints.map(w => ({
        sequence: w.sequence_number,
        address: w.address,
        status: w.status,
        deliveryTime: w.delivery_time,
        notes: w.notes
      }))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `waypoints-${exportData.date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return exportData;
  } catch (error) {
    console.error('Error exporting waypoints:', error);
    throw error;
  }
};
