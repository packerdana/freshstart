import { useState } from 'react';
import { formatMinutesAsTime } from '../../utils/time';
import Card from '../shared/Card';
import Input from '../shared/Input';
import Button from '../shared/Button';

export default function ForgotRouteDialog({
  routeStartTime, // "08:00" format
  predictedStreetMinutes,
  actualStreetMinutes, // From timer (may be inflated)
  onCorrect,
  onUseActual,
  onCancel
}) {
  const [routeEndTime, setRouteEndTime] = useState('');
  const [hasPmOffice, setHasPmOffice] = useState(false);
  const [pmOfficeMinutes, setPmOfficeMinutes] = useState('10');
  const [clockOutTime, setClockOutTime] = useState('');
  const [showError, setShowError] = useState('');

  const calculatePreview = () => {
    if (!routeEndTime) return null;

    // Parse route start time (e.g., "08:00")
    const [startHour, startMin] = routeStartTime.split(':').map(Number);
    
    // Parse route end time (e.g., "16:00")
    const [endHour, endMin] = routeEndTime.split(':').map(Number);
    
    // Calculate street time in minutes
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    let correctedStreetMinutes = endMinutes - startMinutes;

    if (correctedStreetMinutes < 0) {
      correctedStreetMinutes += 24 * 60; // Handle overnight (unlikely but possible)
    }

    // PM office time
    const pmMinutes = hasPmOffice ? (parseInt(pmOfficeMinutes) || 0) : 0;

    // Calculate total time
    const totalMinutes = correctedStreetMinutes + pmMinutes;

    return {
      streetMinutes: correctedStreetMinutes,
      pmMinutes,
      totalMinutes,
      startTime: routeStartTime,
      endTime: routeEndTime,
      clockOut: clockOutTime || 'Not specified'
    };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowError('');

    if (!routeEndTime) {
      setShowError('Please enter the time you finished your route');
      return;
    }

    const preview = calculatePreview();
    
    if (!preview) {
      setShowError('Invalid time calculation');
      return;
    }

    // Validation: Route end must be after route start
    const [startHour, startMin] = routeStartTime.split(':').map(Number);
    const [endHour, endMin] = routeEndTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      setShowError('Route end time must be after start time');
      return;
    }

    // Validation: If clock out provided, must be >= route end (+ PM office if applicable)
    if (clockOutTime) {
      const [clockHour, clockMin] = clockOutTime.split(':').map(Number);
      const clockMinutes = clockHour * 60 + clockMin;
      const expectedMinClockOut = endMinutes + preview.pmMinutes;

      if (clockMinutes < expectedMinClockOut) {
        setShowError('Clock out time must be after route end + PM office time');
        return;
      }
    }

    // Validation: Street time seems reasonable (> 0 and < 14 hours)
    if (preview.streetMinutes <= 0 || preview.streetMinutes > 14 * 60) {
      setShowError(`Street time (${formatMinutesAsTime(preview.streetMinutes)}) seems unreasonable`);
      return;
    }

    onCorrect({
      correctedStreetMinutes: preview.streetMinutes,
      routeEndTime,
      pmOfficeMinutes: preview.pmMinutes,
      clockOutTime: clockOutTime || null,
    });
  };

  const preview = calculatePreview();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">⚠️ Route Running Long</h2>
          <p className="text-sm text-gray-600 mb-4">
            Your route has been running for <span className="font-bold">{formatMinutesAsTime(actualStreetMinutes)}</span>,
            but was predicted to take <span className="font-bold">{formatMinutesAsTime(predictedStreetMinutes)}</span>.
          </p>
          <p className="text-sm font-semibold text-gray-900 mb-6">
            Did you forget to end your route earlier?
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Card className="bg-blue-50 border border-blue-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={true}
                  readOnly
                  className="w-5 h-5 text-blue-600"
                />
                <div>
                  <span className="font-semibold text-blue-900">I forgot to end my route earlier</span>
                  <p className="text-xs text-blue-700">Correct the route end time below</p>
                </div>
              </label>
            </Card>

            <Input
              label="Actual Route End Time *"
              type="time"
              value={routeEndTime}
              onChange={(e) => {
                setRouteEndTime(e.target.value);
                setShowError('');
              }}
              required
              helperText="What time did you actually finish your route?"
            />

            <Card className="bg-gray-50">
              <div className="mb-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPmOffice}
                    onChange={(e) => setHasPmOffice(e.target.checked)}
                    className="w-5 h-5 text-blue-600"
                  />
                  <span className="font-semibold text-gray-900">I did PM Office Time (744)</span>
                </label>
              </div>

              {hasPmOffice && (
                <Input
                  label="PM Office Minutes"
                  type="number"
                  value={pmOfficeMinutes}
                  onChange={(e) => setPmOfficeMinutes(e.target.value)}
                  min="0"
                  max="60"
                  placeholder="10"
                  helperText="How many minutes of PM office work?"
                />
              )}
            </Card>

            <Input
              label="Clock Out Time (Optional)"
              type="time"
              value={clockOutTime}
              onChange={(e) => setClockOutTime(e.target.value)}
              helperText="Your actual clock out time"
            />

            {preview && (
              <Card className="bg-green-50 border border-green-200">
                <h3 className="text-sm font-bold text-green-900 mb-3">📋 Preview</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">722 AM Office:</span>
                    <span className="font-semibold text-green-900">7:30 AM - {preview.startTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">721 Street:</span>
                    <span className="font-semibold text-green-900">
                      {preview.startTime} - {preview.endTime} ({formatMinutesAsTime(preview.streetMinutes)})
                    </span>
                  </div>
                  {hasPmOffice && preview.pmMinutes > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-700">744 PM Office:</span>
                      <span className="font-semibold text-green-900">{preview.pmMinutes} min</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-green-300 pt-2 mt-2">
                    <span className="text-green-700 font-bold">Total Tour:</span>
                    <span className="font-bold text-green-900">{formatMinutesAsTime(preview.totalMinutes)}</span>
                  </div>
                  {clockOutTime && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Clock Out:</span>
                      <span className="font-semibold text-green-900">{preview.clockOut}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {showError && (
              <Card className="bg-red-50 border border-red-200">
                <p className="text-red-700 text-sm font-semibold">⚠️ {showError}</p>
              </Card>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={onCancel}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onUseActual}
                variant="secondary"
                className="flex-1"
              >
                Use Timer
                <div className="text-xs">(No correction)</div>
              </Button>
              <Button
                type="submit"
                className="flex-1"
              >
                Correct & Save
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
