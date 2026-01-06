import { useState } from 'react';
import { formatMinutesAsTime } from '../../utils/time';
import Card from './Card';
import Input from './Input';
import Button from './Button';

export default function RouteCompletionDialog({
  prediction,
  todayInputs,
  calculatedStreetTime = null,
  onComplete,
  onCancel
}) {
  const [streetTime, setStreetTime] = useState(calculatedStreetTime ? (calculatedStreetTime / 60).toFixed(2) : '');
  const [actualClockOut, setActualClockOut] = useState('');
  const [auxiliaryAssistance, setAuxiliaryAssistance] = useState(false);
  const [mailNotDelivered, setMailNotDelivered] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowError(false);

    if (!streetTime || parseFloat(streetTime) <= 0) {
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      const streetTimeMinutes = parseFloat(streetTime) * 60;

      await onComplete({
        streetTime: streetTimeMinutes,
        actualClockOut,
        auxiliaryAssistance,
        mailNotDelivered,
        notes: notes.trim() || null,
      });
    } catch (error) {
      console.error('Error completing route:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        full: error
      });
      alert(`Failed to save route data: ${error.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Route</h2>
          <p className="text-sm text-gray-600 mb-6">
            Record your actual route completion data for better future predictions
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {prediction && (
              <Card className="bg-blue-50 border border-blue-200">
                <h3 className="text-sm font-bold text-blue-900 mb-3">Predicted vs. Actual</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Predicted Street Time:</span>
                    <span className="font-semibold text-blue-900">
                      {formatMinutesAsTime(Math.round(prediction.streetTime))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Predicted Clock Out:</span>
                    <span className="font-semibold text-blue-900">
                      {prediction.clockOutTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            <div>
              <Input
                label="Actual Street Time (hours) *"
                type="number"
                value={streetTime}
                onChange={(e) => {
                  setStreetTime(e.target.value);
                  setShowError(false);
                }}
                placeholder="4.5"
                step="0.01"
                min="0.1"
                max="12"
                helperText={calculatedStreetTime
                  ? `Auto-calculated from timer: ${(calculatedStreetTime / 60).toFixed(2)} hours`
                  : "REQUIRED: Enter the actual time spent on the street in hours"
                }
                className={showError ? 'border-red-500' : ''}
              />
              {showError && (
                <p className="text-red-600 text-sm mt-1 font-semibold">
                  ⚠ Street time is required! Please enter your actual street time in hours.
                </p>
              )}
            </div>

            <Input
              label="Actual Clock Out Time"
              type="time"
              value={actualClockOut}
              onChange={(e) => setActualClockOut(e.target.value)}
              helperText="Optional: Your actual clock out time"
            />

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={auxiliaryAssistance}
                  onChange={(e) => setAuxiliaryAssistance(e.target.checked)}
                  className="w-5 h-5 text-blue-600"
                />
                <div>
                  <span className="font-semibold text-gray-900">Auxiliary Assistance</span>
                  <p className="text-xs text-gray-600">I received help from another carrier</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={mailNotDelivered}
                  onChange={(e) => setMailNotDelivered(e.target.checked)}
                  className="w-5 h-5 text-blue-600"
                />
                <div>
                  <span className="font-semibold text-gray-900">Mail Not Delivered</span>
                  <p className="text-xs text-gray-600">I brought mail back to the office</p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about today's route..."
                rows="3"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={onCancel}
                variant="secondary"
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Complete Route'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
