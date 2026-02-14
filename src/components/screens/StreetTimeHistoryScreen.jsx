import { useState, useEffect } from 'react';
import { History, Calendar, Clock, ChevronDown, ChevronUp, Search, TrendingUp, Trash2, AlertCircle, Check, Ban } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import useRouteStore from '../../stores/routeStore';
import { supabase } from '../../lib/supabase';
import { getStreetTimeSummaryByDate, getOperationCodesForDate, formatDuration } from '../../services/streetTimeHistoryService';
import { setExcludeFromAverages } from '../../services/dataQualityService';
import { useDayDeletion } from '../../hooks/useDayDeletion';
import { formatMinutesAsTime } from '../../utils/time';
import { format, parseISO, differenceInDays } from 'date-fns';

export default function StreetTimeHistoryScreen() {
  const [loading, setLoading] = useState(false);
  const [historySummary, setHistorySummary] = useState([]);
  const [expandedDate, setExpandedDate] = useState(null);
  const [expandedCodes, setExpandedCodes] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dayToDelete, setDayToDelete] = useState(null);
  const [deleteResult, setDeleteResult] = useState(null);
  const [routeName, setRouteName] = useState(null);

  const { currentRouteId, loadRouteHistory } = useRouteStore();
  const { deletingDate, deleteStreetTimeDay } = useDayDeletion();

  useEffect(() => {
    const fetchRouteName = async () => {
      if (!currentRouteId) return;
      
      try {
        const { data, error } = await supabase
          .from('routes')
          .select('route_number')
          .eq('id', currentRouteId)
          .single();
        
        if (error) throw error;
        
        const displayName = data.route_number || currentRouteId.substring(0, 8) + '...';
        setRouteName(displayName);
        console.log('[STREET TIME] Route:', displayName);
      } catch (error) {
        console.error('Failed to fetch route:', error);
        setRouteName(currentRouteId.substring(0, 8) + '...');
      }
    };
    
    fetchRouteName();
  }, [currentRouteId]);

  useEffect(() => {
    if (currentRouteId) {
      loadHistorySummary();
    }
  }, [currentRouteId]);

  const loadHistorySummary = async () => {
    setLoading(true);
    try {
      const summary = await getStreetTimeSummaryByDate(currentRouteId);
      setHistorySummary(summary);
      console.log('[STREET TIME] Loaded', summary.length, 'days');
    } catch (error) {
      console.error('Failed to load history:', error);
      setHistorySummary([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCodesForDate = async (date) => {
    if (expandedDate === date) {
      setExpandedDate(null);
      setExpandedCodes([]);
      return;
    }

    setLoadingDetails(true);
    setExpandedDate(date);
    try {
      const codes = await getOperationCodesForDate(currentRouteId, date);
      setExpandedCodes(codes);
    } catch (error) {
      console.error('Failed to load codes:', error);
      setExpandedCodes([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeleteClick = (e, item) => {
    e.stopPropagation();
    setDayToDelete(item);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!dayToDelete) return;

    try {
      const result = await deleteStreetTimeDay(dayToDelete.date, currentRouteId);

      setDeleteResult({
        success: true,
        message: result.message,
        operationCodesDeleted: result.operationCodesDeleted,
        recoverableUntil: result.recoverableUntil
      });

      await loadHistorySummary();

      setTimeout(() => setDeleteResult(null), 3000);
    } catch (error) {
      setDeleteResult({
        success: false,
        message: error.message || 'Failed to delete day'
      });

      setTimeout(() => setDeleteResult(null), 5000);
    } finally {
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
        case 'week': return daysDiff <= 7;
        case 'month': return daysDiff <= 30;
        case '3months': return daysDiff <= 90;
        default: return true;
      }
    });
  };

  const filteredHistory = getFilteredHistory();

  const getCodeColor = (code) => {
    if (String(code || '').startsWith('BRK_')) return 'bg-slate-50 text-slate-700 border-slate-200';
    switch (code) {
      case '722': return 'bg-blue-50 text-blue-700 border-blue-200';
      case '721': return 'bg-green-50 text-green-700 border-green-200';
      case '736': return 'bg-amber-50 text-amber-700 border-amber-200';
      case '732': return 'bg-amber-50 text-amber-700 border-amber-200';
      case '744': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (!currentRouteId) {
    return (
      <div className="p-4 max-w-2xl mx-auto pb-20">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Daily Timeline</h2>
        </div>
        <Card>
          <div className="text-center py-8">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-1">No route configured</p>
            <p className="text-sm text-gray-500">Go to Settings to create your first route</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-20">
      {deleteResult && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${deleteResult.success ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          <div className="flex items-center gap-3">
            {deleteResult.success ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <div>
              <p className="font-semibold">{deleteResult.success ? 'Day Deleted' : 'Delete Failed'}</p>
              <p className="text-sm opacity-90">{deleteResult.message}</p>
              {deleteResult.success && deleteResult.operationCodesDeleted > 0 && (
                <p className="text-xs opacity-75 mt-1">{deleteResult.operationCodesDeleted} code(s) removed</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && dayToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Delete This Day?</h3>
                <p className="text-sm text-gray-600 mb-2">Recoverable for 30 days.</p>
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">⚠️ Operation codes will be soft-deleted</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-semibold text-gray-900">{format(parseISO(dayToDelete.date), 'MMMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Time:</span>
                  <span className="font-semibold text-gray-900">{formatDuration(dayToDelete.total_minutes)}</span>
                </div>
                {routeName && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Route:</span>
                    <span className="font-semibold text-gray-900">{routeName}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={cancelDelete} variant="secondary" className="flex-1" disabled={deletingDate === dayToDelete.date}>Cancel</Button>
              <Button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-700" disabled={deletingDate === dayToDelete.date}>
                {deletingDate === dayToDelete.date ? (
                  <span className="flex items-center gap-2">
                    <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                    Deleting...
                  </span>
                ) : 'Delete Day'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Daily Timeline</h2>
        <p className="text-sm text-gray-500">{filteredHistory.length > 0 ? `${filteredHistory.length} day(s) of timeline data` : 'No historical data yet'}</p>
        <p className="text-xs text-gray-400 mt-1">💡 Tap any day to view timeline details</p>
      </div>

      <Card className="mb-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input type="text" placeholder="Search by date..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Time' },
            { id: 'week', label: 'Last 7 Days' },
            { id: 'month', label: 'Last 30 Days' },
            { id: '3months', label: 'Last 90 Days' },
          ].map((filter) => (
            <button key={filter.id} onClick={() => setDateFilter(filter.id)} className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${dateFilter === filter.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
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
            <p className="text-gray-600 mb-1">No street time history found</p>
            <p className="text-sm text-gray-500">{searchQuery || dateFilter !== 'all' ? 'Try adjusting your filters' : 'Start tracking routes to build your history'}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => {
            const isExpanded = expandedDate === item.date;
            const daysAgo = differenceInDays(new Date(), parseISO(item.date));
            const totalTimeHHMM = formatMinutesAsTime(item.total_minutes);

            return (
              <Card key={item.date} className="overflow-hidden">
                <div className="cursor-pointer" onClick={() => loadCodesForDate(item.date)}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-5 h-5 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">{format(parseISO(item.date), 'EEEE, MMMM d, yyyy')}</h3>
                      </div>
                      <p className="text-xs text-gray-500">{daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}</p>
                      {routeName && <p className="text-xs text-gray-500 mt-1">Route: {routeName}</p>}
{item.exclude_from_averages && (
  <p className="text-xs mt-1 inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
    <Ban className="w-3 h-3" />
    Excluded from averages
  </p>
) }
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{totalTimeHHMM}</div>
                        <div className="text-xs text-gray-500">time</div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {Object.entries(item.codes).filter(([_, minutes]) => minutes > 0).map(([code, minutes]) => (
                      <div key={code} className={`px-3 py-1 rounded-full text-xs font-semibold border ${getCodeColor(code)}`}>
                        {code}: {formatDuration(minutes)}
                      </div>
                    ))}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    {loadingDetails ? (
                      <div className="text-center py-4">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                      </div>
                    ) : expandedCodes.length > 0 ? (
                      <>
                        {(() => {
                          const breaks = (expandedCodes || []).filter((c) => String(c.code || '').startsWith('BRK_'));
                          const main = (expandedCodes || []).filter((c) => !String(c.code || '').startsWith('BRK_'));
                          return (
                            <>
                              <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                                {main.map((code) => (
                                  <div key={code.id} className={`flex items-start gap-2 p-3 rounded-lg border ${getCodeColor(code.code)}`}>
                                    <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-semibold">{code.code} - {code.code_name}</span>
                                        <span className="text-sm font-bold">{code.duration_formatted}</span>
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        {format(parseISO(code.start_time), 'h:mm a')} → {code.end_time ? format(parseISO(code.end_time), 'h:mm a') : 'Active'}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {breaks.length > 0 ? (
                                <div className="mb-3">
                                  <details className="bg-white rounded-lg border border-gray-200 p-3">
                                    <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                                      Breaks taken ({breaks.length})
                                    </summary>
                                    <div className="mt-3 space-y-2">
                                      {breaks.map((code) => (
                                        <div key={code.id} className="flex items-start justify-between gap-3 p-2 rounded border border-gray-200 bg-gray-50">
                                          <div className="min-w-0">
                                            <div className="text-sm font-semibold text-gray-900">
                                              {code.code_name || code.code}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                              {format(parseISO(code.start_time), 'h:mm a')} → {code.end_time ? format(parseISO(code.end_time), 'h:mm a') : 'Active'}
                                            </div>
                                          </div>
                                          <div className="text-sm font-bold text-gray-900 whitespace-nowrap">
                                            {code.duration_formatted}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                        
                        <div className="grid grid-cols-1 gap-2">
                          <Button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await setExcludeFromAverages({
                                  routeId: currentRouteId,
                                  date: item.date,
                                  exclude: !item.exclude_from_averages,
                                });
                                await loadHistorySummary();
                                // Refresh route_history-based stats/averages too.
                                if (typeof loadRouteHistory === 'function') {
                                  await loadRouteHistory(currentRouteId);
                                }
                              } catch (err) {
                                console.error('Failed to toggle exclude_from_averages:', err);
                                alert(err?.message || 'Failed to update day');
                              }
                            }}
                            variant="secondary"
                            className={`w-full flex items-center justify-center gap-2 ${item.exclude_from_averages ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
                          >
                            <Ban className="w-4 h-4" />
                            {item.exclude_from_averages ? 'Excluded from averages (tap to include)' : 'Exclude from averages'}
                          </Button>

                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(e, item);
                            }}
                            variant="danger"
                            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete This Day
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">No operation code details available</p>
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
              <span className="text-gray-600">Total Time:</span>
              <span className="font-semibold text-blue-600">
                {formatMinutesAsTime(filteredHistory.reduce((sum, item) => sum + item.total_minutes, 0))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Average Per Day:</span>
              <span className="font-semibold text-green-600">
                {formatMinutesAsTime(filteredHistory.reduce((sum, item) => sum + item.total_minutes, 0) / filteredHistory.length)}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
