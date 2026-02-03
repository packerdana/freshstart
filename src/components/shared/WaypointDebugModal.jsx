import { useState } from 'react';
import { Search, X } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import { supabase } from '../../lib/supabase';
import { getLocalDateString } from '../../utils/time';
import { getLocalYesterdayKey } from '../../utils/dateKey';

export default function WaypointDebugModal({ isOpen, onClose, routeId }) {
  const [todayData, setTodayData] = useState(null);
  const [yesterdayData, setYesterdayData] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkData = async () => {
    setLoading(true);
    try {
      const today = getLocalDateString();
      const yesterday = getLocalYesterdayKey();

      const { data: todayWaypoints } = await supabase
        .from('waypoints')
        .select('*')
        .eq('route_id', routeId)
        .eq('date', today)
        .order('sequence_number');

      const { data: yesterdayWaypoints } = await supabase
        .from('waypoints')
        .select('*')
        .eq('route_id', routeId)
        .eq('date', yesterday)
        .order('sequence_number');

      setTodayData({
        date: today,
        count: todayWaypoints?.length || 0,
        waypoints: todayWaypoints || [],
        completed: todayWaypoints?.filter(w => w.status === 'completed').length || 0,
        pending: todayWaypoints?.filter(w => w.status === 'pending').length || 0
      });

      setYesterdayData({
        date: yesterday,
        count: yesterdayWaypoints?.length || 0,
        waypoints: yesterdayWaypoints || [],
        completed: yesterdayWaypoints?.filter(w => w.status === 'completed').length || 0,
        pending: yesterdayWaypoints?.filter(w => w.status === 'pending').length || 0
      });
    } catch (error) {
      console.error('Failed to check data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fixTodayWaypoints = async () => {
    if (!todayData || todayData.count === 0) {
      alert('No waypoints found for today to fix');
      return;
    }

    if (!confirm(`Reset ${todayData.count} waypoints to pending status? This will clear all delivery times for today.`)) {
      return;
    }

    try {
      const today = getLocalDateString();

      const { error } = await supabase
        .from('waypoints')
        .update({
          status: 'pending',
          delivery_time: null,
          updated_at: new Date().toISOString()
        })
        .eq('route_id', routeId)
        .eq('date', today);

      if (error) throw error;

      alert('Successfully reset all waypoints to pending!');
      await checkData();
      onClose();
    } catch (error) {
      console.error('Failed to fix waypoints:', error);
      alert('Failed to fix waypoints. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Waypoint Data Check</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <Button onClick={checkData} disabled={loading} className="w-full mb-4">
          <Search className="w-4 h-4 mr-2" />
          Check Database
        </Button>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-3"></div>
            <p className="text-gray-600">Checking database...</p>
          </div>
        )}

        {todayData && (
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Today ({todayData.date})</h3>
              <div className="text-sm space-y-1 mb-3">
                <p>Total waypoints: <span className="font-semibold">{todayData.count}</span></p>
                <p>Completed: <span className="font-semibold text-green-600">{todayData.completed}</span></p>
                <p>Pending: <span className="font-semibold text-gray-600">{todayData.pending}</span></p>
              </div>

              {todayData.count > 0 && todayData.completed > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3">
                  <p className="text-sm text-amber-800 font-medium">Issue Detected</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Today's waypoints have {todayData.completed} marked as completed.
                    These should be pending for fresh tracking.
                  </p>
                </div>
              )}

              {todayData.waypoints.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {todayData.waypoints.slice(0, 5).map(w => (
                    <div key={w.id} className="text-xs p-2 bg-gray-50 rounded flex justify-between">
                      <span>#{w.sequence_number} {w.address}</span>
                      <span className={w.status === 'completed' ? 'text-green-600' : 'text-gray-500'}>
                        {w.status} {w.delivery_time ? `(${new Date(w.delivery_time).toLocaleTimeString()})` : ''}
                      </span>
                    </div>
                  ))}
                  {todayData.waypoints.length > 5 && (
                    <p className="text-xs text-gray-500 text-center">
                      ...and {todayData.waypoints.length - 5} more
                    </p>
                  )}
                </div>
              )}

              {todayData.completed > 0 && (
                <Button
                  onClick={fixTodayWaypoints}
                  variant="primary"
                  className="w-full mt-3 bg-amber-600 hover:bg-amber-700"
                >
                  Reset All to Pending
                </Button>
              )}
            </div>

            {yesterdayData && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Yesterday ({yesterdayData.date})</h3>
                <div className="text-sm space-y-1">
                  <p>Total waypoints: <span className="font-semibold">{yesterdayData.count}</span></p>
                  <p>Completed: <span className="font-semibold text-green-600">{yesterdayData.completed}</span></p>
                  <p>Pending: <span className="font-semibold text-gray-600">{yesterdayData.pending}</span></p>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !todayData && (
          <div className="text-center py-8">
            <p className="text-gray-500">Click "Check Database" to see waypoint data</p>
          </div>
        )}
      </Card>
    </div>
  );
}
