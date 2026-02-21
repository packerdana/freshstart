import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Clock, Coffee, AlertCircle } from 'lucide-react';
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
  
  // Break/lunch state
  const lunchTime = useBreakStore((state) => state.lunchTime);
  const lunchActive = useBreakStore((state) => state.lunchActive);
  const breakTime = useBreakStore((state) => state.breakTime);
  const breakActive = useBreakStore((state) => state.breakActive);
  const breakType = useBreakStore((state) => state.breakType);
  const todaysBreaks = useBreakStore((state) => state.todaysBreaks);
  
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

    // Base predicted clock-out time
    // prediction is typically { streetTime: minutesOfStreetTime, ... }
    const basePredictedMinutes = prediction.streetTime || prediction || 0;
    
    // Office time constants (fixed)
    const officeMinutes = 45; // Standard office time: 30 min (lunch) + 15 min (office stuff)
    
    // Total time including office
    const totalMinutes = basePredictedMinutes + officeMinutes;
    
    // Calculate base clock-out (no breaks/lunch adjustment)
    const baseClock = new Date(startMs + totalMinutes * 60 * 1000);
    
    // Now calculate how much break/lunch time is remaining
    const lunchMinutesTotal = 30;
    const breakMinutesTotal = 20; // 2× 10-min breaks
    
    // Count completed breaks/lunch
    const completedBreakSeconds = todaysBreaks.reduce((sum, b) => {
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
  }, [prediction, routeStartTime, todaysBreaks]);

  // Update time every 10 seconds for real-time updates
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Calculate break/lunch display text
  const breakLunchStatus = useMemo(() => {
    const lunchMinutesRemaining = Math.max(0, 30 - Math.floor(lunchTime / 60));
    const breakMinutesRemaining = Math.max(0, 20 - Math.floor(breakTime / 60));
    
    const parts = [];
    if (lunchMinutesRemaining > 0) {
      parts.push(`Lunch: ${lunchMinutesRemaining}min`);
    } else {
      parts.push('✓ Lunch done');
    }
    
    if (breakMinutesRemaining > 0) {
      parts.push(`Break: ${breakMinutesRemaining}min`);
    } else {
      parts.push('✓ Breaks done');
    }
    
    return parts.join(' • ');
  }, [lunchTime, breakTime]);

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
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
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
                {predictions.earliest && predictions.latest && 
                  predictions.earliest.getTime() !== predictions.latest.getTime() && (
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
              </div>
            </div>

            {/* Prediction Details */}
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

            {/* Warning Banner */}
            {shouldWarn && (
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
            <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 italic">
              💡 Tip: Take breaks during your route to keep your earliest time stable
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
