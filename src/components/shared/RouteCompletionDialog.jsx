import { useState } from 'react';
import { formatMinutesAsTime } from '../../utils/time';
import Card from './Card';
import Input from './Input';
import Button from './Button';

export default function RouteCompletionDialog({
  prediction,
  todayInputs,
  calculatedStreetTime = null,
  initialAuxiliaryAssistance = false,
  initialAssistanceMinutes = 0,
  onComplete,
  onCancel
}) {
  // FIXED: Keep street time in MINUTES and convert to hours/minutes for display
  const initialMinutes = calculatedStreetTime || 0;
  const initialHours = Math.floor(initialMinutes / 60);
  const initialMins = Math.round(initialMinutes % 60);
  
  const [streetTimeHours, setStreetTimeHours] = useState(initialHours.toString());
  const [streetTimeMinutes, setStreetTimeMinutes] = useState(initialMins.toString());
  const [actualClockOut, setActualClockOut] = useState('');
  const [auxiliaryAssistance, setAuxiliaryAssistance] = useState(!!initialAuxiliaryAssistance);
  const [assistanceMinutes, setAssistanceMinutes] = useState(String(initialAssistanceMinutes || ''));
  const [mailNotDelivered, setMailNotDelivered] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowError(false);

    // Convert hours and minutes to total minutes
    const hours = parseInt(streetTimeHours) || 0;
    const mins = parseInt(streetTimeMinutes) || 0;
    const totalStreetMinutes = (hours * 60) + mins;

    // VALIDATION: Hard limits to prevent unrealistic data entry
    const MAX_STREET_TIME = 720; // 12 hours
    const MAX_PM_OFFICE = 60; // 1 hour
    const MAX_AM_OFFICE = 180; // 3 hours

    const validationWarnings = [];

    // Check street time
    if (totalStreetMinutes <= 0) {
      setShowError(true);
      return;
    }
    if (totalStreetMinutes > MAX_STREET_TIME) {
      validationWarnings.push(
        `⚠️ Street time ${hours}h ${mins}m (${totalStreetMinutes} min) exceeds 12-hour limit.\n`
      );
    }

    // Check PM office time from prediction
    if (prediction && prediction.pmOfficeTime) {
      const pmOffice = Math.round(prediction.pmOfficeTime);
      if (pmOffice > MAX_PM_OFFICE) {
        validationWarnings.push(
          `⚠️ PM Office time ${pmOffice}m exceeds 1-hour limit.\n`
        );
      }
    }

    // Check AM office time from prediction
    if (prediction && prediction.officeTime) {
      const amOffice = Math.round(prediction.officeTime);
      if (amOffice > MAX_AM_OFFICE) {
        validationWarnings.push(
          `⚠️ AM Office time ${amOffice}m exceeds 3-hour limit.\n`
        );
      }
    }

    // If there are validation warnings, ask user to confirm
    if (validationWarnings.length > 0) {
      const message = `Data validation warnings:\n\n${validationWarnings.join('')}\nThese values will be REJECTED by the system.\n\nPlease fix them before saving.`;
      alert(message);
      return;
    }

    setLoading(true);

    try {
      await onComplete({
        streetTime: totalStreetMinutes,
        actualClockOut,
        auxiliaryAssistance,
        assistanceMinutes: auxiliaryAssistance ? (parseInt(assistanceMinutes) || 0) : 0,
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">End Tour</h2>
          <p className="text-sm text-gray-600 mb-6">
            Record your actual route completion data for better future predictions
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {prediction && prediction.streetTime && prediction.clockOutTime && (
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Actual Street Time *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    label="Hours"
                    type="number"
                    value={streetTimeHours}
                    onChange={(e) => {
                      setStreetTimeHours(e.target.value);
                      setShowError(false);
                    }}
                    placeholder="0"
                    min="0"
                    max="12"
                    className={showError ? 'border-red-500' : ''}
                  />
                </div>
                <div>
                  <Input
                    label="Minutes"
                    type="number"
                    value={streetTimeMinutes}
                    onChange={(e) => {
                      setStreetTimeMinutes(e.target.value);
                      setShowError(false);
                    }}
                    placeholder="0"
                    min="0"
                    max="59"
                    className={showError ? 'border-red-500' : ''}
                  />
                </div>
              </div>
              {calculatedStreetTime > 0 ? (
                <p className="text-green-600 text-xs mt-2 flex items-center gap-1">
                  <span>✓</span> Auto-ended and calculated from 721 timer: {Math.floor(calculatedStreetTime / 60)}h {Math.round(calculatedStreetTime % 60)}m
                </p>
              ) : (
                <p className="text-blue-600 text-xs mt-2">
                  REQUIRED: Enter the actual time spent on the street (manual backup)
                </p>
              )}
              {calculatedStreetTime > 0 && (
                <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                  <span>✓</span> Street time was automatically stopped when completing route
                </p>
              )}
              {showError && (
                <p className="text-red-600 text-sm mt-1 font-semibold">
                  ⚠ Street time is required! Please enter your actual street time.
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
                  <span className="font-semibold text-gray-900">Assistance / Gave Away Part of Route</span>
                  <p className="text-xs text-gray-600">I got help or gave away part of my route (don’t use this day for clean averages)</p>
                </div>
              </label>

              {auxiliaryAssistance && (
                <Input
                  label="Minutes given away / assisted"
                  type="number"
                  value={assistanceMinutes}
                  onChange={(e) => setAssistanceMinutes(e.target.value)}
                  placeholder="60"
                  min="0"
                  helperText="Optional: estimate how many minutes you gave away or received"
                />
              )}

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
                {loading ? 'Saving...' : 'End Tour'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
