import { useState } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import Input from './Input';

export default function CreateRouteModal({ isOpen, onClose, onCreateRoute }) {
  const [formData, setFormData] = useState({
    routeNumber: '',
    startTime: '07:30',
    tourLength: '8.5',
    lunchDuration: '30',
    comfortStopDuration: '10',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.routeNumber.trim()) {
      setError('Route number is required');
      return;
    }

    const tourLength = parseFloat(formData.tourLength);
    if (isNaN(tourLength) || tourLength <= 0) {
      setError('Tour length must be a positive number');
      return;
    }

    const lunchDuration = parseInt(formData.lunchDuration);
    if (isNaN(lunchDuration) || lunchDuration < 0) {
      setError('Lunch duration must be a non-negative number');
      return;
    }

    const comfortStopDuration = parseInt(formData.comfortStopDuration);
    if (isNaN(comfortStopDuration) || comfortStopDuration < 0) {
      setError('Comfort stop duration must be a non-negative number');
      return;
    }

    setLoading(true);
    try {
      await onCreateRoute({
        routeNumber: formData.routeNumber.trim(),
        startTime: formData.startTime,
        tourLength,
        lunchDuration,
        comfortStopDuration,
      });

      setFormData({
        routeNumber: '',
        startTime: '07:30',
        tourLength: '8.5',
        lunchDuration: '30',
        comfortStopDuration: '10',
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create route');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        routeNumber: '',
        startTime: '07:30',
        tourLength: '8.5',
        lunchDuration: '30',
        comfortStopDuration: '10',
      });
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Create New Route</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Route Number
            </label>
            <Input
              type="text"
              value={formData.routeNumber}
              onChange={(e) => setFormData({ ...formData, routeNumber: e.target.value })}
              placeholder="e.g., 1234"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Time
            </label>
            <Input
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tour Length (hours)
            </label>
            <Input
              type="number"
              step="0.1"
              value={formData.tourLength}
              onChange={(e) => setFormData({ ...formData, tourLength: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lunch Duration (minutes)
            </label>
            <Input
              type="number"
              value={formData.lunchDuration}
              onChange={(e) => setFormData({ ...formData, lunchDuration: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comfort Stop Duration (minutes)
            </label>
            <Input
              type="number"
              value={formData.comfortStopDuration}
              onChange={(e) => setFormData({ ...formData, comfortStopDuration: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={handleClose}
              variant="secondary"
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Route'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
