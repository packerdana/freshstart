import { useState, useEffect } from 'react';
import Card from './Card';
import Button from './Button';

export default function WorkOffRouteModal({ onClose }) {
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

  const handleStartActivity = () => {
    setStartTime(new Date());
    setTimerActive(true);
    setElapsedTime(0);
    setStage('timer-active');
  };

  const handleEndActivity = () => {
    setTimerActive(false);
    setStage('completed');
  };

  const handleExtend = () => {
    setExpectedDuration((prev) => prev + 10);
    setPromptShown2x(false);
    setTimerActive(true);
    setStage('timer-active');
  };

  const handleCorrectToExpected = () => {
    setElapsedTime(expectedDuration * 60);
    setStage('completed');
  };

  const handleEndNow = () => {
    setStage('completed');
  };

  if (stage === 'select') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Work Off Route</h2>
          <p className="text-sm text-gray-600 mb-6">Select activity:</p>

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
            onClick={onClose}
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
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to cancel?')) {
                onClose();
              }
            }}
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

          <div className="mb-4 text-sm text-gray-600">
            {activityType === 'collections' && location && (
              <p className="mb-1">Location: {location}</p>
            )}
            {activityType === 'relay' && routeId && (
              <p className="mb-1">Helping: {routeId}</p>
            )}
            <p>Started: {startTime?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
          </div>

          <Button onClick={handleEndActivity} className="w-full">
            ✅ END {activityType === 'collections' ? 'COLLECTIONS' : 'RELAY ASSISTANCE'}
          </Button>
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
          <Button onClick={onClose} className="w-full">
            ✅ OK
          </Button>
        </div>
      </div>
    );
  }

  if (stage === 'completed') {
    const duration = Math.round(elapsedTime / 60);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {activityType === 'collections' ? 'Collections' : 'Relay Assistance'} Complete
          </h2>
          <div className="text-center py-4 mb-6">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-sm text-gray-600 mb-2">Recorded!</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            {activityType === 'collections' && location && (
              <p className="text-sm text-gray-700 mb-2">Location: {location}</p>
            )}
            {activityType === 'relay' && routeId && (
              <p className="text-sm text-gray-700 mb-2">Helped: {routeId}</p>
            )}
            <p className="text-sm text-gray-700 mb-1">
              Start: {startTime?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            <p className="text-sm text-gray-700 mb-1">
              End: {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            <p className="text-sm text-gray-700 mb-2">Duration: {duration} minutes</p>
            <p className="text-xs text-gray-500">
              Op Code {activityType === 'collections' ? '732' : '736'} - {activityType === 'collections' ? 'Collections' : 'Relay Assistance'}
            </p>
          </div>

          <Button onClick={onClose} className="w-full">
            ✅ DONE
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
