import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, FileText } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { routeProtectionService } from '../../services/routeProtectionService';
import useRouteStore from '../../stores/routeStore';

export default function RouteProtectionScreen() {
  const { activeRoute } = useRouteStore();
  const [protectionStatus, setProtectionStatus] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProtectionData();
  }, [activeRoute?.id]);

  async function loadProtectionData() {
    if (!activeRoute?.id) return;

    setLoading(true);
    try {
      const [status, weekly, trendData] = await Promise.all([
        routeProtectionService.getRouteProtectionStatus(activeRoute.id),
        routeProtectionService.calculateWeeklyStats(activeRoute.id),
        routeProtectionService.getOvertimeTrends(activeRoute.id, 4)
      ]);

      setProtectionStatus(status);
      setWeeklyStats(weekly);
      setTrends(trendData);
    } catch (error) {
      console.error('Error loading protection data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 max-w-4xl mx-auto pb-20">
        <div className="text-center py-8 text-gray-500">Loading route protection data...</div>
      </div>
    );
  }

  if (!activeRoute) {
    return (
      <div className="p-4 max-w-4xl mx-auto pb-20">
        <div className="text-center py-8 text-gray-500">No active route selected</div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Route Protection</h1>
        <p className="text-sm text-gray-600">
          Monitor your route for overburdened conditions and special inspection qualification
        </p>
      </div>

      {protectionStatus?.needsAttention && (
        <Card className="mb-6 bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Route Protection Alert</h3>
              <p className="text-sm text-gray-700">{protectionStatus.summary}</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">3/5 Rule Status (M-39 271g)</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Violation Days (Last 5 Days)</span>
            <span className="font-bold text-lg">
              {protectionStatus?.rule3of5.violationCount}/{protectionStatus?.rule3of5.daysCounted}
            </span>
          </div>

          <div className="bg-gray-100 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700">
              {protectionStatus?.rule3of5.message}
            </p>
          </div>

          {protectionStatus?.rule3of5.violations.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Qualifying Days:</p>
              <div className="space-y-2">
                {protectionStatus.rule3of5.violations.map((day, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded p-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{new Date(day.date).toLocaleDateString()}</span>
                      <div className="flex gap-2 text-xs">
                        {day.overtime >= 60 && <span className="text-red-700">OT: {day.overtime}min</span>}
                        {day.auxiliary_assistance && <span className="text-red-700">Aux Help</span>}
                        {day.mail_not_delivered && <span className="text-red-700">Mail Not Delivered</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-gray-700">
            <p className="font-semibold mb-1">Rule Explanation:</p>
            <p>3 or more days within a 5-consecutive-day period with: (1) 1+ hour overtime, (2) auxiliary assistance, or (3) mail not delivered qualifies for special inspection.</p>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Overburdened Route Status</h2>
        <div className="space-y-3">
          {protectionStatus?.overburdened.hasEvaluation ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Actual Street Time (Avg)</p>
                  <p className="text-lg font-bold text-gray-900">
                    {protectionStatus.overburdened.actualStreetTime?.toFixed(2)} hrs
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Evaluated Street Time</p>
                  <p className="text-lg font-bold text-gray-900">
                    {protectionStatus.overburdened.evaluatedStreetTime?.toFixed(2)} hrs
                  </p>
                </div>
              </div>

              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">Variance</span>
                  <span className={`text-lg font-bold ${
                    protectionStatus.overburdened.isOverburdened ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {protectionStatus.overburdened.variance > 0 ? '+' : ''}
                    {protectionStatus.overburdened.variance?.toFixed(0)} min
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {protectionStatus.overburdened.message}
                </p>
              </div>

              {protectionStatus.overburdened.evaluationDate && (
                <p className="text-xs text-gray-500">
                  Evaluation Date: {new Date(protectionStatus.overburdened.evaluationDate).toLocaleDateString()}
                </p>
              )}

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-gray-700">
                <p className="font-semibold mb-1">Rule Explanation:</p>
                <p>A route is considered overburdened if average street time exceeds evaluation by 5 or more minutes.</p>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-600 mb-4">No route evaluation on file</p>
              <Button onClick={() => window.location.href = '#/settings'}>
                Add Route Evaluation
              </Button>
            </div>
          )}
        </div>
      </Card>

      {weeklyStats && (
        <Card className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Current Workweek</h2>
          <p className="text-xs text-gray-500 mb-3">
            {new Date(weeklyStats.weekStart).toLocaleDateString()} - {new Date(weeklyStats.weekEnd).toLocaleDateString()}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">{weeklyStats.totalHours.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Days Worked</p>
              <p className="text-2xl font-bold text-gray-900">{weeklyStats.daysWorked}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600">Regular OT (1.5x)</p>
              <p className="text-lg font-bold text-blue-600">{weeklyStats.totalRegularOT.toFixed(2)} hrs</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Penalty OT (2.0x)</p>
              <p className="text-lg font-bold text-red-600">{weeklyStats.totalPenaltyOT.toFixed(2)} hrs</p>
            </div>
          </div>

          {weeklyStats.approachingWeeklyPenalty && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-300 rounded-lg">
              <p className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Approaching 56-hour weekly penalty threshold
              </p>
            </div>
          )}
        </Card>
      )}

      {trends.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Overtime Trends (4 Weeks)
          </h2>
          <div className="space-y-3">
            {trends.map((week, idx) => (
              <div key={idx} className="border-b border-gray-200 pb-3 last:border-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-600">
                    Week of {new Date(week.weekStart).toLocaleDateString()}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {week.totalOT} min OT
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-600">
                  <span>Avg: {week.avgDailyOT.toFixed(0)} min/day</span>
                  {week.totalPenaltyOT > 0 && (
                    <span className="text-red-600 font-semibold">
                      Penalty: {week.totalPenaltyOT} min
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-sm text-gray-900 mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Documentation
        </h3>
        <p className="text-xs text-gray-600 mb-3">
          This data can support requests for route inspection or adjustment. Always consult with your union steward before filing grievances.
        </p>
        <p className="text-xs text-gray-500 italic">
          Sources: USPS M-39 Section 271g, NALC Article 34
        </p>
      </div>
    </div>
  );
}
