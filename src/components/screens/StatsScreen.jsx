import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import Card from '../shared/Card';
import Button from '../shared/Button';
import useRouteStore from '../../stores/routeStore';
// pmOfficeService removed (744 PM Office Time card removed)
import { routeProtectionService } from '../../services/routeProtectionService';
import { formatMinutesAsTime, parseLocalDate, formatTimeAMPM } from '../../utils/time';
import { getWorkweekStart } from '../../utils/uspsConstants';
import { calculateRecordDays, formatRecordValue, formatRecordDate } from '../../services/recordStatsService';
import { calculateAveragePerformance } from '../../utils/percentToStandard';
import { calculateFullDayPrediction } from '../../services/predictionService';
import { Clock, TrendingUp, Calendar, Package, Timer, Target, Activity, Award, AlertTriangle, Shield, Trophy } from 'lucide-react';

function formatDurationMinutes(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) return '--';
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function StatsScreen() {
  const { history, averages, currentRoute, todayInputs, loading, error, activeRoute, getCurrentRouteConfig, currentRouteId, waypoints, routes, loadRouteHistory } = useRouteStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayPrediction, setTodayPrediction] = useState(null);
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

  // Ensure history is loaded when visiting Stats (mobile users often jump here first)
  useEffect(() => {
    if (!currentRouteId) return;
    if (loading) return;
    if (history && history.length > 0) return;
    if (typeof loadRouteHistory !== 'function') return;

    loadRouteHistory(currentRouteId);
  }, [currentRouteId, loading, history?.length, loadRouteHistory]);

  useEffect(() => {
    async function loadPrediction() {
      const hasInput = todayInputs.dps || todayInputs.flats || todayInputs.letters || todayInputs.parcels || todayInputs.sprs;
      if (!hasInput) {
        setTodayPrediction(null);
        return;
      }

      const todayMail = {
        dps: todayInputs.dps || 0,
        flats: todayInputs.flats || 0,
        letters: todayInputs.letters || 0,
        parcels: todayInputs.parcels || 0,
        sprs: todayInputs.sprs || 0,
        curtailed: 0,
        safetyTalk: todayInputs.safetyTalk || 0,
        hasBoxholder: todayInputs.hasBoxholder || false,
      };

      const routeConfig = getCurrentRouteConfig?.() || {};
      const effectiveStartTime = todayInputs.startTimeOverride || routeConfig?.startTime || '07:30';
      const routeConfigForPrediction = { ...routeConfig, startTime: effectiveStartTime };

      try {
        const pred = await calculateFullDayPrediction(
          todayMail,
          routeConfigForPrediction,
          history || [],
          waypoints || [],
          currentRouteId,
          0
        );
        setTodayPrediction(pred);
      } catch (e) {
        console.warn('[StatsScreen] Failed to calculate today prediction:', e?.message || e);
        setTodayPrediction(null);
      }
    }

    loadPrediction();
  }, [todayInputs, history, waypoints, currentRouteId, getCurrentRouteConfig]);

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
    // Must be boolean; returning a number here can render a stray "0" in React when used like:
    // {hasActiveRoute && (...)}
    return !!(todayInputs.dps || todayInputs.flats || todayInputs.letters || todayInputs.parcels || todayInputs.sprs);
  }, [todayInputs]);

  const todayStats = useMemo(() => {
    const predClockOut = todayPrediction?.clockOutTime ? new Date(todayPrediction.clockOutTime) : null;

    // Actual clock-out (set when the user ends the day). Stored as HH:MM.
    let actualClockOut = null;
    const actualClockOutStr = String(todayInputs.actualClockOut || '').trim();
    if (actualClockOutStr && /^\d{1,2}:\d{2}$/.test(actualClockOutStr)) {
      const [hh, mm] = actualClockOutStr.split(':').map(Number);
      const base = new Date(currentTime);
      base.setHours(hh, mm, 0, 0);
      actualClockOut = base;
    }

    // Minutes until predicted clock-out. Negative means we're past predicted time.
    const minutesUntilClockOut = predClockOut ? Math.round((predClockOut - currentTime) / 1000 / 60) : null;

    // Prediction error once the day is ended (actual - predicted).
    const predictionErrorMinutes = (actualClockOut && predClockOut)
      ? Math.round((actualClockOut - predClockOut) / 1000 / 60)
      : null;

    const officeMinutes = Number(todayInputs.actualOfficeTime || 0);
    const leaveOfficeTime = todayInputs.leaveOfficeTime || '';

    const stops = (() => {
      const route = currentRouteId ? routes?.[currentRouteId] : null;
      const n = route?.stops;
      return Number.isFinite(n) && n > 0 ? n : null;
    })();

    const predStreetMinutes = Number(todayPrediction?.streetTime || todayPrediction?.streetMinutes || todayPrediction?.predictedStreetMinutes || 0) || null;
    const paceMinPerStop = stops && predStreetMinutes ? (predStreetMinutes / stops) : null;

    return {
      predClockOut,
      actualClockOut,
      actualClockOutStr,
      minutesUntilClockOut,
      predictionErrorMinutes,
      officeMinutes,
      leaveOfficeTime,
      stops,
      predStreetMinutes,
      paceMinPerStop,
    };
  }, [todayPrediction, currentTime, todayInputs, currentRouteId, routes]);

  const stats = useMemo(() => {
    try {
      if (!history || history.length === 0) {
        return null;
      }

      const safeHistory = (history || []).filter(Boolean);
      const totalDays = safeHistory.length;

      if (totalDays === 0) return null;

      const last30Days = safeHistory.filter(day => {
      const dayDate = new Date(day.date);
      const now = new Date();
      const diffDays = (now - dayDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 30;
    });

    const avgDPS = Math.round(
      safeHistory.reduce((sum, day) => sum + (day.dps || 0), 0) / totalDays
    );
    const avgFlats = safeHistory.reduce((sum, day) => sum + (day.flats || 0), 0) / totalDays;
    const avgParcels = Math.round(
      safeHistory.reduce((sum, day) => sum + (day.parcels || 0), 0) / totalDays
    );
    const avgStreetTime = safeHistory.reduce((sum, day) => sum + (day.streetTime || day.street_time || 0), 0) / totalDays;

    // Overtime: anything past tour length (default 8.5h) counts as OT.
    // We compute this from 722 (office) + 721 (street) + 744 (pm office) to avoid relying on saved overtime fields.
    const route = Array.isArray(routes)
      ? routes.find((r) => r?.id === currentRouteId)
      : routes?.[currentRouteId];
    const tourMinutes = Math.round(Number(route?.tourLength ?? route?.tour_length ?? 8.5) * 60);

    const getMinutes = (day) => {
      if (!day) return 0;
      const am722 = Number(day.officeTime ?? day.office_time ?? 0) || 0;
      const pm744 = Number(day.pmOfficeTime ?? day.pm_office_time ?? 0) || 0;
      const street721 = Number(day.streetTimeNormalized ?? day.street_time_normalized ?? day.streetTime ?? day.street_time ?? 0) || 0;
      return am722 + pm744 + street721;
    };

    const totalOvertime = safeHistory.reduce((sum, day) => {
      const ot = Math.max(0, getMinutes(day) - tourMinutes);
      return sum + ot;
    }, 0);

    const avgOvertime = totalOvertime / totalDays;

    const bestDay = safeHistory.reduce((best, day) => {
      const streetTime = day.streetTime || day.street_time || 999999;
      const bestTime = best.streetTime || best.street_time || 999999;
      return streetTime < bestTime ? day : best;
    }, safeHistory[0]);

    const last7Days = safeHistory.filter(day => {
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
    } catch (e) {
      console.error('[StatsScreen] stats calc failed:', e);
      return null;
    }
  }, [history, routes, currentRouteId, activeRoute?.id, currentRoute?.id]);

  const suspiciousDays = useMemo(() => {
    const safeHistory = (history || []).filter(Boolean);
    if (!safeHistory.length) return [];

    const route = Array.isArray(routes)
      ? routes.find((r) => r?.id === currentRouteId)
      : routes?.[currentRouteId];
    const tourMinutes = Math.round(Number(route?.tourLength ?? route?.tour_length ?? 8.5) * 60);

    const out = [];
    for (const day of safeHistory) {
      const st = Number(day.streetTimeNormalized ?? day.street_time_normalized ?? day.streetTime ?? day.street_time ?? 0) || 0;
      const am = Number(day.officeTime ?? day.office_time ?? 0) || 0;
      const pm = Number(day.pmOfficeTime ?? day.pm_office_time ?? 0) || 0;
      const total = st + am + pm;

      const flags = [];
      if (st > 0 && st < 120) flags.push(`721 low (${st}m)`);
      if (st > 720) flags.push(`721 high (${st}m)`);
      if (am > 240) flags.push(`722 high (${am}m)`);
      if (pm > 120) flags.push(`744 high (${pm}m)`);
      if (total > 14 * 60) flags.push(`total high (${total}m)`);
      if (tourMinutes && (total - tourMinutes) > 240) flags.push(`OT huge (+${total - tourMinutes}m)`);

      if (flags.length) {
        out.push({
          date: day.date,
          flags,
        });
      }
    }

    return out.slice(0, 10);
  }, [history, routes, currentRouteId]);

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

  const averageTimes = useMemo(() => {
    if (!history || history.length === 0) return null;

    const days = history.filter((d) => {
      const st = d.streetTimeNormalized ?? d.street_time_normalized ?? d.streetTime ?? d.street_time;
      const hasAny = (d.officeTime ?? d.office_time ?? 0) > 0 || (st ?? 0) > 0 || (d.pmOfficeTime ?? d.pm_office_time ?? 0) > 0;
      return hasAny;
    });

    if (days.length === 0) return null;

    const avg = (arr) => arr.reduce((s, n) => s + n, 0) / (arr.length || 1);

    const am722 = avg(days.map((d) => Number(d.officeTime ?? d.office_time ?? 0) || 0));
    const street721Raw = avg(days.map((d) => Number(d.streetTimeNormalized ?? d.street_time_normalized ?? d.streetTime ?? d.street_time ?? 0) || 0));
    const pm744Samples = days
      .map((d) => Number(d.pmOfficeTime ?? d.pm_office_time ?? 0) || 0)
      .filter((n) => n > 0)
      .slice(0, 30);

    const pm744 = avg(pm744Samples.length ? pm744Samples : days.map((d) => Number(d.pmOfficeTime ?? d.pm_office_time ?? 0) || 0));

    // P85 cap for 744 (last 30 days) to reduce "helping others" outliers.
    let pm744P85 = 0;
    if (pm744Samples.length) {
      const sorted = [...pm744Samples].sort((a, b) => a - b);
      const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(0.85 * sorted.length) - 1));
      pm744P85 = Math.round(sorted[idx]);
    }

    // USPS lunch assumption for stats: 30 minutes is deducted unless pre-approved no-lunch.
    const street721Adjusted = Math.max(0, street721Raw - 30);

    const total = am722 + street721Adjusted + pm744;

    return {
      days: days.length,
      am722: Math.round(am722),
      street721Raw: Math.round(street721Raw),
      street721: Math.round(street721Adjusted),
      pm744: Math.round(pm744),
      pm744P85,
      pm744Used: pm744P85 ? Math.min(Math.round(pm744), pm744P85) : Math.round(pm744),
      total: Math.round(total),
      lunchDeductedMinutes: 30,
    };
  }, [history]);

  const predictionAccuracy = useMemo(() => {
    const safeHistory = (history || []).filter(Boolean);

    const toMins = (t) => {
      const s = String(t || '').trim();
      if (!/^\d{1,2}:\d{2}$/.test(s)) return null;
      const [hh, mm] = s.split(':').map(Number);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
      return hh * 60 + mm;
    };

    // Use the most recent 14 records that have both times.
    const rows = safeHistory
      .filter((d) => d?.predictedReturnTime && d?.actualClockOut)
      .slice(0, 30)
      .map((d) => {
        const predicted = toMins(d.predictedReturnTime);
        const actual = toMins(d.actualClockOut);
        if (predicted == null || actual == null) return null;
        return {
          date: d.date,
          predicted,
          actual,
          error: actual - predicted,
        };
      })
      .filter(Boolean)
      .slice(0, 14)
      .reverse();

    if (!rows.length) return null;

    const avgAbsError = Math.round(rows.reduce((s, r) => s + Math.abs(r.error), 0) / rows.length);
    const within5 = rows.filter((r) => Math.abs(r.error) <= 5).length;

    const minY = Math.min(...rows.flatMap((r) => [r.predicted, r.actual]));
    const maxY = Math.max(...rows.flatMap((r) => [r.predicted, r.actual]));

    return {
      rows,
      avgAbsError,
      within5,
      minY,
      maxY,
    };
  }, [history]);

  // % to Standard uses total 722 time, so no extra setup data is required.
  const hasCasingWithdrawalData = true;

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

        {error ? (
          <Card className="bg-red-50 border-2 border-red-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-700 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900">Stats couldn’t load</h3>
                <p className="text-sm text-red-800 mt-1 break-words">{String(error)}</p>
                <Button className="mt-4" onClick={() => currentRouteId && loadRouteHistory?.(currentRouteId)}>
                  Retry
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200">
            <div className="text-center py-8">
              <Package className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">No Data Yet</h3>
              <p className="text-gray-700 mb-4">Complete your first route to start seeing statistics and insights.</p>
              <p className="text-sm text-gray-600">Your route averages and predictions will improve with each completed day.</p>
            </div>
          </Card>
        )}
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

      <Card className="mb-4 bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Today's Stats
          </h3>
          <span className="text-xs text-gray-600">live</span>
        </div>

        {!hasActiveRoute ? (
          <p className="text-sm text-gray-700">
            Enter today's mail volumes on the Today tab to see predictions and pace.
          </p>
        ) : !todayStats.predClockOut ? (
          <p className="text-sm text-gray-700">
            Calculating today's prediction...
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/70 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Predicted Clock-Out</p>
              <p className="text-xl font-bold text-gray-900">
                {formatTimeAMPM(todayStats.predClockOut)}
              </p>
            </div>

            <div className="bg-white/70 rounded-lg p-3">
              {todayStats.actualClockOut ? (
                <>
                  <p className="text-xs text-gray-600 mb-1">Actual Clock-Out</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatTimeAMPM(todayStats.actualClockOut)}
                  </p>
                  {todayStats.predictionErrorMinutes != null ? (
                    <p className={`text-xs mt-1 font-semibold ${
                      Math.abs(todayStats.predictionErrorMinutes) <= 5
                        ? 'text-green-700'
                        : todayStats.predictionErrorMinutes > 0
                          ? 'text-red-700'
                          : 'text-blue-700'
                    }`}>
                      Prediction was {todayStats.predictionErrorMinutes > 0 ? 'late' : 'early'} by {Math.abs(todayStats.predictionErrorMinutes)}m
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">Prediction comparison unavailable</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-600 mb-1">Time Until Clock-Out</p>
                  {todayStats.minutesUntilClockOut == null ? (
                    <p className="text-xl font-bold text-gray-900">--</p>
                  ) : (
                    <p className={`text-xl font-bold ${
                      todayStats.minutesUntilClockOut < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {todayStats.minutesUntilClockOut < 0
                        ? `Over by ${formatDurationMinutes(todayStats.minutesUntilClockOut)}`
                        : formatDurationMinutes(todayStats.minutesUntilClockOut)}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="bg-white/70 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Office Time So Far</p>
              <p className="text-xl font-bold text-gray-900">
                {Math.round(todayStats.officeMinutes)}m
              </p>
              {todayStats.leaveOfficeTime ? (
                <p className="text-xs text-gray-600 mt-1">Left office: {todayStats.leaveOfficeTime}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Leave time not set</p>
              )}
            </div>

            <div className="bg-white/70 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Street Pace (est.)</p>
              {todayStats.paceMinPerStop ? (
                <p className="text-xl font-bold text-gray-900">
                  {todayStats.paceMinPerStop.toFixed(1)} min/stop
                </p>
              ) : (
                <p className="text-sm text-gray-700">
                  Add route stops in Settings to see pace.
                </p>
              )}
              {todayStats.stops ? (
                <p className="text-xs text-gray-600 mt-1">Stops: {todayStats.stops}</p>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-gray-900">Prediction Accuracy</h3>
          </div>
          {predictionAccuracy ? (
            <span className="text-xs text-gray-700">last {predictionAccuracy.rows.length} days</span>
          ) : (
            <span className="text-xs text-gray-700">not enough data yet</span>
          )}
        </div>

        {!predictionAccuracy ? (
          <div className="bg-white/70 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-900 mb-1">Complete a day to start tracking accuracy</p>
            <p className="text-sm text-gray-700">
              When you finish a route, RouteWise saves the predicted time and your actual clock-out.
              After that, this chart will show how close the prediction was.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-white/70 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Avg Error (abs)</p>
              <p className="text-xl font-bold text-gray-900">{predictionAccuracy.avgAbsError}m</p>
              <p className="text-xs text-gray-600 mt-1">Within 5m: {predictionAccuracy.within5}/{predictionAccuracy.rows.length}</p>
            </div>
            <div className="bg-white/70 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">What this is</p>
              <p className="text-sm text-gray-700">
                Predicted return/clock-out vs actual clock-out (saved when you end the day).
              </p>
            </div>
          </div>

          <div className="bg-white/70 rounded-lg p-3">
            <svg viewBox="0 0 360 140" className="w-full h-36">
              {(() => {
                const rows = predictionAccuracy.rows;
                const minY = predictionAccuracy.minY;
                const maxY = predictionAccuracy.maxY;
                const padL = 26;
                const padR = 10;
                const padT = 10;
                const padB = 22;
                const W = 360;
                const H = 140;
                const innerW = W - padL - padR;
                const innerH = H - padT - padB;
                const span = Math.max(1, maxY - minY);

                const x = (i) => padL + (rows.length === 1 ? innerW / 2 : (i * innerW) / (rows.length - 1));
                const y = (mins) => padT + innerH - ((mins - minY) / span) * innerH;

                const pathFor = (key) =>
                  rows
                    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(r[key]).toFixed(1)}`)
                    .join(' ');

                const fmt = (mins) => {
                  const h = Math.floor(mins / 60) % 24;
                  const m = mins % 60;
                  const hh = String(h).padStart(2, '0');
                  const mm = String(m).padStart(2, '0');
                  return `${hh}:${mm}`;
                };

                return (
                  <>
                    {/* axes */}
                    <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#9CA3AF" strokeWidth="1" />
                    <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#9CA3AF" strokeWidth="1" />

                    {/* y labels */}
                    <text x={0} y={padT + 10} fontSize="10" fill="#6B7280">{fmt(maxY)}</text>
                    <text x={0} y={H - padB} fontSize="10" fill="#6B7280">{fmt(minY)}</text>

                    {/* predicted line */}
                    <path d={pathFor('predicted')} fill="none" stroke="#2563EB" strokeWidth="2" />
                    {/* actual line */}
                    <path d={pathFor('actual')} fill="none" stroke="#16A34A" strokeWidth="2" />

                    {/* points */}
                    {rows.map((r, i) => (
                      <g key={r.date || i}>
                        <circle cx={x(i)} cy={y(r.predicted)} r="3" fill="#2563EB" />
                        <circle cx={x(i)} cy={y(r.actual)} r="3" fill="#16A34A" />
                      </g>
                    ))}

                    {/* x labels (first + last) */}
                    <text x={padL} y={H - 6} fontSize="10" fill="#6B7280">{rows[0]?.date || ''}</text>
                    <text x={W - padR} y={H - 6} fontSize="10" fill="#6B7280" textAnchor="end">{rows[rows.length - 1]?.date || ''}</text>

                    {/* legend */}
                    <rect x={padL} y={padT} width="8" height="8" fill="#2563EB" />
                    <text x={padL + 12} y={padT + 8} fontSize="10" fill="#374151">Predicted</text>
                    <rect x={padL + 80} y={padT} width="8" height="8" fill="#16A34A" />
                    <text x={padL + 92} y={padT + 8} fontSize="10" fill="#374151">Actual</text>
                  </>
                );
              })()}
            </svg>
          </div>
          </>
        )}
      </Card>

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

      {averageTimes && (
        <Card className="mb-4 bg-gradient-to-br from-slate-50 to-indigo-50 border-2 border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-gray-900">Average Times</h3>
            </div>
            <span className="text-xs text-gray-600">{averageTimes.days} days</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/70 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">722 AM Office</p>
              <p className="text-xl font-bold text-gray-900">{averageTimes.am722}m</p>
            </div>
            <div className="bg-white/70 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">721 Street (minus lunch)</p>
              <p className="text-xl font-bold text-gray-900">{averageTimes.street721}m</p>
              <p className="text-xs text-gray-500 mt-1">Raw: {averageTimes.street721Raw}m</p>
            </div>
            <div className="bg-white/70 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">744 PM Office</p>
              <p className="text-xl font-bold text-gray-900">{averageTimes.pm744}m</p>
              {averageTimes.pm744P85 ? (
                <p className="text-xs text-gray-500 mt-1">P85 cap: {averageTimes.pm744P85}m</p>
              ) : null}
            </div>
            <div className="bg-white/70 rounded-lg p-3 border border-indigo-200">
              <p className="text-xs text-gray-600 mb-1">Average Route Time</p>
              <p className="text-xl font-bold text-indigo-700">{formatMinutesAsTime(averageTimes.total)}</p>
              <p className="text-xs text-gray-500 mt-1">(722 + 721 − 30 + 744)</p>
              {averageTimes.pm744P85 ? (
                <p className="text-xs text-gray-500 mt-1">Prediction uses min(avg 744, P85) = {averageTimes.pm744Used}m</p>
              ) : null}
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
      {officePerformanceStats && (
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
                  {formatMinutesAsTime(averages.normal)}
                </span>
              </div>
            </div>
          )}
          {averages.monday && (
            <div className="bg-white/70 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Monday</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatMinutesAsTime(averages.monday)}
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

      {suspiciousDays.length > 0 && (
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
          <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
            Data Quality
          </h3>
          <p className="text-xs text-amber-800 mb-3">
            These days have unusual time values and can hurt prediction accuracy.
          </p>
          <div className="space-y-2">
            {suspiciousDays.slice(0, 5).map((d) => {
              let label = String(d.date || '');
              try {
                if (d.date && /^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) {
                  label = format(parseLocalDate(d.date), 'EEE, MMM d');
                }
              } catch {}

              return (
                <div key={String(d.date || Math.random())} className="bg-white/70 rounded-lg p-3 border border-amber-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-800">{label}</div>
                    <div className="text-xs text-amber-800">{d.flags.join(' • ')}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-amber-700 mt-3">
            Tip: If one of these was a bad/partial day, delete it so it doesn’t poison your averages.
          </p>
        </Card>
      )}

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

      {/* Recent History removed */}
    </div>
  );
}
