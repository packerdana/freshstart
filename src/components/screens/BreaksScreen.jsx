import { Coffee, Clock, Coffee as BreakIcon, Truck } from 'lucide-react';
import { useState, useEffect } from 'react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import Input from '../shared/Input';
import useBreakStore from '../../stores/breakStore';
import useRouteStore from '../../stores/routeStore';
import useAuthStore from '../../stores/authStore';

export default function BreaksScreen() {
  const lunchActive = useBreakStore((state) => state.lunchActive);
  const lunchTime = useBreakStore((state) => state.lunchTime);
  const breakActive = useBreakStore((state) => state.breakActive);
  const breakTime = useBreakStore((state) => state.breakTime);
  const breakType = useBreakStore((state) => state.breakType);
  const todaysBreaks = useBreakStore((state) => state.todaysBreaks);

  const loadTruckActive = useBreakStore((state) => state.loadTruckActive);
  const loadTruckTime = useBreakStore((state) => state.loadTruckTime);
  const loadTruckPackageCount = useBreakStore((state) => state.loadTruckPackageCount);
  const loadTruckWarning = useBreakStore((state) => state.loadTruckWarning);

  const startLunch = useBreakStore((state) => state.startLunch);
  const endLunch = useBreakStore((state) => state.endLunch);
  const startBreak = useBreakStore((state) => state.startBreak);
  const endBreak = useBreakStore((state) => state.endBreak);
  const cancelBreak = useBreakStore((state) => state.cancelBreak);
  const startLoadTruck = useBreakStore((state) => state.startLoadTruck);
  const endLoadTruck = useBreakStore((state) => state.endLoadTruck);
  const getExpectedLoadTime = useBreakStore((state) => state.getExpectedLoadTime);
  const loadSmartLoadHistory = useBreakStore((state) => state.loadSmartLoadHistory);
  
  // ADDED: Get initialization function and status
  const initialized = useBreakStore((state) => state.initialized);
  const initializeFromDatabase = useBreakStore((state) => state.initializeFromDatabase);

  const routeStarted = useRouteStore((state) => state.routeStarted);
  const user = useAuthStore((state) => state.user);

  const [packageCount, setPackageCount] = useState('');
  const [expectedMins, setExpectedMins] = useState(null);

  // ADDED: Initialize break timers from database on mount (restores timers after minimize)
  useEffect(() => {
    if (!initialized) {
      console.log('Initializing break timers from database...');
      initializeFromDatabase();
    }
  }, [initialized, initializeFromDatabase]);

  useEffect(() => {
    if (user?.id) {
      loadSmartLoadHistory(user.id);
    }
  }, [user?.id, loadSmartLoadHistory]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const breakTypes = [
    { id: 'bathroom', label: 'Bathroom', icon: '🚻', countDown: false },
    { id: 'vehicle', label: 'Vehicle', icon: '🔧', countDown: false },
    { id: 'phone', label: 'Phone', icon: '📞', countDown: false },
    { id: 'customer', label: 'Customer', icon: '🚶', countDown: false },
    { id: 'break', label: 'Break', icon: '☕', countDown: true, duration: 10 * 60 },
    { id: 'other', label: 'Other', icon: '⏸️', countDown: false },
  ];

  const handleStartLoadTruck = () => {
    const count = parseInt(packageCount, 10);
    if (startLoadTruck(count)) {
      setPackageCount('');
    }
  };

  const handleEndLoadTruck = async () => {
    // ADDED: Pass routeStore so loading time can be saved for 721 street time
    await endLoadTruck(user?.id, useRouteStore);
  };

  useEffect(() => {
    if (loadTruckActive && loadTruckPackageCount > 0) {
      getExpectedLoadTime(loadTruckPackageCount).then(time => {
        setExpectedMins(Math.floor(time / 60));
      });
    }
  }, [loadTruckActive, loadTruckPackageCount, getExpectedLoadTime]);

  if (loadTruckActive) {

    return (
      <div className="p-4 max-w-2xl mx-auto pb-20">
        <button
          onClick={() => {
            if (confirm('Are you sure you want to cancel loading?')) {
              handleEndLoadTruck();
            }
          }}
          className="text-blue-600 font-medium mb-6"
        >
          ← Back
        </button>

        <Card className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🚚</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">LOADING TRUCK</h2>
            <div className="text-5xl font-bold text-green-600 mb-4">
              {formatTime(loadTruckTime)}
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Loading {loadTruckPackageCount} packages
            </p>
            {expectedMins !== null && (
              <p className="text-xs text-gray-500">
                Expected: ~{expectedMins} minutes
              </p>
            )}
          </div>
        </Card>

        {loadTruckWarning && (
          <Card className="mb-4 bg-yellow-50 border-2 border-yellow-400">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <p className="font-semibold text-yellow-900">Extended Loading Time</p>
                <p className="text-sm text-yellow-800">
                  Loading is taking 50% longer than expected
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card className="mb-4">
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span>⏱️</span>
              <span>Loading time will be included in street time (Code 721)</span>
            </div>
            <div className="flex items-center gap-2">
              <span>📝</span>
              <span>Will backdate 721 start when you click "Start Route"</span>
            </div>
          </div>
        </Card>

        <Button onClick={handleEndLoadTruck} className="w-full bg-green-600 hover:bg-green-700">
          ✅ FINISH LOADING
        </Button>
      </div>
    );
  }

  if (breakActive && breakType) {
    return (
      <div className="p-4 max-w-2xl mx-auto pb-20">
        <button
          onClick={() => {
            if (confirm('Are you sure you want to cancel this break?')) {
              cancelBreak();
            }
          }}
          className="text-blue-600 font-medium mb-6"
        >
          ← Back
        </button>

        <Card className="mb-6 bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">{breakType.icon}</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {breakType.countDown ? breakType.label.toUpperCase() : `${breakType.label.toUpperCase()} TIMER`}
            </h2>
            <div className="text-5xl font-bold text-orange-600 mb-4">
              {formatTime(breakTime)}
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {breakType.countDown ? 'Auto-stops at 00:00' : 'Timer counting up'}
            </p>
            <p className="text-sm font-semibold text-gray-700">Type: {breakType.label}</p>
          </div>
        </Card>

        <Card className="mb-4">
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span>⏸️</span>
              <span>Waypoint timers paused</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏱️</span>
              <span>Route clock still running</span>
            </div>
          </div>
        </Card>

        <Button onClick={endBreak} className="w-full">
          ✅ {breakType.countDown ? 'END BREAK EARLY' : 'END TIMER'}
        </Button>
      </div>
    );
  }

  if (lunchActive) {
    return (
      <div className="p-4 max-w-2xl mx-auto pb-20">
        <button
          onClick={() => {
            if (confirm('Are you sure you want to end lunch early?')) {
              endLunch();
            }
          }}
          className="text-blue-600 font-medium mb-6"
        >
          ← Back
        </button>

        <Card className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🍔</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">LUNCH BREAK</h2>
            <div className="text-5xl font-bold text-blue-600 mb-4">
              {formatTime(lunchTime)}
            </div>
            <p className="text-sm text-gray-600">Auto-stops at 00:00</p>
          </div>
        </Card>

        <Card className="mb-4">
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span>⏸️</span>
              <span>Waypoint timers paused</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⏸️</span>
              <span>Route timer paused</span>
            </div>
          </div>
        </Card>

        <Button onClick={endLunch} variant="secondary" className="w-full">
          End Lunch Early
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-20">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Breaks & Timers</h2>
        <p className="text-sm text-gray-500">Optional timers to help track your breaks</p>
      </div>

      {!routeStarted && (
        <Card className="mb-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">🚚</div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">LOAD TRUCK TIMER</h3>
              <p className="text-sm text-gray-600">Track pre-route loading time</p>
              <p className="text-xs text-gray-500">Time will be included in 721 street time</p>
            </div>
          </div>
          <div className="space-y-3">
            <Input
              label="Package Count"
              type="number"
              min="1"
              placeholder="Enter total packages"
              value={packageCount}
              onChange={(e) => setPackageCount(e.target.value)}
            />
            <Button
              onClick={handleStartLoadTruck}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={!packageCount || parseInt(packageCount, 10) <= 0}
            >
              Start Loading Timer
            </Button>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl">🍔</div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">LUNCH BREAK</h3>
            <p className="text-sm text-gray-600">30 minute countdown</p>
            <p className="text-xs text-gray-500">Auto-stops, pauses route</p>
          </div>
        </div>
        <Button onClick={startLunch} className="w-full">
          Start Lunch
        </Button>
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl">⏸️</div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">BREAK TIMERS</h3>
            <p className="text-sm text-gray-600">Break: 10 min countdown | Others: count up</p>
            <p className="text-xs text-gray-500">Pauses waypoints, route keeps running</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {breakTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => startBreak(type)}
              className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            >
              <span className="text-2xl mb-1">{type.icon}</span>
              <span className="text-xs font-medium text-gray-700">{type.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {todaysBreaks.length > 0 && (
        <Card>
          <h3 className="font-bold text-gray-900 mb-3">Today's Breaks:</h3>
          <div className="space-y-2">
            {todaysBreaks.map((breakItem, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <span className="text-xl">{breakItem.icon}</span>
                <span className="font-medium text-gray-700">{breakItem.type}:</span>
                <span className="text-gray-600">{breakItem.time}</span>
                <span className="text-gray-600">({breakItem.duration})</span>
                {breakItem.packages && (
                  <span className="text-xs text-gray-500 ml-auto">
                    📦 {breakItem.packages} pkgs
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
