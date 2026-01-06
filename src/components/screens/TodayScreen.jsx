import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Clock, Pause, Play, FileText, Navigation } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import Input from '../shared/Input';
import HowAmIDoingSection from '../shared/HowAmIDoingSection';
import PackageProgressCard from '../shared/PackageProgressCard';
import RouteCompletionDialog from '../shared/RouteCompletionDialog';
import WorkOffRouteModal from '../shared/WorkOffRouteModal';
import EndOfDayReport from '../shared/EndOfDayReport';
import useRouteStore from '../../stores/routeStore';
import { calculateFullDayPrediction } from '../../services/predictionService';
import { saveRouteHistory, getWeekTotalMinutes } from '../../services/routeHistoryService';
import { pmOfficeService } from '../../services/pmOfficeService';
import { streetTimeService } from '../../services/streetTimeService';
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
  const [weekTotal, setWeekTotal] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [showEodReport, setShowEodReport] = useState(false);
  const [eodReportData, setEodReportData] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadActiveSession();
    loadStreetTimeSession();
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

  useEffect(() => {
    if (!streetTimeSession) return;

    const interval = setInterval(() => {
      const duration = streetTimeService.calculateCurrentDuration(streetTimeSession);
      setStreetTime(duration);
    }, 1000);

    return () => clearInterval(interval);
  }, [streetTimeSession]);

  const loadActiveSession = async () => {
    try {
      const session = await pmOfficeService.getActiveSession();
      setPmOfficeSession(session);
      if (session) {
        setNotes(session.notes || '');
        const duration = pmOfficeService.calculateCurrentDuration(session);
        setPmOfficeTime(duration);
      }
    } catch (error) {
      console.error('Error loading active session:', error);
    }
  };

  const loadStreetTimeSession = async () => {
    try {
      const session = await streetTimeService.getActiveSession();
      setStreetTimeSession(session);
      if (session) {
        const duration = streetTimeService.calculateCurrentDuration(session);
        setStreetTime(duration);
        setRouteStarted(true);
      } else if (routeStarted && !session) {
        setRouteStarted(false);
      }
    } catch (error) {
      console.error('Error loading street time session:', error);
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

  const prediction = useMemo(() => {
    const hasInput = todayInputs.dps || todayInputs.flats || todayInputs.letters ||
                     todayInputs.parcels || todayInputs.sprs;

    if (!hasInput) return null;

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

    return calculateFullDayPrediction(todayMail, routeConfig, routeHistory);
  }, [todayInputs, history, getCurrentRouteConfig]);

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

      const session = await streetTimeService.startSession(currentRouteId);
      setStreetTimeSession(session);
      setStreetTime(0);
      setRouteStarted(true);
      console.log('Route started with data:', todayInputs);
      console.log('Street time tracking started:', session);
    } catch (error) {
      console.error('Error starting route:', error);
      alert(error.message || 'Failed to start street time tracking');
    }
  };

  const handleCancelRoute = () => {
    if (confirm('Cancel route start? Your mail volume data will be kept.')) {
      setRouteStarted(false);
    }
  };

  const handleStartPmOffice = async () => {
    try {
      if (streetTimeSession && !streetTimeSession.end_time) {
        await streetTimeService.endSession(streetTimeSession.id);
        setStreetTimeSession(null);
        setStreetTime(0);
      }

      const session = await pmOfficeService.startSession();
      setPmOfficeSession(session);
      setPmOfficeTime(0);
      setNotes('');
      await loadWeekTotal();
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
      await loadWeekTotal();
      const duration = Math.round(pmOfficeTime / 60);
      alert(`PM Office completed: ${duration} minutes`);
    } catch (error) {
      console.error('Error stopping PM Office:', error);
      alert('Failed to stop PM Office timer');
    }
  };

  const handlePausePmOffice = async () => {
    if (!pmOfficeSession) return;

    try {
      const updated = await pmOfficeService.pauseSession(pmOfficeSession.id);
      setPmOfficeSession(updated);
    } catch (error) {
      console.error('Error pausing PM Office:', error);
      alert(error.message || 'Failed to pause PM Office timer');
    }
  };

  const handleResumePmOffice = async () => {
    if (!pmOfficeSession) return;

    try {
      const updated = await pmOfficeService.resumeSession(pmOfficeSession.id);
      setPmOfficeSession(updated);
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

  const handleCompleteRoute = async (completionData) => {
    console.log('handleCompleteRoute - currentRouteId:', currentRouteId);

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
          const endedSession = await streetTimeService.endSession(streetTimeSession.id);
          streetTimeMinutes = Math.round(endedSession.duration_minutes);
          setStreetTimeSession(null);
          setStreetTime(0);
        } catch (error) {
          console.error('Error stopping street time during route completion:', error);
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

      const actualOfficeTime = prediction?.officeTime || 0;
      const actualStreetTime = completionData.streetTime || streetTimeMinutes || 0;
      const actualTotalMinutes = actualOfficeTime + actualStreetTime + pmOfficeTimeMinutes;
      const tourLengthMinutes = (currentRoute?.tourLength || 8.5) * 60;
      const actualOvertime = Math.max(0, actualTotalMinutes - tourLengthMinutes);

      const historyData = {
        date: today,
        dps: todayInputs.dps || 0,
        flats: todayInputs.flats || 0,
        letters: todayInputs.letters || 0,
        parcels: todayInputs.parcels || 0,
        sprs: todayInputs.sprs || 0,
        streetTime: actualStreetTime,
        officeTime: prediction?.officeTime,
        overtime: actualOvertime,
        auxiliaryAssistance: completionData.auxiliaryAssistance,
        mailNotDelivered: completionData.mailNotDelivered,
        notes: completionData.notes,
        pmOfficeTime: pmOfficeTimeMinutes,
        hasBoxholder: todayInputs.hasBoxholder || false,
        startTime: todayInputs.leaveOfficeTime || currentRoute?.startTime,
        leaveOfficeTime: prediction?.leaveOfficeTime,
      };

      const waypointsToSave = waypoints.map(wp => ({
        id: wp.id,
        name: wp.address || `Stop ${wp.sequence_number}`,
        order: wp.sequence_number,
        status: wp.status,
        completedAt: wp.delivery_time
      }));

      console.log('About to save route history with data:', {
        currentRouteId,
        historyData,
        waypointsToSave
      });

      const result = await saveRouteHistory(currentRouteId, historyData, waypointsToSave);

      console.log('Route history saved successfully:', result);

      if (result) {
        addHistoryEntry(result);
      }

      setShowCompletionDialog(false);
      setRouteStarted(false);
      await loadWeekTotal();

      const updatedWeekTotal = await getWeekTotalMinutes();

      const { data: routeData } = await supabase
        .from('routes')
        .select('route_number, evaluated_street_time')
        .eq('id', currentRouteId)
        .maybeSingle();

      const reportData = {
        date: today,
        routeNumber: routeData?.route_number || currentRoute?.routeNumber || 'N/A',
        mailVolumes: {
          dps: todayInputs.dps || 0,
          flats: todayInputs.flats || 0,
          letters: todayInputs.letters || 0,
          parcels: todayInputs.parcels || 0,
          sprs: todayInputs.sprs || 0,
        },
        predictedOfficeTime: prediction?.officeTime || null,
        actualOfficeTime: actualOfficeTime,
        officeTime722: actualOfficeTime,
        officeTime744: pmOfficeTimeMinutes,
        predictedStreetTime: prediction?.streetTime || null,
        actualStreetTime: actualStreetTime,
        evaluatedStreetTime: routeData?.evaluated_street_time ? Math.round(routeData.evaluated_street_time * 60) : null,
        predictedClockOut: prediction?.clockOutTime || null,
        actualClockOut: completionData.actualClockOut || null,
        officeTime: actualOfficeTime,
        pmOfficeTime: pmOfficeTimeMinutes,
        overtime: actualOvertime,
        penaltyOvertime: result?.penalty_overtime || 0,
        workOffRouteTime: 0,
        auxiliaryAssistance: completionData.auxiliaryAssistance,
        mailNotDelivered: completionData.mailNotDelivered,
        notes: completionData.notes,
        weekTotal: updatedWeekTotal,
      };

      setEodReportData(reportData);
      setShowEodReport(true);
    } catch (error) {
      console.error('Failed to complete route:', error);
      throw error;
    }
  };

  const totalDPS = todayInputs.dps || 0;
  const totalFeet = (todayInputs.flats || 0) + (todayInputs.letters || 0);
  const routesList = Object.values(routes);
  const currentRoute = routes[currentRouteId];

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {format(date, 'EEEE, MMMM d')}
        </h2>
        <p className="text-sm text-gray-500">{format(date, 'yyyy')}</p>
      </div>

      {routesList.length > 1 && (
        <Card className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Route
          </label>
          <select
            value={currentRouteId || ''}
            onChange={(e) => switchToRoute(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {routesList.map((route) => (
              <option key={route.id} value={route.id}>
                Route {route.routeNumber}
              </option>
            ))}
          </select>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Mail Volume</h3>

        <Input
          label="DPS (Delivery Point Sequence)"
          type="number"
          value={todayInputs.dps || ''}
          onChange={(e) => handleInputChange('dps', e.target.value)}
          placeholder="0"
          min="0"
        />

        <Input
          label="Flats (feet)"
          type="number"
          value={todayInputs.flats || ''}
          onChange={(e) => handleInputChange('flats', e.target.value)}
          placeholder="0"
          min="0"
          step="0.01"
        />

        <Input
          label="Letters (feet)"
          type="number"
          value={todayInputs.letters || ''}
          onChange={(e) => handleInputChange('letters', e.target.value)}
          placeholder="0"
          min="0"
          step="0.01"
        />

        <div>
          <Input
            label="Safety/Training Time (minutes)"
            type="number"
            value={todayInputs.safetyTalk || ''}
            onChange={(e) => handleInputChange('safetyTalk', e.target.value)}
            placeholder="10"
            min="0"
            max="60"
          />
          <p className="text-xs text-gray-500 mt-1">
            Daily safety talks, service talks, training, and briefings
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="has-boxholder"
            checked={todayInputs.hasBoxholder || false}
            onChange={(e) => updateTodayInputs({ hasBoxholder: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="has-boxholder" className="text-sm font-medium text-gray-700">
            Boxholder Mail Today (EDDM/Unaddressed)
          </label>
        </div>
        {todayInputs.hasBoxholder && (
          <p className="text-xs text-blue-600 mt-1 ml-6">
            +15 minutes added to office time for boxholder bundling
          </p>
        )}

        <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">DPS Pieces:</span>
            <span className="text-2xl font-bold text-blue-600">{totalDPS}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Flats + Letters:</span>
            <span className="text-2xl font-bold text-blue-600">{totalFeet.toFixed(2)} ft</span>
          </div>
        </div>
      </Card>

      {!routeStarted && <HowAmIDoingSection />}

      {routeStarted && <PackageProgressCard />}

      {prediction && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Today's Prediction</h3>
            <span className="text-2xl">{prediction.prediction?.badge || '📊'}</span>
          </div>

          <div className="space-y-3">
            <div className="bg-white/70 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Office Time</span>
                <span className="text-xl font-bold text-blue-600">
                  {Math.floor(prediction.officeTime / 60)}h {Math.round(prediction.officeTime % 60)}m
                </span>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Fixed Office Time:</span>
                  <span>{Math.round(prediction.components.fixedOfficeTime)} min</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-700">
                  <span>Casing Time:</span>
                  <span>{Math.round(prediction.components.caseTime)} min</span>
                </div>
                {prediction.breakdown.flats.time > 0 && (
                  <div className="flex justify-between pl-3">
                    <span>• Flats ({prediction.breakdown.flats.pieces} pcs):</span>
                    <span>{Math.round(prediction.breakdown.flats.time)} min</span>
                  </div>
                )}
                {prediction.breakdown.letters.time > 0 && (
                  <div className="flex justify-between pl-3">
                    <span>• Letters ({prediction.breakdown.letters.pieces} pcs):</span>
                    <span>{Math.round(prediction.breakdown.letters.time)} min</span>
                  </div>
                )}
                {prediction.breakdown.sprs.time > 0 && (
                  <div className="flex justify-between pl-3">
                    <span>• SPRs ({prediction.breakdown.sprs.pieces} pcs):</span>
                    <span>{Math.round(prediction.breakdown.sprs.time)} min</span>
                  </div>
                )}
                {prediction.components.pullDownTime > 0 && (
                  <div className="flex justify-between">
                    <span>Pull-Down Time:</span>
                    <span>{Math.round(prediction.components.pullDownTime)} min</span>
                  </div>
                )}
                {prediction.components.safetyTalk > 0 && (
                  <div className="flex justify-between">
                    <span>Safety/Training:</span>
                    <span>{Math.round(prediction.components.safetyTalk)} min</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Leave Office</p>
                <p className="text-lg font-bold text-gray-900">{formatTimeAMPM(prediction.leaveOfficeTime)}</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Return Time</p>
                <p className="text-lg font-bold text-gray-900">{formatTimeAMPM(prediction.clockOutTime)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Street Time</p>
                <p className="text-lg font-bold text-gray-900">
                  {Math.floor(prediction.streetTime / 60)}h {Math.round(prediction.streetTime % 60)}m
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Overtime</p>
                <p className={`text-lg font-bold ${prediction.overtime > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {prediction.overtime > 0 ? `+${Math.round(prediction.overtime)} min` : 'None'}
                </p>
              </div>
            </div>

            {prediction.prediction?.confidence && (
              <div className="bg-white/70 rounded-lg p-2 text-center">
                <span className="text-xs text-gray-600">
                  Confidence: <span className="font-semibold capitalize">{prediction.prediction.confidence}</span>
                  {prediction.prediction.matchesUsed > 0 && (
                    <> • {prediction.prediction.matchesUsed} similar days</>
                  )}
                </span>
              </div>
            )}
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
              <Button onClick={() => setShowCompletionDialog(true)} className="w-full">
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
          prediction={prediction}
          todayInputs={todayInputs}
          calculatedStreetTime={Math.round(streetTime / 60)}
          onComplete={handleCompleteRoute}
          onCancel={() => setShowCompletionDialog(false)}
        />
      )}

      {showWorkOffRouteModal && (
        <WorkOffRouteModal onClose={() => setShowWorkOffRouteModal(false)} />
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
