import { useState, useEffect } from 'react';
import { History, Calendar, MapPin, Check, Clock, ChevronDown, ChevronUp, Search, TrendingUp, Trash2, AlertCircle } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import useRouteStore from '../../stores/routeStore';
import { fetchWaypointHistory } from '../../services/waypointHistoryService';
import { format, parseISO, differenceInDays } from 'date-fns';
import { supabase } from '../../lib/supabase';

export default function WaypointHistoryScreen() {
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [expandedDate, setExpandedDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dayToDelete, setDayToDelete] = useState(null);
  const [deleteResult, setDeleteResult] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { currentRouteId } = useRouteStore();

  useEffect(() => {
    if (currentRouteId) {
      loadHistoryData();
    }
  }, [currentRouteId]);

  const loadHistoryData = async () => {
    setLoading(true);
    try {
      const history = await fetchWaypointHistory(currentRouteId, 90); // 90 days back
      setHistoryData(history);
      console.log('[WAYPOINT HISTORY] Loaded', history.length, 'days');
    } catch (error) {
      console.error('Failed to load waypoint history:', error);
      setHistoryData([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (date) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  const handleDeleteClick = async (e, dayData) => {
    e.stopPropagation();
    
    // Check if day has any completed waypoints
    const completedCount = dayData.waypoint_timings?.length || 0;
    
    if (completedCount > 0) {
      alert(
        `Cannot Delete Day\n\n` +
        `This day has ${completedCount} completed waypoints.\n\n` +
        `Only empty days can be deleted.`
      );
      return;
    }

    // Show confirmation for empty days
    setDayToDelete(dayData);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!dayToDelete) return;

    setDeleting(true);

    try {
      // Delete all waypoints for this date and route
      const { error } = await supabase
        .from('waypoints')
        .delete()
        .eq('route_id', currentRouteId)
        .eq('date', dayToDelete.date);

      if (error) throw error;

      // Show success
      setDeleteResult({
        success: true,
        message: 'Day deleted successfully'
      });

      // Reload data
      await loadHistoryData();

      // Auto-hide after 3 seconds
      setTimeout(() => {
        setDeleteResult(null);
      }, 3000);

    } catch (error) {
      console.error('Failed to delete day:', error);
      setDeleteResult({
        success: false,
        message: error.message || 'Failed to delete day'
      });

      setTimeout(() => {
        setDeleteResult(null);
      }, 5000);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDayToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDayToDelete(null);
  };

  const getFilteredHistory = () => {
    const today = new Date();
    return historyData.filter(item => {
      if (searchQuery) {
        const dateStr = format(parseISO(item.date), 'MMMM d, yyyy');
        if (!dateStr.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      const itemDate = parseISO(item.date);
      const daysDiff = differenceInDays(today, itemDate);

      switch (dateFilter) {
        case 'week':
          return daysDiff <= 7;
        case 'month':
          return daysDiff <= 30;
        case '3months':
          return daysDiff <= 90;
        default:
          return true;
      }
    });
  };

  const filteredHistory = getFilteredHistory();

  if (!currentRouteId) {
    return (
      <div className="p-4 max-w-2xl mx-auto pb-20">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Waypoint History</h2>
        </div>
        <Card>
          <div className="text-center py-8">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-1">No route configured</p>
            <p className="text-sm text-gray-500">
              Go to Settings to create your first route
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-20">
      {/* Success/Error Toast */}
      {deleteResult && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
            deleteResult.success
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            {deleteResult.success ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <div>
              <p className="font-semibold">
                {deleteResult.success ? 'Day Deleted' : 'Delete Failed'}
              </p>
              <p className="text-sm opacity-90">{deleteResult.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && dayToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Delete This Day?
                </h3>
                <p className="text-sm text-gray-600">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-semibold text-gray-900">
                    {format(parseISO(dayToDelete.date), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Waypoints:</span>
                  <span className="font-semibold text-gray-900">
                    {dayToDelete.waypoint_timings?.length || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={cancelDelete}
                variant="secondary"
                className="flex-1"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={deleting}
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                    Deleting...
                  </span>
                ) : (
                  'Delete Day'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Waypoint History</h2>
        <p className="text-sm text-gray-500">
          {filteredHistory.length > 0
            ? `${filteredHistory.length} day(s) of waypoint data`
            : 'No historical data yet'}
        </p>
      </div>

      <Card className="mb-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Time' },
            { id: 'week', label: 'Last 7 Days' },
            { id: 'month', label: 'Last 30 Days' },
            { id: '3months', label: 'Last 90 Days' },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setDateFilter(filter.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
                dateFilter === filter.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <Card>
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-3"></div>
            <p className="text-gray-600">Loading history...</p>
          </div>
        </Card>
      ) : filteredHistory.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-1">No waypoint history found</p>
            <p className="text-sm text-gray-500">
              {searchQuery || dateFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start adding waypoints to build your history'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((dayData) => {
            const isExpanded = expandedDate === dayData.date;
            const daysAgo = differenceInDays(new Date(), parseISO(dayData.date));
            const waypointCount = dayData.waypoint_timings?.length || 0;
            const isEmpty = waypointCount === 0;

            return (
              <Card key={dayData.date} className="overflow-hidden">
                <div
                  className="cursor-pointer"
                  onClick={() => toggleExpanded(dayData.date)}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">
                          {format(parseISO(dayData.date), 'EEEE, MMMM d, yyyy')}
                        </h3>
                        {isEmpty && (
                          <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                            Empty
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">
                          {waypointCount}
                        </div>
                        <div className="text-xs text-gray-500">stops</div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    {waypointCount > 0 ? (
                      <>
                        <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                          {dayData.waypoint_timings.map((waypoint, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg"
                            >
                              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500">
                                      #{waypoint.sequence}
                                    </span>
                                    <p className="text-sm text-gray-900 truncate">
                                      {waypoint.name}
                                    </p>
                                  </div>
                                  {waypoint.durationFromPrevious > 0 && (
                                    <span className="text-xs text-blue-600 font-medium whitespace-nowrap">
                                      +{waypoint.durationFromPrevious}min
                                    </span>
                                  )}
                                </div>
                                {waypoint.timestamp && (
                                  <p className="text-xs text-gray-500">
                                    {format(parseISO(waypoint.timestamp), 'h:mm a')}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="text-xs text-gray-500 mb-3 p-2 bg-blue-50 rounded">
                          💡 Durations show time from previous waypoint
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 mb-3">
                          No completed waypoints for this day
                        </p>
                      </div>
                    )}

                    {/* Delete Button - only for empty days */}
                    {isEmpty && (
                      <Button
                        onClick={(e) => handleDeleteClick(e, dayData)}
                        variant="danger"
                        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Empty Day
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {filteredHistory.length > 0 && (
        <Card className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Summary</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Days Tracked:</span>
              <span className="font-semibold text-gray-900">{filteredHistory.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Waypoints:</span>
              <span className="font-semibold text-gray-900">
                {filteredHistory.reduce((sum, day) => sum + (day.waypoint_timings?.length || 0), 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Empty Days:</span>
              <span className="font-semibold text-gray-400">
                {filteredHistory.filter(day => (day.waypoint_timings?.length || 0) === 0).length}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
