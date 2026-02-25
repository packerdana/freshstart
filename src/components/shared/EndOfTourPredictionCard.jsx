import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Clock, Coffee, AlertCircle, CheckCircle2 } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import useBreakStore from '../../stores/breakStore';
import useRouteStore from '../../stores/routeStore';
import { addMinutes, formatTimeAMPM, parseLocalDate, getLocalDateString } from '../../utils/time';

/**
 * EndOfTourPredictionCard
 * 
 * Floating sticky card that shows:
 * - Real-time break/lunch status (10/10 break, 30/30 lunch, etc.)
 * - Dynamic End-of-Tour prediction based on:
 *   1. Current predicted clock-out time from the route
 *   2. Remaining break/lunch time (affects the earliest possible finish)
 * - Warnings if break/lunch time will push finish past normal out
 * - Collapse/expand toggle for screen space on mobile
 */
export default function EndOfTourPredictionCard({ prediction, routeStartTime, routeConfig }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showManualBreakOptions, setShowManualBreakOptions] = useState(false);
  
  // Break/lunch state
  const lunchTime = useBreakStore((state) => state.lunchTime);
  const lunchActive = useBreakStore((state) => state.lunchActive);
  const breakTime = useBreakStore((state) => state.breakTime);
  const breakActive = useBreakStore((state) => state.breakActive);
  const breakType = useBreakStore((state) => state.breakType);
  const todaysBreaks = useBreakStore((state) => state.todaysBreaks);
  const breakEvents = useBreakStore((state) => state.breakEvents || []);
  const completeLunch = useBreakStore((state) => state.completeLunch);
  const completeBreak = useBreakStore((state) => state.completeBreak);
  
  // Current time for calculations
  const [now, setNow] = useState(new Date());
  
  // Prediction calculations
  const predictions = useMemo(() => {
    if (!prediction || !routeStartTime) {
      return { baseClock: null, earliest: null, latest: null };
    }

    // Parse route start time (format: "HH:MM")
    let startMs = null;
    if (typeof routeStartTime === 'string') {
      const [h, m] = routeStartTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      startMs = d.getTime();
    } else if (routeStartTime instanceof Date) {
      startMs = routeStartTime.getTime();
    }

    /**
     * ✅ CLEANER FIX: Use the calculated return-to-PO time from waypoint predictions.
     * 
     * The WaypointsScreen now calculates:
     * End of Tour = Last Real Delivery Prediction + (Avg duration: Last Stop → Return to PO)
     *
     * This is better because:
     * - Uses verified last delivery prediction (working correctly)
     * - Adds historical average duration from that stop back to office
     * - Avoids day-rollover issues on Return to Post Office waypoint itself
     * - Self-corrects if ahead/behind — last waypoint time already reflects that
     */
    
    let baseClock = null;
    
    if (prediction.returnToPOTime instanceof Date && !isNaN(prediction.returnToPOTime.getTime())) {
      // Use the calculated End of Tour time from waypoint predictions
      baseClock = new Date(prediction.returnToPOTime);
      console.log('[EndOfTourCard] Using calculated return-to-PO time:', baseClock.toLocaleTimeString(), 
        '(last delivery + ' + prediction.durationToReturn + ' min)');
    } else if (prediction.returnToPOMinutes && typeof prediction.returnToPOMinutes === 'number') {
      // Fallback: if we only have total minutes
      baseClock = new Date(startMs + prediction.returnToPOMinutes * 60 * 1000);
      console.log('[EndOfTourCard] Fallback to return-to-PO minutes:', prediction.returnToPOMinutes);
    } else {
      // Final fallback: use streetTime + standard office time (for old data)
      const basePredictedMinutes = prediction.streetTime || prediction || 0;
      const officeMinutes = 45; // Standard: 30 min lunch + 15 min office
      const totalMinutes = basePredictedMinutes + officeMinutes;
      baseClock = new Date(startMs + totalMinutes * 60 * 1000);
      console.log('[EndOfTourCard] Fallback to streetTime + 45 min:', baseClock.toLocaleTimeString());
    }
    
    // Now calculate how much break/lunch time is remaining
    const lunchMinutesTotal = 30;
    const breakMinutesTotal = 20; // 2× 10-min breaks
    
    // Count completed breaks/lunch from breakEvents (has the correct format)
    const completedBreakSeconds = breakEvents.reduce((sum, b) => {
      if (b.kind === 'break' || b.kind === 'lunch') {
        return sum + (b.seconds || 0);
      }
      return sum;
    }, 0);
    const completedBreakMinutes = completedBreakSeconds / 60;
    
    // Remaining break/lunch time
    const remainingBreakLunchMinutes = (lunchMinutesTotal + breakMinutesTotal) - completedBreakMinutes;
    
    // Earliest: base prediction (assumes remaining breaks will be taken during the day)
    const earliestClock = new Date(baseClock);
    
    // Latest: base prediction + remaining break/lunch time
    // (assumes breaks/lunch happen AFTER all work is done)
    const latestClock = new Date(baseClock.getTime() + Math.max(0, remainingBreakLunchMinutes) * 60 * 1000);
    
    return {
      baseClock,
      earliest: earliestClock,
      latest: latestClock,
      remainingBreakLunchMinutes: Math.max(0, remainingBreakLunchMinutes),
      completedBreakMinutes,
    };
  }, [prediction, routeStartTime, breakEvents]);

  // Update time every 10 seconds for real-time updates
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Calculate break/lunch display text
  // Use predictions.remainingBreakLunchMinutes (already calculated correctly from breakEvents)
  const breakLunchStatus = useMemo(() => {
    const remaining = predictions?.remainingBreakLunchMinutes || 0;
    
    if (remaining <= 0) {
      return '✓ All breaks taken';
    }
    
    // Show total remaining (simplified; exact breakdown depends on what was taken)
    return `Breaks & Lunch: ${Math.round(remaining)} min remaining`;
  }, [predictions?.remainingBreakLunchMinutes]);

  // Warning: check if remaining break/lunch time will push finish past config "usual out"
  const shouldWarn = useMemo(() => {
    if (!predictions.latest || !routeConfig?.expectedOutTime) {
      return false;
    }

    // Parse expected out time (format: "HH:MM")
    const [h, m] = routeConfig.expectedOutTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    const expectedOutMs = d.getTime();

    return predictions.latest.getTime() > expectedOutMs;
  }, [predictions.latest, routeConfig]);

  if (!prediction || !routeStartTime) {
    return null;
  }

  const formatClock = (date) => {
    if (!date) return '--:--';
    return formatTimeAMPM(date);
  };

  return (
    <div className="sticky top-0 z-40 px-4 pt-4 pb-2">
      <Card
        className={`
          border-2 transition-all
          ${shouldWarn 
            ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50' 
            : 'border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50'
          }
        `}
      >
        <div
          className="flex items-center justify-between cursor-pointer py-3 px-4"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-3 flex-1">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-xs font-semibold text-gray-600">END OF TOUR</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatClock(predictions.earliest)}
                {/* Only show range if breaks/lunch remain. Once consumed, show single time. */}
                {predictions.earliest && predictions.latest && 
                  predictions.earliest.getTime() !== predictions.latest.getTime() &&
                  predictions.remainingBreakLunchMinutes > 0 && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      – {formatClock(predictions.latest)}
                    </span>
                  )
                }
              </div>
            </div>
          </div>
          
          <button
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronUp className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {!isCollapsed && (
          <div className="px-4 pb-3 border-t border-gray-200/50 pt-3 space-y-3">
            {/* Break/Lunch Status */}
            <div className="flex items-start gap-3">
              <Coffee className="w-4 h-4 text-amber-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-gray-600 mb-1">BREAK/LUNCH STATUS</div>
                <div className="text-sm font-medium text-gray-900">
                  {breakLunchStatus}
                </div>
                {/* Manual break/lunch checkoff for non-timer users */}
                {!breakActive && !lunchActive && (
                  <div className="mt-2 space-y-1">
                    <button
                      onClick={() => setShowManualBreakOptions(!showManualBreakOptions)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {showManualBreakOptions ? '▼' : '▶'} Mark breaks manually
                    </button>
                    {showManualBreakOptions && (
                      <div className="pl-2 pt-1 border-l-2 border-blue-200 space-y-1">
                        <button
                          onClick={async () => {
                            const minutes = prompt('How many minutes for lunch?\n\n(Default: 30 min)', '30');
                            if (minutes === null) return;
                            const mins = Math.max(0, parseInt(minutes, 10) || 30);
                            if (mins > 0) {
                              // Create a manual lunch entry
                              const endTime = Date.now();
                              const startTime = endTime - (mins * 60 * 1000);
                              useBreakStore.setState((state) => ({
                                waypointPausedSeconds: (state.waypointPausedSeconds || 0) + (mins * 60),
                                waypointPauseDate: getLocalDateString(),
                                breakEvents: [
                                  ...(state.breakEvents || []),
                                  {
                                    kind: 'lunch',
                                    label: 'Lunch (manual)',
                                    startTime,
                                    endTime,
                                    seconds: mins * 60,
                                  },
                                ],
                                todaysBreaksDate: getLocalDateString(),
                                todaysBreaks: [
                                  ...state.todaysBreaks,
                                  {
                                    type: 'Lunch',
                                    icon: '🍔',
                                    time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                                    duration: `${mins}m`,
                                  },
                                ],
                              }));
                              setShowManualBreakOptions(false);
                            }
                          }}
                          className="block w-full text-left px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 rounded text-blue-700 font-medium"
                        >
                          ✓ Mark Lunch Done
                        </button>
                        <button
                          onClick={async () => {
                            const minutes = prompt('How many minutes for breaks?\n\n(Default: 20 min)', '20');
                            if (minutes === null) return;
                            const mins = Math.max(0, parseInt(minutes, 10) || 20);
                            if (mins > 0) {
                              // Create a manual break entry
                              const endTime = Date.now();
                              const startTime = endTime - (mins * 60 * 1000);
                              useBreakStore.setState((state) => ({
                                waypointPausedSeconds: (state.waypointPausedSeconds || 0) + (mins * 60),
                                waypointPauseDate: getLocalDateString(),
                                breakEvents: [
                                  ...(state.breakEvents || []),
                                  {
                                    kind: 'break',
                                    label: 'Break (manual)',
                                    startTime,
                                    endTime,
                                    seconds: mins * 60,
                                  },
                                ],
                                todaysBreaksDate: getLocalDateString(),
                                todaysBreaks: [
                                  ...state.todaysBreaks,
                                  {
                                    type: 'Break',
                                    icon: '⏸️',
                                    time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                                    duration: `${mins}m`,
                                  },
                                ],
                              }));
                              setShowManualBreakOptions(false);
                            }
                          }}
                          className="block w-full text-left px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 rounded text-blue-700 font-medium"
                        >
                          ✓ Mark Breaks Done
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Prediction Details */}
            {/* Show range only if breaks remain. Once all breaks used, show single prediction. */}
            {predictions.remainingBreakLunchMinutes > 0 ? (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/60 rounded p-2">
                  <div className="text-gray-600 font-semibold">Earliest</div>
                  <div className="text-lg font-bold text-blue-600">
                    {formatClock(predictions.earliest)}
                  </div>
                  <div className="text-gray-600 text-xs mt-1">All breaks during route</div>
                </div>
                
                <div className="bg-white/60 rounded p-2">
                  <div className="text-gray-600 font-semibold">Latest</div>
                  <div className="text-lg font-bold text-blue-600">
                    {formatClock(predictions.latest)}
                  </div>
                  <div className="text-gray-600 text-xs mt-1">
                    +{Math.round(predictions.remainingBreakLunchMinutes)}min
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/60 rounded p-2 text-xs">
                <div className="text-gray-600 font-semibold">All breaks taken</div>
                <div className="text-lg font-bold text-green-600 mt-1">
                  {formatClock(predictions.earliest)}
                </div>
                <div className="text-gray-600 text-xs mt-1">✓ Your predicted clock-out time</div>
              </div>
            )}

            {/* Warning Banner - only show if breaks remain and would push past expected out time */}
            {shouldWarn && predictions.remainingBreakLunchMinutes > 0 && (
              <div className="bg-amber-100 border border-amber-300 rounded p-3 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <div className="font-semibold">Break/lunch may extend your day</div>
                  <div className="text-xs text-amber-800 mt-1">
                    Remaining time could push your finish to {formatClock(predictions.latest)} 
                    (vs usual {routeConfig?.expectedOutTime})
                  </div>
                </div>
              </div>
            )}

            {/* Smart Tips */}
            {predictions.remainingBreakLunchMinutes > 0 ? (
              <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 italic">
                💡 Tip: Take breaks during your route to keep your earliest time stable
              </div>
            ) : (
              <div className="text-xs text-green-700 bg-green-50 rounded p-2 italic">
                ✓ All breaks taken. You're locked in at {formatClock(predictions.earliest)}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
