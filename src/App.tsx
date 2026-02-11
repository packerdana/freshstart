import { useEffect, useState } from 'react';
import TodayScreen from './components/screens/TodayScreen';
import RoutesScreen from './components/screens/RoutesScreen';
import WaypointsScreen from './components/screens/WaypointsScreen';
import StreetTimeHistoryScreen from './components/screens/StreetTimeHistoryScreen';
import AssistantScreen from './components/screens/AssistantScreen';
import BreaksScreen from './components/screens/BreaksScreen';
import StatsScreen from './components/screens/StatsScreen';
import SettingsScreen from './components/screens/SettingsScreen';
import LoginScreen from './components/screens/LoginScreen';
import SignupScreen from './components/screens/SignupScreen';
import AuthCallbackScreen from './components/screens/AuthCallbackScreen';
import BottomNav from './components/layout/BottomNav';
import Button from './components/shared/Button';
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

  // Break/Load Truck overrun nudges (prevents bad data when timers are left running)
  const breakActive = useBreakStore((state: any) => state.breakActive);
  const breakType = useBreakStore((state: any) => state.breakType);
  const breakStartTime = useBreakStore((state: any) => state.breakStartTime);
  const breakTime = useBreakStore((state: any) => state.breakTime);
  const endBreak = useBreakStore((state: any) => state.endBreak);
  const breakNudgeSnoozedUntil = useBreakStore((state: any) => state.breakNudgeSnoozedUntil);
  const snoozeBreakNudge = useBreakStore((state: any) => state.snoozeBreakNudge);

  const loadTruckActive = useBreakStore((state: any) => state.loadTruckActive);
  const loadTruckStartTime = useBreakStore((state: any) => state.loadTruckStartTime);
  const loadTruckTime = useBreakStore((state: any) => state.loadTruckTime);
  const loadTruckPackageCount = useBreakStore((state: any) => state.loadTruckPackageCount);
  const getExpectedLoadTime = useBreakStore((state: any) => state.getExpectedLoadTime);
  const loadTruckNudgeSnoozedUntil = useBreakStore((state: any) => state.loadTruckNudgeSnoozedUntil);
  const snoozeLoadTruckNudge = useBreakStore((state: any) => state.snoozeLoadTruckNudge);

  const [breakNudgeVisible, setBreakNudgeVisible] = useState(false);
  const [loadTruckNudgeVisible, setLoadTruckNudgeVisible] = useState(false);
  const [expectedLoadSeconds, setExpectedLoadSeconds] = useState<number | null>(null);


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

  // Show a nudge if a count-up break timer has been running too long.
  useEffect(() => {
    const now = Date.now();
    const snoozed = breakNudgeSnoozedUntil && now < breakNudgeSnoozedUntil;

    if (!breakActive || !breakType || !breakStartTime || breakType.countDown || snoozed) {
      setBreakNudgeVisible(false);
      return;
    }

    const elapsedSeconds = Math.floor((Date.now() - breakStartTime) / 1000);
    const overrun = elapsedSeconds >= 15 * 60;
    setBreakNudgeVisible(overrun);
  }, [breakActive, breakType, breakStartTime, breakNudgeSnoozedUntil, breakTime]);

  // Load Truck nudge uses expected load time estimate (not a fixed threshold).
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!loadTruckActive || !loadTruckPackageCount) {
        setExpectedLoadSeconds(null);
        return;
      }
      try {
        const sec = await getExpectedLoadTime(loadTruckPackageCount);
        if (!cancelled) setExpectedLoadSeconds(Number(sec) || null);
      } catch {
        if (!cancelled) setExpectedLoadSeconds(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [loadTruckActive, loadTruckPackageCount, getExpectedLoadTime]);

  useEffect(() => {
    const now = Date.now();
    const snoozed = loadTruckNudgeSnoozedUntil && now < loadTruckNudgeSnoozedUntil;

    if (!loadTruckActive || !loadTruckStartTime || !expectedLoadSeconds || snoozed) {
      setLoadTruckNudgeVisible(false);
      return;
    }

    const elapsed = Math.floor((Date.now() - loadTruckStartTime) / 1000);
    const threshold = Math.floor(Number(expectedLoadSeconds) * 1.5);
    setLoadTruckNudgeVisible(elapsed >= threshold);
  }, [loadTruckActive, loadTruckStartTime, expectedLoadSeconds, loadTruckNudgeSnoozedUntil, loadTruckTime]);

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
        {breakNudgeVisible && breakType && (
          <div className="mx-4 mt-3 mb-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900 truncate">
                  {breakType.label} timer has been running a while
                </p>
                <p className="text-xs text-amber-800">
                  If you forgot to stop it, you can end it and correct the minutes so your data stays clean.
                </p>
              </div>
              <button
                className="text-amber-900 text-sm px-2"
                onClick={() => snoozeBreakNudge(10)}
                aria-label="Snooze break nudge"
                title="Snooze"
              >
                Snooze
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setActiveTab('timers');
                }}
              >
                Open Timers
              </Button>
              <Button
                className="w-full"
                onClick={async () => {
                  // Prompt correction inline (same logic as Timers screen)
                  let overrideMinutes: number | null = null;
                  try {
                    const computedMins = Math.round(
                      Math.max(0, (Date.now() - Number(breakStartTime || 0)) / 1000 / 60)
                    );
                    const input = prompt(
                      `How many minutes was your ${breakType.label} break?`,
                      String(computedMins)
                    );
                    if (input === null) return;
                    overrideMinutes = Math.max(0, Math.round(Number(input) || 0));
                  } catch {
                    // ignore
                  }
                  await endBreak(overrideMinutes);
                }}
              >
                End + Correct
              </Button>
            </div>
          </div>
        )}

        {loadTruckNudgeVisible && (
          <div className="mx-4 mt-3 mb-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-yellow-900 truncate">
                  Load Truck is taking longer than expected
                </p>
                <p className="text-xs text-yellow-800">
                  Based on your package count, you’re past the expected load time.
                </p>
              </div>
              <button
                className="text-yellow-900 text-sm px-2"
                onClick={() => snoozeLoadTruckNudge(10)}
                aria-label="Snooze load truck nudge"
                title="Snooze"
              >
                Snooze
              </button>
            </div>
            <div className="mt-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setActiveTab('timers')}
              >
                Open Load Truck Timer
              </Button>
            </div>
          </div>
        )}

        {renderScreen()}
      </main>
      {!requireRouteSetup && (
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  );
}

export default App;