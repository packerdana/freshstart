import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { smartLoadMonitor } from '../services/smart-load-monitor';
import { saveBreakState, loadBreakState, clearBreakState } from '../services/breakService';

// ADDED: Auto-save interval (save state every 30 seconds while timer is active)
let autoSaveInterval = null;

// Alarm interval: repeat sound/vibrate until user acknowledges.
let alarmInterval = null;

const tryVibrate = () => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([250, 120, 250]);
    }
  } catch {
    // ignore
  }
};

const tryBeep = async () => {
  try {
    // WebAudio beep (works after any user interaction; otherwise may be blocked).
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 880;

    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.stop(ctx.currentTime + 0.4);

    // Let it close cleanly.
    setTimeout(() => {
      try { ctx.close(); } catch { /* ignore */ }
    }, 600);
  } catch {
    // ignore
  }
};

const startAlarm = (setState, kind) => {
  // kind: 'lunch' | 'break'
  stopAlarm(setState);
  setState({ alarmActive: true, alarmKind: kind, alarmStartedAt: Date.now() });

  const fire = () => {
    tryVibrate();
    tryBeep();
  };

  // Fire immediately and then repeat.
  fire();
  alarmInterval = setInterval(fire, 15000);
};

const stopAlarm = (setState) => {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  // Only clear if setState passed (store context)
  if (setState) {
    setState({ alarmActive: false, alarmKind: null, alarmStartedAt: null });
  }
};

const startAutoSave = (getState) => {
  if (autoSaveInterval) return; // Already running
  
  autoSaveInterval = setInterval(() => {
    const state = getState();
    if (state.lunchActive || state.breakActive || state.loadTruckActive) {
      saveBreakState(state);
    }
  }, 30000); // Save every 30 seconds
  
  console.log('✓ Auto-save started for break timers');
};

const stopAutoSave = () => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
    console.log('✓ Auto-save stopped');
  }
};

