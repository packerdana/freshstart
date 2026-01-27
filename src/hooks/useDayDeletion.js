import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook for deleting waypoint and street time days
 */
export function useDayDeletion() {
  const [deletingDate, setDeletingDate] = useState(null);
  const [swipedDate, setSwipedDate] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchCurrent, setTouchCurrent] = useState(null);

  /**
   * Get session ID for a specific date and route
   * CRITICAL: Must get session for the SPECIFIC DATE being deleted
   * @param {string} currentRouteId - Current route UUID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {string|null} Session ID or null
   */
  const getSessionId = async (currentRouteId, date) => {
    try {
      if (!currentRouteId || !date) {
        console.error('[DELETE] Missing route ID or date');
        return null;
      }

      // Get session_id from operation code for THIS SPECIFIC DATE
      const { data, error } = await supabase
        .from('operation_codes')
        .select('session_id')
        .eq('route_id', currentRouteId)
        .eq('date', date)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('[DELETE] Failed to get session:', error);
        return null;
      }

      if (!data) {
        console.error('[DELETE] No operation codes found for date:', date);
        return null;
      }

      if (data?.session_id) {
        console.log('[DELETE] Found session ID for date', date, ':', data.session_id);
        return data.session_id;
      }

      return null;
    } catch (e) {
      console.error('[DELETE] Error getting session ID:', e);
      return null;
    }
  };

  /**
   * Check if a waypoint day is empty (no completed waypoints)
   */
  const isWaypointDayEmpty = (daySummary) => {
    return daySummary.completed === 0;
  };

  /**
   * Delete a waypoint day (empty days only)
   */
  const deleteWaypointDay = async (routeId, date, daySummary) => {
    if (!isWaypointDayEmpty(daySummary)) {
      throw new Error(
        `Cannot delete day with ${daySummary.completed} completed waypoints. ` +
        `Only empty days (0 completed waypoints) can be deleted.`
      );
    }

    setDeletingDate(date);

    try {
      const sessionId = await getSessionId(routeId, date);
      if (!sessionId) {
        throw new Error('Unable to find session ID for this date');
      }

      console.log('[DELETE] Deleting waypoint day:', date);

      const { data, error } = await supabase.rpc('delete_waypoint_day', {
        p_route_id: routeId,
        p_date: date,
        p_session_id: sessionId
      });

      if (error) throw error;

      return {
        success: true,
        message: data?.message || 'Waypoint day deleted successfully',
        waypointsDeleted: data?.waypoints_deleted || 0,
        date: date
      };
    } catch (error) {
      console.error('Error deleting waypoint day:', error);
      throw error;
    } finally {
      setDeletingDate(null);
      setSwipedDate(null);
    }
  };

  /**
   * Delete a street time day
   */
  const deleteStreetTimeDay = async (date, routeId) => {
  setDeletingDate(date);

  try {
    console.log('[DELETE] Deleting:', date, routeId);

    const { data, error } = await supabase.rpc('delete_day_by_route', {
      p_date: date,
      p_route_id: routeId
    });

    if (error) throw error;

    return {
      success: true,
      message: 'Day deleted',
      operationCodesDeleted: data.operation_codes_deleted,
      date: date
    };
  } catch (error) {
    console.error('[DELETE] Error:', error);
    throw error;
  } finally {
    setDeletingDate(null);
  }
};

      if (error) throw error;

      console.log('[DELETE] Delete successful:', data);

      return {
        success: true,
        message: data?.message || 'Street time day deleted successfully',
        operationCodesDeleted: data?.operation_codes_deleted || 0,
        dayStateMoved: data?.day_state_moved || false,
        recoverableUntil: data?.recoverable_until || null,
        date: date
      };
    } catch (error) {
      console.error('Error deleting street time day:', error);
      throw error;
    } finally {
      setDeletingDate(null);
      setSwipedDate(null);
    }
  };

  const handleTouchStart = (e, date) => {
    setTouchStart(e.touches[0].clientX);
    setTouchCurrent(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (touchStart === null) return;
    setTouchCurrent(e.touches[0].clientX);
  };

  const handleTouchEnd = (date) => {
    if (touchStart === null || touchCurrent === null) return false;

    const diff = touchStart - touchCurrent;
    const SWIPE_THRESHOLD = 100;

    setTouchStart(null);
    setTouchCurrent(null);

    if (diff > SWIPE_THRESHOLD) {
      setSwipedDate(date);
      return true;
    }

    if (diff < -50) {
      setSwipedDate(null);
      return false;
    }

    return false;
  };

  const getSwipeOffset = () => {
    if (touchStart === null || touchCurrent === null) return 0;
    const diff = touchStart - touchCurrent;
    return Math.max(0, Math.min(diff, 150));
  };

  const cancelSwipe = () => {
    setSwipedDate(null);
  };

  return {
    deletingDate,
    swipedDate,
    deleteWaypointDay,
    deleteStreetTimeDay,
    isWaypointDayEmpty,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    getSwipeOffset,
    cancelSwipe,
  };
}
