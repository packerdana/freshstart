import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { LogOut, User, Mail, Clock, Database, Info, Settings as SettingsIcon, Bell, Shield, Download, MapPin, Plus, CreditCard as Edit, Trash2, FileText, AlertTriangle, Bug } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import RouteSetupModal from '../shared/RouteSetupModal';
import RouteEvaluationModal from '../shared/RouteEvaluationModal';
import DeleteTestDataModal from '../shared/DeleteTestDataModal';
import DiagnosticsModal from '../shared/DiagnosticsModal';
import useAuthStore from '../../stores/authStore';
import useRouteStore from '../../stores/routeStore';
import { createRoute, updateRoute, deleteRoute } from '../../services/routeHistoryService';

export default function SettingsScreen() {
  const { user, signOut, loading } = useAuthStore();
  const { history, currentRoute, currentRouteId, routes, loadUserRoutes, activateRoute } = useRouteStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      await signOut();
    }
  };

  const handleCreateRoute = async (routeData) => {
    try {
      const newRoute = await createRoute(routeData);
      await loadUserRoutes();
      setShowRouteModal(false);
    } catch (error) {
      console.error('Failed to create route:', error);
      throw error;
    }
  };

  const handleUpdateRoute = async (routeData) => {
    try {
      await updateRoute(editingRoute.id, routeData);
      await loadUserRoutes();
      setShowRouteModal(false);
      setEditingRoute(null);
    } catch (error) {
      console.error('Failed to update route:', error);
      throw error;
    }
  };

  const handleEditRoute = (route) => {
    setEditingRoute(route);
    setShowRouteModal(true);
  };

  const handleDeleteRoute = async (route) => {
    if (route.id === currentRouteId) {
      alert('Cannot delete the active route. Please set another route as active first.');
      return;
    }

    if (confirm(`Delete Route ${route.routeNumber}? This will also delete all history for this route.`)) {
      try {
        await deleteRoute(route.id);
        await loadUserRoutes();
      } catch (error) {
        console.error('Failed to delete route:', error);
        alert('Failed to delete route. Please try again.');
      }
    }
  };

  const handleDeleteDataSuccess = async (results) => {
    console.log('Test data deleted successfully:', results);
    await loadUserRoutes();
    alert(`Successfully deleted:\n- ${results.routeHistory} route history entries\n- ${results.waypoints} waypoints\n- ${results.pmOfficeSessions} PM office sessions`);
  };

  const accountCreatedDate = user?.created_at ? new Date(user.created_at) : null;
  const daysActive = accountCreatedDate
    ? Math.floor((currentTime - accountCreatedDate) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500">{format(currentTime, 'EEEE, MMMM d')}</p>
      </div>

      <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-sky-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
              <User className="text-white" size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Account</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-700 break-all">{user?.email}</p>
                </div>
                {accountCreatedDate && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <p className="text-sm text-gray-600">
                      Member since {format(accountCreatedDate, 'MMM d, yyyy')}
                      {daysActive !== null && ` (${daysActive} days)`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-blue-200">
          <Button
            variant="danger"
            onClick={handleSignOut}
            disabled={loading}
            className="w-full"
          >
            <LogOut size={20} className="mr-2" />
            {loading ? 'Signing out...' : 'Sign Out'}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">My Routes</h3>
            <p className="text-xs text-gray-600">Manage your delivery routes</p>
          </div>
          <Button
            onClick={() => {
              setEditingRoute(null);
              setShowRouteModal(true);
            }}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Route
          </Button>
        </div>

        <div className="space-y-2">
          {Object.values(routes).length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">No routes configured</p>
              <p className="text-sm text-gray-500 mb-4">Create your first route to start tracking</p>
              <Button
                onClick={() => {
                  setEditingRoute(null);
                  setShowRouteModal(true);
                }}
                className="mx-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Route
              </Button>
            </div>
          ) : (
            Object.values(routes).map((route) => (
              <div
                key={route.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  route.id === currentRouteId
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900">Route {route.routeNumber}</h4>
                      {route.id === currentRouteId && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>Start: {route.startTime}</div>
                      <div>Tour: {route.tourLength}h</div>
                      <div>Lunch: {route.lunchDuration}m</div>
                      <div>Breaks: {route.comfortStopDuration}m</div>
                      {route.manualStreetTime && (
                        <div className="col-span-2 text-blue-600 font-medium">
                          Est. Street Time: {Math.floor(route.manualStreetTime / 60)}h {route.manualStreetTime % 60}m
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {route.id !== currentRouteId && (
                      <button
                        onClick={() => {
                          const rn = route?.routeNumber || route?.route_number || '—';
                          if (window.confirm(`Are you sure you want to switch to Route ${rn}?`)) {
                            activateRoute(route.id);
                          }
                        }}
                        className="text-xs text-blue-600 font-medium hover:text-blue-700"
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      onClick={() => handleEditRoute(route)}
                      className="text-xs text-gray-600 font-medium hover:text-gray-700 flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                    {route.id === currentRouteId && (
                      <button
                        onClick={() => setShowEvaluationModal(true)}
                        className="text-xs text-green-600 font-medium hover:text-green-700 flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Evaluation
                      </button>
                    )}
                    {route.id !== currentRouteId && (
                      <button
                        onClick={() => handleDeleteRoute(route)}
                        className="text-xs text-red-600 font-medium hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Data Summary</h3>
            <p className="text-xs text-gray-600">Your route tracking information</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-semibold text-gray-700">Routes Tracked</span>
            <span className="text-xl font-bold text-gray-900">{history?.length || 0}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-semibold text-gray-700">Account Status</span>
            <span className="text-sm font-bold text-green-600">Active</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Preferences</h3>
            <p className="text-xs text-gray-600">App settings and customization</p>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => setShowDiagnosticsModal(true)}
            className="w-full flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Bug className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-blue-900">Run Diagnostics</p>
                <p className="text-xs text-blue-700">Test database connection and data access</p>
              </div>
            </div>
          </button>
          <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Notifications</p>
                <p className="text-xs text-gray-600">Manage alerts and reminders</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">Coming Soon</span>
          </button>
          <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Export Data</p>
                <p className="text-xs text-gray-600">Download your route history</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">Coming Soon</span>
          </button>
          <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Privacy & Security</p>
                <p className="text-xs text-gray-600">Manage your data and privacy</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">Coming Soon</span>
          </button>
        </div>
      </Card>

      <Card className="border-2 border-red-200 bg-red-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-900">Danger Zone</h3>
            <p className="text-xs text-red-700">Irreversible actions</p>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => setShowDeleteDataModal(true)}
            className="w-full flex items-center justify-between p-3 bg-white border-2 border-red-200 rounded-lg hover:bg-red-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-900">Delete Test Data</p>
                <p className="text-xs text-red-700">Remove all route history, waypoints, and sessions</p>
              </div>
            </div>
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Info className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">About</h3>
            <p className="text-xs text-gray-600">App information and support</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">App Version</span>
            <span className="text-sm font-mono text-gray-900">{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">Last Updated</span>
            <span className="text-sm text-gray-900">{format(currentTime, 'MMM yyyy')}</span>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-900 font-semibold mb-1">Postal Route Tracker</p>
            <p className="text-xs text-blue-700">
              Track mail volume, predict street time, and analyze your delivery performance.
            </p>
            <p className="text-[11px] text-blue-700 mt-2">
              Tip: when reporting a bug, include the App Version above so we know you’re on the latest deploy.
            </p>
          </div>
        </div>
      </Card>

      <RouteSetupModal
        isOpen={showRouteModal}
        onClose={() => {
          setShowRouteModal(false);
          setEditingRoute(null);
        }}
        onSave={editingRoute ? handleUpdateRoute : handleCreateRoute}
        editRoute={editingRoute}
      />

      <RouteEvaluationModal
        isOpen={showEvaluationModal}
        onClose={() => setShowEvaluationModal(false)}
        routeId={currentRouteId}
      />

      <DeleteTestDataModal
        isOpen={showDeleteDataModal}
        onClose={() => setShowDeleteDataModal(false)}
        onSuccess={handleDeleteDataSuccess}
      />

      <DiagnosticsModal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
      />
    </div>
  );
}
