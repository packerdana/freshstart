import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import Input from './Input';
import { supabase } from '../../lib/supabase';
import { decimalHoursToHHMM, hhmmToDecimalHours, validateHHMMFormat } from '../../utils/time';
import useRouteStore from '../../stores/routeStore';

export default function RouteEvaluationModal({ isOpen, onClose, routeId }) {
  const { loadUserRoutes } = useRouteStore();
  const [evaluation, setEvaluation] = useState({
    evaluated_office_time: '',
    evaluated_street_time: '',
    evaluation_date: '',
    evaluation_notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (isOpen && routeId) {
      loadEvaluation();
    }
  }, [isOpen, routeId]);

  async function loadEvaluation() {
    const { data, error } = await supabase
      .from('routes')
      .select('evaluated_office_time, evaluated_street_time, evaluation_date, evaluation_notes')
      .eq('id', routeId)
      .maybeSingle();

    if (data && data.evaluated_street_time) {
      setEvaluation({
        evaluated_office_time: decimalHoursToHHMM(data.evaluated_office_time) || '',
        evaluated_street_time: decimalHoursToHHMM(data.evaluated_street_time) || '',
        evaluation_date: data.evaluation_date || '',
        evaluation_notes: data.evaluation_notes || ''
      });
      setHasExisting(true);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!validateHHMMFormat(evaluation.evaluated_office_time)) {
      alert('Please enter office time in HH:MM format (e.g., 02:30)');
      return;
    }

    if (!validateHHMMFormat(evaluation.evaluated_street_time)) {
      alert('Please enter street time in HH:MM format (e.g., 06:00)');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('routes')
        .update({
          evaluated_office_time: hhmmToDecimalHours(evaluation.evaluated_office_time),
          evaluated_street_time: hhmmToDecimalHours(evaluation.evaluated_street_time),
          evaluation_date: evaluation.evaluation_date || null,
          evaluation_notes: evaluation.evaluation_notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', routeId);

      if (error) throw error;

      await loadUserRoutes();

      alert(hasExisting ? 'Route evaluation updated!' : 'Route evaluation saved!');
      onClose();
    } catch (error) {
      console.error('Error saving evaluation:', error);
      alert('Failed to save evaluation: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const totalEvalTimeDecimal = (hhmmToDecimalHours(evaluation.evaluated_office_time) || 0) +
                                (hhmmToDecimalHours(evaluation.evaluated_street_time) || 0);
  const totalEvalTime = decimalHoursToHHMM(totalEvalTimeDecimal);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {hasExisting ? 'Update' : 'Add'} Route Evaluation
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700">
            <p className="font-semibold mb-1">What is a Route Evaluation?</p>
            <p className="text-xs">
              Your route's official evaluation from USPS showing how many hours of office and street time
              your route should take on an average day. This is used to determine if your route is overburdened.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evaluated Office Time (HH:MM)
            </label>
            <Input
              type="text"
              value={evaluation.evaluated_office_time}
              onChange={(e) => setEvaluation({ ...evaluation, evaluated_office_time: e.target.value })}
              placeholder="e.g., 02:30"
              pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
              maxLength="5"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Time for casing, pulling down, scanning packages (format: HH:MM)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evaluated Street Time (HH:MM)
            </label>
            <Input
              type="text"
              value={evaluation.evaluated_street_time}
              onChange={(e) => setEvaluation({ ...evaluation, evaluated_street_time: e.target.value })}
              placeholder="e.g., 06:00"
              pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
              maxLength="5"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Time for loading truck, delivery, and return (format: HH:MM)</p>
          </div>

          {totalEvalTimeDecimal > 0 && (
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Evaluated Time</span>
                <span className="text-lg font-bold text-gray-900">{totalEvalTime} ({totalEvalTimeDecimal.toFixed(2)} hours)</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evaluation Date
            </label>
            <Input
              type="date"
              value={evaluation.evaluation_date}
              onChange={(e) => setEvaluation({ ...evaluation, evaluation_date: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Date of the official route inspection/evaluation</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={evaluation.evaluation_notes}
              onChange={(e) => setEvaluation({ ...evaluation, evaluation_notes: e.target.value })}
              placeholder="Any additional notes about the evaluation..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-xs text-gray-700">
            <p className="font-semibold mb-1">Where to Find This Information:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>PS Form 3999 (Route Inspection)</li>
              <li>PS Form 1838-C (Route Summary)</li>
              <li>Ask your supervisor or union steward</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button type="button" onClick={onClose} className="flex-1 bg-gray-300 text-gray-700">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save Evaluation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
