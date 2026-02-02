import { useState } from 'react';
import { X, MapPin } from 'lucide-react';
import Button from './Button';
import Input from './Input';

export default function RouteSetupModal({ isOpen, onClose, onSave, editRoute = null }) {
  const manualStreetTimeHours = editRoute?.manual_street_time ? Math.floor(editRoute.manual_street_time / 60) : '';
  const manualStreetTimeMinutes = editRoute?.manual_street_time ? editRoute.manual_street_time % 60 : '';

  const [formData, setFormData] = useState({
    routeNumber: editRoute?.route_number || '',
    startTime: editRoute?.start_time || '07:30',
    tourLength: editRoute?.tour_length || 8.5,
    lunchDuration: editRoute?.lunch_duration || 30,
    comfortStopDuration: editRoute?.comfort_stop_duration || 10,
    baseParcels: (editRoute?.base_parcels ?? '') === 0 ? '0' : (editRoute?.base_parcels ?? ''),
    manualStreetTimeHours: manualStreetTimeHours,
    manualStreetTimeMinutes: manualStreetTimeMinutes,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors = {};

    if (!formData.routeNumber.trim()) {
      newErrors.routeNumber = 'Route number is required';
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (formData.tourLength <= 0 || formData.tourLength > 12) {
      newErrors.tourLength = 'Tour length must be between 0 and 12 hours';
    }

    if (formData.lunchDuration < 0 || formData.lunchDuration > 60) {
      newErrors.lunchDuration = 'Lunch duration must be between 0 and 60 minutes';
    }

    if (formData.comfortStopDuration < 0 || formData.comfortStopDuration > 30) {
      newErrors.comfortStopDuration = 'Break duration must be between 0 and 30 minutes';
    }

    if (formData.manualStreetTimeHours && (formData.manualStreetTimeHours < 0 || formData.manualStreetTimeHours > 10)) {
      newErrors.manualStreetTimeHours = 'Hours must be between 0 and 10';
    }

    if (formData.manualStreetTimeMinutes && (formData.manualStreetTimeMinutes < 0 || formData.manualStreetTimeMinutes > 59)) {
      newErrors.manualStreetTimeMinutes = 'Minutes must be between 0 and 59';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    try {
      const saveData = {
        routeNumber: formData.routeNumber.trim(),
        startTime: formData.startTime,
        tourLength: parseFloat(formData.tourLength),
        lunchDuration: parseInt(formData.lunchDuration),
        comfortStopDuration: parseInt(formData.comfortStopDuration),
        baseParcels: null,
      };

      const hours = parseInt(formData.manualStreetTimeHours) || 0;
      const minutes = parseInt(formData.manualStreetTimeMinutes) || 0;
      const totalMinutes = (hours * 60) + minutes;

      if (totalMinutes > 0) {
        saveData.manualStreetTime = totalMinutes;
      } else {
        saveData.manualStreetTime = null;
      }

      // Optional base parcels
      if (String(formData.baseParcels).trim() !== '') {
        const parsed = parseInt(formData.baseParcels, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setErrors({ ...errors, baseParcels: 'Base parcels must be a non-negative number' });
          setSaving(false);
          return;
        }
        saveData.baseParcels = parsed;
      } else {
        saveData.baseParcels = null;
      }

      await onSave(saveData);
      onClose();
    } catch (error) {
      console.error('Failed to save route:', error);
      setErrors({ submit: 'Failed to save route. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {editRoute ? 'Edit Route' : 'Create Route'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto overscroll-contain">
          <Input
            label="Route Number"
            type="text"
            value={formData.routeNumber}
            onChange={(e) => setFormData({ ...formData, routeNumber: e.target.value })}
            placeholder="e.g., 123, R001, Downtown"
            error={errors.routeNumber}
            required
          />

          <Input
            label="Start Time"
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            error={errors.startTime}
            required
          />

          <Input
            label="Tour Length (hours)"
            type="number"
            value={formData.tourLength}
            onChange={(e) => setFormData({ ...formData, tourLength: e.target.value })}
            placeholder="8.5"
            step="0.5"
            min="0"
            max="12"
            error={errors.tourLength}
            required
          />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Estimated Street Time
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Hours"
                type="number"
                value={formData.manualStreetTimeHours}
                onChange={(e) => setFormData({ ...formData, manualStreetTimeHours: e.target.value })}
                placeholder="4"
                min="0"
                max="10"
                error={errors.manualStreetTimeHours}
              />
              <Input
                label="Minutes"
                type="number"
                value={formData.manualStreetTimeMinutes}
                onChange={(e) => setFormData({ ...formData, manualStreetTimeMinutes: e.target.value })}
                placeholder="30"
                min="0"
                max="59"
                error={errors.manualStreetTimeMinutes}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Optional: Used for return time estimates until the app learns from your actual route data
            </p>
          </div>

          <Input
            label="Lunch Duration (minutes)"
            type="number"
            value={formData.lunchDuration}
            onChange={(e) => setFormData({ ...formData, lunchDuration: e.target.value })}
            placeholder="30"
            min="0"
            max="60"
            error={errors.lunchDuration}
            required
          />

          <Input
            label="Base Parcels (optional)"
            type="number"
            value={formData.baseParcels}
            onChange={(e) => setFormData({ ...formData, baseParcels: e.target.value })}
            placeholder="e.g., 35"
            min="0"
            error={errors.baseParcels}
          />
          <p className="text-xs text-gray-500 -mt-2">
            If known, RouteWise can suggest “Parcels over base” as a 3996 reason.
          </p>

          <div>
            <Input
              label="Break Duration (minutes)"
              type="number"
              value={formData.comfortStopDuration}
              onChange={(e) => setFormData({ ...formData, comfortStopDuration: e.target.value })}
              placeholder="10"
              min="0"
              max="30"
              error={errors.comfortStopDuration}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              USPS city carriers get two 10-minute breaks
            </p>
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={saving}
            >
              {saving ? 'Saving...' : editRoute ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
