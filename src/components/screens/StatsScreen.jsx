import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import Card from '../shared/Card';
import Button from '../shared/Button';
import useRouteStore from '../../stores/routeStore';
// pmOfficeService removed (744 PM Office Time card removed)
import { routeProtectionService } from '../../services/routeProtectionService';
import { formatMinutesAsTime, parseLocalDate } from '../../utils/time';
import { getWorkweekStart } from '../../utils/uspsConstants';
import { calculateRecordDays, formatRecordValue, formatRecordDate } from '../../services/recordStatsService';
import { calculateAveragePerformance } from '../../utils/percentToStandard';
import { Clock, TrendingUp, Calendar, Package, Timer, Target, Activity, Award, AlertTriangle, Shield, Trophy } from 'lucide-react';

export default function StatsScreen() {
  const { history, averages, currentRoute, todayInputs, loading, activeRoute } = useRouteStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  // PM Office stats removed
  const [protectionStatus, setProtectionStatus] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadProtectionData();
  }, [activeRoute?.id]);

  // PM office stats section removed

  const loadProtectionData = async () => {
    if (!activeRoute?.id) return;

    try {
      const [status, weekly] = await Promise.all([
        routeProtectionService.getRouteProtectionStatus(activeRoute.id),
        routeProtectionService.calculateWeeklyStats(activeRoute.id)
      ]);

      setProtectionStatus(status);
      setWeeklyStats(weekly);
    } catch (error) {
      console.error('Error loading protection data:', error);
    }
  };

  const hasActiveRoute = useMemo(() => {
    return todayInputs.dps || todayInputs.flats || todayInputs.letters || todayInputs.parcels;
  }, [todayInputs]);

  const stats = useMemo(() => {
    if (!history || history.length === 0) {
      return null;
    }

    const totalDays = history.length;
    const last30Days = history.filter(day => {
      const dayDate = new Date(day.date);
      const now = new Date();
      const diffDays = (now - dayDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 30;
    });

    const avgDPS = Math.round(
      history.reduce((sum, day) => sum + (day.dps || 0), 0) / totalDays
    );
    const avgFlats = history.reduce((sum, day) => sum + (day.flats || 0), 0) / totalDays;
    const avgParcels = Math.round(
      history.reduce((sum, day) => sum + (day.parcels || 0), 0) / totalDays
    );
    const avgStreetTime = history.reduce((sum, day) => sum + (day.streetTime || day.street_time || 0), 0) / totalDays;

    const totalOvertime = history.reduce((sum, day) => sum + (day.overtime || 0), 0);
    const avgOvertime = totalOvertime / totalDays;

    const bestDay = history.reduce((best, day) => {
      const streetTime = day.streetTime || day.street_time || 999999;
      const bestTime = best.streetTime || best.street_time || 999999;
      return streetTime < bestTime ? day : best;
    }, history[0]);

    const last7Days = history.filter(day => {
      const dayDate = new Date(day.date);
      const now = new Date();
      const diffDays = (now - dayDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    });

    const avgLast7Street = last7Days.length > 0
      ? last7Days.reduce((sum, day) => sum + (day.streetTime || day.street_time || 0), 0) / last7Days.length
      : 0;

    return {
      totalDays,
      last30Days: last30Days.length,
      avgDPS,
      avgFlats,
      avgParcels,
      avgStreetTime,
      avgOvertime: Math.round(avgOvertime),
      totalOvertime: Math.round(totalOvertime),
      bestDay,
      avgLast7Street,
    };
  }, [history]);

  const performanceMetrics = useMemo(() => {
    if (!stats || !history || history.length < 5) return null;

    const recent = history.slice(0, 5);
    const older = history.slice(5, 10);

    if (older.length === 0) return null;

    const recentAvg = recent.reduce((sum, day) =>
      sum + (day.streetTime || day.street_time || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, day) =>
      sum + (day.streetTime || day.street_time || 0), 0) / older.length;

    const improvement = olderAvg - recentAvg;
    const improvementPercent = ((improvement / olderAvg) * 100).toFixed(1);

    return {
      improving: improvement > 0,
      improvement,
      improvementPercent,
    };
  }, [stats, history]);

  const recentHistory = useMemo(() => {
    if (!history) return [];
    return history.slice(0, 10);
  }, [history]);

  const recordDays = useMemo(() => {
    return calculateRecordDays(history);
  }, [history]);

  const casingStats = useMemo(() => {
    if (!history || history.length === 0) return null;

    const daysWithLeaveTimesData = history.filter(day =>
      day.predicted_leave_time && day.actual_leave_time
    );

    if (daysWithLeaveTimesData.length === 0) return null;

    const parseTimeToMinutes = (timeStr) => {
      if (!timeStr) return null;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    let totalVariance = 0;
    let earlyCount = 0;
    let lateCount = 0;
    let onTimeCount = 0;

    const detailedDays = daysWithLeaveTimesData.map(day => {
      const predictedMins = parseTimeToMinutes(day.predicted_leave_time);
      const actualMins = parseTimeToMinutes(day.actual_leave_time);

      if (predictedMins === null || actualMins === null) return null;

      const variance = actualMins - predictedMins;
      totalVariance += variance;

      if (variance < -5) earlyCount++;
      else if (variance > 5) lateCount++;
      else onTimeCount++;

      return {
        date: day.date,
        predictedTime: day.predicted_leave_time,
        actualTime: day.actual_leave_time,
        variance,
        predictedOfficeTime: day.predicted_office_time,
        actualOfficeTime: day.actual_office_time
      };
    }).filter(Boolean);

    const avgVariance = totalVariance / detailedDays.length;

    return {
      totalDays: detailedDays.length,
      avgVariance: Math.round(avgVariance),
      earlyCount,
      lateCount,
      onTimeCount,
      accuracy: ((onTimeCount / detailedDays.length) * 100).toFixed(0),
      recentDays: detailedDays.slice(0, 5)
    };
  }, [history]);

  const officePerformanceStats = useMemo(() => {
    if (!history || history.length === 0) return null;

    return calculateAveragePerformance(history);
  }, [history]);

  const hasCasingWithdrawalData = useMemo(() => {
    if (!history || history.length === 0) return false;
    return history.some(day => {
      const v = day.casingWithdrawalMinutes ?? day.casing_withdrawal_minutes;
      return typeof v === 'number' ? v > 0 : parseFloat(v) > 0;
    });
  }, [history]);

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Statistics</h2>
        <Card>
          <p className="text-center text-gray-600">Loading statistics...</p>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Performance</h2>
          <p className="text-sm text-gray-500">{format(currentTime, 'h:mm:ss a')}</p>
        </div>

        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200">
          <div className="text-center py-8">
            <Package className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Data Yet</h3>
            <p className="text-gray-700 mb-4">
              Complete your first route to start seeing statistics and insights.
            </p>
            <p className="text-sm text-gray-600">
              Your route averages and predictions will improve with each completed day.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const weekStart = getWorkweekStart(currentTime);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);

  return (
    <div className="p-4 max-w-2xl mx-auto pb-20">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Performance</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{format(currentTime, 'EEEE, MMMM d')}</p>
          <p className="text-sm font-mono text-gray-700">{format(currentTime, 'h:mm:ss a')}</p>
        </div>
      </div>

      {protectionStatus?.needsAttention && (
        <Card className="mb-4 bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">Route Protection Alert</h3>
              <p className="text-sm text-gray-700 mb-3">{protectionStatus.summary}</p>
              {protectionStatus.rule3of5.qualifies && (
                <div className="bg-white rounded p-2 mb-2 text-xs">
                  <p className="font-semibold text-red-700">3/5 Rule: {protectionStatus.rule3of5.message}</p>
                </div>
              )}
              {protectionStatus.overburdened.isOverburdened && (
                <div className="bg-white rounded p-2 text-xs">
                  <p className="font-semibold text-red-700">
                    Route overburdened by {protectionStatus.overburdened.variance.toFixed(0)} minutes
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {weeklyStats && (
        <Card className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900">Current Workweek</h3>
              <p className="text-xs text-gray-600">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')} (Sat-Fri)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-600">Total Hours</p>
              <p className="text-lg font-bold text-gray-900">{weeklyStats.totalHours.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Regular OT</p>
              <p className="text-lg font-bold text-blue-600">{weeklyStats.totalRegularOT.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Penalty OT</p>
              <p className="text-lg font-bold text-red-600">{weeklyStats.totalPenaltyOT.toFixed(1)}h</p>
            </div>
          </div>

          {weeklyStats.approachingWeeklyPenalty && (
            <div className="mt-3 p-2 bg-orange-50 border border-orange-300 rounded text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="text-orange-800 font-semibold">
                Approaching 56-hour weekly penalty threshold
              </span>
            </div>
          )}
        </Card>
      )}


      {hasActiveRoute && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900">Today's Route Active</h3>
            <Activity className="w-6 h-6 text-green-600 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {todayInputs.dps > 0 && (
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">DPS</p>
                <p className="text-xl font-bold text-gray-900">{todayInputs.dps}</p>
              </div>
            )}
            {todayInputs.flats > 0 && (
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Flats</p>
                <p className="text-xl font-bold text-gray-900">{todayInputs.flats.toFixed(1)} ft</p>
              </div>
            )}
            {todayInputs.letters > 0 && (
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Letters</p>
                <p className="text-xl font-bold text-gray-900">{todayInputs.letters.toFixed(1)} ft</p>
              </div>
            )}
            {todayInputs.parcels > 0 && (
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Parcels</p>
                <p className="text-xl font-bold text-gray-900">{todayInputs.parcels}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 744 PM Office Time removed */}

      {casingStats && (
        <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Timer className="w-5 h-5 text-violet-600" />
                Casing Performance
              </h3>
              <p className="text-xs text-gray-600 mt-1">Predicted vs Actual Leave Times</p>
            </div>
            <span className="text-2xl">📦</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/70 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Days Tracked</p>
              <p className="text-2xl font-bold text-violet-600">{casingStats.totalDays}</p>
            </div>
            <div className="bg-white/70 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Avg Variance</p>
              <p className={`text-2xl font-bold ${
                Math.abs(casingStats.avgVariance) <= 5 ? 'text-green-600' :
                casingStats.avgVariance > 0 ? 'text-red-600' : 'text-blue-600'
              }`}>
                {casingStats.avgVariance > 0 ? '+' : ''}{casingStats.avgVariance}m
              </p>
            </div>
            <div className="bg-white/70 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Accuracy</p>
              <p className="text-2xl font-bold text-violet-600">{casingStats.accuracy}%</p>
              <p className="text-xs text-gray-500">±5 min</p>
            </div>
          </div>

          <div className="bg-white/70 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-green-600 font-bold text-lg">{casingStats.earlyCount}</p>
                <p className="text-xs text-gray-600">Left Early</p>
              </div>
              <div>
                <p className="text-blue-600 font-bold text-lg">{casingStats.onTimeCount}</p>
                <p className="text-xs text-gray-600">On Time</p>
              </div>
              <div>
                <p className="text-red-600 font-bold text-lg">{casingStats.lateCount}</p>
                <p className="text-xs text-gray-600">Left Late</p>
              </div>
            </div>
          </div>

          {casingStats.recentDays && casingStats.recentDays.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Days</h4>
              <div className="space-y-2">
                {casingStats.recentDays.map((day, index) => (
                  <div key={index} className="bg-white/70 rounded p-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">
                        {format(parseLocalDate(day.date), 'MMM d')}
                      </span>
                      <span className={`font-bold ${
                        Math.abs(day.variance) <= 5 ? 'text-green-600' :
                        day.variance > 0 ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {day.variance > 0 ? '+' : ''}{day.variance}m
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600 mt-1">
                      <span>Predicted: {day.predictedTime}</span>
                      <span>Actual: {day.actualTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Office Performance (% to Standard) */}
      {(officePerformanceStats || !hasCasingWithdrawalData) && (
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" />
                Office Performance (% to Standard)
              </h3>
              <p className="text-xs text-gray-600 mt-1">USPS DOIS 18/8 Standard</p>
            </div>
            <span className="text-2xl">📊</span>
          </div>

          {!hasCasingWithdrawalData ? (
            <div className="bg-white/70 rounded-lg p-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900 mb-1">Needs one-time setup</p>
              <p>
                To calculate <strong>% to Standard</strong>, RouteWise needs your <strong>casing + withdrawal minutes</strong>.
              </p>
              <p className="mt-2">
                On the <strong>Today</strong> screen, after you tap <strong>Start Route (721 Time)</strong>, enter
                “<strong>Casing + Withdrawal (minutes)</strong>”.
              </p>
              <p className="mt-2 text-xs text-gray-600">
                This is casing + pull-down only (not stand-up, accountables, waiting, etc.).
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">Average</p>
                  <p className={`text-2xl font-bold ${
                    officePerformanceStats.avgPercent < 100 ? 'text-green-600' :
                    officePerformanceStats.avgPercent > 100 ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {officePerformanceStats.avgPercent}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {officePerformanceStats.avgPercent < 100 ? '⬇️ Faster' :
                     officePerformanceStats.avgPercent > 100 ? '⬆️ Slower' : '➡️ On Standard'}
                  </p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">Best Day</p>
                  <p className="text-2xl font-bold text-green-600">
                    {officePerformanceStats.best}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">⬇️ Fastest</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-600 mb-1">Worst Day</p>
                  <p className="text-2xl font-bold text-red-600">
                    {officePerformanceStats.worst}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">⬆️ Slowest</p>
                </div>
              </div>

              <div className="bg-white/70 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">
                    Days Under 100% (Faster)
                  </span>
                  <span className="text-lg font-bold text-green-600">
                    {officePerformanceStats.daysUnder100}/{officePerformanceStats.totalDays}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 rounded-full h-2 transition-all"
                      style={{ width: `${officePerformanceStats.consistency}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 text-center mt-1">
                    {officePerformanceStats.consistency}% consistency
                  </p>
                </div>
              </div>

              <div className="mt-3 p-2 bg-blue-50 border border-blue-300 rounded text-xs">
                <p className="text-blue-800">
                  <strong>USPS Standards:</strong> 18 letters/min • 8 flats/min • 70 pieces/min pull-down
                </p>
                <p className="text-blue-700 mt-1">
                  <strong>Note:</strong> % to Standard is for carrier reference only and is not contractually binding.
                </p>
              </div>
            </>
          )}
        </Card>
      )}

      {performanceMetrics && (
        <Card className={`bg-gradient-to-br ${
          performanceMetrics.improving
            ? 'from-green-50 to-emerald-50 border-2 border-green-200'
            : 'from-orange-50 to-amber-50 border-2 border-orange-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className={`w-5 h-5 ${performanceMetrics.improving ? 'text-green-600' : 'text-orange-600'}`} />
              Performance Trend
            </h3>
            <span className="text-2xl">{performanceMetrics.improving ? '📈' : '📊'}</span>
          </div>
          <div className="bg-white/70 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-2">Last 5 routes vs previous 5</p>
            <p className={`text-3xl font-bold ${performanceMetrics.improving ? 'text-green-600' : 'text-orange-600'}`}>
              {performanceMetrics.improving ? '-' : '+'}{Math.abs(Math.round(performanceMetrics.improvement))} min
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {performanceMetrics.improving ? 'Faster' : 'Slower'} by {Math.abs(performanceMetrics.improvementPercent)}%
            </p>
          </div>
        </Card>
      )}

      {stats.bestDay && (
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Best Performance
            </h3>
            <span className="text-2xl">🏆</span>
          </div>
          <div className="bg-white/70 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">
                  {format(parseLocalDate(stats.bestDay.date), 'EEEE, MMM d')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.bestDay.dps} DPS • {stats.bestDay.flats} flats • {stats.bestDay.parcels} parcels
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-600">
                  {formatMinutesAsTime(stats.bestDay.streetTime || stats.bestDay.street_time || 0)}
                </p>
                <p className="text-xs text-gray-600">street time</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Average Times
        </h3>
        <div className="space-y-3">
          <div className="bg-white/70 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Street Time (All Days)</span>
              <span className="text-xl font-bold text-blue-600">
                {formatMinutesAsTime(stats.avgStreetTime)}
              </span>
            </div>
          </div>
          {stats.avgLast7Street > 0 && (
            <div className="bg-white/70 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Last 7 Days</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatMinutesAsTime(stats.avgLast7Street)}
                </span>
              </div>
            </div>
          )}
          {averages.normal && (
            <div className="bg-white/70 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Normal Day</span>
                <span className="text-xl font-bold text-blue-600">
                  {averages.normal.toFixed(1)} hrs
                </span>
              </div>
            </div>
          )}
          {averages.monday && (
            <div className="bg-white/70 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Monday</span>
                <span className="text-xl font-bold text-blue-600">
                  {averages.monday.toFixed(1)} hrs
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Overview
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Total Days Tracked</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalDays}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Last 30 Days</p>
            <p className="text-2xl font-bold text-gray-900">{stats.last30Days}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Avg Overtime</p>
            <p className={`text-xl font-bold ${stats.avgOvertime > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.avgOvertime > 0 ? `+${formatMinutesAsTime(stats.avgOvertime)}` : 'None'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Total Overtime</p>
            <p className={`text-xl font-bold ${stats.totalOvertime > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.totalOvertime > 0 ? `+${formatMinutesAsTime(stats.totalOvertime)}` : 'None'}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Average Mail Volume
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 mb-1">DPS</p>
            <p className="text-xl font-bold text-gray-900">{stats.avgDPS}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 mb-1">Flats</p>
            <p className="text-xl font-bold text-gray-900">{stats.avgFlats.toFixed(1)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600 mb-1">Parcels</p>
            <p className="text-xl font-bold text-gray-900">{stats.avgParcels}</p>
          </div>
        </div>
      </Card>

      {recordDays && (
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-600" />
            Record Day Performance
          </h3>
          <div className="space-y-3">
            {recordDays.dps.value > 0 && (
              <div className="bg-white/70 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 mb-1">DPS</p>
                    <p className="text-xs text-gray-600">
                      {formatRecordDate(recordDays.dps.date)}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-purple-600">
                    {formatRecordValue(recordDays.dps.value, 'dps')}
                  </p>
                </div>
              </div>
            )}
            {recordDays.letters.value > 0 && (
              <div className="bg-white/70 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Letters</p>
                    <p className="text-xs text-gray-600">
                      {formatRecordDate(recordDays.letters.date)}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-purple-600">
                    {formatRecordValue(recordDays.letters.value, 'letters')}
                  </p>
                </div>
              </div>
            )}
            {recordDays.flats.value > 0 && (
              <div className="bg-white/70 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Flats</p>
                    <p className="text-xs text-gray-600">
                      {formatRecordDate(recordDays.flats.date)}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-purple-600">
                    {formatRecordValue(recordDays.flats.value, 'flats')}
                  </p>
                </div>
              </div>
            )}
            {recordDays.parcels.value > 0 && (
              <div className="bg-white/70 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Parcels</p>
                    <p className="text-xs text-gray-600">
                      {formatRecordDate(recordDays.parcels.date)}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-purple-600">
                    {formatRecordValue(recordDays.parcels.value, 'parcels')}
                  </p>
                </div>
              </div>
            )}
            {recordDays.spurs.value > 0 && (
              <div className="bg-white/70 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 mb-1">SPRs</p>
                    <p className="text-xs text-gray-600">
                      {formatRecordDate(recordDays.spurs.date)}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-purple-600">
                    {formatRecordValue(recordDays.spurs.value, 'spurs')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Recent History
        </h3>
        <div className="space-y-2">
          {recentHistory.length > 0 ? (
            recentHistory.map((day, index) => (
              <div
                key={day.id || index}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {format(parseLocalDate(day.date), 'EEEE, MMM d')}
                  </p>
                  <p className="text-xs text-gray-600">
                    {day.dps} DPS • {day.flats} flats • {day.parcels} parcels
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    {formatMinutesAsTime(day.street_time || day.streetTime || 0)}
                  </p>
                  <p className="text-xs text-gray-600">street time</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-600 text-sm italic py-4 text-center">
              No history available yet
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
