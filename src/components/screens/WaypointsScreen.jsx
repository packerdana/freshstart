import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Download, Trash2, MapPin, Check, Clock, TrendingUp, TrendingDown, Save, RefreshCw } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import AddWaypointModal from '../shared/AddWaypointModal';
import useRouteStore from '../../stores/routeStore';
import { exportWaypointsToJSON, markWaypointCompleted, markWaypointPending } from '../../services/waypointsService';
import { predictWaypointTimes } from '../../services/waypointPredictionService';
import { format } from 'date-fns';

export default function WaypointsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWaypoint, setEditingWaypoint] = useState(null);

  const {
    waypoints,
    waypointsLoading,
    currentRouteId,
    routeConfig,
    routeHistory,
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

  const waypointPredictions = useMemo(() => {
    if (!waypoints || waypoints.length === 0 || !routeHistory || routeHistory.length === 0) {
      return [];
    }

    const leaveOfficeTime = todayInputs.leaveOfficeTime || routeConfig?.startTime || '07:30';
    return predictWaypointTimes(waypoints, leaveOfficeTime, routeHistory);
  }, [waypoints, routeHistory, todayInputs.leaveOfficeTime, routeConfig]);

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

  const handleMarkCompleted = async (waypointId) => {
    try {
      const updated = await markWaypointCompleted(waypointId);
      await updateWaypoint(waypointId, {
        status: updated.status,
        delivery_time: updated.delivery_time
      });
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
    } catch (error) {
      console.error('Failed to mark waypoint pending:', error);
    }
  };

  const filters = [
    { id: 'all', label: `All (${waypoints.length})` },
    { id: 'completed', label: `Done (${waypoints.filter(w => w.status === 'completed').length})` },
    { id: 'pending', label: `Pending (${waypoints.filter(w => w.status === 'pending').length})` },
  ];

  const filteredWaypoints = waypoints.filter(waypoint => {
    if (activeFilter === 'completed' && waypoint.status !== 'completed') return false;
    if (activeFilter === 'pending' && waypoint.status !== 'pending') return false;
    if (searchQuery && !waypoint.address.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="p-4 max-w-2xl mx-auto pb-20">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Waypoints</h2>
        <p className="text-sm text-gray-500">Today: {waypoints.length} stops</p>
      </div>

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

      {waypointsLoading ? (
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
              const hasPrediction = prediction && prediction.predictedTime && prediction.confidence !== 'none';

              let variance = null;
              if (hasActualTime && hasPrediction && prediction.predictedMinutes) {
                const actualMinutes = Math.round(
                  (new Date(waypoint.delivery_time) - new Date(todayInputs.leaveOfficeTime || routeConfig?.startTime || '07:30')) / (1000 * 60)
                );
                variance = actualMinutes - prediction.predictedMinutes;
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
                              {waypoint.delivery_time
                                ? format(new Date(waypoint.delivery_time), 'h:mm a')
                                : 'Not delivered'}
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

                          {hasPrediction && !hasActualTime && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                              <Clock className="w-3 h-3" />
                              Expected: {format(new Date(prediction.predictedTime), 'h:mm a')}
                            </div>
                          )}

                          {waypoint.notes && (
                            <p className="text-sm text-gray-400 mt-1">{waypoint.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
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
            <Button
              variant="secondary"
              onClick={handleClearAll}
              className="flex-1 flex items-center justify-center gap-2 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </Button>
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
    </div>
  );
}
