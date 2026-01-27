import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook for deleting waypoint and street time days with swipe-to-delete UI
 * Follows RouteWise non-negotiables: minimal changes, strong guardrails, accuracy over speed
 */
export function useDayDeletion() {
  const [deletingDate, setDeletingDate] = useState(null);
  const [swipedDate, setSwipedDate] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchCurrent, setTouchCurrent] = useState(null);

  /**
   * Get session ID from multiple possible sources
   * @returns {string|null} Session ID or null
   */
  const getSessionId = async () => {
    // Method 1: Try localStorage (routewise-storage)
    try {
      const stored = localStorage.getItem('routewise-storage');
      if (stored) {
        const data = JSON.parse(stored);
        const sessionId = data.sessionId || data.state?.sessionId;
        if (sessionId) {
          console.log('[DELETE] Found session ID in routewise-storage');
          return sessionId;
        }
      }
    } catch (e) {
      console.warn('[DELETE] Failed to parse routewise-storage:', e);
    }

    // Method 2: Try Supabase auth
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        console.log('[DELETE] Found session ID from Supabase auth');
        return session.user.id;
      }
    } catch (e) {
      console.warn('[DELETE] Failed to get Supabase session:', e);
    }

    // Method 3: Try direct sessionId key
    try {
      const directId = localStorage.getItem('sessionId');
      if (directId) {
        console.log('[DELETE] Found session ID in sessionId key');
        return directId;
      }
    } catch (e) {
      console.warn('[DELETE] Failed to get direct sessionId:', e);
    }

    console.error('[DELETE] No session ID found in any location');
    return null;
  };

  /**
   * Check if a waypoint day is empty (no completed waypoints)
   * @param {Object} daySummary - Summary object with {total, completed} counts
   * @returns {boolean} True if day is empty or has no completed waypoints
   */
  const isWaypointDayEmpty = (daySummary) => {
    return daySummary.completed === 0;
  };

  /**
   * Delete a waypoint day (empty days only)
   * @param {string} routeId - UUID of the route
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {Object} daySummary - Summary object with {total, completed} counts
   * @returns {Promise<Object>} Result object
   */
  const deleteWaypointDay = async (routeId, date, daySummary) => {
    // Validate: Day must be empty
    if (!isWaypointDayEmpty(daySummary)) {
      throw new Error(
        `Cannot delete day with ${daySummary.completed} completed waypoints. ` +
        `Only empty days (0 completed waypoints) can be deleted.`
      );
    }

    setDeletingDate(date);

    try {
      const sessionId = await getSessionId();
      if (!sessionId) {
        throw new Error('Not authenticated - no session ID found');
      }

      console.log('[DELETE] Deleting waypoint day:', date, 'with session:', sessionId);

      // Call RPC function
      const { data, error } = await supabase.rpc('delete_waypoint_day', {
        p_route_id: routeId,
        p_date: date,
        p_session_id: sessionId
      });

      if (error) {
        console.error('[DELETE] RPC error:', error);
        throw error;
      }

      console.log('[DELETE] Waypoint day deleted successfully:', data);

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
   * Delete a street time day (always allowed with confirmation)
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {Object} daySummary - Summary object with street time data
   * @returns {Promise<Object>} Result object
   */
  const deleteStreetTimeDay = async (date, daySummary) => {
    setDeletingDate(date);

    try {
      const sessionId = await getSessionId();
      if (!sessionId) {
        throw new Error('Not authenticated - no session ID found');
      }

      console.log('[DELETE] Deleting street time day:', date, 'with session:', sessionId);

      // Call RPC function
      const { data, error } = await supabase.rpc('delete_street_time_day', {
        p_date: date,
        p_session_id: sessionId
      });

      if (error) {
        console.error('[DELETE] RPC error:', error);
        throw error;
      }

      console.log('[DELETE] Street time day deleted successfully:', data);

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

  /**
   * Handle touch start for swipe-to-delete
   * @param {TouchEvent} e - Touch event
   * @param {string} date - Date being swiped
   */
  const handleTouchStart = (e, date) => {
    setTouchStart(e.touches[0].clientX);
    setTouchCurrent(e.touches[0].clientX);
  };

  /**
   * Handle touch move for swipe-to-delete
   * @param {TouchEvent} e - Touch event
   */
  const handleTouchMove = (e) => {
    if (touchStart === null) return;
    setTouchCurrent(e.touches[0].clientX);
  };

  /**
   * Handle touch end for swipe-to-delete
   * @param {string} date - Date being swiped
   * @returns {boolean} True if swipe threshold was met
   */
  const handleTouchEnd = (date) => {
    if (touchStart === null || touchCurrent === null) return false;

    const diff = touchStart - touchCurrent;
    const SWIPE_THRESHOLD = 100; // pixels

    setTouchStart(null);
    setTouchCurrent(null);

    // Swipe left to reveal delete
    if (diff > SWIPE_THRESHOLD) {
      setSwipedDate(date);
      return true;
    }

    // Swipe right to cancel
    if (diff < -50) {
      setSwipedDate(null);
      return false;
    }

    return false;
  };

  /**
   * Get swipe offset for animation
   * @returns {number} Offset in pixels
   */
  const getSwipeOffset = () => {
    if (touchStart === null || touchCurrent === null) return 0;
    const diff = touchStart - touchCurrent;
    return Math.max(0, Math.min(diff, 150)); // Clamp between 0-150px
  };

  /**
   * Cancel swipe (close delete button)
   */
  const cancelSwipe = () => {
    setSwipedDate(null);
  };

  return {
    // State
    deletingDate,
    swipedDate,
    
    // Deletion functions
    deleteWaypointDay,
    deleteStreetTimeDay,
    isWaypointDayEmpty,
    
    // Swipe handlers
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    getSwipeOffset,
    cancelSwipe,
  };
}
