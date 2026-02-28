import { X } from 'lucide-react';
import Button from './Button';

/**
 * Modal to select reason for excluding a day from averages.
 * Shows when user toggles "Exclude from averages".
 */
export default function ExclusionReasonModal({ isOpen, onClose, onConfirm, isLoading = false }) {
  if (!isOpen) return null;

  const reasons = [
    {
      id: 'maintenance',
      label: 'Maintenance / Box prep',
      description: 'Spent time labeling boxes, organizing, etc.',
    },
    {
      id: 'unusual_conditions',
      label: 'Unusual conditions',
      description: 'Weather, traffic, road closures, etc.',
    },
    {
      id: 'sick',
      label: 'Sick / Not feeling well',
      description: 'Health-related slowdown',
    },
    {
      id: 'different_mail_volume',
      label: 'Different mail volume',
      description: 'Significantly more or less mail than normal',
    },
    {
      id: 'other',
      label: 'Other',
      description: 'Custom reason',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Why exclude this day?</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
          {reasons.map((reason) => (
            <button
              key={reason.id}
              onClick={() => onConfirm(reason.id)}
              disabled={isLoading}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="font-semibold text-sm text-gray-900">{reason.label}</div>
              <div className="text-xs text-gray-600 mt-0.5">{reason.description}</div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-2">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          {/* Note: confirm is called directly from reason buttons above, so no separate confirm button needed */}
        </div>
      </div>
    </div>
  );
}
