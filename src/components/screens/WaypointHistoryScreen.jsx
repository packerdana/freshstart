import { useState, useEffect } from 'react';
import { History, Calendar, MapPin, Check, Clock, Copy, ChevronDown, ChevronUp, Search, TrendingUp } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import useRouteStore from '../../stores/routeStore';
import { getWaypointSummaryByDate, copyWaypointsToToday, getHistoricalWaypoints } from '../../services/waypointRecoveryService';
import { format, parseISO, differenceInDays } from 'date-fns';

export default function WaypointHistoryScreen() {
  const [loading, setLoading] = useState(false);
  const [historySummary, setHistorySummary] = useState([]);
  const [expandedDate, setExpandedDate] = useState(null);
  const [expandedWaypoints, setExpandedWaypoints] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const { currentRouteId, loadWaypoints } = useRouteStore();

  useEffect(() => {
    if (currentRouteId) {
      loadHistorySummary();
    }
  }, [currentRouteId]);

  const loadHistorySummary = async () => {
    setLoading(true);
    try {
      const summary = await getWaypointSummaryByDate(currentRouteId);
      setHistorySummary(summary);
    } catch (error) {
      console.error('Failed to load waypoint history:', error);
      setHistorySummary([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWaypointsForDate = async (date) => {
    if (expandedDate === date) {
      setExpandedDate(null);
      setExpandedWaypoints([]);
      return;
    }

    setLoadingDetails(true);
    setExpandedDate(date);
    try {
      const waypoints = await getHistoricalWaypoints(currentRouteId, date, date);
      setExpandedWaypoints(waypoints);
    } catch (error) {
      console.error('Failed to load waypoints for date:', error);
      setExpandedWaypoints([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCopyToToday = async (date, count) => {
    if (!confirm(`Copy ${count} waypoints from ${format(parseISO(date), 'MMMM d, yyyy')} to today? This will replace today's waypoints.`)) {
      return;
    }

    try {
      const result = await copyWaypointsToToday(currentRouteId, date);
      alert(`Successfully recovered ${result.count} waypoints to today!`);
      await loadWaypoints();
    } catch (error) {
      console.error('Failed to copy waypoints:', error);
      alert('Failed to copy waypoints. Please try again.');
    }
  };

  const getFilteredHistory = () => {
    const today = new Date();
    return historySummary.filter(item => {
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

  const getCompletionColor = (rate) => {
    if (rate === 100) return 'text-green-600 bg-green-50';
    if (rate >= 80) return 'text-blue-600 bg-blue-50';
    if (rate >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

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
          {filteredHistory.map((item) => {
            const completionRate = item.total > 0
              ? Math.round((item.completed / item.total) * 100)
              : 0;
            const isExpanded = expandedDate === item.date;
            const daysAgo = differenceInDays(new Date(), parseISO(item.date));

            return (
              <Card key={item.date} className="overflow-hidden">
                <div
                  className="cursor-pointer"
                  onClick={() => loadWaypointsForDate(item.date)}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">
                          {format(parseISO(item.date), 'EEEE, MMMM d, yyyy')}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500">
                        {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{item.total} stops</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-700">{item.completed} completed</span>
                    </div>
                    <div className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold ${getCompletionColor(completionRate)}`}>
                      {completionRate}%
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    {loadingDetails ? (
                      <div className="text-center py-4">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                      </div>
                    ) : expandedWaypoints.length > 0 ? (
                      <>
                        <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                          {expandedWaypoints.map((waypoint) => (
                            <div
                              key={waypoint.id}
                              className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg"
                            >
                              {waypoint.status === 'completed' ? (
                                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-500">
                                    #{waypoint.sequence_number}
                                  </span>
                                  <p className="text-sm text-gray-900 truncate">
                                    {waypoint.address}
                                  </p>
                                </div>
                                {waypoint.delivery_time && (
                                  <p className="text-xs text-gray-500">
                                    {format(parseISO(waypoint.delivery_time), 'h:mm a')}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyToToday(item.date, item.total);
                          }}
                          variant="secondary"
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Copy to Today
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No waypoint details available
                      </p>
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
                {filteredHistory.reduce((sum, item) => sum + item.total, 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Completed:</span>
              <span className="font-semibold text-green-600">
                {filteredHistory.reduce((sum, item) => sum + item.completed, 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Average Completion:</span>
              <span className="font-semibold text-blue-600">
                {filteredHistory.length > 0
                  ? Math.round(
                      (filteredHistory.reduce((sum, item) => sum + item.completed, 0) /
                        filteredHistory.reduce((sum, item) => sum + item.total, 0)) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
