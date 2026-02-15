import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import Card from '../shared/Card';
import Button from '../shared/Button';
import Input from '../shared/Input';
import useRouteStore from '../../stores/routeStore';
// pmOfficeService removed (744 PM Office Time card removed)
import { routeProtectionService } from '../../services/routeProtectionService';
import { formatMinutesAsTime, parseLocalDate, formatTimeAMPM, getLocalDateString } from '../../utils/time';
import { getWorkweekStart } from '../../utils/uspsConstants';
import { calculateRecordDays, formatRecordValue, formatRecordDate } from '../../services/recordStatsService';
// Office Performance (% to Standard) removed (was confusing/inaccurate)
// import { calculateAveragePerformance } from '../../utils/percentToStandard';
import { calculateFullDayPrediction } from '../../services/predictionService';
import { ensureRouteHistoryDay, updateRouteHistory, moveDayToRoute } from '../../services/routeHistoryService';
import { getStreetTimeSummaryByDate, getOperationCodesForDate } from '../../services/streetTimeHistoryService';
import { formatUtcAsChicago } from '../../utils/timezone';
import { deriveOfficeTimeMinutes, findFirst721 } from '../../utils/deriveOfficeTime';
import { buildExpandedDayHistoryRows, shouldUseFixedCoreRows } from '../../utils/dayHistoryDisplay';
import { Clock, TrendingUp, Calendar, Package, Timer, Target, Activity, Award, AlertTriangle, Shield, Trophy, History as HistoryIcon } from 'lucide-react';

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

  const [fixDayOpen, setFixDayOpen] = useState(false);
  const [fixDaySaving, setFixDaySaving] = useState(false);
  const [fixDayMoving, setFixDayMoving] = useState(false);
  const [fixDayMoveRouteId, setFixDayMoveRouteId] = useState('');
  const [fixDayRecord, setFixDayRecord] = useState(null);
  const [fixDayForm, setFixDayForm] = useState({
    dps: '',
    flats: '',
    letters: '',
    parcels: '',
    sprs: '',
    safetyTalk: '',
    amOfficeTime: '',
    streetTime: '',
    pmOfficeTime: '',
    hasBoxholder: false,
    excludeFromAverages: false,
    assistance: false,
    assistanceMinutes: '',
    notes: '',
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayPrediction, setTodayPrediction] = useState(null);
  // PM Office stats removed
  const [protectionStatus, setProtectionStatus] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState(null);

  // Today's timeline
  const [todayOps, setTodayOps] = useState([]);

  // Day History (operation codes)
  const [daySummaries, setDaySummaries] = useState([]);
  const [dayDetails, setDayDetails] = useState({});
  const [expandedDay, setExpandedDay] = useState(null);


  // Daily Volume Log (debugging volumes saved to Supabase)
  const [expandedVolumeDate, setExpandedVolumeDate] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadProtectionData();
  }, [activeRoute?.id]);

  useEffect(() => {
    // Load day summaries for the current route (recent days)
    async function loadDaySummaries() {
      if (!currentRouteId) return;
      try {
        const summary = await getStreetTimeSummaryByDate(currentRouteId);
        setDaySummaries(Array.isArray(summary) ? summary.slice(0, 14) : []);
      } catch (e) {
        console.warn('[StatsScreen] Failed to load day summaries:', e?.message || e);
        setDaySummaries([]);
      }
    }

    loadDaySummaries();
  }, [currentRouteId]);

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

  useEffect(() => {
    async function loadTodayOps() {
      if (!currentRouteId) return;
      const today = getLocalDateString();
      try {
        const rows = await getOperationCodesForDate(currentRouteId, today);
        setTodayOps(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.warn('[StatsScreen] Failed to load today operation codes:', e?.message || e);
        setTodayOps([]);
      }
    }

    loadTodayOps();
  }, [currentRouteId]);

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


  const volumeRows = useMemo(() => {
    // routeStore.loadRouteHistory loads ~90 days by default
    const rows = Array.isArray(history) ? history.slice(0, 90) : [];

    // Important: treat missing (null/undefined) as “not saved yet”, not as 0.
    // 0 is a real value; null means we don’t have data for that field/day.
    const numOrNull = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    return rows
      .filter((r) => r?.date)
      .map((r) => ({
        date: r.date,
        dps: numOrNull(r.dps),
        flats: numOrNull(r.flats),
        letters: numOrNull(r.letters),
        parcels: numOrNull(r.parcels),
        sprs: numOrNull(r.sprs),
        scannerTotal: numOrNull(r.scannerTotal),
        curtailedLetters: numOrNull(r.curtailedLetters) ?? 0,
        curtailedFlats: numOrNull(r.curtailedFlats) ?? 0,
        hasBoxholder: !!r.hasBoxholder,
        notes: r.notes || '',
      }));
  }, [history]);

  const hasActiveRoute = useMemo(() => {
    // Must be boolean; returning a number here can render a stray "0" in React when used like:
    // {hasActiveRoute && (...)}
    return !!(
      todayInputs.dps ||
      todayInputs.flats ||
      todayInputs.letters ||
      todayInputs.parcels ||
      todayInputs.sprs ||
      // Some users only enter scanner/package totals.
      todayInputs.scannerTotal
    );
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
        id: day.id,
        date: day.date,
        predictedTime: day.predicted_leave_time,
        actualTime: day.actual_leave_time,
        variance,
        predictedOfficeTime: day.predicted_office_time,
        actualOfficeTime: day.actual_office_time,
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

  // Office Performance (% to Standard) removed (was confusing/inaccurate)
  // const officePerformanceStats = useMemo(() => {
  //   if (!history || history.length === 0) return null;
  //
  //   return calculateAveragePerformance(history);
  // }, [history]);

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
      .filter((d) => (d?.predictedClockOut || d?.predictedReturnTime) && d?.actualClockOut)
      .slice(0, 30)
      .map((d) => {
        // Prefer true clock-out prediction when available.
        const predicted = toMins(d.predictedClockOut || d.predictedReturnTime);
        const actual = toMins(d.actualClockOut);
        if (predicted == null || actual == null) return null;
        return {
          date: d.date,
          predicted,
          actual,
          error: actual - predicted,
          usedClockOut: !!d.predictedClockOut,
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

  const getDayDetail = async (date) => {
    if (!currentRouteId || !date) return;

    // Toggle collapse if clicking the open one
    if (expandedDay === date) {
      setExpandedDay(null);
      return;
    }

    setExpandedDay(date);

    if (dayDetails?.[date]) return;

    try {
      const rows = await getOperationCodesForDate(currentRouteId, date);
      setDayDetails((prev) => ({
        ...(prev || {}),
        [date]: rows || [],
      }));
    } catch (e) {
      console.warn('[StatsScreen] Failed to load operation codes for', date, e?.message || e);
      setDayDetails((prev) => ({
        ...(prev || {}),
        [date]: [],
      }));
    }
  };

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
            Today
          </h3>
          <span className="text-xs text-gray-600">live</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
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
            <p className="text-xs text-gray-600 mb-1">Actual Clock-Out</p>
            <p className="text-xl font-bold text-gray-900">
              {todayStats.actualClockOut ? formatTimeAMPM(todayStats.actualClockOut) : '--'}
            </p>
            <p className="text-xs text-gray-500 mt-1">(predicted removed)</p>
          </div>
        </div>

        <div className="bg-white/70 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-900">Today timeline</p>
            <p className="text-xs text-gray-600">{getLocalDateString()}</p>
          </div>

          {todayOps.length === 0 ? (
            <p className="text-sm text-gray-700">No timers saved yet today.</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                const routeStartHHMM = (routes?.[currentRouteId]?.startTime || todayInputs?.startTimeOverride || '07:30');
                const first721 = findFirst721(todayOps);
                const derived722 = (first721?.start_time)
                  ? deriveOfficeTimeMinutes(routeStartHHMM, first721.start_time)
                  : 0;
                const has722 = todayOps.some((r) => r?.code === '722');

                const computed722Row = (!has722 && derived722 > 0 && first721?.start_time)
                  ? {
                      id: `derived-722-${getLocalDateString()}`,
                      code: '722',
                      code_name: 'AM Office (derived)',
                      duration_minutes: derived722,
                      start_time: `${getLocalDateString()}T${routeStartHHMM}:00`,
                      end_time: first721.start_time,
                      _derived: true,
                    }
                  : null;

                const displayRows = computed722Row ? [computed722Row, ...todayOps] : todayOps;

                return displayRows.map((row) => {
                  const mins = Number(row.duration_minutes || 0) || 0;
                  const label = row.code_name || row.code || 'Code';

                  const start = row?._derived
                    ? formatTimeAMPM(new Date(`${getLocalDateString()}T${routeStartHHMM}:00`))
                    : (row.start_time ? formatUtcAsChicago(row.start_time) : '--');
                  const end = row?._derived
                    ? (row.end_time ? formatUtcAsChicago(row.end_time) : '--')
                    : (row.end_time ? formatUtcAsChicago(row.end_time) : '--');

                  return (
                    <div key={row.id} className="flex items-center justify-between bg-white rounded p-2 text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">{row.code} — {label}</p>
                        <p className="text-xs text-gray-600">{start} → {end}</p>
                      </div>
                      <div className="font-mono text-gray-900">{formatMinutesAsTime(Math.round(mins))}</div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
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
                Predicted clock-out vs actual clock-out (saved when you end the day).
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

      <Card className="mb-4 bg-gradient-to-br from-indigo-50 to-slate-50 border-2 border-indigo-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-700" />
            <h3 className="font-bold text-gray-900">Daily Volume Log</h3>
          </div>
          <span className="text-xs text-gray-700">last {Math.min(90, volumeRows.length)} days • from Supabase</span>
        </div>

        {volumeRows.length === 0 ? (
          <div className="bg-white/70 rounded-lg p-4">
            <p className="text-sm text-gray-700">No saved volume history found yet.</p>
            <p className="text-xs text-gray-600 mt-1">This list shows what RouteWise actually saved to Supabase for each day.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {volumeRows.map((r) => {
              const isOpen = expandedVolumeDate === r.date;
              const display = (v) => (v === null || v === undefined ? '—' : v);
              const hasAnyVolume = [r.dps, r.flats, r.letters, r.parcels, r.sprs].some((v) => v !== null && v !== undefined);
              const total = (r.dps || 0) + (r.flats || 0) + (r.letters || 0) + (r.parcels || 0) + (r.sprs || 0);

              return (
                <button
                  key={r.date}
                  type="button"
                  className="w-full text-left bg-white rounded-lg p-3 border border-indigo-100 hover:border-indigo-200"
                  onClick={() => setExpandedVolumeDate((cur) => (cur === r.date ? null : r.date))}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{format(parseLocalDate(r.date), 'EEE MMM d')}</p>
                      <p className="text-xs text-gray-600">
                        D {display(r.dps)} • F {display(r.flats)} • L {display(r.letters)} • P {display(r.parcels)} • SPR {display(r.sprs)}
                        {!hasAnyVolume ? <span className="ml-2 text-amber-700">(not saved)</span> : null}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600">Total</p>
                      <p className="font-mono text-sm text-gray-900">{hasAnyVolume ? total : '—'}</p>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-indigo-100 text-sm text-gray-800">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-600">DPS</p>
                          <p className="font-mono">{display(r.dps)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Flats</p>
                          <p className="font-mono">{display(r.flats)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Letters</p>
                          <p className="font-mono">{display(r.letters)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Parcels</p>
                          <p className="font-mono">{display(r.parcels)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">SPRs</p>
                          <p className="font-mono">{display(r.sprs)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Scanner Total</p>
                          <p className="font-mono">{display(r.scannerTotal)}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        {r.hasBoxholder ? 'Boxholder: yes' : 'Boxholder: no'}
                        {(r.curtailedLetters || r.curtailedFlats) ? ` • Curtailed L ${r.curtailedLetters} / F ${r.curtailedFlats}` : ''}
                      </div>
                      {r.notes ? (
                        <p className="mt-2 text-xs text-gray-600 whitespace-pre-line">Notes: {r.notes}</p>
                      ) : null}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
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

      {daySummaries && daySummaries.length > 0 && (
        <Card className="mb-4 bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-slate-700" />
              <h3 className="font-bold text-gray-900">Day History</h3>
            </div>
            <span className="text-xs text-gray-600">tap a day to expand</span>
          </div>

          <div className="space-y-2">
            {daySummaries.map((d) => {
              const codes = d?.codes || {};

              // 722 is not always recorded as an operation code (often derived from clock-in -> 721 start).
              // route_history is normally the source of truth, BUT we must tolerate bad/partial rows
              // (e.g. if the browser lost state or End Tour never saved correctly).
              const hist = (history || []).find((h) => h?.date === d.date);

              const routeStartHHMM = (routes?.[currentRouteId]?.startTime || todayInputs?.startTimeOverride || '07:30');
              const first721StartUtc = d?.first_721_start || null;
              const derived722 = first721StartUtc ? deriveOfficeTimeMinutes(routeStartHHMM, first721StartUtc) : 0;

              const codes722 = Number(codes['722'] ?? 0) || 0;
              const codes721 = Number(codes['721'] ?? 0) || 0;
              const codes744 = Number(codes['744'] ?? 0) || 0;

              const hist722 = Number(hist?.officeTime ?? hist?.office_time ?? 0) || 0;
              const hist721 = Number(hist?.streetTimeNormalized ?? hist?.street_time_normalized ?? hist?.streetTime ?? hist?.street_time ?? 0) || 0;
              const hist744 = Number(hist?.pmOfficeTime ?? hist?.pm_office_time ?? 0) || 0;

              // Prefer history when it looks sane; otherwise fall back to operation_codes.
              // This fixes cases where timers show (e.g.) 7:12 street time but route_history shows 0:42.
              let m722 = hist722 || codes722 || 0;
              if (!m722 && derived722) m722 = derived722;

              const m721 = (hist721 > 0 && (codes721 <= 0 || hist721 >= Math.round(codes721 * 0.8)))
                ? hist721
                : (codes721 || hist721 || 0);

              const m744 = (hist744 > 0 && (codes744 <= 0 || hist744 >= Math.round(codes744 * 0.8)))
                ? hist744
                : (codes744 || hist744 || 0);

              const lunch = 30;
              const core = Math.max(0, m722 + m721 + m744 - lunch);

              const offRoute = Object.entries(codes)
                .filter(([code]) => !['722', '721', '744'].includes(code))
                .reduce((s, [, mins]) => s + (Number(mins) || 0), 0);

              const total = core + offRoute;

              const isOpen = expandedDay === d.date;

              const detailRows = (dayDetails?.[d.date] || []);

              // If the user has manually fixed minutes for this day (Fix this day modal), the
              // route_history minutes become the source of truth. The timer-based detail rows can be stale
              // (e.g. 721 shows 0:00) and should not be displayed for core codes.
              const useFixedCore = shouldUseFixedCoreRows({ hist, detailRows });

              // In timer mode, we sometimes synthesize a derived 722 row (clock-in -> first 721 start).
              const hasRecorded722 = detailRows.some((r) => String(r?.code) === '722');
              const computed722Row = (!useFixedCore && !hasRecorded722 && derived722 > 0 && first721StartUtc)
                ? {
                    id: `derived-722-${d.date}`,
                    code: '722',
                    code_name: 'AM Office (derived)',
                    duration_minutes: derived722,
                    start_time: `${d.date}T${routeStartHHMM}:00`,
                    end_time: first721StartUtc,
                    _derived: true,
                  }
                : null;

              const timerRows = computed722Row ? [computed722Row, ...detailRows] : detailRows;

              const { rows: displayRows } = buildExpandedDayHistoryRows({
                date: d.date,
                detailRows: timerRows,
                hist,
                codeNameByCode: {
                  '722': 'AM Office',
                  '721': 'Street Time',
                  '744': 'PM Office',
                },
                useFixed: useFixedCore,
              });

              return (
                <div key={d.date} className="bg-white/70 rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    className="w-full text-left p-3"
                    onClick={() => getDayDetail(d.date)}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {format(parseLocalDate(d.date), 'EEEE, MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">Route time: {formatMinutesAsTime(Math.round(total))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">722+721+744−30</p>
                        <p className="text-sm font-bold text-gray-900">{formatMinutesAsTime(Math.round(core))}</p>
                        {offRoute > 0 ? (
                          <p className="text-xs font-semibold text-orange-700 mt-0.5">Off-route: +{Math.round(offRoute)}m</p>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-slate-200 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          className="text-xs font-semibold text-blue-700 underline"
                          onClick={async () => {
                            let record = (history || []).find((h) => h?.date === d.date) || null;
                            if (!record) {
                              try {
                                record = await ensureRouteHistoryDay(currentRouteId, d.date);
                                await loadRouteHistory(currentRouteId);
                              } catch (e) {
                                alert(e?.message || 'No saved day record found yet for that date.');
                                return;
                              }
                            }

                            setFixDayRecord(record);
                            setFixDayMoveRouteId(currentRouteId || '');
                            setFixDayForm({
                              dps: record.dps ?? '',
                              flats: record.flats ?? '',
                              letters: record.letters ?? '',
                              parcels: record.parcels ?? '',
                              sprs: record.sprs ?? '',
                              safetyTalk: record.safetyTalk ?? '',
                              amOfficeTime: record.officeTime ?? record.office_time ?? '',
                              streetTime: record.streetTimeNormalized ?? record.street_time_normalized ?? record.streetTime ?? record.street_time ?? '',
                              pmOfficeTime: record.pmOfficeTime ?? record.pm_office_time ?? '',
                              hasBoxholder: !!record.hasBoxholder,
                              excludeFromAverages: !!record.excludeFromAverages,
                              assistance: !!record.auxiliaryAssistance,
                              assistanceMinutes: record.assistanceMinutes ?? '',
                              notes: record.notes ?? '',
                            });
                            setFixDayOpen(true);
                          }}
                        >
                          Fix this day
                        </button>

                        <button
                          className="text-xs font-semibold text-slate-700 underline"
                          onClick={async () => {
                            try {
                              let record = (history || []).find((h) => h?.date === d.date) || null;
                              if (!record) {
                                record = await ensureRouteHistoryDay(currentRouteId, d.date);
                              }

                              // Compute minutes from the timers (operation_codes) for this day.
                              const c = d?.codes || {};
                              const routeStartHHMM = (routes?.[currentRouteId]?.startTime || todayInputs?.startTimeOverride || '07:30');
                              const first721StartUtc = d?.first_721_start || null;
                              const derived722 = first721StartUtc ? deriveOfficeTimeMinutes(routeStartHHMM, first721StartUtc) : 0;

                              const m722 = Number(c['722'] || 0) || derived722 || 0;
                              const m721 = Number(c['721'] || 0) || 0;
                              const m744 = Number(c['744'] || 0) || 0;

                              // ⚠️ Safety: "Sync from timers" should NOT erase a manually-fixed 744 (or other overrides)
                              // just because the timer session row is missing.
                              // Example: carrier starts 744 then hits End Tour (timer row fails to persist) → m744=0.
                              // In that case, keep the existing route_history.pm_office_time.
                              const existing722 = Number(record?.office_time || 0) || 0;
                              const existing721 = Number(record?.street_time || 0) || 0;
                              const existing744 = Number(record?.pm_office_time || 0) || 0;

                              const next722 = (m722 > 0) ? Math.round(m722) : existing722;
                              const next721 = (m721 > 0) ? Math.round(m721) : existing721;
                              const next744 = (m744 > 0) ? Math.round(m744) : existing744;

                              await updateRouteHistory(record.id, {
                                office_time: next722,
                                street_time: next721,
                                street_time_normalized: next721,
                                pm_office_time: next744,
                              });

                              await loadRouteHistory(currentRouteId);
                              alert('Synced this day from timers (operation codes).');
                            } catch (e) {
                              alert(e?.message || 'Could not sync from timers.');
                            }
                          }}
                          type="button"
                        >
                          Sync from timers
                        </button>
                      </div>
                      {displayRows.length === 0 ? (
                        <p className="text-sm text-gray-700">No detailed codes saved for this day.</p>
                      ) : (
                        <div className="space-y-2">
                          {displayRows.map((row) => {
                            const mins = Number(row.duration_minutes || 0) || 0;
                            const label = row.code_name || row.code || 'Code';
                            const start = row?._derived
                              ? formatTimeAMPM(new Date(`${d.date}T${routeStartHHMM}:00`))
                              : (row.start_time ? formatUtcAsChicago(row.start_time) : '--');
                            const end = row?._derived
                              ? (first721StartUtc ? formatUtcAsChicago(first721StartUtc) : '--')
                              : (row.end_time ? formatUtcAsChicago(row.end_time) : '--');

                            const subline = row?._fixed
                              ? 'fixed'
                              : `${start} → ${end}`;

                            return (
                              <div key={row.id} className="flex items-center justify-between bg-white rounded p-2 text-sm">
                                <div>
                                  <p className="font-semibold text-gray-900">{row.code} — {label}{row?._fixed ? ' (fixed)' : ''}</p>
                                  <p className="text-xs text-gray-600">{subline}</p>
                                </div>
                                <div className="font-mono text-gray-900">{formatMinutesAsTime(Math.round(mins))}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
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
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-medium text-gray-700">
                        {format(parseLocalDate(day.date), 'MMM d')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${
                          Math.abs(day.variance) <= 5 ? 'text-green-600' :
                          day.variance > 0 ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {day.variance > 0 ? '+' : ''}{day.variance}m
                        </span>
                        <button
                          className="text-[11px] font-semibold text-blue-700 underline"
                          onClick={async () => {
                            let record = (history || []).find((h) => h.date === day.date) || null;
                            if (!record) {
                              try {
                                record = await ensureRouteHistoryDay(currentRouteId, day.date);
                                await loadRouteHistory(currentRouteId);
                              } catch (e) {
                                alert(e?.message || 'No saved day record found yet for that date.');
                                return;
                              }
                            }

                            setFixDayRecord(record);
                            setFixDayMoveRouteId(currentRouteId || '');
                            setFixDayForm({
                              dps: record.dps ?? '',
                              flats: record.flats ?? '',
                              letters: record.letters ?? '',
                              parcels: record.parcels ?? '',
                              sprs: record.sprs ?? '',
                              safetyTalk: record.safetyTalk ?? '',
                              amOfficeTime: record.officeTime ?? record.office_time ?? '',
                              streetTime: record.streetTimeNormalized ?? record.street_time_normalized ?? record.streetTime ?? record.street_time ?? '',
                              pmOfficeTime: record.pmOfficeTime ?? record.pm_office_time ?? '',
                              hasBoxholder: !!record.hasBoxholder,
                              excludeFromAverages: !!record.excludeFromAverages,
                              assistance: !!record.auxiliaryAssistance,
                              assistanceMinutes: record.assistanceMinutes ?? '',
                              notes: record.notes ?? '',
                            });
                            setFixDayOpen(true);
                          }}
                        >
                          Fix
                        </button>
                      </div>
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

      {/* Office Performance (% to Standard) removed (was confusing/inaccurate) */}

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

      {fixDayOpen && fixDayRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Fix This Day</h2>
              <p className="text-sm text-gray-600 mb-4">
                {format(parseLocalDate(fixDayRecord.date), 'EEEE, MMMM d, yyyy')}
              </p>

              <div className="space-y-3">
                {/* T-6 / multi-route recovery: move this day to another route */}
                {Object.keys(routes || {}).length > 1 ? (
                  <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <p className="font-semibold text-gray-900 text-sm">Route for this day</p>
                    <p className="text-xs text-gray-600 mb-2">If this day saved under the wrong route, move it here.</p>
                    <select
                      value={fixDayMoveRouteId || ''}
                      onChange={(e) => setFixDayMoveRouteId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                    >
                      {Object.values(routes || {}).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.routeNumber ? `Route ${r.routeNumber}` : r.id}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        disabled={fixDayMoving || fixDaySaving || !fixDayMoveRouteId || fixDayMoveRouteId === currentRouteId}
                        onClick={async () => {
                          if (!fixDayRecord?.date) return;
                          if (!fixDayMoveRouteId || fixDayMoveRouteId === currentRouteId) return;
                          const ok = window.confirm(
                            `Move ${fixDayRecord.date} from the current route to the selected route?\n\nThis will move BOTH the day totals and timers for that date.`
                          );
                          if (!ok) return;

                          try {
                            setFixDayMoving(true);

                            // If destination already has data, offer overwrite.
                            // We don't pre-check via API here; just ask if they want overwrite when needed.
                            let overwrite = window.confirm(
                              `If the selected route already has data for ${fixDayRecord.date}, should we overwrite it?\n\nOK = overwrite if needed\nCancel = do not overwrite`
                            );

                            await moveDayToRoute({
                              fromRouteId: currentRouteId,
                              toRouteId: fixDayMoveRouteId,
                              date: fixDayRecord.date,
                              overwrite,
                            });

                            alert('Moved day to the selected route.');
                            setFixDayOpen(false);
                            setFixDayRecord(null);
                            await loadRouteHistory(currentRouteId);
                          } catch (e) {
                            alert(e?.message || 'Failed to move day');
                          } finally {
                            setFixDayMoving(false);
                          }
                        }}
                      >
                        {fixDayMoving ? 'Moving…' : 'Move day'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={!!fixDayForm.excludeFromAverages}
                    onChange={(e) => setFixDayForm((s) => ({ ...s, excludeFromAverages: e.target.checked }))}
                    className="w-5 h-5"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">Exclude from averages</p>
                    <p className="text-xs text-gray-600">Use for bad data days so predictions stay clean.</p>
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <Input label="DPS" type="number" value={fixDayForm.dps} onChange={(e) => setFixDayForm((s) => ({ ...s, dps: e.target.value }))} />
                  <Input label="Parcels" type="number" value={fixDayForm.parcels} onChange={(e) => setFixDayForm((s) => ({ ...s, parcels: e.target.value }))} />
                  <Input label="Flats (ft)" type="number" step="0.1" value={fixDayForm.flats} onChange={(e) => setFixDayForm((s) => ({ ...s, flats: e.target.value }))} />
                  <Input label="SPRs" type="number" value={fixDayForm.sprs} onChange={(e) => setFixDayForm((s) => ({ ...s, sprs: e.target.value }))} />
                  <Input label="Letters (ft)" type="number" step="0.1" value={fixDayForm.letters} onChange={(e) => setFixDayForm((s) => ({ ...s, letters: e.target.value }))} />
                  <Input label="Safety/Training (min)" type="number" value={fixDayForm.safetyTalk} onChange={(e) => setFixDayForm((s) => ({ ...s, safetyTalk: e.target.value }))} />
                  <Input label="AM Office 722 (min)" type="number" value={fixDayForm.amOfficeTime} onChange={(e) => setFixDayForm((s) => ({ ...s, amOfficeTime: e.target.value }))} />
                  <Input label="Street 721 (min)" type="number" value={fixDayForm.streetTime} onChange={(e) => setFixDayForm((s) => ({ ...s, streetTime: e.target.value }))} />
                  <Input label="PM Office 744 (min)" type="number" value={fixDayForm.pmOfficeTime} onChange={(e) => setFixDayForm((s) => ({ ...s, pmOfficeTime: e.target.value }))} />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!fixDayForm.hasBoxholder}
                    onChange={(e) => setFixDayForm((s) => ({ ...s, hasBoxholder: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  Boxholder/EDDM
                </label>

                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={!!fixDayForm.assistance}
                    onChange={(e) => setFixDayForm((s) => ({ ...s, assistance: e.target.checked }))}
                    className="w-5 h-5"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Assistance / gave away part of route</p>
                    <p className="text-xs text-gray-600">If yes, enter minutes.</p>
                  </div>
                </label>

                {fixDayForm.assistance && (
                  <Input
                    label="Assistance minutes"
                    type="number"
                    value={fixDayForm.assistanceMinutes}
                    onChange={(e) => setFixDayForm((s) => ({ ...s, assistanceMinutes: e.target.value }))}
                  />
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={fixDayForm.notes}
                    onChange={(e) => setFixDayForm((s) => ({ ...s, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-5">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={fixDaySaving}
                  onClick={() => {
                    setFixDayOpen(false);
                    setFixDayRecord(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={fixDaySaving}
                  onClick={async () => {
                    try {
                      setFixDaySaving(true);
                      const updates = {
                        dps: Number(fixDayForm.dps || 0) || 0,
                        flats: Number(fixDayForm.flats || 0) || 0,
                        letters: Number(fixDayForm.letters || 0) || 0,
                        parcels: Number(fixDayForm.parcels || 0) || 0,
                        spurs: Number(fixDayForm.sprs || 0) || 0,
                        safety_talk: Number(fixDayForm.safetyTalk || 0) || 0,
                        office_time: Number(fixDayForm.amOfficeTime || 0) || 0,
                        street_time: Number(fixDayForm.streetTime || 0) || 0,
                        street_time_normalized: Number(fixDayForm.streetTime || 0) || 0,
                        pm_office_time: Number(fixDayForm.pmOfficeTime || 0) || 0,
                        has_boxholder: !!fixDayForm.hasBoxholder,
                        exclude_from_averages: !!fixDayForm.excludeFromAverages,
                        auxiliary_assistance: !!fixDayForm.assistance,
                        assistance_minutes: fixDayForm.assistance ? (Number(fixDayForm.assistanceMinutes || 0) || 0) : 0,
                        notes: String(fixDayForm.notes || '').trim() || null,
                        updated_at: new Date().toISOString(),
                      };

                      await updateRouteHistory(fixDayRecord.id, updates);
                      await loadRouteHistory(currentRouteId);
                      setFixDayOpen(false);
                      setFixDayRecord(null);
                    } catch (e) {
                      alert(e?.message || 'Failed to save day');
                    } finally {
                      setFixDaySaving(false);
                    }
                  }}
                >
                  {fixDaySaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent History removed */}
    </div>
  );
}
