import { useEffect, useState } from 'react';
import TodayScreen from './components/screens/TodayScreen';
import RoutesScreen from './components/screens/RoutesScreen';
import WaypointsScreen from './components/screens/WaypointsScreen';
import BreaksScreen from './components/screens/BreaksScreen';
import StatsScreen from './components/screens/StatsScreen';
import SettingsScreen from './components/screens/SettingsScreen';
import LoginScreen from './components/screens/LoginScreen';
import SignupScreen from './components/screens/SignupScreen';
import BottomNav from './components/layout/BottomNav';
import useRouteStore from './stores/routeStore';
import useAuthStore from './stores/authStore';
import useBreakTimer from './hooks/useBreakTimer';

function App() {
  const [showSignup, setShowSignup] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const loadUserRoutes = useRouteStore((state) => state.loadUserRoutes);
  const checkAndResetDailyData = useRouteStore((state) => state.checkAndResetDailyData);
  const { user, loading, initializeAuth } = useAuthStore();
  const currentRoute = useRouteStore((state) => state.currentRoute);

  useBreakTimer();

  useEffect(() => {
    const authListener = initializeAuth();
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [initializeAuth]);

  useEffect(() => {
    if (user) {
      checkAndResetDailyData();
      loadUserRoutes();
    }
  }, [user, loadUserRoutes, checkAndResetDailyData]);

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
    switch (activeTab) {
      case 'today':
        return <TodayScreen />;
      case 'routes':
        return <RoutesScreen />;
      case 'waypoints':
        return <WaypointsScreen />;
      case 'timers':
        return <BreaksScreen />;
      case 'stats':
        return <StatsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <TodayScreen />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white py-4 px-6 shadow-md">
        <h1 className="text-xl font-bold">RouteWise</h1>
        <p className="text-sm text-blue-100">Route {currentRoute}</p>
      </header>

      <main className="flex-1 overflow-auto">
        {renderScreen()}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
