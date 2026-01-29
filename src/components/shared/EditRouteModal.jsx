import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import Input from './Input';

export default function EditRouteModal({ isOpen, onClose, onUpdateRoute, route }) {
  const [formData, setFormData] = useState({
    routeNumber: '',
    stops: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (route && isOpen) {
      setFormData({
        routeNumber: route.routeNumber || route.route_number || '',
        stops: route.stops ?? route.stops === 0 ? String(route.stops) : '',
      });
    }
  }, [route, isOpen]);

  if (!isOpen || !route) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.routeNumber.trim()) {
      setError('Route number is required');
      return;
    }

    let stops = null;
    if (String(formData.stops).trim() !== '') {
      const parsed = parseInt(formData.stops, 10);
      if (isNaN(parsed) || parsed < 0) {
        setError('# of stops must be a non-negative number');
        return;
      }
      stops = parsed;
    }

    setLoading(true);
    try {
      await onUpdateRoute(route.id, {
        routeNumber: formData.routeNumber.trim(),
        stops,
        // keep existing defaults on backend for now
        startTime: route.startTime || route.start_time || '07:30',
        tourLength: route.tourLength || route.tour_length || 8.5,
        lunchDuration: route.lunchDuration || route.lunch_duration || 30,
        comfortStopDuration: route.comfortStopDuration || route.comfort_stop_duration || 10,
      });

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update route');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Edit Route</h2>
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
              # of Stops (optional)
            </label>
            <Input
              type="number"
              value={formData.stops}
              onChange={(e) => setFormData({ ...formData, stops: e.target.value })}
              placeholder="e.g., 450"
              disabled={loading}
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
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
