import { useState, useEffect } from 'react';
import { Search, Plus, Download, Trash2, MapPin, Check, Clock, TrendingUp, TrendingDown, Save, RefreshCw, Calendar, Copy, AlertCircle, Wrench } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import AddWaypointModal from '../shared/AddWaypointModal';
import DatePicker from '../shared/DatePicker';
import WaypointDebugModal from '../shared/WaypointDebugModal';
import useRouteStore from '../../stores/routeStore';
import { exportWaypointsToJSON, markWaypointCompleted, markWaypointPending, getWaypointsForRoute, removeDuplicateWaypoints, createQuickSetupWaypoints } from '../../services/waypointsService';
import { predictWaypointTimes } from '../../services/waypointPredictionService';
import { copyWaypointsToToday, verifyHistoricalDataExists } from '../../services/waypointRecoveryService';
import { format } from 'date-fns';

export default function WaypointsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWaypoint, setEditingWaypoint] = useState(null);
  const [viewMode, setViewMode] = useState('today');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [historicalWaypoints, setHistoricalWaypoints] = useState([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [dataVerification, setDataVerification] = useState(null);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [waypointPredictions, setWaypointPredictions] = useState([]);

  const {
    waypoints,
    waypointsLoading,
    currentRouteId,
    getCurrentRouteConfig,
    history,
    todayInputs,
    hasTemplates,
    loadWaypoints,
    addWaypoint,
    updateWaypoint,
    deleteWaypoint,
    clearAllWaypoints,
    saveAsTemplate,
    loadFromTemplate,
    loadTemplates,
  } = useRouteStore();

  const routeConfig = getCurrentRouteConfig();

  useEffect(() => {
    async function loadPredictions() {
      if (!waypoints || waypoints.length === 0 || !currentRouteId) {
        console.log('[UI] No waypoint predictions - missing data:', { waypoints: waypoints?.length, routeId: currentRouteId });
        setWaypointPredictions([]);
        return;
      }

      const leaveOfficeTime = todayInputs.leaveOfficeTime || routeConfig?.startTime || '07:30';
      console.log('[UI] Calculating predictions with start time:', leaveOfficeTime, 'for route:', currentRouteId);

      try {
        const predictions = await predictWaypointTimes(waypoints, leaveOfficeTime, currentRouteId);
        console.log('[UI] Received predictions:', predictions.map(p => ({ id: p.id, address: p.address, hasPrediction: !!p.predictedTime, confidence: p.confidence })));
        setWaypointPredictions(predictions);
      } catch (error) {
        console.error('[UI] Error loading predictions:', error);
        setWaypointPredictions([]);
      }
    }

    loadPredictions();
  }, [waypoints, currentRouteId, todayInputs.leaveOfficeTime, routeConfig]);

  useEffect(() => {
    if (currentRouteId) {
      loadWaypoints();
      loadTemplates();
    }
  }, [currentRouteId, loadWaypoints, loadTemplates]);

  const handleAddWaypoint = async (waypointData) => {
    try {
      await addWaypoint(waypointData);
    } catch (error) {
      console.error('Failed to add waypoint:', error);
    }
  };

  const handleEditWaypoint = (waypoint) => {
    setEditingWaypoint(waypoint);
    setIsModalOpen(true);
  };

  const handleUpdateWaypoint = async (waypointData) => {
    try {
      await updateWaypoint(editingWaypoint.id, waypointData);
      setEditingWaypoint(null);
    } catch (error) {
      console.error('Failed to update waypoint:', error);
    }
  };

  const handleDeleteWaypoint = async (waypointId) => {
    if (confirm('Are you sure you want to delete this waypoint?')) {
      try {
        await deleteWaypoint(waypointId);
      } catch (error) {
        console.error('Failed to delete waypoint:', error);
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete all waypoints for today?')) {
      try {
        await clearAllWaypoints();
      } catch (error) {
        console.error('Failed to clear waypoints:', error);
      }
    }
  };

  const handleExport = async () => {
    try {
      await exportWaypointsToJSON(currentRouteId);
    } catch (error) {
      console.error('Failed to export waypoints:', error);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (waypoints.length === 0) {
      alert('Add some waypoints first before saving as a template');
      return;
    }

    if (confirm(`Save these ${waypoints.length} waypoints as your route template? This will replace any existing template.`)) {
      try {
        await saveAsTemplate();
        alert('Template saved! Your waypoints will auto-populate each day.');
      } catch (error) {
        console.error('Failed to save template:', error);
        alert('Failed to save template. Please try again.');
      }
    }
  };

  const handleLoadFromTemplate = async () => {
    if (!hasTemplates) {
      alert('No template found. Create waypoints and save them as a template first.');
      return;
    }

    if (waypoints.length > 0) {
      if (!confirm('This will replace your current waypoints. Continue?')) {
        return;
      }
      await clearAllWaypoints();
    }

    try {
      await loadFromTemplate();
      alert('Waypoints loaded from template!');
    } catch (error) {
      console.error('Failed to load from template:', error);
      alert('Failed to load waypoints from template. Please try again.');
    }
  };

  const handleQuickSetupWaypoints = async () => {
    if (!currentRouteId) return;

    const msg = waypoints.length === 0
      ? 'Create 4 quick setup waypoints (Leave Post Office, 1st Stop, Last Stop, Return to Post Office)?'
      : 'Add missing quick-setup anchors (won\'t delete your existing waypoints)?';

    if (!confirm(msg)) return;

    try {
      const result = await createQuickSetupWaypoints(currentRouteId, null, waypoints);
      await loadWaypoints();
      alert(result.created > 0
        ? `Added ${result.created} quick-setup waypoint(s).`
        : 'Quick setup already exists.');
    } catch (error) {
      console.error('Failed to quick-setup waypoints:', error);
      alert('Failed to create quick setup waypoints. Please try again.');
    }
  };

  const handleRemoveDuplicates = async () => {
    if (!currentRouteId) return;

    if (confirm('Remove duplicate waypoints? This will keep only the first occurrence of each sequence number.')) {
      try {
        const result = await removeDuplicateWaypoints(currentRouteId);
        await loadWaypoints();
        alert(`Removed ${result.removed} duplicates. ${result.remaining} waypoints remaining.`);
      } catch (error) {
        console.error('Failed to remove duplicates:', error);
        alert('Failed to remove duplicates. Please try again.');
      }
    }
  };

  const handleMarkCompleted = async (waypointId) => {
    try {
      const updated = await markWaypointCompleted(waypointId);
      await updateWaypoint(waypointId, {
        status: updated.status,
        delivery_time: updated.delivery_time
      });
      await loadWaypoints();
    } catch (error) {
      console.error('Failed to mark waypoint completed:', error);
    }
  };

  const handleMarkPending = async (waypointId) => {
    try {
      const updated = await markWaypointPending(waypointId);
      await updateWaypoint(waypointId, {
        status: updated.status,
        delivery_time: updated.delivery_time
      });
      await loadWaypoints();
    } catch (error) {
      console.error('Failed to mark waypoint pending:', error);
    }
  };

  const loadHistoricalWaypoints = async (date) => {
    if (!currentRouteId) return;

    setHistoricalLoading(true);
    try {
      const data = await getWaypointsForRoute(currentRouteId, date);
      setHistoricalWaypoints(data);

      const verification = await verifyHistoricalDataExists(currentRouteId, date);
      setDataVerification(verification);
    } catch (error) {
      console.error('Failed to load historical waypoints:', error);
      setHistoricalWaypoints([]);
      setDataVerification(null);
    } finally {
      setHistoricalLoading(false);
    }
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    const today = new Date().toISOString().split('T')[0];
    if (newDate === today) {
      setViewMode('today');
    } else {
      setViewMode('historical');
      loadHistoricalWaypoints(newDate);
    }
  };

  const handleCopyToToday = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate === today) {
      alert('You are already viewing today\'s waypoints');
      return;
    }

    if (!confirm(`Copy ${historicalWaypoints.length} waypoints from ${format(new Date(selectedDate), 'MMMM d, yyyy')} to today? This will replace today's waypoints.`)) {
      return;
    }

    try {
      const result = await copyWaypointsToToday(currentRouteId, selectedDate);
      alert(`Successfully recovered ${result.count} waypoints to today!`);

      setViewMode('today');
      setSelectedDate(today);
      await loadWaypoints();
    } catch (error) {
      console.error('Failed to copy waypoints:', error);
      alert('Failed to copy waypoints. Please try again.');
    }
  };

  useEffect(() => {
    if (viewMode === 'historical' && selectedDate) {
      loadHistoricalWaypoints(selectedDate);
    }
  }, [currentRouteId]);

  const displayWaypoints = viewMode === 'today' ? waypoints : historicalWaypoints;
  const isLoading = viewMode === 'today' ? waypointsLoading : historicalLoading;

  const filters = [
    { id: 'all', label: `All (${displayWaypoints.length})` },
    { id: 'completed', label: `Done (${displayWaypoints.filter(w => w.status === 'completed').length})` },
    { id: 'pending', label: `Pending (${displayWaypoints.filter(w => w.status === 'pending').length})` },
  ];

  const filteredWaypoints = displayWaypoints.filter(waypoint => {
    if (activeFilter === 'completed' && waypoint.status !== 'completed') return false;
    if (activeFilter === 'pending' && waypoint.status !== 'pending') return false;
    if (searchQuery && !waypoint.address.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="p-4 max-w-2xl mx-auto pb-20">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Waypoints</h2>
          <p className="text-sm text-gray-500">
            {viewMode === 'today'
              ? `Today: ${waypoints.length} stops`
              : `${format(new Date(selectedDate), 'MMM d, yyyy')}: ${displayWaypoints.length} stops`}
          </p>
        </div>
        {viewMode === 'today' && currentRouteId && (
          <button
            onClick={() => setIsDebugModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Check & Fix Waypoint Data"
          >
            <Wrench className="w-4 h-4" />
            <span>Fix</span>
          </button>
        )}
      </div>

      <Card className="mb-4">
        <DatePicker
          selectedDate={selectedDate}
          onChange={handleDateChange}
          label="View Waypoints from Date"
        />

        {viewMode === 'historical' && dataVerification && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-blue-800 font-medium">Historical Data Found</p>
                <p className="text-xs text-blue-700 mt-1">
                  {dataVerification.waypointCount} waypoint(s) from this date
                  {dataVerification.hasHistory && ' • Route history saved'}
                  {dataVerification.hasTimingData && ' • Timing data available'}
                </p>
              </div>
            </div>
            {displayWaypoints.length > 0 && (
              <Button
                onClick={handleCopyToToday}
                variant="secondary"
                className="w-full mt-3 flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy These Waypoints to Today
              </Button>
            )}
          </div>
        )}

        {viewMode === 'historical' && displayWaypoints.length === 0 && !isLoading && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">No Waypoints Found</p>
            <p className="text-xs text-amber-700 mt-1">
              There are no waypoints saved for {format(new Date(selectedDate), 'MMMM d, yyyy')}
            </p>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        {!currentRouteId && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 mb-1 font-medium">No route configured</p>
            <p className="text-xs text-amber-700">
              Go to Settings to create your first route and start tracking waypoints
            </p>
          </div>
        )}

        {hasTemplates && waypoints.length === 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-1 font-medium">Template Available</p>
            <p className="text-xs text-blue-700">
              Click "Load Template" below to auto-populate your waypoints for today
            </p>
          </div>
        )}

        {(
          <>
            <Button
              onClick={async () => {
                // Always show the button. If user is browsing history, guide them back to Today.
                if (viewMode !== 'today') {
                  if (!confirm('Quick Setup creates today\'s 4 anchor waypoints. Switch to Today and continue?')) {
                    return;
                  }
                  const today = new Date().toISOString().split('T')[0];
                  setSelectedDate(today);
                  setViewMode('today');
                }
                await handleQuickSetupWaypoints();
              }}
              variant="secondary"
              className="w-full mb-3 flex items-center justify-center gap-2"
              disabled={!currentRouteId}
            >
              <MapPin className="w-5 h-5" />
              Quick Setup (4 Waypoints)
            </Button>

            {viewMode === 'today' && (
              <Button
                onClick={() => {
                  setEditingWaypoint(null);
                  setIsModalOpen(true);
                }}
                className="w-full mb-3 flex items-center justify-center gap-2"
                disabled={!currentRouteId}
              >
                <Plus className="w-5 h-5" />
                Add Waypoint
              </Button>
            )}

            <div className="flex gap-2 mb-4">
              <Button
                variant="secondary"
                onClick={handleLoadFromTemplate}
                className="flex-1 flex items-center justify-center gap-2"
                disabled={!currentRouteId || !hasTemplates}
              >
                <RefreshCw className="w-4 h-4" />
                Load Template
              </Button>
              <Button
                variant="secondary"
                onClick={handleSaveAsTemplate}
                className="flex-1 flex items-center justify-center gap-2"
                disabled={!currentRouteId || waypoints.length === 0}
              >
                <Save className="w-4 h-4" />
                Save as Template
              </Button>
            </div>

            {waypoints.length > 20 && (
              <Button
                variant="secondary"
                onClick={handleRemoveDuplicates}
                className="w-full mb-4 flex items-center justify-center gap-2 bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                disabled={!currentRouteId}
              >
                <AlertCircle className="w-4 h-4" />
                Remove Duplicate Waypoints
              </Button>
            )}
          </>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </Card>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
              activeFilter === filter.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {viewMode === 'today' && waypoints.length > 0 && (!history || history.length === 0) && (
        <Card className="mb-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-2">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Building Prediction Data</p>
              <p className="text-xs text-blue-700 mt-1">
                Complete your route today to start seeing delivery time predictions tomorrow.
                The system learns from your delivery patterns to provide accurate estimates.
              </p>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-600">Loading waypoints...</p>
          </div>
        </Card>
      ) : filteredWaypoints.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-1">
              {waypoints.length === 0 ? 'No waypoints yet' : 'No waypoints match your filters'}
            </p>
            <p className="text-sm text-gray-500">
              {waypoints.length === 0
                ? 'Add waypoints to track your deliveries'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {filteredWaypoints.map((waypoint) => {
              const prediction = waypointPredictions.find(p => p.id === waypoint.id);
              const hasActualTime = waypoint.delivery_time && waypoint.status === 'completed';
              const hasPrediction = prediction &&
                                     prediction.predictedTime &&
                                     prediction.predictedTime !== null &&
                                     prediction.confidence !== 'none';

              if (waypoint.status !== 'completed') {
                console.log(`[UI] Waypoint ${waypoint.address}:`, {
                  hasPrediction,
                  predictionFound: !!prediction,
                  predictedTime: prediction?.predictedTime,
                  confidence: prediction?.confidence
                });
              }

              let variance = null;
              if (hasActualTime && hasPrediction && prediction.predictedMinutes) {
                const startTimeStr = todayInputs.leaveOfficeTime || routeConfig?.startTime || '07:30';
                let startTime;
                
                const tempDate = new Date(startTimeStr);
                if (!isNaN(tempDate.getTime())) {
                  startTime = tempDate;
                } else {
                  const timeMatch = startTimeStr.match(/^(\d{1,2}):(\d{2})$/);
                  if (timeMatch) {
                    const today = new Date(waypoint.delivery_time);
                    today.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
                    startTime = today;
                  } else {
                    startTime = null;
                  }
                }
                
                if (startTime) {
                  const actualMinutes = Math.round(
                    (new Date(waypoint.delivery_time) - startTime) / (1000 * 60)
                  );
                  variance = actualMinutes - prediction.predictedMinutes;
                }
              }

              return (
                <Card key={waypoint.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {waypoint.status === 'completed' ? (
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                            <span className="w-3 h-3 rounded-full border-2 border-gray-300"></span>
                          </span>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500">#{waypoint.sequence_number}</span>
                            <h3 className="font-semibold text-gray-900">{waypoint.address}</h3>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-gray-500">
                              {(() => {
                                if (!waypoint.delivery_time) return 'Not delivered';
                                try {
                                  const deliveryTime = new Date(waypoint.delivery_time);
                                  if (isNaN(deliveryTime.getTime())) return 'Not delivered';
                                  return format(deliveryTime, 'h:mm a');
                                } catch (e) {
                                  return 'Not delivered';
                                }
                              })()}
                            </p>

                            {variance !== null && (
                              <span className={`flex items-center gap-1 text-xs font-medium ${
                                variance < -5 ? 'text-blue-600' : variance > 5 ? 'text-amber-600' : 'text-gray-600'
                              }`}>
                                {variance < -5 && <TrendingUp className="w-3 h-3" />}
                                {variance > 5 && <TrendingDown className="w-3 h-3" />}
                                {Math.abs(variance)}m {variance < 0 ? 'ahead' : 'behind'}
                              </span>
                            )}
                          </div>

                          {hasPrediction && !hasActualTime && (() => {
                            try {
                              const predTime = new Date(prediction.predictedTime);
                              if (isNaN(predTime.getTime())) return null;
                              return (
                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                  <Clock className="w-3 h-3" />
                                  Expected: {format(predTime, 'h:mm a')}
                                </div>
                              );
                            } catch (e) {
                              return null;
                            }
                          })()}

                          {waypoint.notes && (
                            <p className="text-sm text-gray-400 mt-1">{waypoint.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {viewMode === 'today' && (
                      <div className="flex flex-col gap-1">
                        {waypoint.status === 'completed' ? (
                          <button
                            onClick={() => handleMarkPending(waypoint.id)}
                            className="text-amber-600 text-xs font-medium hover:text-amber-700"
                          >
                            Uncomplete
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkCompleted(waypoint.id)}
                            className="text-green-600 text-xs font-medium hover:text-green-700"
                          >
                            Complete
                          </button>
                        )}
                        <button
                          onClick={() => handleEditWaypoint(waypoint)}
                          className="text-blue-600 text-xs font-medium hover:text-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteWaypoint(waypoint.id)}
                          className="text-red-600 text-xs font-medium hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
            {viewMode === 'today' && (
              <Button
                variant="secondary"
                onClick={handleClearAll}
                className="flex-1 flex items-center justify-center gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
            )}
          </div>
        </>
      )}

      <AddWaypointModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingWaypoint(null);
        }}
        onSave={editingWaypoint ? handleUpdateWaypoint : handleAddWaypoint}
        editWaypoint={editingWaypoint}
      />

      <WaypointDebugModal
        isOpen={isDebugModalOpen}
        onClose={() => {
          setIsDebugModalOpen(false);
          loadWaypoints();
        }}
        routeId={currentRouteId}
      />
    </div>
  );
}
