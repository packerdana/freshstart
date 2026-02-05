import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import Input from './Input';

export default function AddWaypointModal({ isOpen, onClose, onSave, editWaypoint = null, defaultSequenceNumber = 0 }) {
  const [formData, setFormData] = useState({
    address: '',
    sequence_number: 0,
    notes: '',
  });

  useEffect(() => {
    if (editWaypoint) {
      setFormData({
        address: editWaypoint.address || '',
        sequence_number: editWaypoint.sequence_number || 0,
        notes: editWaypoint.notes || '',
      });
    } else {
      setFormData({
        address: '',
        sequence_number: Number.isFinite(defaultSequenceNumber) ? defaultSequenceNumber : 0,
        notes: '',
      });
    }
  }, [editWaypoint, isOpen, defaultSequenceNumber]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {editWaypoint ? 'Edit Waypoint' : 'Add Waypoint'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <Input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sequence Number
              </label>
              <Input
                type="number"
                value={formData.sequence_number}
                onChange={(e) => setFormData({ ...formData, sequence_number: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Special delivery instructions..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
              >
                {editWaypoint ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
