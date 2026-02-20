import { useState, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { Clock, Pause, Play, FileText, Navigation } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import Input from '../shared/Input';
import HowAmIDoingSection from '../shared/HowAmIDoingSection';
import OfficeTimeBreakdown from '../shared/OfficeTimeBreakdown';
import RouteCompletionDialog from '../shared/RouteCompletionDialog';
import WorkOffRouteModal from '../shared/WorkOffRouteModal';
import EndOfDayReport from '../shared/EndOfDayReport';
import ForgotRouteDialog from '../shared/ForgotRouteDialog';
import Reason3996Modal from '../shared/Reason3996Modal';
import { confidenceToMinutes } from '../../utils/predictionConfidence';
import { applyExpectedTimeRolloverSanity } from '../../utils/liveExpected';
import useRouteStore from '../../stores/routeStore';
import { upsertTodayVolumes } from '../../services/todayVolumesService';
import { getTodayRouteHistory } from '../../services/routeHistoryService';
import useBreakStore from '../../stores/breakStore';
import { addMinutes } from '../../utils/time';
import { calculateFullDayPrediction } from '../../services/predictionService';
import { saveRouteHistory, getWeekTotalMinutes } from '../../services/routeHistoryService';
import { getDayType } from '../../utils/holidays';
import { pmOfficeService } from '../../services/pmOfficeService';
import { syncPmOfficeToHistory } from '../../services/pmOfficeSyncService';
import { streetTimeService } from '../../services/streetTimeService';
import { offRouteService } from '../../services/offRouteService';
import { DEFAULT_ROUTE_CONFIG } from '../../utils/constants';
import { getLocalDateString, formatTimeAMPM, parseLocalDate } from '../../utils/time';
import { supabase } from '../../lib/supabase';

export default function TodayScreen() {
  const { todayInputs, updateTodayInputs, history, getCurrentRouteConfig, currentRouteId, addHistoryEntry, waypoints, routeStarted, setRouteStarted, routes, switchToRoute, preRouteLoadingMinutes, streetPreloadSeconds, setStreetPreloadSeconds } = useRouteStore();
  const today = getLocalDateString();
  const waypointPausedSeconds = useBreakStore((state) => state.waypointPausedSeconds);
  const [date, setDate] = useState(new Date());
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  // Expected time sanity: if the predicted return time appears to be "yesterday" (common after midnight),
  // roll it forward by +24h in the UI. Banner offers a one-tap reset to the raw route prediction.
  const [expectedTimeSanityEnabled, setExpectedTimeSanityEnabled] = useState(true);
  const [showPmOfficePrompt, setShowPmOfficePrompt] = useState(false);
  const [pmOfficeManualMinutes, setPmOfficeManualMinutes] = useState('');
  const pmOfficeManualMinutesRef = useRef(null);

  const [showAssistancePrompt, setShowAssistancePrompt] = useState(false);
  const [assistanceMinutesInput, setAssistanceMinutesInput] = useState('');
  const assistancePrefillRef = useRef({ auxiliaryAssistance: false, assistanceMinutes: 0 });
  const [showWorkOffRouteModal, setShowWorkOffRouteModal] = useState(false);
  const [pmOfficeSession, setPmOfficeSession] = useState(null);
  const [pmOfficeTime, setPmOfficeTime] = useState(0);
  const [streetTimeSession, setStreetTimeSession] = useState(null);
  const [streetTime, setStreetTime] = useState(0);
  const [completedStreetTimeMinutes, setCompletedStreetTimeMinutes] = useState(null);
  const [streetStartTime, setStreetStartTime] = useState(null);
  const [weekTotal, setWeekTotal] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [showEodReport, setShowEodReport] = useState(false);
  const [eodReportData, setEodReportData] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [show3996Helper, setShow3996Helper] = useState(false);
  
  // NEW: Forgot route feature
  const [showForgotRouteDialog, setShowForgotRouteDialog] = useState(false);
  const [showBannerNudge, setShowBannerNudge] = useState(false);
  const [bannerSnoozedUntil, setBannerSnoozedUntil] = useState(null);
  
  // NEW: Off-route tracking
  const [offRouteSession, setOffRouteSession] = useState(null);
  const [offRouteTime, setOffRouteTime] = useState(0);
  
  // ✅ NEW: Track accumulated street time from completed segments
  const [accumulatedStreetSeconds, setAccumulatedStreetSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Hydrate critical inputs from Supabase in case mobile storage gets wiped mid-day.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!currentRouteId) return;

      // Only hydrate if local volumes are empty.
      const hasLocalVolumes =
        (Number(todayInputs.dps || 0) || 0) > 0 ||
        (Number(todayInputs.flats || 0) || 0) > 0 ||
        (Number(todayInputs.letters || 0) || 0) > 0 ||
        (Number(todayInputs.parcels || 0) || 0) > 0 ||
        (Number(todayInputs.sprs || 0) || 0) > 0;

      if (hasLocalVolumes) return;

      try {
        const rh = await getTodayRouteHistory(currentRouteId, today);
        if (cancelled || !rh) return;

        const next = {};
        // Use != null checks so we don't accidentally skip legitimate 0 values.
        if (rh.dps != null) next.dps = rh.dps;
        if (rh.flats != null) next.flats = rh.flats;
        if (rh.letters != null) next.letters = rh.letters;
        if (rh.parcels != null) next.parcels = rh.parcels;
        if (rh.sprs != null) next.sprs = rh.sprs;
        if (rh.safetyTalk != null) next.safetyTalk = rh.safetyTalk;
        if (rh.hasBoxholder != null) next.hasBoxholder = rh.hasBoxholder;
        if (rh.casedBoxholder != null) next.casedBoxholder = rh.casedBoxholder;
        if (rh.casedBoxholderType != null) next.casedBoxholderType = rh.casedBoxholderType;
        if (rh.curtailedLetters != null) next.curtailedLetters = rh.curtailedLetters;
        if (rh.curtailedFlats != null) next.curtailedFlats = rh.curtailedFlats;
        if (rh.dailyLog != null) next.dailyLog = rh.dailyLog;

        if (Object.keys(next).length) {
          console.log('[TodayScreen] Hydrated volumes from route_history for', today);
          updateTodayInputs(next);
        }
      } catch (e) {
        console.warn('[TodayScreen] Could not hydrate today volumes:', e?.message || e);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRouteId, today]);

  useEffect(() => {
    loadActiveSession();
    loadStreetTimeSession();
    loadOffRouteSession();
    loadWeekTotal();

    // If the user navigates away (Waypts/History/etc) and comes back,
    // re-check active timers so off-route sessions don't "disappear".
    const onFocus = () => {
      loadStreetTimeSession();
      loadOffRouteSession();
    };

    // Also flush any pending volume autosave when the app is backgrounded.
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        flushVolumesAutosave();
        return;
      }
      if (document.visibilityState === 'visible') {
        loadStreetTimeSession();
        loadOffRouteSession();
      }
    };

    const onPageHide = () => {
      flushVolumesAutosave();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    if (!pmOfficeSession) return;

    const interval = setInterval(() => {
      const duration = pmOfficeService.calculateCurrentDuration(pmOfficeSession);
      setPmOfficeTime(duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [pmOfficeSession]);

  // ✅ FIXED: Calculate total street time (accumulated + current segment)
  useEffect(() => {
    if (!streetTimeSession) {
      // No active session - just show accumulated time
      setStreetTime(accumulatedStreetSeconds);
      return;
    }

    const interval = setInterval(() => {
      const currentSegmentDuration = streetTimeService.calculateCurrentDuration(streetTimeSession);
      // Total = accumulated from previous segments + current segment
     setStreetTime(Math.floor(accumulatedStreetSeconds + currentSegmentDuration)); // ✅ Force to whole seconds
    }, 1000);

    return () => clearInterval(interval);
  }, [streetTimeSession, accumulatedStreetSeconds]);

  // NEW: Off-route timer effect
  useEffect(() => {
    if (!offRouteSession) return;

    const interval = setInterval(() => {
      const duration = offRouteService.calculateCurrentDuration(offRouteSession);
      setOffRouteTime(duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [offRouteSession]);

  // NEW: Banner nudge detection
  useEffect(() => {
    if (!prediction || !prediction.clockOutTime || !streetTimeSession || !routeStarted) {
      setShowBannerNudge(false);
      return;
    }

    // Don't show if already snoozed
    if (bannerSnoozedUntil && Date.now() < bannerSnoozedUntil) {
      return;
    }

    // Check if past predicted end time + 15 minutes
    const predictedEndTime = prediction.clockOutTime;
    const now = new Date();
    const minutesPastPredicted = Math.round((now - predictedEndTime) / 1000 / 60);

    if (minutesPastPredicted >= 15) {
      setShowBannerNudge(true);
    } else {
      setShowBannerNudge(false);
    }
  }, [prediction, streetTimeSession, routeStarted, bannerSnoozedUntil]);

  const loadActiveSession = async () => {
    try {
      const session = await pmOfficeService.getActiveSession();
      setPmOfficeSession(session);
      if (session) {
        setNotes(session.notes || '');
        const duration = pmOfficeService.calculateCurrentDuration(session);
        setPmOfficeTime(duration);
        setRouteStarted(true);
      }
    } catch (error) {
      console.error('Error loading active session:', error);
    }
  };

  // ✅ COMPLETE loadStreetTimeSession function with debugging
  const loadStreetTimeSession = async () => {
    try {
      console.log('📊 [loadStreetTimeSession] Getting active session...');
      const session = await streetTimeService.getActiveSession();
      setStreetTimeSession(session);
      console.log('📊 [loadStreetTimeSession] Active session:', session ? 'Found' : 'None');
      
      console.log('📊 [loadStreetTimeSession] Getting total street time for today...');
      const totalMinutes = await offRouteService.getTotalStreetTimeToday();
      const preload = Math.max(0, Number(useRouteStore.getState().streetPreloadSeconds || 0) || 0);
      const totalSeconds = Math.floor(totalMinutes * 60) + preload; // include pre-route load seconds
      console.log('📊 [loadStreetTimeSession] Total:', totalMinutes, 'min =', totalSeconds, 'sec');
      
      if (session) {
        const currentSegmentDuration = streetTimeService.calculateCurrentDuration(session);
        const accumulated = Math.floor(Math.max(0, totalSeconds - currentSegmentDuration)); // ✅ Force to whole seconds
        console.log('📊 [loadStreetTimeSession] Current segment duration:', currentSegmentDuration, 'sec');
        console.log('📊 [loadStreetTimeSession] Accumulated:', accumulated, 'sec');
        setAccumulatedStreetSeconds(accumulated);
        setRouteStarted(true);
      } else {
        // No active session - all time is accumulated.
        // IMPORTANT: Do NOT auto-end the day just because there is no currently-running timer.
        // Carriers may stop 721 to run 744, or stop timers briefly, and still need the End Tour flow
        // (EOD report + assistance prompt).
        setAccumulatedStreetSeconds(totalSeconds);
      }
    } catch (error) {
      console.error('Error loading street time session:', error);
    }
  };

  // NEW: Load off-route session
  const loadOffRouteSession = async () => {
    try {
      const session = await offRouteService.getActiveOffRouteSession();
      setOffRouteSession(session);
      if (session) {
        const duration = offRouteService.calculateCurrentDuration(session);
        setOffRouteTime(duration);
      }
    } catch (error) {
      console.error('Error loading off-route session:', error);

      // If we somehow have multiple active sessions, pick the newest so the UI still works.
      try {
        const list = await offRouteService.listActiveOffRouteSessions?.(10);
        const newest = Array.isArray(list) && list.length ? list[0] : null;
        if (newest) {
          setOffRouteSession(newest);
          setOffRouteTime(offRouteService.calculateCurrentDuration(newest));
        }
      } catch {}
    }
  };

  const loadWeekTotal = async () => {
    try {
      const total = await pmOfficeService.getWeekTotal();
      setWeekTotal(total);
    } catch (error) {
      console.error('Error loading week total:', error);
    }
  };

  useEffect(() => {
    async function loadPrediction() {
      const hasInput = todayInputs.dps || todayInputs.flats || todayInputs.letters ||
                       todayInputs.parcels || todayInputs.sprs;

      if (!hasInput) {
        setPrediction(null);
        return;
      }

      const routeConfig = getCurrentRouteConfig();

      const todayMail = {
        dps: todayInputs.dps || 0,
        flats: todayInputs.flats || 0,
        letters: todayInputs.letters || 0,
        parcels: todayInputs.parcels || 0,
        sprs: todayInputs.sprs || 0,
        curtailedLetters: todayInputs.curtailedLetters || 0,
        curtailedFlats: todayInputs.curtailedFlats || 0,
        safetyTalk: todayInputs.safetyTalk || 0,
        hasBoxholder: todayInputs.hasBoxholder || false,
        casedBoxholder: todayInputs.casedBoxholder || false,
        casedBoxholderType: todayInputs.casedBoxholderType || '',
        routeStops: routeConfig?.stops || 0,
      };

      const effectiveStartTime = todayInputs.startTimeOverride || routeConfig?.startTime || '07:30';
      const routeConfigForPrediction = {
        ...routeConfig,
        startTime: effectiveStartTime,
      };
      const routeHistory = history || [];

      try {
        const pauseMinutes = Math.round((waypointPausedSeconds || 0) / 60);
        const pred = await calculateFullDayPrediction(todayMail, routeConfigForPrediction, routeHistory, waypoints, currentRouteId, pauseMinutes);
        setPrediction(pred);
      } catch (error) {
        console.error('[TodayScreen] Error calculating prediction:', error);
        setPrediction(null);
      }
    }

    loadPrediction();
  }, [todayInputs, history, waypoints, currentRouteId, getCurrentRouteConfig]);

  // Autosave critical volumes to Supabase so mobile state loss can't wipe them.
  const [volumesSaveError, setVolumesSaveError] = useState(null);
  const volumesSaveTimerRef = useRef(null);
  const volumesRetryTimerRef = useRef(null);
  const lastVolumesSavedRef = useRef(null);
  const pendingVolumesPayloadRef = useRef(null);

  const scheduleVolumesAutosave = (nextInputs) => {
    if (!currentRouteId) return;

    const payload = {
      routeId: currentRouteId,
      date: today,
      dps: nextInputs.dps || 0,
      flats: nextInputs.flats || 0,
      letters: nextInputs.letters || 0,
      parcels: nextInputs.parcels || 0,
      sprs: nextInputs.sprs || 0,
      safetyTalk: nextInputs.safetyTalk || 0,
      hasBoxholder: nextInputs.hasBoxholder || false,
      casedBoxholder: nextInputs.casedBoxholder || false,
      casedBoxholderType: nextInputs.casedBoxholderType || '',
      curtailedLetters: nextInputs.curtailedLetters || 0,
      curtailedFlats: nextInputs.curtailedFlats || 0,
      dailyLog: nextInputs.dailyLog || null,
    };

    pendingVolumesPayloadRef.current = payload;

    // Avoid spamming identical writes.
    const fingerprint = JSON.stringify(payload);
    if (fingerprint === lastVolumesSavedRef.current) return;

    if (volumesSaveTimerRef.current) clearTimeout(volumesSaveTimerRef.current);

    // Save quickly; mobile browsers can reload/evict background tabs unexpectedly.
    volumesSaveTimerRef.current = setTimeout(async () => {
      try {
        await upsertTodayVolumes(payload);
        lastVolumesSavedRef.current = fingerprint;
        setVolumesSaveError(null);
      } catch (e) {
        // Non-fatal: keep UI working even if offline.
        const msg = e?.message || String(e);
        console.warn('[TodayScreen] Volume autosave failed:', msg);
        setVolumesSaveError(msg);

        // If the user stops typing, still keep trying in the background.
        if (volumesRetryTimerRef.current) clearTimeout(volumesRetryTimerRef.current);
        volumesRetryTimerRef.current = setTimeout(async () => {
          try {
            const p = pendingVolumesPayloadRef.current;
            if (!p) return;
            await upsertTodayVolumes(p);
            lastVolumesSavedRef.current = JSON.stringify(p);
            setVolumesSaveError(null);
          } catch (e2) {
            console.warn('[TodayScreen] Volume autosave retry failed:', e2?.message || e2);
            setVolumesSaveError(e2?.message || String(e2));
          }
        }, 15000);
      }
    }, 250);
  };

  const flushVolumesAutosave = async () => {
    const payload = pendingVolumesPayloadRef.current;
    if (!payload) return;
    try {
      await upsertTodayVolumes(payload);
      lastVolumesSavedRef.current = JSON.stringify(payload);
      setVolumesSaveError(null);
    } catch (e) {
      console.warn('[TodayScreen] Volume flush failed:', e?.message || e);
      setVolumesSaveError(e?.message || String(e));
    }
  };

  const handleInputChange = (field, value) => {
    const isDecimalField = field === 'flats' || field === 'letters';
    const numValue = isDecimalField ? (parseFloat(value) || 0) : (parseInt(value) || 0);

    const nextInputs = { ...todayInputs, [field]: numValue };
    updateTodayInputs({ [field]: numValue });

    // Autosave critical volume-ish fields (plus curtailed counts).
    if (['dps', 'flats', 'letters', 'parcels', 'sprs', 'safetyTalk', 'curtailedLetters', 'curtailedFlats'].includes(field)) {
      scheduleVolumesAutosave(nextInputs);
    }
  };

  const handleStartRoute = async () => {
    try {
      if (!currentRouteId) {
        alert('Please set up your route first.\n\nGo to Settings → Create Route to configure your route details.');
        return;
      }

      const preRouteLoadingMinutes = useRouteStore.getState().preRouteLoadingMinutes || 0;

      if (preRouteLoadingMinutes > 0) {
        console.log(`Including ${preRouteLoadingMinutes} minutes of pre-route loading time in totals (without shifting leave time)`);
      }

      // Start 721 street time at the actual leave moment (button press)
      const session = await streetTimeService.startSession(currentRouteId, 0);
      setStreetTimeSession(session);

      // If user tracked load truck before leaving, include it in totals without backdating leave time.
      const preloadSeconds = Math.max(0, Math.round(preRouteLoadingMinutes * 60));
      setStreetPreloadSeconds(preloadSeconds);
      setAccumulatedStreetSeconds(preloadSeconds);
      setStreetTime(preloadSeconds);
      
      setCompletedStreetTimeMinutes(null);
      setStreetStartTime(null);
      setRouteStarted(true);
      setCompletedStreetTimeMinutes(null);
      setStreetStartTime(null);
      setRouteStarted(true);

      // Capture the actual "leave office" moment (721 start) as the end of 722 (AM office) for today.
      const leaveDate = new Date(session.start_time);
      const actualLeaveHHMM = leaveDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      const routeConfig = getCurrentRouteConfig();
      const startTimeStr = todayInputs.startTimeOverride || routeConfig?.startTime || '07:30';

      const parseHHMMToMinutes = (timeStr) => {
        const match = String(timeStr || '').match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return 0;
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        return (h * 60) + m;
      };

      const startMinutes = parseHHMMToMinutes(startTimeStr);
      const leaveMinutes = (leaveDate.getHours() * 60) + leaveDate.getMinutes();
      let officeMinutes = leaveMinutes - startMinutes;
      if (officeMinutes < 0) officeMinutes += 1440;

      // Load truck time should be treated as street time (721), not 722.
      // So subtract any pre-route loading minutes from the captured office time.
      const adjustedOfficeMinutes = Math.max(0, officeMinutes - preRouteLoadingMinutes);

      updateTodayInputs({
        streetTimerStartTime: session.start_time,
        leaveOfficeTime: actualLeaveHHMM,
        actualOfficeTime: Math.round(adjustedOfficeMinutes),
        // leave casingWithdrawalMinutes for user to enter (optional)
      });

      if (preRouteLoadingMinutes > 0) {
        console.log(`✓ 722 office minutes adjusted for load truck: ${officeMinutes} - ${preRouteLoadingMinutes} = ${adjustedOfficeMinutes}`);
      }

      if (preRouteLoadingMinutes > 0) {
        useRouteStore.getState().setPreRouteLoadingMinutes(0);
        console.log('✓ Pre-route loading time cleared from state');
      }
      // Keep streetPreloadSeconds for the rest of the day so it never disappears from the 721 timer.
      // It will be reset on route completion/cancel and at the next daily reset.

      console.log('Route started with data:', todayInputs);
      console.log('Street time tracking started:', session);
      console.log('✓ 721 start captured as Actual Leave Time:', actualLeaveHHMM);
      console.log('✓ Actual 722 office minutes captured:', officeMinutes);
    } catch (error) {
      console.error('Error starting route:', error);
      alert(error.message || 'Failed to start street time tracking');
    }
  };

  const handleCancelRoute = async () => {
    if (!confirm('Cancel route start? This will stop the 721 timer. Your mail volume data will be kept.')) {
      return;
    }

    try {
      // If 721 was started, stop it so the timer doesn't keep running.
      if (streetTimeSession && !streetTimeSession.end_time) {
        await streetTimeService.endSession(streetTimeSession.id);
      }
    } catch (e) {
      console.warn('Could not stop 721 timer on cancel:', e);
      // Continue clearing local UI state anyway.
    }

    setRouteStarted(false);
    setStreetPreloadSeconds(0);
    setStreetTimeSession(null);
    setStreetTime(0);
    setAccumulatedStreetSeconds(0);
    setCompletedStreetTimeMinutes(null);
    setStreetStartTime(null);

    // Clear today-only captured clock times so the next start is clean.
    updateTodayInputs({
      streetTimerStartTime: null,
      leaveOfficeTime: '',
      actualOfficeTime: 0,
    });
  };

  const totalStreetMinutesFromEnded = (endedSession, accumulatedSeconds) => {
    const segSeconds = endedSession?.duration_seconds != null
      ? Number(endedSession.duration_seconds || 0)
      : (Number(endedSession?.duration_minutes || 0) * 60);
    const totalSeconds = Math.max(0, Math.floor(Number(accumulatedSeconds || 0) + segSeconds));
    return Math.round(totalSeconds / 60);
  };

  const handleStartPmOffice = async () => {
    try {
      let streetTimeEnded = false;
      let durationMinutes = 0;

      if (streetTimeSession && !streetTimeSession.end_time) {
        const endedSession = await streetTimeService.endSession(streetTimeSession.id);
        durationMinutes = totalStreetMinutesFromEnded(endedSession, accumulatedStreetSeconds);
        setCompletedStreetTimeMinutes(durationMinutes);
        setStreetStartTime(streetTimeSession.start_time);
        console.log(`✓ Street time preserved (summed segments): ${durationMinutes} minutes (started at ${streetTimeSession.start_time})`);
        setStreetTime(0);
        setStreetTimeSession(null);
        streetTimeEnded = true;
        console.log('Street time ended:', durationMinutes, 'minutes');
      }

      if (!streetTimeEnded) {
        console.log('Starting PM Office without ending street time');
      }

      const session = await pmOfficeService.startSession(notes || null);
      setPmOfficeSession(session);
      console.log('PM Office session started:', session);
    } catch (error) {
      console.error('Error starting PM Office:', error);
      alert(error.message || 'Failed to start PM Office timer');
    }
  };

  const handleEndOffRouteNow = async () => {
    try {
      await offRouteService.endOffRouteActivity(offRouteSession?.id || null);
      await loadOffRouteSession();
      await loadStreetTimeSession();

      // If a stray duplicate is still active, clean it up.
      try {
        const list = await offRouteService.listActiveOffRouteSessions?.(5);
        if (Array.isArray(list) && list.length) {
          await offRouteService.forceEndAllActiveOffRouteSessions?.();
          await loadOffRouteSession();
        }
      } catch {}
    } catch (error) {
      console.error('Error ending off-route activity:', error);
      alert(error.message || 'Failed to end activity');
      try {
        await loadOffRouteSession();
        await loadStreetTimeSession();
      } catch {}
    }
  };

  const handleStopPmOffice = async () => {
    if (!pmOfficeSession) return;

    try {
      await pmOfficeService.endSession(pmOfficeSession.id, notes);
      setPmOfficeSession(null);
      setPmOfficeTime(0);
      setNotes('');
      setShowNotes(false);
      console.log('PM Office ended');
    } catch (error) {
      console.error('Error ending PM Office:', error);
      alert(error.message || 'Failed to end PM Office timer');
    }
  };

  const handlePausePmOffice = async () => {
    if (!pmOfficeSession) return;

    try {
      await pmOfficeService.pauseSession(pmOfficeSession.id);
      loadActiveSession();
      console.log('PM Office paused');
    } catch (error) {
      console.error('Error pausing PM Office:', error);
      alert(error.message || 'Failed to pause PM Office timer');
    }
  };

  const handleResumePmOffice = async () => {
    if (!pmOfficeSession) return;

    try {
      await pmOfficeService.resumeSession(pmOfficeSession.id);
      loadActiveSession();
      console.log('PM Office resumed');
    } catch (error) {
      console.error('Error resuming PM Office:', error);
      alert(error.message || 'Failed to resume PM Office timer');
    }
  };

  const handleSaveNotes = async () => {
    if (!pmOfficeSession) return;

    try {
      await pmOfficeService.updateNotes(pmOfficeSession.id, notes);
      setShowNotes(false);
      alert('Notes saved!');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    }
  };

  const formatPmOfficeTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCompleteRouteClick = async () => {
    try {
      // ✅ NEW: Auto-end any active off-route timers first
      const activeOffRoute = await offRouteService.getActiveOffRouteSession();
      if (activeOffRoute) {
        console.log('⚠️ Found active off-route session during route completion - ending it automatically...');
        await offRouteService.endOffRouteActivity(offRouteSession?.id || null);
        console.log('✓ Off-route timer auto-ended');
      
      // Reload sessions to update UI
      await loadStreetTimeSession();
      await loadOffRouteSession();
    }
      let actualStreetMinutes = 0;
      
      if (streetTimeSession && !streetTimeSession.end_time) {
        console.log('Ending street timer before opening dialog...');
        const endedSession = await streetTimeService.endSession(streetTimeSession.id);
        actualStreetMinutes = totalStreetMinutesFromEnded(endedSession, accumulatedStreetSeconds);
        setAccumulatedStreetSeconds(0);

        setCompletedStreetTimeMinutes(actualStreetMinutes);
        setStreetStartTime(streetTimeSession.start_time);

        console.log(`✓ Street timer ended (summed segments): ${actualStreetMinutes} minutes`);

        setStreetTimeSession(null);
        setStreetTime(0);
        setAccumulatedStreetSeconds(0);
      }
      
      const predictedStreetMinutes = Math.round(prediction?.streetTime || 0);
      const runningLong = actualStreetMinutes > (predictedStreetMinutes + 15);

      // If 744 is active, sync it immediately before we continue.
      // This makes 744 show up in operation_codes even if the later end-of-day save flow fails.
      if (pmOfficeSession && !pmOfficeSession.ended_at) {
        try {
          const approxMinutes = Math.max(0, Math.round(Number(pmOfficeTime || 0) / 60));
          const todayKey = getLocalDateString();
          await syncPmOfficeToHistory({
            routeId: currentRouteId,
            date: todayKey,
            minutes: approxMinutes,
            startedAt: pmOfficeSession.started_at || null,
            endedAt: null,
          });
        } catch (e) {
          console.warn('[TodayScreen] Pre-sync 744 failed (non-fatal):', e?.message || e);
        }
      }

      // If the user never started 744 PM Office, prompt for manual minutes before completing.
      // We only prompt when something is "missing".
      const missingPmOffice = !pmOfficeSession && (pmOfficeTime || 0) <= 0;
      if (missingPmOffice) {
        setPmOfficeManualMinutes('');
        setShowPmOfficePrompt(true);
        return;
      }

      // Assistance prompt (only when likely missing): if user did 736 today but hasn't flagged assistance yet.
      // This catches common "helper" days that would otherwise poison averages.
      try {
        const alreadyPrefilled = !!assistancePrefillRef.current?.auxiliaryAssistance;
        if (!alreadyPrefilled && currentRouteId) {
          const todayKey = getLocalDateString();
          const { data: rows, error } = await supabase
            .from('operation_codes')
            .select('id')
            .eq('route_id', currentRouteId)
            .eq('date', todayKey)
            .in('code', ['736'])
            .limit(1);
          if (!error && (rows || []).length > 0) {
            setAssistanceMinutesInput('');
            setShowAssistancePrompt(true);
            return;
          }
        }
      } catch {
        // ignore
      }
      
      if (runningLong && predictedStreetMinutes > 0) {
        console.log(`Route running long: ${actualStreetMinutes} min (predicted: ${predictedStreetMinutes} min)`);
        setShowForgotRouteDialog(true);
      } else {
        setShowCompletionDialog(true);
      }
    } catch (error) {
      console.error('Error in handleCompleteRouteClick:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleCompleteRoute = async (completionData) => {
    console.log('handleCompleteRoute - currentRouteId:', currentRouteId);
    console.log('handleCompleteRoute - prediction:', prediction);

    if (!currentRouteId) {
      console.error('No currentRouteId found in store');
      alert('Please set up your route first.\n\nGo to Settings → Create Route to configure your route details before completing a day.');
      setShowCompletionDialog(false);
      return;
    }

    try {
      let pmOfficeTimeMinutes = 0;
      let streetTimeMinutes = 0;

      const manualPm = pmOfficeManualMinutesRef.current != null
        ? Math.max(0, Math.round(Number(pmOfficeManualMinutesRef.current) || 0))
        : 0;

      if (streetTimeSession && !streetTimeSession.end_time) {
        try {
          console.log('Auto-ending active street time session during route completion...');
          const endedSession = await streetTimeService.endSession(streetTimeSession.id);
          streetTimeMinutes = totalStreetMinutesFromEnded(endedSession, accumulatedStreetSeconds);

          setCompletedStreetTimeMinutes(streetTimeMinutes);
          setStreetStartTime(streetTimeSession.start_time);
          console.log(`✓ Street time preserved during completion (summed segments): ${streetTimeMinutes} minutes (started at ${streetTimeSession.start_time})`);

          setStreetTimeSession(null);
          setStreetTime(0);
          setAccumulatedStreetSeconds(0);
        } catch (error) {
          console.error('Error stopping street time during route completion:', error);
          alert('Warning: Failed to automatically stop street time. Please verify your street time entry.');
        }
      }

      if (pmOfficeSession && !pmOfficeSession.ended_at) {
        try {
          const endedSession = await pmOfficeService.endSession(pmOfficeSession.id, notes);
          pmOfficeTimeMinutes = Math.round((endedSession.duration_seconds || 0) / 60);

          // Persist 744 immediately so a refresh can't lose it, and so Stats -> Day History can display 744.
          try {
            const todayKey = getLocalDateString();
            await syncPmOfficeToHistory({
              routeId: currentRouteId,
              date: todayKey,
              minutes: pmOfficeTimeMinutes,
              startedAt: endedSession.started_at || pmOfficeSession.started_at || null,
              endedAt: endedSession.ended_at || new Date().toISOString(),
            });
          } catch (e) {
            console.warn('[TodayScreen] Failed to sync 744 to history:', e?.message || e);
          }

          setPmOfficeSession(null);
          setPmOfficeTime(0);
          setNotes('');
          setShowNotes(false);
        } catch (error) {
          console.error('Error stopping PM Office during route completion:', error);
        }
      } else if (manualPm > 0) {
        pmOfficeTimeMinutes = manualPm;

        // Also persist manual 744 immediately.
        try {
          const todayKey = getLocalDateString();
          await syncPmOfficeToHistory({
            routeId: currentRouteId,
            date: todayKey,
            minutes: pmOfficeTimeMinutes,
            startedAt: null,
            endedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('[TodayScreen] Failed to sync manual 744 to history:', e?.message || e);
        }
      }

      const today = getLocalDateString();
      const currentRoute = getCurrentRouteConfig();

      let actualOfficeTime = 0;

      // Prefer captured actual 722 time from when user tapped Start Route (721).
      if (todayInputs.actualOfficeTime && todayInputs.actualOfficeTime > 0) {
        actualOfficeTime = todayInputs.actualOfficeTime;
      } else if (prediction && prediction.officeTime != null) {
        // Fallback to predicted office time if we don't have an actual.
        actualOfficeTime = prediction.officeTime;
      }

      const leaveTimeStr = todayInputs.leaveOfficeTime || currentRoute?.startTime || '07:30';
      const startTimeStr = todayInputs.startTimeOverride || currentRoute?.startTime || '07:30';
      
      const parseTimeToMinutes = (timeStr) => {
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return 0;
        const hours = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        return (hours * 60) + mins;
      };
      
      const leaveMinutes = parseTimeToMinutes(leaveTimeStr);
      const startMinutes = parseTimeToMinutes(startTimeStr);
      
      let calculatedOfficeTime = leaveMinutes - startMinutes;
      if (calculatedOfficeTime < 0) {
        calculatedOfficeTime += 1440;
      }
      
      // If we didn't capture it at Start Route, calculate it from time-of-day.
      // Allow up to 8 hours just in case of oddball days (late trucks, etc.).
      if ((!todayInputs.actualOfficeTime || todayInputs.actualOfficeTime <= 0) && calculatedOfficeTime >= 0 && calculatedOfficeTime <= 480) {
        actualOfficeTime = calculatedOfficeTime;
        console.log(`✓ Actual 722 office time calculated from time-of-day: ${calculatedOfficeTime} minutes (${startTimeStr} → ${leaveTimeStr})`);
      }
      
      const actualStreetTime = completionData.streetTime || streetTimeMinutes || 0;
      const actualTotalMinutes = actualOfficeTime + actualStreetTime + pmOfficeTimeMinutes;
      const tourLengthMinutes = (currentRoute?.tourLength || 8.5) * 60;
      const actualOvertime = Math.max(0, actualTotalMinutes - tourLengthMinutes);

      const actualLeaveTime = streetTimeSession?.start_time
        ? new Date(streetTimeSession.start_time).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          })
        : null;

      // If the app refreshed mid-day, we can lose computed 722 in state.
      // Recover it from start time + leave office time when possible.
      const recoveredOfficeMinutes = (() => {
        const leaveStr = String(todayInputs.leaveOfficeTime || '').trim();
        if (!/^\d{1,2}:\d{2}$/.test(leaveStr)) return null;

        const routeConfig = getCurrentRouteConfig();
        const startStr = String(todayInputs.startTimeOverride || routeConfig?.startTime || '07:30').trim();
        if (!/^\d{1,2}:\d{2}$/.test(startStr)) return null;

        const [sh, sm] = startStr.split(':').map(Number);
        const [lh, lm] = leaveStr.split(':').map(Number);
        if (![sh, sm, lh, lm].every((n) => Number.isFinite(n))) return null;

        let mins = (lh * 60 + lm) - (sh * 60 + sm);
        if (mins < 0) mins += 1440;

        // Subtract any load-truck minutes; those belong to 721.
        const preload = Number(useRouteStore.getState().preRouteLoadingMinutes || 0) || 0;
        mins = Math.max(0, mins - preload);

        return Math.round(mins);
      })();

      const officeMinutesFinal = (Number(actualOfficeTime || 0) > 0)
        ? actualOfficeTime
        : (recoveredOfficeMinutes ?? 0);

      const historyData = {
        date: today,
        dayType: getDayType(today),
        dps: todayInputs.dps || 0,
        flats: todayInputs.flats || 0,
        letters: todayInputs.letters || 0,
        parcels: todayInputs.parcels || 0,
        sprs: todayInputs.sprs || 0,
        scannerTotal: todayInputs.scannerTotal || 0,
        curtailed: 0,
        officeTime: officeMinutesFinal,
        streetTime: actualStreetTime,
        pmOfficeTime: pmOfficeTimeMinutes,
        totalMinutes: actualTotalMinutes,
        overtime: actualOvertime,
        predictedOfficeTime: 0,
        predictedStreetTime: 0,
        predictedReturnTime: null,
        actualLeaveTime: actualLeaveTime,
        // Provide a timestamp for waypoint elapsed-minute calculations in history.
        streetTimerStartTime: todayInputs.streetTimerStartTime || null,
        leaveOfficeTime: todayInputs.leaveOfficeTime || null,
        actualClockOut: completionData.actualClockOut || null,
        auxiliaryAssistance: completionData.auxiliaryAssistance || false,
        assistanceMinutes: completionData.assistanceMinutes || 0,
        mailNotDelivered: completionData.mailNotDelivered || false,
        routeId: currentRouteId,
        notes: completionData.notes || null,
        safetyTalk: todayInputs.safetyTalk || 0,
        hasBoxholder: todayInputs.hasBoxholder || false,
        casingWithdrawalMinutes: todayInputs.casingWithdrawalMinutes || null,
        dailyLog: todayInputs.dailyLog || null,
      };
      
      try {
        if (prediction && typeof prediction === 'object') {
          const predOfficeTime = prediction.officeTime;
          const predStreetTime = prediction.streetTime;
          const predReturnTime = prediction.returnTimeEstimate?.predictedReturnTime;

          if (predOfficeTime != null && !isNaN(predOfficeTime)) {
            historyData.predictedOfficeTime = Math.round(predOfficeTime);
          }
          if (predStreetTime != null && !isNaN(predStreetTime)) {
            historyData.predictedStreetTime = Math.round(predStreetTime);
          }

          // Save predicted return-to-office. Stored as HH:MM.
          if (predReturnTime instanceof Date && !isNaN(predReturnTime.getTime())) {
            historyData.predictedReturnTime = predReturnTime.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            });
          }

          // Save predicted CLOCK-OUT (end-of-tour). Stored as HH:MM.
          if (prediction.clockOutTime instanceof Date && !isNaN(prediction.clockOutTime.getTime())) {
            historyData.predictedClockOut = prediction.clockOutTime.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            });
          }

          // Back-compat fallback: if we don't have a return-to-office estimate, at least store something.
          if (!historyData.predictedReturnTime && historyData.predictedClockOut) {
            historyData.predictedReturnTime = historyData.predictedClockOut;
          }
        }
      } catch (predError) {
        console.warn('Could not add prediction data to history:', predError);
      }

      // Data-quality sanity checks (prevents bad days from poisoning predictions)
      const warnings = [];
      const st = Number(historyData.streetTime || 0) || 0;
      const am = Number(historyData.officeTime || 0) || 0;
      const pm = Number(historyData.pmOfficeTime || 0) || 0;
      const total = am + st + pm;

      if (st > 0 && st < 120) warnings.push(`721 street time looks too low: ${st} min`);
      if (st > 720) warnings.push(`721 street time looks very high: ${st} min`);
      if (am > 240) warnings.push(`722 AM office time looks very high: ${am} min`);
      if (pm > 120) warnings.push(`744 PM office time looks very high: ${pm} min`);
      if (total > 14 * 60) warnings.push(`Total day time looks very high: ${total} min`);

      if (warnings.length) {
        const ok = confirm(
          `⚠️ This day has unusual times.\n\n${warnings.map((w) => `• ${w}`).join('\n')}\n\nSaving this can mess up predictions.\n\nPress OK to Save anyway, or Cancel to go back and fix.`
        );
        if (!ok) {
          return;
        }
      }

      console.log('Saving route history:', historyData);
      const savedHistory = await saveRouteHistory(currentRouteId, historyData);
      console.log('Route history saved:', savedHistory);

      addHistoryEntry(savedHistory);

      const reportData = {
        date: historyData.date,
        routeNumber: currentRoute?.routeNumber || 'Unknown',
        mailVolumes: {
          parcels: historyData.parcels || 0,
          flats: historyData.flats || 0,
          letters: historyData.letters || 0,
          sprs: historyData.sprs || 0,
          dps: historyData.dps || 0,
        },
        predictedOfficeTime: historyData.predictedOfficeTime || null,
        actualOfficeTime: historyData.officeTime || 0,
        officeTime722: historyData.officeTime || 0,
        officeTime744: historyData.pmOfficeTime || 0,
        predictedStreetTime: historyData.predictedStreetTime || null,
        actualStreetTime: historyData.streetTime || 0,
        evaluatedStreetTime: currentRoute?.manualStreetTime || null,
        predictedClockOut: prediction?.clockOutTime ? prediction.clockOutTime.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        }) : null,
        actualClockOut: historyData.actualClockOut || null,
        officeTime: historyData.officeTime || 0,
        pmOfficeTime: historyData.pmOfficeTime || 0,
        overtime: historyData.overtime || 0,
        penaltyOvertime: 0,
        workOffRouteTime: 0,
        auxiliaryAssistance: historyData.auxiliaryAssistance || false,
        mailNotDelivered: historyData.mailNotDelivered || false,
        notes: historyData.notes || null,
        weekTotal: 0,
      };

      setEodReportData(reportData);
      setShowEodReport(true);
      setShowCompletionDialog(false);
      setRouteStarted(false);
      setStreetPreloadSeconds(0);
      setCompletedStreetTimeMinutes(null);
      setStreetStartTime(null);
      
      updateTodayInputs({
        streetTimerStartTime: null,
        // Persist actual clock-out so Stats can show Prediction vs Actual after the day is ended.
        actualClockOut: historyData.actualClockOut || new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        })
      });
      console.log('✓ Cleared 721 timer start time from state');

      console.log('Route completed successfully');
    } catch (error) {
      console.error('Error completing route:', error);
      alert(`Failed to save route data: ${error.message || 'Unknown error'}.`);
    }
  };

  const handleForgotRouteCorrect = async (correctionData) => {
    try {
      console.log('Applying route correction:', correctionData);
      setCompletedStreetTimeMinutes(correctionData.correctedStreetMinutes);
      setShowForgotRouteDialog(false);
      setShowCompletionDialog(true);
    } catch (error) {
      console.error('Error correcting route:', error);
      alert(`Failed to apply correction: ${error.message}`);
    }
  };

  const handleForgotRouteUseActual = () => {
    setShowForgotRouteDialog(false);
    setShowCompletionDialog(true);
  };

  const handleForgotRouteCancel = () => {
    setShowForgotRouteDialog(false);
  };

  const handleBannerSnooze = () => {
    setBannerSnoozedUntil(Date.now() + (30 * 60 * 1000));
    setShowBannerNudge(false);
  };

  const handleBannerEndNow = () => {
    setShowBannerNudge(false);
    handleCompleteRouteClick();
  };

  const handleBannerCorrect = () => {
    setShowBannerNudge(false);
    handleCompleteRouteClick();
  };

  const currentRoute = getCurrentRouteConfig();
  const routeOptions = Object.values(routes || {}).map(r => ({
    value: r.id,
    label: r.routeNumber
  }));

  // --- Prediction explainability (carrier-friendly) ---
  const dayType = getDayType(getLocalDateString());

  const cleanHistory = (history || []).filter((d) => {
    const aux = !!(d.auxiliaryAssistance ?? d.auxiliary_assistance);
    const mnd = !!(d.mailNotDelivered ?? d.mail_not_delivered);
    const ns = !!(d.isNsDay ?? d.is_ns_day);
    return !aux && !mnd && !ns;
  });

  const sameDayType = cleanHistory.filter((d) => {
    try {
      return getDayType(d.date) === dayType;
    } catch {
      return false;
    }
  });

  const baseline = (sameDayType.length ? sameDayType : cleanHistory).slice(0, 10);

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const baselineAverages = {
    parcels: Math.round(avg(baseline.map((d) => Number(d.parcels || 0)))) || 0,
    sprs: Math.round(avg(baseline.map((d) => Number(d.sprs ?? d.spurs ?? 0)))) || 0,
    dps: Math.round(avg(baseline.map((d) => Number(d.dps || 0)))) || 0,
    flats: avg(baseline.map((d) => Number(d.flats || 0))) || 0,
    letters: avg(baseline.map((d) => Number(d.letters || 0))) || 0,
  };

  const drivers = [];
  if ((todayInputs.parcels || 0) && baselineAverages.parcels) {
    const delta = (todayInputs.parcels || 0) - baselineAverages.parcels;
    if (Math.abs(delta) >= 10) drivers.push(`Parcels ${delta > 0 ? '+' : ''}${delta} vs your avg (${baselineAverages.parcels}).`);
  }
  if ((todayInputs.dps || 0) && baselineAverages.dps) {
    const delta = (todayInputs.dps || 0) - baselineAverages.dps;
    if (Math.abs(delta) >= 200) drivers.push(`DPS ${delta > 0 ? '+' : ''}${delta} vs your avg (${baselineAverages.dps}).`);
  }
  if ((todayInputs.flats || 0) && baselineAverages.flats) {
    const delta = (todayInputs.flats || 0) - baselineAverages.flats;
    if (Math.abs(delta) >= 0.5) drivers.push(`Flats ${delta > 0 ? '+' : ''}${delta.toFixed(1)} ft vs your avg (${baselineAverages.flats.toFixed(1)}).`);
  }
  if ((todayInputs.letters || 0) && baselineAverages.letters) {
    const delta = (todayInputs.letters || 0) - baselineAverages.letters;
    if (Math.abs(delta) >= 0.5) drivers.push(`Letters ${delta > 0 ? '+' : ''}${delta.toFixed(1)} ft vs your avg (${baselineAverages.letters.toFixed(1)}).`);
  }

  if (todayInputs.dailyLog?.lateMail) drivers.unshift('Late mail / delayed distribution.');
  if (todayInputs.dailyLog?.lateParcels) drivers.unshift('Late parcels / delayed Amazon.');

  const modelConfidence = prediction?.returnTimeEstimate?.confidence || prediction?.prediction?.confidence;

  // Confidence meter based on how much personal history we have (simple + transparent).
  const includedHistoryDays = (history || []).filter((d) => !d?.excludeFromAverages && !d?.exclude_from_averages).length;

  const confidenceMeter = useMemo(() => {
    // 0-21 days ramps up; after that we consider it "learned".
    const days = Math.max(0, Math.min(21, includedHistoryDays));
    const pct = Math.round((days / 21) * 100);
    let label = 'Low';
    if (days >= 14) label = 'High';
    else if (days >= 5) label = 'Medium';
    return { pct, label, days };
  }, [includedHistoryDays]);

  const shouldShowLearningBanner = includedHistoryDays < 14;

  const confidenceMinutes = confidenceToMinutes(
    modelConfidence,
    { waypointEnhanced: !!prediction?.waypointEnhanced }
  );

  const clockOutSanity = useMemo(() => {
    if (!prediction?.clockOutTime) return { time: null, didAdjust: false, rolledDays: 0 };
    const base = prediction.clockOutTime instanceof Date ? prediction.clockOutTime : new Date(prediction.clockOutTime);
    if (!(base instanceof Date) || isNaN(base.getTime())) return { time: null, didAdjust: false, rolledDays: 0 };

    if (!expectedTimeSanityEnabled) return { time: base, didAdjust: false, rolledDays: 0 };

    const res = applyExpectedTimeRolloverSanity(base, new Date(), { maxPastMinutes: 60, maxDays: 2 });
    return { time: res?.time || base, didAdjust: !!res?.didAdjust, rolledDays: res?.rolledDays || 0 };
  }, [prediction?.clockOutTime, expectedTimeSanityEnabled]);

  const rangeText = useMemo(() => {
    if (!clockOutSanity?.time) return null;
    const base = new Date(clockOutSanity.time);
    const early = new Date(base.getTime() - confidenceMinutes * 60000);
    const late = new Date(base.getTime() + confidenceMinutes * 60000);
    const fmt = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${fmt(early)}–${fmt(late)}`;
  }, [clockOutSanity?.time, confidenceMinutes]);

  return (
    <div className="p-4 pb-20 max-w-4xl mx-auto">
      {volumesSaveError ? (
        <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-red-900 text-sm">
          <div className="font-semibold">Not saved to cloud yet</div>
          <div className="text-xs mt-1">
            Your volumes may disappear if the page refreshes. Usually this means offline or signed out.
          </div>
          <div className="text-[11px] mt-1 opacity-80 break-words">
            {String(volumesSaveError).slice(0, 200)}
          </div>
        </div>
      ) : null}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Today</h1>
            <p className="text-sm text-gray-500">{format(date, 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{format(date, 'h:mm')}</p>
            <p className="text-sm text-gray-500">{format(date, 'a')}</p>
          </div>
        </div>

        {routeOptions.length > 1 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Route
            </label>
            <select
              value={currentRouteId || ''}
              onChange={(e) => {
                const nextId = e.target.value;
                if (!nextId || nextId === currentRouteId) return;
                const nextLabel = routeOptions.find((o) => o.value === nextId)?.label || 'that route';
                if (window.confirm(`Are you sure you want to switch to ${nextLabel}?`)) {
                  switchToRoute(nextId);
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {routeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {prediction?.clockOutTime && !routeStarted && (
        <Card className="mb-4 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Go-around Estimate</h3>
              <p className="text-xs text-gray-600">Real clock time (what you tell the supervisor)</p>
            </div>
          </div>

          {clockOutSanity?.didAdjust && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-900 font-medium">Return time looked like it was from yesterday.</p>
              <p className="text-[11px] text-amber-800 mt-1">
                RouteWise auto-rolled it forward by +24h so it makes sense after midnight.
              </p>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  className="w-full bg-white/60 border-amber-300 text-amber-900 hover:bg-white"
                  onClick={() => setExpectedTimeSanityEnabled(false)}
                >
                  Reset to route default
                </Button>
              </div>
            </div>
          )}

          {/* Confidence meter + expectation setting */}
          <div className="bg-white/70 rounded-lg p-4 mb-3 border border-emerald-100">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <p className="text-xs text-gray-600">Confidence</p>
                <p className="text-sm font-semibold text-gray-900">
                  {confidenceMeter.label}
                  <span className="text-xs font-normal text-gray-600"> · {confidenceMeter.days} day(s) learned</span>
                </p>
              </div>
              {modelConfidence && (
                <p className="text-xs text-gray-600">Model: {String(modelConfidence)}</p>
              )}
            </div>

            <div className="w-full h-2 bg-emerald-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-emerald-600"
                style={{ width: `${confidenceMeter.pct}%` }}
              />
            </div>

            {shouldShowLearningBanner && (
              <p className="text-xs text-gray-700 mt-2">
                Your predictions will improve over the next <strong>2–3 weeks</strong> as RouteWise learns your route.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white/70 rounded-lg p-4">
              <p className="text-xs text-gray-600">Projected return</p>
              <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {clockOutSanity?.time ? clockOutSanity.time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}
              </p>
              {rangeText && (
                <p className="text-xs text-gray-700 mt-1">Range: {rangeText} (±{confidenceMinutes}m)</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Updates as you complete waypoints.</p>
            </div>

            <div className="bg-white/70 rounded-lg p-4">
              <p className="text-xs text-gray-600">What’s driving it</p>
              <ul className="text-xs text-gray-800 mt-2 space-y-1">
                {(drivers.length ? drivers : ['Using your recent history + today’s inputs.']).slice(0, 4).map((d, i) => (
                  <li key={i}>• {d}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 mt-3">
            Built by carriers for carriers. Personal planning tool—follow local instructions.
          </p>
        </Card>
      )}

      <Card className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Start Time (Today)</h3>
        <Input
          label="Optional override"
          type="time"
          value={todayInputs.startTimeOverride || ''}
          onChange={(e) => updateTodayInputs({ startTimeOverride: e.target.value })}
          helperText={`Route default: ${currentRoute?.startTime || '07:30'}`}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => updateTodayInputs({ startTimeOverride: currentRoute?.startTime || '07:30' })}
          >
            Set to default
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => updateTodayInputs({ startTimeOverride: '' })}
            disabled={!todayInputs.startTimeOverride}
          >
            Clear
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          This only affects today’s predictions/clock-out estimate.
        </p>
      </Card>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">Morning Inputs</h3>
          <Button
            onClick={() => setShow3996Helper(true)}
            className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700"
          >
            3996 ideas
          </Button>
        </div>
        <p className="text-xs text-gray-600 mb-4">Enter what you know. Everything is optional, but more info = better predictions.</p>
        <p className="text-xs text-gray-500 mb-4">Need 3996 ideas? Tap the red button.</p>
        
        <div className="mb-4">
          <Input
            label='📱 Scanner Total ("How Am I Doing" → Pkgs Remaining)'
            type="number"
            value={todayInputs.scannerTotal || ''}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;

              if (value <= 0) {
                updateTodayInputs({
                  scannerTotal: 0,
                  parcels: 0,
                  sprs: 0,
                  packagesManuallyUpdated: false,
                });
                return;
              }

              // If the user already manually set parcels, keep parcels and recompute SPRs as the remainder.
              const existingParcels = parseInt(todayInputs.parcels, 10) || 0;
              const hasManualSplit = !!todayInputs.packagesManuallyUpdated;

              if (hasManualSplit && existingParcels > 0) {
                const parcels = Math.min(existingParcels, value);
                const sprs = Math.max(0, value - parcels);
                updateTodayInputs({
                  scannerTotal: value,
                  parcels,
                  sprs,
                  packagesManuallyUpdated: true,
                });
                return;
              }

              // Default auto-split
              const sprs = Math.round(value * 0.56);
              const parcels = value - sprs;
              updateTodayInputs({
                scannerTotal: value,
                sprs,
                parcels,
                packagesManuallyUpdated: false,
              });
            }}
            placeholder="103"
            helperText="Enter total packages (parcels + SPRs)"
          />
          
          {todayInputs.scannerTotal > 0 && (
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800 font-medium mb-2">
                📊 {todayInputs.packagesManuallyUpdated ? 'Manual Split (SPRs = Total − Parcels)' : 'Auto-Split: 56% SPRs / 44% Parcels'}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-600">Total</p>
                  <p className="text-lg font-bold text-gray-900">{todayInputs.scannerTotal}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">SPRs</p>
                  <p className="text-lg font-bold text-green-600">{todayInputs.sprs || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Parcels</p>
                  <p className="text-lg font-bold text-blue-600">{todayInputs.parcels || 0}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 {todayInputs.packagesManuallyUpdated 
                  ? 'Manually adjusted - update as needed' 
                  : 'Adjust counts below when loading truck for accuracy'}
              </p>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="DPS"
            type="number"
            value={todayInputs.dps || ''}
            onChange={(e) => handleInputChange('dps', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Flats (Ft)"
            type="number"
            step="0.1"
            value={todayInputs.flats || ''}
            onChange={(e) => handleInputChange('flats', e.target.value)}
            placeholder="0.0"
          />
          <Input
            label="Letters (Ft)"
            type="number"
            step="0.1"
            value={todayInputs.letters || ''}
            onChange={(e) => handleInputChange('letters', e.target.value)}
            placeholder="0.0"
          />
          <Input
            label="Curtailed Flats (Ft)"
            type="number"
            step="0.1"
            value={todayInputs.curtailedFlats || ''}
            onChange={(e) => handleInputChange('curtailedFlats', e.target.value)}
            placeholder="0.0"
          />
          <Input
            label="Curtailed Letters (Ft)"
            type="number"
            step="0.1"
            value={todayInputs.curtailedLetters || ''}
            onChange={(e) => handleInputChange('curtailedLetters', e.target.value)}
            placeholder="0.0"
          />
          <Input
            label="Parcels"
            type="number"
            value={todayInputs.parcels || ''}
            onChange={(e) => {
              const numValue = parseInt(e.target.value) || 0;
              const scannerTotal = todayInputs.scannerTotal || 0;
              
              if (scannerTotal > 0) {
                const newSprs = Math.max(0, scannerTotal - numValue);
                const patch = {
                  parcels: numValue,
                  sprs: newSprs,
                  packagesManuallyUpdated: true
                };
                const nextInputs = { ...todayInputs, ...patch };
                updateTodayInputs(patch);
                scheduleVolumesAutosave(nextInputs);
              } else {
                handleInputChange('parcels', e.target.value);
              }
            }}
            placeholder="0"
          />
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-2">SPRs (auto)</label>
            <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
              {todayInputs.scannerTotal > 0 ? (todayInputs.sprs || 0) : 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Calculated as Total Packages − Parcels</p>
          </div>
          <Input
            label="Safety/Training (min)"
            type="number"
            value={todayInputs.safetyTalk || ''}
            onChange={(e) => handleInputChange('safetyTalk', e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={todayInputs.hasBoxholder || false}
              onChange={(e) => {
                const nextInputs = { ...todayInputs, hasBoxholder: e.target.checked };
                updateTodayInputs({ hasBoxholder: e.target.checked });
                scheduleVolumesAutosave(nextInputs);
              }}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm text-gray-700">Boxholder/EDDM</span>
          </label>
          <p className="text-xs text-gray-500 pl-6">
            Average street time uses last X Boxholder days (with fallback to overall average if needed).
          </p>

          {Number(getCurrentRouteConfig()?.stops || 0) > 0 ? (
            <div className="pl-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={todayInputs.casedBoxholder || false}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const patch = {
                      casedBoxholder: checked,
                      // If you cased it, you definitely had one.
                      hasBoxholder: checked ? true : (todayInputs.hasBoxholder || false),
                      casedBoxholderType: checked ? (todayInputs.casedBoxholderType || 'flats') : '',
                    };
                    const nextInputs = { ...todayInputs, ...patch };
                    updateTodayInputs(patch);
                    scheduleVolumesAutosave(nextInputs);
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Cased boxholder?</span>
              </label>

              {todayInputs.hasBoxholder && (
                <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                  💡 Route stop boxholder: {todayInputs.casedBoxholder 
                    ? `You will get full coverage casing credit. No need to count in with the flats or letters volume.`
                    : `App will average your last 10 door to door days.`}
                </p>
              )}

              {todayInputs.casedBoxholder ? (
                <div className="mt-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Boxholder size</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={(todayInputs.casedBoxholderType || 'flats')}
                    onChange={(e) => {
                      const patch = { casedBoxholderType: e.target.value };
                      const nextInputs = { ...todayInputs, ...patch };
                      updateTodayInputs(patch);
                      scheduleVolumesAutosave(nextInputs);
                    }}
                  >
                    <option value="letters">Letter size</option>
                    <option value="flats">Flat size</option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Credits 1 piece per stop into Letters or Flats casing totals.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {prediction && (
        <>
          <OfficeTimeBreakdown prediction={prediction} />
          <HowAmIDoingSection prediction={prediction} startTime={todayInputs.startTimeOverride || currentRoute?.startTime || '07:30'} />
        </>
      )}

      {showBannerNudge && prediction && prediction.clockOutTime && (
        <Card className="bg-yellow-50 border-2 border-yellow-400 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-900">Past Predicted End Time</h3>
              <p className="text-sm text-yellow-800">
                You're {Math.round((Date.now() - (clockOutSanity?.time || prediction.clockOutTime)) / 1000 / 60)} minutes past predicted clock out. 
                Did you forget to end your route?
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={handleBannerSnooze} variant="secondary" size="sm">
              Snooze 30m
            </Button>
            <Button onClick={handleBannerEndNow} size="sm">
              End Now
            </Button>
            <Button onClick={handleBannerCorrect} size="sm">
              Correct Time
            </Button>
          </div>
        </Card>
      )}

      {streetTimeSession && !streetTimeSession.end_time && (
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
              <Navigation className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">
                721 STREET TIME ACTIVE
              </h3>
              <p className="text-xs text-gray-600">
                Started at {new Date(streetTimeSession.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="bg-white/70 rounded-lg p-6 mb-4">
            <div className="text-center">
              <div className="text-5xl font-bold text-blue-600 mb-2 font-mono">
                {streetTimeService.formatDuration(streetTime)}
              </div>
              <p className="text-sm text-gray-600">
                {Math.floor(streetTime / 60)} minutes on street
              </p>
            </div>
          </div>

          <p className="text-xs text-blue-700 text-center">
            Timer will stop automatically when you start 744 PM Office or complete your route
          </p>
        </Card>
      )}

      {offRouteSession && (
        <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center animate-pulse">
              {offRouteSession.code === '732' ? '📬' : '📦'}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">
                {offRouteSession.code === '732' ? 'COLLECTIONS (732)' : 'RELAY ASSISTANCE (736)'}
              </h3>
              <p className="text-xs text-gray-600">
                Started at {new Date(offRouteSession.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="bg-white/70 rounded-lg p-6 mb-4">
            <div className="text-center">
              <div className="text-5xl font-bold text-orange-600 mb-2 font-mono">
                {offRouteService.formatDuration(offRouteTime)}
              </div>
              <p className="text-sm text-gray-600">
                {Math.floor(offRouteTime / 60)} minutes off-route
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2 text-blue-700">
                <span>⏸️</span>
                <span>Route timer (721) PAUSED at {streetTimeService.formatDuration(streetTime)}</span>
              </div>
              <div className="flex items-center gap-2 text-orange-700">
                <span>⏱️</span>
                <span>Off-route timer ({offRouteSession.code}) ACTIVE</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-orange-700 text-center">
            Route timer will resume from {streetTimeService.formatDuration(streetTime)} when off-route work ends
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              onClick={() => setShowWorkOffRouteModal(true)}
              variant="secondary"
              className="w-full"
            >
              View / End
            </Button>
            <Button
              onClick={handleEndOffRouteNow}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              End Now
            </Button>
          </div>
        </Card>
      )}

      {pmOfficeSession && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 bg-green-600 rounded-full flex items-center justify-center ${!pmOfficeSession.is_paused && 'animate-pulse'}`}>
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">
                744 PM OFFICE {pmOfficeSession.is_paused ? 'PAUSED' : 'ACTIVE'}
              </h3>
              <p className="text-xs text-gray-600">
                Started at {new Date(pmOfficeSession.started_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="bg-white/70 rounded-lg p-6 mb-4">
            <div className="text-center">
              <div className="text-5xl font-bold text-green-600 mb-2 font-mono">
                {formatPmOfficeTime(pmOfficeTime)}
              </div>
              <p className="text-sm text-gray-600">
                {Math.floor(pmOfficeTime / 60)} minutes elapsed
              </p>
              {weekTotal > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Week total: {Math.floor(weekTotal / 3600)}h {Math.floor((weekTotal % 3600) / 60)}m
                </p>
              )}
            </div>
          </div>

          {showNotes ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                rows="3"
                placeholder="What tasks did you perform?"
              />
              <div className="flex gap-2 mt-2">
                <Button onClick={handleSaveNotes} className="flex-1" size="sm">
                  Save Notes
                </Button>
                <Button onClick={() => setShowNotes(false)} variant="secondary" className="flex-1" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {pmOfficeSession.is_paused ? (
                <Button onClick={handleResumePmOffice} variant="secondary" className="flex items-center justify-center gap-2">
                  <Play className="w-4 h-4" />
                  Resume
                </Button>
              ) : (
                <Button onClick={handlePausePmOffice} variant="secondary" className="flex items-center justify-center gap-2">
                  <Pause className="w-4 h-4" />
                  Pause
                </Button>
              )}
              <Button onClick={() => setShowNotes(true)} variant="secondary" className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                Notes
              </Button>
            </div>
          )}

          <Button onClick={handleStopPmOffice} className="w-full">
            Stop PM Office Timer
          </Button>

          <Button
            onClick={handleCompleteRouteClick}
            variant="secondary"
            className="w-full mt-2"
          >
            End Tour (stop 744)
          </Button>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {routeStarted ? 'Route In Progress' : 'Route Start'}
        </h3>
        <div className="mb-4">
          {routeStarted ? (
            <>
              <p className="text-sm text-gray-600">Route in progress...</p>
              <p className="text-xs text-gray-500 mt-1">
                End your tour when finished to save data
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">Ready to begin your route?</p>
              <p className="text-xs text-gray-500 mt-1">
                Estimated leave time will be calculated based on mail volume
              </p>
            </>
          )}
        </div>
        {routeStarted ? (
          <div className="space-y-3">
            {/* After Start Route (721), show predicted vs actual leave time + actual 722 minutes */}
            {streetTimeSession?.start_time && (
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">Leave Office</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Predicted 722 Done</p>
                    <p className="text-lg font-bold text-blue-700">
                      {prediction?.leaveOfficeTime
                        ? new Date(prediction.leaveOfficeTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                        : '—'}
                    </p>
                    {prediction?.leaveOfficeTime && (preRouteLoadingMinutes || 0) > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Projected depart (with Load): {addMinutes(new Date(prediction.leaveOfficeTime), preRouteLoadingMinutes).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Actual 721 Start</p>
                    <p className="text-lg font-bold text-gray-900">
                      {todayInputs.leaveOfficeTime
                        ? new Date(`1970-01-01T${todayInputs.leaveOfficeTime}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                        : new Date(streetTimeSession.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Actual 722 (AM Office)</p>
                    <p className="text-base font-bold text-gray-900">
                      {todayInputs.actualOfficeTime ? `${todayInputs.actualOfficeTime} min` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Variance (vs projected depart)</p>
                    <p className="text-base font-bold text-gray-900">
                      {prediction?.leaveOfficeTime
                        ? (() => {
                            const base = new Date(prediction.leaveOfficeTime);
                            const projected = (preRouteLoadingMinutes || 0) > 0 ? addMinutes(base, preRouteLoadingMinutes) : base;
                            return `${Math.round((new Date(streetTimeSession.start_time) - projected) / 60000)} min`;
                          })()
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* % to Standard now uses total 722 time (no extra input needed). */}
              </div>
            )}

            {!pmOfficeSession && (
              <Button
                onClick={handleStartPmOffice}
                variant="secondary"
                className="w-full flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" />
                Start 744 PM Office
              </Button>
            )}
            <Button
              onClick={() => setShowWorkOffRouteModal(true)}
              variant="secondary"
              className="w-full"
            >
              🔧 Work Off Route
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleCancelRoute} variant="secondary" className="w-full">
                Cancel Route
              </Button>
              <Button onClick={handleCompleteRouteClick} className="w-full">
                End Tour
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleStartRoute} className="w-full">
            Start Route (721 Time)
          </Button>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Daily Log (Quick)</h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={todayInputs.dailyLog?.lateMail || false}
              onChange={(e) => updateTodayInputs({
                dailyLog: {
                  ...(todayInputs.dailyLog || {}),
                  lateMail: e.target.checked,
                }
              })}
            />
            Late mail
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={todayInputs.dailyLog?.lateParcels || false}
              onChange={(e) => updateTodayInputs({
                dailyLog: {
                  ...(todayInputs.dailyLog || {}),
                  lateParcels: e.target.checked,
                }
              })}
            />
            Late parcels / late Amazon
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Casing interruptions (min)"
              type="number"
              value={todayInputs.dailyLog?.casingInterruptionsMinutes || ''}
              onChange={(e) => updateTodayInputs({
                dailyLog: {
                  ...(todayInputs.dailyLog || {}),
                  casingInterruptionsMinutes: parseInt(e.target.value, 10) || 0,
                }
              })}
              placeholder="0"
              className="mb-0"
            />
            <Input
              label="Waiting on parcels (min)"
              type="number"
              value={todayInputs.dailyLog?.waitingOnParcelsMinutes || ''}
              onChange={(e) => updateTodayInputs({
                dailyLog: {
                  ...(todayInputs.dailyLog || {}),
                  waitingOnParcelsMinutes: parseInt(e.target.value, 10) || 0,
                }
              })}
              placeholder="0"
              className="mb-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Accountables (min)"
              type="number"
              value={todayInputs.dailyLog?.accountablesMinutes || ''}
              onChange={(e) => updateTodayInputs({
                dailyLog: {
                  ...(todayInputs.dailyLog || {}),
                  accountablesMinutes: parseInt(e.target.value, 10) || 0,
                }
              })}
              placeholder="0"
              className="mb-0"
            />
            <Input
              label="Other delays (min)"
              type="number"
              value={todayInputs.dailyLog?.otherDelayMinutes || ''}
              onChange={(e) => updateTodayInputs({
                dailyLog: {
                  ...(todayInputs.dailyLog || {}),
                  otherDelayMinutes: parseInt(e.target.value, 10) || 0,
                }
              })}
              placeholder="0"
              className="mb-0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
            <textarea
              value={todayInputs.dailyLog?.notes || ''}
              onChange={(e) => updateTodayInputs({
                dailyLog: {
                  ...(todayInputs.dailyLog || {}),
                  notes: e.target.value,
                }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="3"
              placeholder="Anything unusual today?"
            />
          </div>

          <p className="text-xs text-gray-500">
            This is for your records and to help RouteWise learn why today ran long/short.
          </p>
        </div>
      </Card>

      {showPmOfficePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">PM Office (744) missing</h2>
              <p className="text-sm text-gray-600 mb-4">
                You didn’t start a 744 timer. If you had PM office time, enter the minutes so your total tour time is accurate.
              </p>

              <Input
                label="PM Office minutes (744)"
                type="number"
                value={pmOfficeManualMinutes}
                onChange={(e) => setPmOfficeManualMinutes(e.target.value)}
                placeholder="0"
                min="0"
                helperText="Leave blank or 0 if you had no PM office time"
              />

              <div className="flex gap-3 pt-4">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowPmOfficePrompt(false);
                    pmOfficeManualMinutesRef.current = 0;
                    setShowCompletionDialog(true);
                  }}
                >
                  Skip
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    const mins = Math.max(0, Math.round(Number(pmOfficeManualMinutes) || 0));
                    pmOfficeManualMinutesRef.current = mins;
                    setShowPmOfficePrompt(false);
                    setShowCompletionDialog(true);
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssistancePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Assistance detected</h2>
              <p className="text-sm text-gray-600 mb-4">
                It looks like you had relay assistance activity today. If you got help or gave away part of your route, record it so your averages stay accurate.
              </p>

              <Input
                label="Minutes helped / given away"
                type="number"
                value={assistanceMinutesInput}
                onChange={(e) => setAssistanceMinutesInput(e.target.value)}
                placeholder="0"
                min="0"
                helperText="Enter minutes if you got help or gave away time; leave 0 if not"
              />

              <div className="flex gap-3 pt-4">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    assistancePrefillRef.current = { auxiliaryAssistance: false, assistanceMinutes: 0 };
                    setShowAssistancePrompt(false);
                    setShowCompletionDialog(true);
                  }}
                >
                  No help
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    const mins = Math.max(0, Math.round(Number(assistanceMinutesInput) || 0));
                    assistancePrefillRef.current = { auxiliaryAssistance: mins > 0, assistanceMinutes: mins };
                    setShowAssistancePrompt(false);
                    setShowCompletionDialog(true);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCompletionDialog && (
        <RouteCompletionDialog
          prediction={prediction || { officeTime: 0, streetTime: 0, clockOutTime: null, returnTime: null }}
          todayInputs={todayInputs}
          calculatedStreetTime={completedStreetTimeMinutes}
          initialAuxiliaryAssistance={!!assistancePrefillRef.current?.auxiliaryAssistance}
          initialAssistanceMinutes={Number(assistancePrefillRef.current?.assistanceMinutes || 0) || 0}
          onComplete={handleCompleteRoute}
          onCancel={() => setShowCompletionDialog(false)}
        />
      )}

      {showForgotRouteDialog && (
        <ForgotRouteDialog
          routeStartTime={todayInputs.startTimeOverride || getCurrentRouteConfig()?.startTime || '08:00'}
          predictedStreetMinutes={Math.round(prediction?.streetTime || 0)}
          actualStreetMinutes={completedStreetTimeMinutes || 0}
          onCorrect={handleForgotRouteCorrect}
          onUseActual={handleForgotRouteUseActual}
          onCancel={handleForgotRouteCancel}
        />
      )}

      {show3996Helper && (
        <Reason3996Modal
          todayInputs={todayInputs}
          prediction={prediction}
          history={history}
          baseParcels={getCurrentRouteConfig()?.baseParcels ?? null}
          onClose={() => setShow3996Helper(false)}
        />
      )}

      {showWorkOffRouteModal && (
        <WorkOffRouteModal 
          onClose={() => { 
            setShowWorkOffRouteModal(false);
            setTimeout(() => {
              loadStreetTimeSession();
              loadOffRouteSession();
            }, 100);
          }}
          onSessionChange={() => {
            console.log('🔄 Off-route session changed - scheduling reload...');
            
            setTimeout(async () => {
              console.log('🔄 [After 1s delay] Now reloading sessions...');
              
              try {
                await loadStreetTimeSession();
                console.log('✅ Street time session reloaded');
                
                await loadOffRouteSession();
                console.log('✅ Off-route session reloaded');
              } catch (error) {
                console.error('❌ Error reloading sessions:', error);
              }
            }, 1000);
          }}
        />
      )}

      {showEodReport && eodReportData && (
        <EndOfDayReport
          reportData={eodReportData}
          onClose={() => setShowEodReport(false)}
        />
      )}
    </div>
  );
}
