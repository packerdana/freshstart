import { useState, useEffect } from 'react';
import Card from './Card';
import Button from './Button';
import { offRouteService } from '../../services/offRouteService';
import useRouteStore from '../../stores/routeStore';

export default function WorkOffRouteModal({ onClose, onSessionChange }) {
  const currentRouteId = useRouteStore((state) => state.currentRouteId);
  
  const [stage, setStage] = useState('select');
  const [activityType, setActivityType] = useState(null);
  const [expectedDuration, setExpectedDuration] = useState(null);
  const [customDuration, setCustomDuration] = useState('');
  const [location, setLocation] = useState('');
  const [routeId, setRouteId] = useState('');
  const [timerActive, setTimerActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [promptShown2x, setPromptShown2x] = useState(false);
  const [offRouteSession, setOffRouteSession] = useState(null);
  const [completedSummary, setCompletedSummary] = useState(null);

  useEffect(() => {
    if (!timerActive) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive]);

  useEffect(() => {
    if (!timerActive || !expectedDuration) return;

    const expectedSeconds = expectedDuration * 60;

    if (elapsedTime >= expectedSeconds * 2 && !promptShown2x) {
      setPromptShown2x(true);
      setStage('prompt-2x');
      setTimerActive(false);
    } else if (elapsedTime >= expectedSeconds * 3) {
      setStage('auto-ended');
      setTimerActive(false);
    }
  }, [elapsedTime, expectedDuration, timerActive, promptShown2x]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSelectActivity = (type) => {
    setActivityType(type);
    setStage('set-duration');
  };

  const handleSetDuration = (duration) => {
    if (duration === 'custom') {
      setStage('custom-duration');
    } else {
      setExpectedDuration(duration);
      setStage('additional-info');
    }
  };

  const handleCustomDuration = () => {
    const duration = parseInt(customDuration);
    if (duration > 0) {
      setExpectedDuration(duration);
      setStage('additional-info');
    }
  };

  const handleStartActivity = async () => {
    try {
      if (!currentRouteId) {
        alert('No route selected. Please start your route first.');
        return;
      }

      const metadata = {};
      if (activityType === 'collections' && location) {
        metadata.location = location;
      } else if (activityType === 'relay' && routeId) {
        metadata.helping_route = routeId;
      }

      console.log('Starting off-route activity:', {
        type: activityType,
        duration: expectedDuration,
        routeId: currentRouteId,
        metadata
      });

      const result = await offRouteService.startOffRouteActivity(
        activityType,
        expectedDuration,
        currentRouteId,
        metadata
      );

      setOffRouteSession(result.offRouteSession);
      setStartTime(new Date(result.offRouteSession.start_time));
      setTimerActive(true);
      setElapsedTime(0);
      setStage('timer-active');

      console.log('✓ Off-route activity started:', result);
      
      if (onSessionChange) {
        onSessionChange();
      }
    } catch (error) {
      console.error('Error starting off-route activity:', error);
      alert(`Failed to start activity: ${error.message}`);
    }
  };

  const handleEndActivity = async () => {
    try {
      console.log('Ending off-route activity...');

      const result = await offRouteService.endOffRouteActivity();

      const ended = result?.endedOffRouteSession;
      const startedAt = ended?.start_time ? new Date(ended.start_time) : startTime;
      const endedAt = ended?.end_time ? new Date(ended.end_time) : new Date();
      const durationMinutes = Number(ended?.duration_minutes);

      setCompletedSummary({
        startedAt,
        endedAt,
        durationMinutes: Number.isFinite(durationMinutes) ? Math.round(durationMinutes) : Math.round(elapsedTime / 60),
        code: ended?.code || (activityType === 'collections' ? '732' : '736'),
        metadata: ended?.metadata || {},
      });

      setTimerActive(false);
      setStage('completed');

      console.log('✓ Off-route activity ended:', result);

      if (onSessionChange) {
        onSessionChange();
      }
    } catch (error) {
      console.error('Error ending off-route activity:', error);
      alert(`Failed to end activity: ${error.message}`);
    }
  };

  const handleExtend = () => {
    setExpectedDuration((prev) => prev + 10);
    setPromptShown2x(false);
    setTimerActive(true);
    setStage('timer-active');
  };

  const handleCorrectToExpected = async () => {
    try {
      await offRouteService.endOffRouteActivity();
      setElapsedTime(expectedDuration * 60);
      setStage('completed');
      
      if (onSessionChange) {
        onSessionChange();
      }
    } catch (error) {
      console.error('Error correcting activity:', error);
      alert(`Failed to correct activity: ${error.message}`);
    }
  };

  const handleEndNow = async () => {
    try {
      await offRouteService.endOffRouteActivity();
      setStage('completed');
      
      if (onSessionChange) {
        onSessionChange();
      }
    } catch (error) {
      console.error('Error ending activity:', error);
      alert(`Failed to end activity: ${error.message}`);
    }
  };

  // ✅ NEW: Prevent closing modal while timer is active
  const handleClose = () => {
    if (timerActive) {
      if (confirm('⚠️ WARNING: Off-route timer is still running!\n\nYou must END the activity before closing this window.\n\nClick OK to force stop the timer, or Cancel to go back.')) {
        // Force stop the timer
        handleEndActivity().then(() => {
          onClose();
        });
      }
      // Don't close if they clicked Cancel
      return;
    }
    
    // Safe to close - no active timer
    onClose();
  };

  if (stage === 'select') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Work Off Route</h2>
          <p className="text-sm text-gray-600 mb-2">Select activity:</p>
          <p className="text-xs text-blue-600 mb-4">
            ⏸️ This will pause your route timer (721)
          </p>

          <div className="space-y-3">
            <button
              onClick={() => handleSelectActivity('collections')}
              className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-left"
            >
              <div className="font-bold text-gray-900 mb-1">📬 COLLECTIONS (732)</div>
              <div className="text-sm text-gray-600">Empty blue boxes</div>
            </button>

            <button
              onClick={() => handleSelectActivity('relay')}
              className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-left"
            >
              <div className="font-bold text-gray-900 mb-1">📦 RELAY ASSISTANCE (736)</div>
              <div className="text-sm text-gray-600">Help another carrier</div>
            </button>
          </div>

          <button
            onClick={handleClose}
            className="w-full mt-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'set-duration') {
    const durations = [15, 20, 25, 30, 45];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {activityType === 'collections' ? 'Collections (732)' : 'Relay Assistance (736)'}
          </h2>
          <p className="text-sm text-gray-600 mb-6">How long do you expect this to take?</p>

          <div className="grid grid-cols-3 gap-3 mb-3">
            {durations.map((duration) => (
              <button
                key={duration}
                onClick={() => handleSetDuration(duration)}
                className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 font-semibold text-gray-900"
              >
                {duration} min
              </button>
            ))}
            <button
              onClick={() => handleSetDuration('custom')}
              className="p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 font-semibold text-gray-900"
            >
              Custom
            </button>
          </div>

          <button
            onClick={() => setStage('select')}
            className="w-full mt-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'custom-duration') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Custom Duration</h2>
          <p className="text-sm text-gray-600 mb-4">Expected minutes:</p>

          <input
            type="number"
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)}
            placeholder="35"
            className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            min="1"
          />

          <Button onClick={handleCustomDuration} className="w-full mb-2">
            ✅ SET DURATION
          </Button>

          <button
            onClick={() => setStage('set-duration')}
            className="w-full py-2 text-gray-600 hover:text-gray-800"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'additional-info') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {activityType === 'collections' ? 'Collections (732)' : 'Relay Assistance (736)'}
          </h2>

          {activityType === 'collections' ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location (optional):
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="5th & Main St"
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Helping Route (optional):
              </label>
              <input
                type="text"
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                placeholder="Route 017"
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>
          )}

          <Button onClick={handleStartActivity} className="w-full mb-2">
            ▶️ START {activityType === 'collections' ? 'COLLECTIONS' : 'RELAY'}
          </Button>

          <button
            onClick={() => setStage('set-duration')}
            className="w-full py-2 text-gray-600 hover:text-gray-800"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'timer-active') {
    const code = activityType === 'collections' ? '732' : '736';
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          {/* ✅ FIXED: Changed close behavior */}
          <button
            onClick={handleClose}
            className="text-blue-600 font-medium mb-6"
          >
            ← Back
          </button>

          <Card className="mb-6 bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200">
            <div className="text-center py-8">
              <div className="text-5xl mb-4">
                {activityType === 'collections' ? '📬' : '📦'}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {activityType === 'collections' ? 'COLLECTING' : 'HELPING CARRIER'}
              </h2>
              <div className="text-4xl font-bold text-orange-600 mb-2">
                {formatTime(elapsedTime)}
              </div>
              <p className="text-sm text-gray-600">(Timer counts UP)</p>
            </div>
          </Card>

          <Card className="mb-4 bg-blue-50 border border-blue-200">
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2 text-blue-700">
                <span>⏸️</span>
                <span>Route timer (721) PAUSED</span>
              </div>
              <div className="flex items-center gap-2 text-orange-700">
                <span>⏱️</span>
                <span>Off-route timer ({code}) ACTIVE</span>
              </div>
            </div>
          </Card>

          <div className="mb-4 text-sm text-gray-600">
            {activityType === 'collections' && location && (
              <p className="mb-1">Location: {location}</p>
            )}
            {activityType === 'relay' && routeId && (
              <p className="mb-1">Helping: {routeId}</p>
            )}
            <p>Started: {startTime?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
          </div>

          <Button onClick={handleEndActivity} className="w-full bg-green-600 hover:bg-green-700">
            ✅ END {activityType === 'collections' ? 'COLLECTIONS' : 'RELAY ASSISTANCE'}
          </Button>
          
          {/* ✅ NEW: Emergency force stop button */}
          <button
            onClick={() => {
              if (confirm('⚠️ Force stop this timer?\n\nThis will end the activity immediately.')) {
                handleEndActivity();
              }
            }}
            className="w-full mt-2 py-2 text-red-600 hover:text-red-800 text-sm font-medium"
          >
            🛑 Force Stop
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'prompt-2x') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            ⚠️ {activityType === 'collections' ? 'Collections' : 'Relay Assistance'} Running Long
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            You've been {activityType === 'collections' ? 'collecting' : 'helping'} for{' '}
            {Math.round(elapsedTime / 60)} minutes (expected {expectedDuration} min).
          </p>
          <p className="text-sm font-semibold text-gray-900 mb-6">Still working?</p>

          <div className="space-y-3">
            <Button onClick={handleExtend} className="w-full">
              ✅ YES, STILL WORKING
              <div className="text-xs">(Extend 10 minutes)</div>
            </Button>

            <Button onClick={handleCorrectToExpected} variant="secondary" className="w-full">
              ⏹️ NO, FORGOT TO END
              <div className="text-xs">(Set duration to {expectedDuration} min)</div>
            </Button>

            <Button onClick={handleEndNow} variant="secondary" className="w-full">
              🕐 END NOW
              <div className="text-xs">(Record actual {Math.round(elapsedTime / 60)} min)</div>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'auto-ended') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            🛑 {activityType === 'collections' ? 'Collections' : 'Relay Assistance'} Auto-Ended
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            This activity was automatically ended after {Math.round(elapsedTime / 60)} minutes
            (3x the expected {expectedDuration} minutes).
          </p>
          <p className="text-sm text-gray-600 mb-4">
            This activity has been flagged in your End of Day Report.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-700 mb-1">Recorded:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Start: {startTime?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</li>
              <li>• End: {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} (auto)</li>
              <li>• Duration: {Math.round(elapsedTime / 60)} minutes ⚠️</li>
            </ul>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            You can edit this in the End of Day Report if needed.
          </p>
          <Button onClick={handleClose} className="w-full">
            ✅ OK
          </Button>
        </div>
      </div>
    );
  }

  if (stage === 'completed') {
    const duration = completedSummary?.durationMinutes ?? Math.round(elapsedTime / 60);
    const code = completedSummary?.code || (activityType === 'collections' ? '732' : '736');

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {activityType === 'collections' ? 'Collections' : 'Relay Assistance'} Complete
          </h2>
          <div className="text-center py-4 mb-6">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-sm text-gray-600 mb-2">Recorded!</p>
            <p className="text-xs text-green-600">✓ Route timer (721) resumed</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            {activityType === 'collections' && location && (
              <p className="text-sm text-gray-700 mb-2">Location: {location}</p>
            )}
            {activityType === 'relay' && routeId && (
              <p className="text-sm text-gray-700 mb-2">Helped: {routeId}</p>
            )}
            <p className="text-sm text-gray-700 mb-1">
              Start: {(completedSummary?.startedAt || startTime)?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            <p className="text-sm text-gray-700 mb-1">
              End: {(completedSummary?.endedAt || new Date())?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            <p className="text-sm text-gray-700 mb-2">Duration: {duration} minutes</p>
            <p className="text-xs text-gray-500">
              Op Code {code} - {activityType === 'collections' ? 'Collections' : 'Relay Assistance'}
            </p>
          </div>

          <Button onClick={handleClose} className="w-full">
            ✅ DONE
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
