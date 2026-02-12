import { useState } from 'react';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';
import useRouteStore from '../../stores/routeStore';
import useAuthStore from '../../stores/authStore';
import Card from '../shared/Card';
import Button from '../shared/Button';
import CreateRouteModal from '../shared/CreateRouteModal';
import EditRouteModal from '../shared/EditRouteModal';

export default function RoutesScreen() {
  const { routes, currentRouteId, createRoute, updateRoute, deleteRoute, switchToRoute, loadUserRoutes } = useRouteStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const routesList = Object.values(routes);

  const authEmail = useAuthStore((s) => s.user?.email || '—');
  const authUserId = useAuthStore((s) => s.user?.id || null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseHost = supabaseUrl ? (() => { try { return new URL(supabaseUrl).host; } catch { return supabaseUrl; } })() : 'MISSING';

  const testSupabaseRest = async () => {
    try {
      if (!supabaseUrl) {
        alert('VITE_SUPABASE_URL is missing in this build.');
        return;
      }

      const url = new URL('/rest/v1/routes?select=id,user_id,route_number&limit=5', supabaseUrl);

      // If auth is working, supabase-js should have stored an access token.
      // Grab it directly so we can test REST with the same token.
      let token = null;
      try {
        const raw = localStorage.getItem('routewise-auth');
        if (raw) {
          const parsed = JSON.parse(raw);
          token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token || null;
        }
      } catch {}

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const text = await res.text();
      alert(`REST status: ${res.status}\n\n${text.slice(0, 800)}`);
    } catch (e) {
      alert(`REST test failed: ${e?.message || String(e)}`);
    }
  };

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
          <div className="mx-auto max-w-md text-left text-xs text-gray-500 mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p><span className="font-semibold">Signed in:</span> {authEmail}</p>
            <p className="break-all"><span className="font-semibold">User ID:</span> {authUserId || '—'}</p>
            <p className="break-all"><span className="font-semibold">Supabase:</span> {supabaseHost}</p>
            <Button
              variant="secondary"
              className="w-full mt-2"
              onClick={async () => {
                try {
                  await loadUserRoutes(authUserId);
                } catch (e) {
                  alert(e?.message || String(e));
                }
              }}
            >
              Reload routes
            </Button>

            <Button
              variant="secondary"
              className="w-full mt-2"
              onClick={testSupabaseRest}
            >
              Test Supabase REST
            </Button>
          </div>
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
