import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function useDayDeletion() {
  const [deletingDate, setDeletingDate] = useState(null);
  const [swipedDate, setSwipedDate] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchCurrent, setTouchCurrent] = useState(null);

  const isWaypointDayEmpty = (daySummary) => {
    return daySummary.completed === 0;
  };

  const deleteWaypointDay = async (routeId, date, daySummary) => {
    if (!isWaypointDayEmpty(daySummary)) {
      throw new Error(
        `Cannot delete day with ${daySummary.completed} completed waypoints. ` +
        `Only empty days (0 completed waypoints) can be deleted.`
      );
    }

    setDeletingDate(date);

    try {
      console.log('[DELETE] Deleting waypoint day:', date);

      const { data, error } = await supabase.rpc('delete_waypoint_day', {
        p_route_id: routeId,
        p_date: date,
        p_session_id: 'dummy'
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