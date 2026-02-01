import { useState } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import Input from './Input';

export default function CreateRouteModal({ isOpen, onClose, onCreateRoute }) {
  const [formData, setFormData] = useState({
    routeNumber: '',
    routeType: 'mixed',
    startTime: '07:30',
    stops: '', // optional
    baseParcels: '', // optional
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

    let stops = null;
    if (String(formData.stops).trim() !== '') {
      const parsed = parseInt(formData.stops, 10);
      if (isNaN(parsed) || parsed < 0) {
        setError('# of stops must be a non-negative number');
        return;
      }
      stops = parsed;
    }

    let baseParcels = null;
    if (String(formData.baseParcels).trim() !== '') {
      const parsed = parseInt(formData.baseParcels, 10);
      if (isNaN(parsed) || parsed < 0) {
        setError('Base parcels must be a non-negative number');
        return;
      }
      baseParcels = parsed;
    }

    setLoading(true);
    try {
      await onCreateRoute({
        routeNumber: formData.routeNumber.trim(),
        routeType: formData.routeType,
        startTime: formData.startTime,
        stops,
        baseParcels,
        // defaults for now
        tourLength: 8.5,
        lunchDuration: 30,
        comfortStopDuration: 10,
      });

      setFormData({
        routeNumber: '',
        routeType: 'mixed',
        startTime: '07:30',
        stops: '',
        baseParcels: '',
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
        routeType: 'mixed',
        startTime: '07:30',
        stops: '',
        baseParcels: '',
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
          <p className="text-sm text-gray-600">
            First, create at least one route. If you’re a swing/CCA/unassigned regular, you can add multiple routes.
          </p>
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
              placeholder="e.g., C12"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Route Type
            </label>
            <select
              value={formData.routeType}
              onChange={(e) => setFormData({ ...formData, routeType: e.target.value })}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="mixed">Mixed</option>
              <option value="mounted">Mounted</option>
              <option value="walking">Walking</option>
            </select>
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
              # of Stops (optional)
            </label>
            <Input
              type="number"
              value={formData.stops}
              onChange={(e) => setFormData({ ...formData, stops: e.target.value })}
              placeholder="e.g., 450"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              If you’re not sure, leave it blank.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Base Parcels (optional)
            </label>
            <Input
              type="number"
              value={formData.baseParcels}
              onChange={(e) => setFormData({ ...formData, baseParcels: e.target.value })}
              placeholder="e.g., 35"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              If known, RouteWise can use this to suggest “Parcels over base” as a 3996 reason.
            </p>
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
