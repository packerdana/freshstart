import { useState, useEffect, useMemo } from 'react';
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
import useRouteStore from '../../stores/routeStore';
import { calculateFullDayPrediction } from '../../services/predictionService';
import { saveRouteHistory, getWeekTotalMinutes } from '../../services/routeHistoryService';
import { pmOfficeService } from '../../services/pmOfficeService';
import { streetTimeService } from '../../services/streetTimeService';
import { offRouteService } from '../../services/offRouteService';
import { DEFAULT_ROUTE_CONFIG } from '../../utils/constants';
import { getLocalDateString, formatTimeAMPM } from '../../utils/time';
import { supabase } from '../../lib/supabase';

export default function TodayScreen() {
  const { todayInputs, updateTodayInputs, history, getCurrentRouteConfig, currentRouteId, addHistoryEntry, waypoints, routeStarted, setRouteStarted, routes, switchToRoute } = useRouteStore();
  const [date, setDate] = useState(new Date());
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
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

  useEffect(() => {
    loadActiveSession();
    loadStreetTimeSession();
    loadOffRouteSession();
    loadWeekTotal();
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
      setStreetTime(accumulatedStreetSeconds + currentSegmentDuration);
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
      const totalSeconds = Math.floor(totalMinutes * 60); // ✅ Force to whole seconds
      console.log('📊 [loadStreetTimeSession] Total:', totalMinutes, 'min =', totalSeconds, 'sec');
      
      if (session) {
        const currentSegmentDuration = streetTimeService.calculateCurrentDuration(session);
        const accumulated = Math.max(0, totalSeconds - currentSegmentDuration);
        console.log('📊 [loadStreetTimeSession] Current segment duration:', currentSegmentDuration, 'sec');
        console.log('📊 [loadStreetTimeSession] Accumulated:', accumulated, 'sec');
        setAccumulatedStreetSeconds(accumulated);
        setRouteStarted(true);
      } else {
        // No active session - all time is accumulated
        setAccumulatedStreetSeconds(totalSeconds);
        if (routeStarted && !session && !pmOfficeSession) {
          setRouteStarted(false);
        }
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

      const routeConfig = getCurrentRouteConfig();
      const routeHistory = history || [];

      try {
        const pred = await calculateFullDayPrediction(todayMail, routeConfig, routeHistory, waypoints, currentRouteId);
        setPrediction(pred);
      } catch (error) {
        console.error('[TodayScreen] Error calculating prediction:', error);
        setPrediction(null);
      }
    }

    loadPrediction();
  }, [todayInputs, history, waypoints, currentRouteId, getCurrentRouteConfig]);

  const handleInputChange = (field, value) => {
    const isDecimalField = field === 'flats' || field === 'letters';
    const numValue = isDecimalField ? (parseFloat(value) || 0) : (parseInt(value) || 0);
    updateTodayInputs({ [field]: numValue });
  };

  const handleStartRoute = async () => {
    try {
      if (!currentRouteId) {
        alert('Please set up your route first.\n\nGo to Settings → Create Route to configure your route details.');
        return;
      }

      const preRouteLoadingMinutes = useRouteStore.getState().preRouteLoadingMinutes || 0;
      
      if (preRouteLoadingMinutes > 0) {
        console.log(`Including ${preRouteLoadingMinutes} minutes of pre-route loading time in 721 street time`);
      }

      const session = await streetTimeService.startSession(currentRouteId, preRouteLoadingMinutes);
      setStreetTimeSession(session);
      setAccumulatedStreetSeconds(0); // ✅ Reset accumulated time on fresh start
      setStreetTime(0);
      setCompletedStreetTimeMinutes(null);
      setStreetStartTime(null);
      setRouteStarted(true);

      // Store 721 timer start time for waypoint predictions
      updateTodayInputs({ 
        streetTimerStartTime: session.start_time 
      });

      if (preRouteLoadingMinutes > 0) {
        useRouteStore.getState().setPreRouteLoadingMinutes(0);
        console.log('✓ Pre-route loading time cleared from state');
      }

      console.log('Route started with data:', todayInputs);
      console.log('Street time tracking started:', session);
      console.log('✓ 721 street timer start captured for waypoint predictions:', session.start_time);
    } catch (error) {
      console.error('Error starting route:', error);
      alert(error.message || 'Failed to start street time tracking');
    }
  };

  const handleCancelRoute = () => {
    if (confirm('Cancel route start? Your mail volume data will be kept.')) {
      setRouteStarted(false);
      setCompletedStreetTimeMinutes(null);
      setStreetStartTime(null);
    }
  };

  const handleStartPmOffice = async () => {
    try {
      let streetTimeEnded = false;
      let durationMinutes = 0;

      if (streetTimeSession && !streetTimeSession.end_time) {
        const endedSession = await streetTimeService.endSession(streetTimeSession.id);
        durationMinutes = Math.round(endedSession.duration_minutes);
        setCompletedStreetTimeMinutes(durationMinutes);
        setStreetStartTime(streetTimeSession.start_time);
        console.log(`✓ Street time preserved: ${durationMinutes} minutes (started at ${streetTimeSession.start_time})`);
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
        await offRouteService.endOffRouteActivity();
        console.log('✓ Off-route timer auto-ended');
      
      // Reload sessions to update UI
      await loadStreetTimeSession();
      await loadOffRouteSession();
    }
      let actualStreetMinutes = 0;
      
      if (streetTimeSession && !streetTimeSession.end_time) {
        console.log('Ending street timer before opening dialog...');
        const endedSession = await streetTimeService.endSession(streetTimeSession.id);
        actualStreetMinutes = Math.round(endedSession.duration_minutes);
        
        setCompletedStreetTimeMinutes(actualStreetMinutes);
        setStreetStartTime(streetTimeSession.start_time);
        
        console.log(`✓ Street timer ended: ${actualStreetMinutes} minutes`);
        
        setStreetTimeSession(null);
        setStreetTime(0);
      }
      
      const predictedStreetMinutes = Math.round(prediction?.streetTime || 0);
      const runningLong = actualStreetMinutes > (predictedStreetMinutes + 15);
      
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

      if (streetTimeSession && !streetTimeSession.end_time) {
        try {
          console.log('Auto-ending active street time session during route completion...');
          const endedSession = await streetTimeService.endSession(streetTimeSession.id);
          streetTimeMinutes = Math.round(endedSession.duration_minutes);
          
          setCompletedStreetTimeMinutes(streetTimeMinutes);
          setStreetStartTime(streetTimeSession.start_time);
          console.log(`✓ Street time preserved during completion: ${streetTimeMinutes} minutes (started at ${streetTimeSession.start_time})`);
          
          setStreetTimeSession(null);
          setStreetTime(0);
        } catch (error) {
          console.error('Error stopping street time during route completion:', error);
          alert('Warning: Failed to automatically stop street time. Please verify your street time entry.');
        }
      }

      if (pmOfficeSession && !pmOfficeSession.ended_at) {
        try {
          const endedSession = await pmOfficeService.endSession(pmOfficeSession.id, notes);
          pmOfficeTimeMinutes = Math.round(endedSession.duration_seconds / 60);
          setPmOfficeSession(null);
          setPmOfficeTime(0);
          setNotes('');
          setShowNotes(false);
        } catch (error) {
          console.error('Error stopping PM Office during route completion:', error);
        }
      }

      const today = getLocalDateString();
      const currentRoute = getCurrentRouteConfig();

      let actualOfficeTime = 0;
      if (prediction && prediction.officeTime != null) {
        actualOfficeTime = prediction.officeTime;
      }
      
      const leaveTimeStr = todayInputs.leaveOfficeTime || currentRoute?.startTime || '07:30';
      const startTimeStr = currentRoute?.startTime || '07:30';
      
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
      
      if (calculatedOfficeTime >= 0 && calculatedOfficeTime <= 180) {
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

      const historyData = {
        date: today,
        dps: todayInputs.dps || 0,
        flats: todayInputs.flats || 0,
        letters: todayInputs.letters || 0,
        parcels: todayInputs.parcels || 0,
        sprs: todayInputs.sprs || 0,
        scannerTotal: todayInputs.scannerTotal || 0,
        curtailed: 0,
        officeTime: actualOfficeTime,
        streetTime: actualStreetTime,
        pmOfficeTime: pmOfficeTimeMinutes,
        totalMinutes: actualTotalMinutes,
        overtime: actualOvertime,
        predictedOfficeTime: 0,
        predictedStreetTime: 0,
        predictedReturnTime: null,
        actualLeaveTime: actualLeaveTime,
        actualClockOut: completionData.actualClockOut || null,
        auxiliaryAssistance: completionData.auxiliaryAssistance || false,
        mailNotDelivered: completionData.mailNotDelivered || false,
        routeId: currentRouteId,
        notes: completionData.notes || null,
        safetyTalk: todayInputs.safetyTalk || 0,
        hasBoxholder: todayInputs.hasBoxholder || false,
      };
      
      try {
        if (prediction && typeof prediction === 'object') {
          const predOfficeTime = prediction.officeTime;
          const predStreetTime = prediction.streetTime;
          const predReturnTime = prediction.returnTime;
          
          if (predOfficeTime != null && !isNaN(predOfficeTime)) {
            historyData.predictedOfficeTime = Math.round(predOfficeTime);
          }
          if (predStreetTime != null && !isNaN(predStreetTime)) {
            historyData.predictedStreetTime = Math.round(predStreetTime);
          }
          if (predReturnTime instanceof Date && !isNaN(predReturnTime.getTime())) {
            historyData.predictedReturnTime = predReturnTime.toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        }
      } catch (predError) {
        console.warn('Could not add prediction data to history:', predError);
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
      setCompletedStreetTimeMinutes(null);
      setStreetStartTime(null);
      
      updateTodayInputs({ 
        streetTimerStartTime: null 
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

  return (
    <div className="p-4 pb-20 max-w-4xl mx-auto">
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
              onChange={(e) => switchToRoute(e.target.value)}
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

      <Card className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Mail Volume</h3>
        
        <div className="mb-4">
          <Input
            label='📱 Scanner Total ("How Am I Doing" → Pkgs Remaining)'
            type="number"
            value={todayInputs.scannerTotal || ''}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              updateTodayInputs({ 
                scannerTotal: value,
                packagesManuallyUpdated: false
              });
              
              if (value > 0) {
                const sprs = Math.round(value * 0.56);
                const parcels = value - sprs;
                updateTodayInputs({
                  scannerTotal: value,
                  sprs: sprs,
                  parcels: parcels,
                  packagesManuallyUpdated: false
                });
              }
            }}
            placeholder="103"
            helperText="Check your scanner for total packages"
          />
          
          {todayInputs.scannerTotal > 0 && (
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800 font-medium mb-2">
                📊 {todayInputs.packagesManuallyUpdated ? 'Manual Split' : 'Auto-Split: 56% SPRs / 44% Parcels'}
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
            label="Parcels"
            type="number"
            value={todayInputs.parcels || ''}
            onChange={(e) => {
              const numValue = parseInt(e.target.value) || 0;
              const scannerTotal = todayInputs.scannerTotal || 0;
              
              if (scannerTotal > 0) {
                const newSprs = Math.max(0, scannerTotal - numValue);
                updateTodayInputs({
                  parcels: numValue,
                  sprs: newSprs,
                  packagesManuallyUpdated: true
                });
              } else {
                handleInputChange('parcels', e.target.value);
              }
            }}
            placeholder="0"
          />
          <Input
            label="SPRs"
            type="number"
            value={todayInputs.sprs || ''}
            onChange={(e) => {
              const numValue = parseInt(e.target.value) || 0;
              const scannerTotal = todayInputs.scannerTotal || 0;
              
              if (scannerTotal > 0) {
                const newParcels = Math.max(0, scannerTotal - numValue);
                updateTodayInputs({
                  sprs: numValue,
                  parcels: newParcels,
                  packagesManuallyUpdated: true
                });
              } else {
                handleInputChange('sprs', e.target.value);
              }
            }}
            placeholder="0"
          />
          <Input
            label="Safety/Training (min)"
            type="number"
            value={todayInputs.safetyTalk || ''}
            onChange={(e) => handleInputChange('safetyTalk', e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={todayInputs.hasBoxholder || false}
              onChange={(e) => updateTodayInputs({ hasBoxholder: e.target.checked })}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm text-gray-700">Boxholder/EDDM</span>
          </label>
        </div>
      </Card>

      {prediction && (
        <>
          <OfficeTimeBreakdown prediction={prediction} />
          <HowAmIDoingSection prediction={prediction} />
        </>
      )}

      {showBannerNudge && prediction && prediction.clockOutTime && (
        <Card className="bg-yellow-50 border-2 border-yellow-400 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-900">Past Predicted End Time</h3>
              <p className="text-sm text-yellow-800">
                You're {Math.round((Date.now() - prediction.clockOutTime) / 1000 / 60)} minutes past predicted clock out. 
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
                Complete your route when finished to save data
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
                Complete Route
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleStartRoute} className="w-full">
            Start Route
          </Button>
        )}
      </Card>

      {showCompletionDialog && (
        <RouteCompletionDialog
          prediction={prediction || { officeTime: 0, streetTime: 0, clockOutTime: null, returnTime: null }}
          todayInputs={todayInputs}
          calculatedStreetTime={completedStreetTimeMinutes}
          onComplete={handleCompleteRoute}
          onCancel={() => setShowCompletionDialog(false)}
        />
      )}

      {showForgotRouteDialog && (
        <ForgotRouteDialog
          routeStartTime={todayInputs.leaveOfficeTime || getCurrentRouteConfig()?.startTime || '08:00'}
          predictedStreetMinutes={Math.round(prediction?.streetTime || 0)}
          actualStreetMinutes={completedStreetTimeMinutes || 0}
          onCorrect={handleForgotRouteCorrect}
          onUseActual={handleForgotRouteUseActual}
          onCancel={handleForgotRouteCancel}
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