const useBreakStore = create(
  persist(
    (set, get) => ({
  lunchActive: false,
  lunchTime: 30 * 60,
  lunchStartTime: null,

  breakActive: false,
  breakTime: 0,
  breakType: null,
  breakStartTime: null,

  loadTruckActive: false,
  loadTruckTime: 0,
  loadTruckStartTime: null,
  loadTruckPackageCount: 0,
  loadTruckWarning: false,

  todaysBreaks: [],

  // Detailed break events for adjusting waypoint "expected" times.
  // Each event: { kind, label, startTime, endTime, seconds }
  breakEvents: [],

  // Minutes/seconds of breaks that should PAUSE waypoint predictions (lunch + breaks only; NOT load truck)
  waypointPausedSeconds: 0,

  // Nudge banner snoozes (so we don't spam)
  breakNudgeSnoozedUntil: null,
  loadTruckNudgeSnoozedUntil: null,

  // Audible/vibrate alarm when timers finish (repeat until acknowledged)
  alarmActive: false,
  alarmKind: null, // 'lunch' | 'break'
  alarmStartedAt: null,

  // Keep the screen awake while timers are active (prevents background throttling / missed alerts)
  keepAwakeDuringTimers: false,
  wakeLockActive: false,

  // ADDED: Initialize from database
  initialized: false,
  initializing: false,
  initializeFromDatabase: async () => {
    // Avoid parallel init calls
    if (get().initializing) return;
    set({ initializing: true });

    const savedState = await loadBreakState();

    // If auth isn't ready yet (common right after refresh), don't mark initialized.
    // App.tsx will call this again once the user session is available.
    if (savedState && savedState.__noUser) {
      set({ initializing: false });
      return;
    }

    if (savedState) {
      console.log('Restoring break timers from database...');
      
      // Restore detailed break events (used to adjust expected waypoint times)
      if (Array.isArray(savedState.breakEvents)) {
        set({ breakEvents: savedState.breakEvents });
      }

      // Restore accumulated pause for waypoint predictions
      if (typeof savedState.waypointPausedSeconds === 'number') {
        set({ waypointPausedSeconds: savedState.waypointPausedSeconds });
      }

      // Restore lunch timer
      if (savedState.lunchActive && savedState.lunchStartTime) {
        const elapsed = Math.floor((Date.now() - savedState.lunchStartTime) / 1000);
        const remaining = Math.max(0, 30 * 60 - elapsed);
        
        if (remaining > 0) {
          set({
            lunchActive: true,
            lunchTime: remaining,
            lunchStartTime: savedState.lunchStartTime,
          });
          startAutoSave(get);
          console.log(`✓ Lunch timer restored: ${Math.floor(remaining / 60)} minutes remaining`);
        }
      }
      
      // Restore break timer
      if (savedState.breakActive && savedState.breakStartTime && savedState.breakType) {
        const elapsed = Math.floor((Date.now() - savedState.breakStartTime) / 1000);
        
        if (savedState.breakType.countDown) {
          const remaining = Math.max(0, savedState.breakType.duration - elapsed);
          if (remaining > 0) {
            set({
              breakActive: true,
              breakType: savedState.breakType,
              breakTime: remaining,
              breakStartTime: savedState.breakStartTime,
            });
            startAutoSave(get);
            console.log(`✓ Break timer restored: ${Math.floor(remaining / 60)} minutes remaining`);
          }
        } else {
          set({
            breakActive: true,
            breakType: savedState.breakType,
            breakTime: elapsed,
            breakStartTime: savedState.breakStartTime,
          });
          startAutoSave(get);
          console.log(`✓ Break timer restored: ${Math.floor(elapsed / 60)} minutes elapsed`);
        }
      }
      
      // Restore load truck timer
      if (savedState.loadTruckActive && savedState.loadTruckStartTime) {
        const elapsed = Math.floor((Date.now() - savedState.loadTruckStartTime) / 1000);
        
        set({
          loadTruckActive: true,
          loadTruckTime: elapsed,
          loadTruckStartTime: savedState.loadTruckStartTime,
          loadTruckPackageCount: savedState.loadTruckPackageCount || 0,
        });
        startAutoSave(get);
        console.log(`✓ Load truck timer restored: ${Math.floor(elapsed / 60)} minutes elapsed`);
      }
    }

    set({ initialized: true, initializing: false });
  },

  startLunch: async () => {
    // If an alarm is ringing from a previous timer, stop it.
    stopAlarm(set);

    const state = {
      lunchActive: true,
      lunchTime: 30 * 60,
      lunchStartTime: Date.now(),
    };
    
    set(state);
    await saveBreakState({ ...get(), ...state }); // ADDED: Save to database
    startAutoSave(get); // ADDED: Start auto-save
  },

  endLunch: async () => {
    stopAlarm(set);
    const { lunchTime, lunchStartTime, todaysBreaks, waypointPausedSeconds, breakEvents } = get();
    const duration = Math.round((30 * 60 - lunchTime) / 60);

    // Add actual lunch seconds to the waypoint pause accumulator
    const lunchSeconds = Math.max(0, (30 * 60 - lunchTime));

    const endTime = Date.now();
    const startTime = lunchStartTime || (endTime - lunchSeconds * 1000);

    set({
      lunchActive: false,
      lunchStartTime: null,
      lunchTime: 30 * 60,
      waypointPausedSeconds: (waypointPausedSeconds || 0) + lunchSeconds,
      breakEvents: [
        ...(breakEvents || []),
        {
          kind: 'lunch',
          label: 'Lunch',
          startTime,
          endTime,
          seconds: lunchSeconds,
        },
      ],
      todaysBreaks: [
        ...todaysBreaks,
        {
          type: 'Lunch',
          icon: '🍔',
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          duration: `${duration}m`,
        },
      ],
    });

    // Persist updated pause accumulator even when no timer is active
    await saveBreakState(get());
    stopAutoSave(); // ADDED: Stop auto-save
  },

  completeLunch: async () => {
    const { lunchStartTime, todaysBreaks, waypointPausedSeconds, breakEvents } = get();

    const endTime = Date.now();
    const startTime = lunchStartTime || (endTime - 30 * 60 * 1000);

    set({
      lunchActive: false,
      lunchStartTime: null,
      lunchTime: 30 * 60,
      waypointPausedSeconds: (waypointPausedSeconds || 0) + (30 * 60),
      breakEvents: [
        ...(breakEvents || []),
        { kind: 'lunch', label: 'Lunch', startTime, endTime, seconds: 30 * 60 },
      ],
      todaysBreaks: [
        ...todaysBreaks,
        {
          type: 'Lunch',
          icon: '🍔',
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          duration: '30m',
        },
      ],
    });

    // Persist updated pause accumulator even when no timer is active
    await saveBreakState(get());
    stopAutoSave(); // ADDED: Stop auto-save

    // Audible/vibrate alarm (repeat until acknowledged)
    startAlarm(set, 'lunch');
  },

  tickLunch: () => {
    const { lunchActive, lunchStartTime } = get();
    if (!lunchActive || !lunchStartTime) return;

    const elapsed = Math.floor((Date.now() - lunchStartTime) / 1000);
    const remaining = Math.max(0, 30 * 60 - elapsed);

    if (remaining <= 0) {
      get().completeLunch();
      return;
    }

    set({ lunchTime: remaining });
  },

  startBreak: async (type) => {
    // If an alarm is ringing from a previous timer, stop it.
    stopAlarm(set);

    const state = {
      breakActive: true,
      breakType: type,
      breakTime: type.countDown ? type.duration : 0,
      breakStartTime: Date.now(),
    };
    
    set(state);
    await saveBreakState({ ...get(), ...state }); // ADDED: Save to database
    startAutoSave(get); // ADDED: Start auto-save
  },

  endBreak: async (overrideMinutes = null) => {
    stopAlarm(set);
    const { breakTime, breakType, breakStartTime, todaysBreaks, waypointPausedSeconds, breakEvents } = get();
    let duration;

    if (breakType.countDown) {
      duration = Math.round((breakType.duration - breakTime) / 60);
    } else {
      duration = Math.round(breakTime / 60);
    }

    // Add actual break seconds to the waypoint pause accumulator
    // If the user forgot to stop the timer, allow an override duration.
    const override = overrideMinutes != null ? Math.max(0, Math.round(Number(overrideMinutes) || 0)) : null;
    const breakSeconds = Math.max(0, (override != null ? override : duration) * 60);

    const endTime = Date.now();
    const startTime = breakStartTime || (endTime - breakSeconds * 1000);

    set({
      breakActive: false,
      breakType: null,
      breakTime: 0,
      breakStartTime: null,
      waypointPausedSeconds: (waypointPausedSeconds || 0) + breakSeconds,
      breakEvents: [
        ...(breakEvents || []),
        {
          kind: 'break',
          label: breakType.label,
          startTime,
          endTime,
          seconds: breakSeconds,
        },
      ],
      todaysBreaks: [
        ...todaysBreaks,
        {
          type: breakType.label,
          icon: breakType.icon,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          duration: `${(override != null ? override : duration)}m`,
        },
      ],
    });

    // Persist updated pause accumulator even when no timer is active
    await saveBreakState(get());
    stopAutoSave(); // ADDED: Stop auto-save
  },

  completeBreak: async (overrideMinutes = null) => {
    const { breakType, breakStartTime, todaysBreaks, waypointPausedSeconds, breakEvents } = get();
    const duration = Math.round(breakType.duration / 60);

    const override = overrideMinutes != null ? Math.max(0, Math.round(Number(overrideMinutes) || 0)) : null;
    const breakSeconds = Math.max(0, (override != null ? override : duration) * 60);
    const endTime = Date.now();
    const startTime = breakStartTime || (endTime - breakSeconds * 1000);

    set({
      breakActive: false,
      breakType: null,
      breakTime: 0,
      breakStartTime: null,
      waypointPausedSeconds: (waypointPausedSeconds || 0) + breakSeconds,
      breakEvents: [
        ...(breakEvents || []),
        { kind: 'break', label: breakType.label, startTime, endTime, seconds: breakSeconds },
      ],
      todaysBreaks: [
        ...todaysBreaks,
        {
          type: breakType.label,
          icon: breakType.icon,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          duration: `${(override != null ? override : duration)}m`,
        },
      ],
    });

    // Persist updated pause accumulator even when no timer is active
    await saveBreakState(get());
    stopAutoSave(); // ADDED: Stop auto-save

    // Audible/vibrate alarm (repeat until acknowledged)
    startAlarm(set, 'break');
  },

  tickBreak: () => {
    const { breakActive, breakType, breakStartTime } = get();
    if (!breakActive || !breakType || !breakStartTime) return;

    const elapsed = Math.floor((Date.now() - breakStartTime) / 1000);

    if (breakType.countDown) {
      const remaining = Math.max(0, breakType.duration - elapsed);

      if (remaining <= 0) {
        get().completeBreak();
        return;
      }

      set({ breakTime: remaining });
    } else {
      set({ breakTime: elapsed });
    }
  },

  cancelBreak: async () => {
    stopAlarm(set);
    set({
      breakActive: false,
      breakType: null,
      breakTime: 0,
      breakStartTime: null,
    });
    
    await clearBreakState(); // ADDED: Clear from database
    stopAutoSave(); // ADDED: Stop auto-save
  },

  clearTodaysBreaks: () => {
    set({ todaysBreaks: [] });
  },

  snoozeBreakNudge: (minutes = 10) => {
    const ms = Math.max(1, Math.round(Number(minutes) || 10)) * 60 * 1000;
    set({ breakNudgeSnoozedUntil: Date.now() + ms });
  },

  snoozeLoadTruckNudge: (minutes = 10) => {
    const ms = Math.max(1, Math.round(Number(minutes) || 10)) * 60 * 1000;
    set({ loadTruckNudgeSnoozedUntil: Date.now() + ms });
  },

  clearNudges: () => set({ breakNudgeSnoozedUntil: null, loadTruckNudgeSnoozedUntil: null }),

  acknowledgeAlarm: () => {
    stopAlarm(set);
  },

  setKeepAwakeDuringTimers: (enabled) => {
    set({ keepAwakeDuringTimers: !!enabled });
  },

  setWakeLockActive: (active) => {
    set({ wakeLockActive: !!active });
  },

  startLoadTruck: async (packageCount) => {
    // If an alarm is ringing from a previous timer, stop it.
    stopAlarm(set);

    console.log('Starting Load Truck Timer with', packageCount, 'packages');

    if (!packageCount || packageCount <= 0) {
      alert('Please enter a valid package count');
      return false;
    }

    const state = {
      loadTruckActive: true,
      loadTruckTime: 0,
      loadTruckStartTime: Date.now(),
      loadTruckPackageCount: packageCount,
      loadTruckWarning: false,
    };

    set(state);
    await saveBreakState({ ...get(), ...state }); // ADDED: Save to database
    startAutoSave(get); // ADDED: Start auto-save

    return true;
  },

  endLoadTruck: async (userId = null, routeStore = null) => {
    stopAlarm(set);
    const { loadTruckTime, loadTruckPackageCount, todaysBreaks } = get();
    const duration = Math.round(loadTruckTime / 60);
    const loadingTimeMs = loadTruckTime * 1000;

    console.log('Ending Load Truck Timer. Duration:', duration, 'minutes');

    if (userId) {
      await smartLoadMonitor.saveLoadingEntry(userId, loadTruckPackageCount, loadingTimeMs);
    }

    // ADDED: Save loading time to routeStore so it can be included in 721 street time
    if (routeStore && duration > 0) {
      routeStore.getState().setPreRouteLoadingMinutes(duration);
      console.log(`✓ Pre-route loading time saved: ${duration} minutes (will be included when route starts)`);
    }

    set({
      loadTruckActive: false,
      loadTruckStartTime: null,
      loadTruckTime: 0,
      loadTruckPackageCount: 0,
      loadTruckWarning: false,
      todaysBreaks: [
        ...todaysBreaks,
        {
          type: 'Load Truck',
          icon: '🚚',
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          duration: `${duration}m`,
          packages: loadTruckPackageCount,
        },
      ],
    });
    
    await clearBreakState(); // ADDED: Clear from database
    stopAutoSave(); // ADDED: Stop auto-save
  },

  tickLoadTruck: async () => {
    const { loadTruckActive, loadTruckStartTime, loadTruckPackageCount } = get();
    if (!loadTruckActive || !loadTruckStartTime) return;

    const elapsed = Math.floor((Date.now() - loadTruckStartTime) / 1000);
    const expectedTime = await get().getExpectedLoadTime(loadTruckPackageCount);
    const warningThreshold = expectedTime * 1.5;

    const shouldShowWarning = elapsed >= warningThreshold;

    set({
      loadTruckTime: elapsed,
      loadTruckWarning: shouldShowWarning
    });
  },

  getExpectedLoadTime: async (packageCount) => {
    const averageLoadTime = await smartLoadMonitor.getAverageLoadTime(packageCount);

    if (averageLoadTime !== null) {
      return Math.round(averageLoadTime / 1000);
    }

    const baseTime = 300;
    const timePerPackage = 6;
    return baseTime + (packageCount * timePerPackage);
  },

  loadSmartLoadHistory: async (userId) => {
    if (userId) {
      await smartLoadMonitor.loadHistoryFromDatabase(userId);
      console.log('Smart load history loaded for user');
    }
  },
}),
{
  name: 'routewise-break-timers',
  version: 1,
  partialize: (state) => ({
    // Persist only what we need to restore timers and pace adjustments after refresh.
    lunchActive: state.lunchActive,
    lunchTime: state.lunchTime,
    lunchStartTime: state.lunchStartTime,

    breakActive: state.breakActive,
    breakTime: state.breakTime,
    breakType: state.breakType,
    breakStartTime: state.breakStartTime,

    loadTruckActive: state.loadTruckActive,
    loadTruckTime: state.loadTruckTime,
    loadTruckStartTime: state.loadTruckStartTime,
    loadTruckPackageCount: state.loadTruckPackageCount,

    waypointPausedSeconds: state.waypointPausedSeconds,
    breakEvents: state.breakEvents,
    todaysBreaks: state.todaysBreaks,
    breakNudgeSnoozedUntil: state.breakNudgeSnoozedUntil,
    loadTruckNudgeSnoozedUntil: state.loadTruckNudgeSnoozedUntil,
    alarmActive: state.alarmActive,
    alarmKind: state.alarmKind,
    alarmStartedAt: state.alarmStartedAt,
    keepAwakeDuringTimers: state.keepAwakeDuringTimers,
  }),
  onRehydrateStorage: () => (state) => {
    try {
      if (!state) return;
      // Recompute timers based on stored start times so they're correct after refresh.
      const now = Date.now();

      if (state.lunchActive && state.lunchStartTime) {
        const elapsed = Math.floor((now - state.lunchStartTime) / 1000);
        state.lunchTime = Math.max(0, 30 * 60 - elapsed);
      }

      if (state.breakActive && state.breakStartTime && state.breakType) {
        const elapsed = Math.floor((now - state.breakStartTime) / 1000);
        if (state.breakType.countDown) {
          state.breakTime = Math.max(0, (state.breakType.duration || 0) - elapsed);
        } else {
          state.breakTime = Math.max(0, elapsed);
        }
      }

      if (state.loadTruckActive && state.loadTruckStartTime) {
        const elapsed = Math.floor((now - state.loadTruckStartTime) / 1000);
        state.loadTruckTime = Math.max(0, elapsed);
      }

      // IMPORTANT:
      // Do NOT mark the store as initialized here.
      // If mobile storage is evicted, we'd rehydrate an "empty" state and then skip the
      // server restore (initializeFromDatabase) in App.tsx, making timers appear to vanish.
      // App.tsx / BreaksScreen will call initializeFromDatabase once auth is ready.

      // Ensure todaysBreaks always exists (older persisted versions didn't include it).
      if (!Array.isArray(state.todaysBreaks)) state.todaysBreaks = [];
      if (state.breakNudgeSnoozedUntil == null) state.breakNudgeSnoozedUntil = null;
      if (state.loadTruckNudgeSnoozedUntil == null) state.loadTruckNudgeSnoozedUntil = null;
      if (state.alarmActive == null) state.alarmActive = false;
      if (state.alarmKind == null) state.alarmKind = null;
      if (state.alarmStartedAt == null) state.alarmStartedAt = null;
      if (state.keepAwakeDuringTimers == null) state.keepAwakeDuringTimers = false;
      if (state.wakeLockActive == null) state.wakeLockActive = false;

      // Note: we also don't auto-start the save interval here because we don't have access
      // to the live store getter in this hook.
    } catch (e) {
      console.warn('Failed to rehydrate break timers:', e?.message || e);
    }
  },
}
)
);

export default useBreakStore;
