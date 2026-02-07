import { useEffect, useState } from 'react';
import TodayScreen from './components/screens/TodayScreen';
import RoutesScreen from './components/screens/RoutesScreen';
import WaypointsScreen from './components/screens/WaypointsScreen';
import WaypointHistoryScreen from './components/screens/WaypointHistoryScreen';
import StreetTimeHistoryScreen from './components/screens/StreetTimeHistoryScreen';
import AssistantScreen from './components/screens/AssistantScreen';
import BreaksScreen from './components/screens/BreaksScreen';
import StatsScreen from './components/screens/StatsScreen';
import SettingsScreen from './components/screens/SettingsScreen';
import LoginScreen from './components/screens/LoginScreen';
import SignupScreen from './components/screens/SignupScreen';
import AuthCallbackScreen from './components/screens/AuthCallbackScreen';
import BottomNav from './components/layout/BottomNav';
import useRouteStore from './stores/routeStore';
import useAuthStore from './stores/authStore';
import useBreakTimer from './hooks/useBreakTimer';
import useBreakStore from './stores/breakStore';

function App() {
  const [showSignup, setShowSignup] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const loadUserRoutes = useRouteStore((state: any) => state.loadUserRoutes);
  const checkAndResetDailyData = useRouteStore((state: any) => state.checkAndResetDailyData);
  const autoPopulateWaypointsIfNeeded = useRouteStore((state: any) => state.autoPopulateWaypointsIfNeeded);
  const { user, loading, error, initializeAuth } = useAuthStore();
  const currentRoute = useRouteStore((state: any) => state.currentRoute);
  const currentRouteId = useRouteStore((state: any) => state.currentRouteId);
  const routes = useRouteStore((state: any) => state.routes);
  const hasRoutes = Object.keys(routes || {}).length > 0;

  useBreakTimer();

  // Ensure break timers restore on refresh even if the user never opens the Timers tab.
  const breaksInitialized = useBreakStore((state: any) => state.initialized);
  const initializeBreaksFromDatabase = useBreakStore((state: any) => state.initializeFromDatabase);

  useEffect(() => {
    const authListener = initializeAuth();
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [initializeAuth]);

  useEffect(() => {
    if (user) {
      // Restore any running break timers (lunch/break/load truck) on app refresh.
      if (!breaksInitialized) {
        initializeBreaksFromDatabase();
      }

      checkAndResetDailyData();
      loadUserRoutes().then(() => {
        autoPopulateWaypointsIfNeeded();
      });
    }
  }, [user, breaksInitialized, initializeBreaksFromDatabase, loadUserRoutes, checkAndResetDailyData, autoPopulateWaypointsIfNeeded]);

  // Email confirmation / magic-link callback page.
  // We don't use a router, so we check the path directly.
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallbackScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-red-700 mb-2">Setup needed</h2>
          <p className="text-gray-700 text-sm whitespace-pre-line">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return showSignup ? (
      <SignupScreen onSwitchToLogin={() => setShowSignup(false)} />
    ) : (
      <LoginScreen onSwitchToSignup={() => setShowSignup(true)} />
    );
  }

  const renderScreen = () => {
    // Must set up at least one route first
    if (!hasRoutes || !currentRouteId) {
      return <RoutesScreen />;
    }

    switch (activeTab) {
      case 'today':
        return <TodayScreen />;
      case 'routes':
        return <RoutesScreen />;
      case 'waypoints':
        return <WaypointsScreen />;
      case 'history':
        return <WaypointHistoryScreen />;
      case 'street-time-history':
        return <StreetTimeHistoryScreen />;
      case 'timers':
        return <BreaksScreen />;
      case 'assistant':
        return <AssistantScreen />;
      case 'stats':
        return <StatsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <TodayScreen />;
    }
  };

  const requireRouteSetup = !hasRoutes || !currentRouteId;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white py-4 px-6 shadow-md">
        <div className="flex items-center gap-3">
          <img
            src="/routewise-icon.svg"
            alt="RouteWise"
            className="h-9 w-9"
          />
          <div className="min-w-0">
            <img
              src="/routewise-logo.svg"
              alt="RouteWise"
              className="h-7 w-auto"
            />
            <p className="text-sm text-blue-100 truncate">
              {requireRouteSetup ? 'Set up a route to get started' : `Route ${currentRoute}`}
            </p>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        {renderScreen()}
      </main>
      {!requireRouteSetup && (
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  );
}

export default App;