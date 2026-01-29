import { useState } from 'react';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';
import useRouteStore from '../../stores/routeStore';
import Card from '../shared/Card';
import Button from '../shared/Button';
import CreateRouteModal from '../shared/CreateRouteModal';
import EditRouteModal from '../shared/EditRouteModal';

export default function RoutesScreen() {
  const { routes, currentRouteId, createRoute, updateRoute, deleteRoute, switchToRoute } = useRouteStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const routesList = Object.values(routes);

  const handleCreateRoute = async (routeData) => {
    await createRoute(routeData);
  };

  const handleUpdateRoute = async (routeId, updates) => {
    await updateRoute(routeId, updates);
  };

  const handleEditClick = (route) => {
    setSelectedRoute(route);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (routeId) => {
    if (deleteConfirm === routeId) {
      deleteRoute(routeId);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(routeId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleRouteSelect = (routeId) => {
    switchToRoute(routeId);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Routes</h1>
          <p className="text-gray-600 mt-1">Manage your delivery routes</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={20} />
          <span>New Route</span>
        </Button>
      </div>

      {routesList.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Plus size={48} className="mx-auto opacity-50" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No routes yet</h3>
          <p className="text-gray-600 mb-6">Create your first route to get started</p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={20} />
            <span>Create Route</span>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {routesList.map((route) => (
            <Card key={route.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => handleRouteSelect(route.id)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-800">
                      Route {route.routeNumber}
                    </h3>
                    {currentRouteId === route.id && (
                      <span className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                        <Check size={14} />
                        Active
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Type</span>
                      <p className="font-medium text-gray-700" style={{ textTransform: 'capitalize' }}>
                        {route.routeType || 'mixed'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Start Time</span>
                      <p className="font-medium text-gray-700">{route.startTime}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Tour Length</span>
                      <p className="font-medium text-gray-700">{route.tourLength}h</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Lunch</span>
                      <p className="font-medium text-gray-700">{route.lunchDuration}m</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Comfort</span>
                      <p className="font-medium text-gray-700">{route.comfortStopDuration}m</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Stops</span>
                      <p className="font-medium text-gray-700">{route.stops ?? '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEditClick(route)}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit route"
                  >
                    <Edit2 size={20} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(route.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      deleteConfirm === route.id
                        ? 'bg-red-600 text-white'
                        : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                    }`}
                    title={deleteConfirm === route.id ? 'Click again to confirm' : 'Delete route'}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateRouteModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateRoute={handleCreateRoute}
      />

      <EditRouteModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedRoute(null);
        }}
        onUpdateRoute={handleUpdateRoute}
        route={selectedRoute}
      />
    </div>
  );
}
