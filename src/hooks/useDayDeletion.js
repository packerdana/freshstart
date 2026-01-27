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
      // Get session ID from Supabase auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call RPC function
      const { data, error } = await supabase.rpc('delete_waypoint_day', {
        p_route_id: routeId,
        p_date: date,
        p_session_id: session.user.id
      });

      if (error) throw error;

      return {
        success: true,
        message: data.message,
        waypointsDeleted: data.waypoints_deleted,
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
      // Get session ID from Supabase auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call RPC function
      const { data, error } = await supabase.rpc('delete_street_time_day', {
        p_date: date,
        p_session_id: session.user.id
      });

      if (error) throw error;

      return {
        success: true,
        message: data.message,
        operationCodesDeleted: data.operation_codes_deleted,
        dayStateMoved: data.day_state_moved,
        recoverableUntil: data.recoverable_until,
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
