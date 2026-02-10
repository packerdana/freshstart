import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { smartLoadMonitor } from '../services/smart-load-monitor';
import { saveBreakState, loadBreakState, clearBreakState } from '../services/breakService';

// ADDED: Auto-save interval (save state every 30 seconds while timer is active)
let autoSaveInterval = null;

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
    alert('Lunch break complete!');
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

  endBreak: async () => {
    const { breakTime, breakType, breakStartTime, todaysBreaks, waypointPausedSeconds, breakEvents } = get();
    let duration;

    if (breakType.countDown) {
      duration = Math.round((breakType.duration - breakTime) / 60);
    } else {
      duration = Math.round(breakTime / 60);
    }

    // Add actual break seconds to the waypoint pause accumulator
    const breakSeconds = Math.max(0, duration * 60);

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
          duration: `${duration}m`,
        },
      ],
    });

    // Persist updated pause accumulator even when no timer is active
    await saveBreakState(get());
    stopAutoSave(); // ADDED: Stop auto-save
  },

  completeBreak: async () => {
    const { breakType, breakStartTime, todaysBreaks, waypointPausedSeconds, breakEvents } = get();
    const duration = Math.round(breakType.duration / 60);

    const breakSeconds = Math.max(0, duration * 60);
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
          duration: `${duration}m`,
        },
      ],
    });

    // Persist updated pause accumulator even when no timer is active
    await saveBreakState(get());
    stopAutoSave(); // ADDED: Stop auto-save
    alert(`${breakType.label} break complete!`);
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

  startLoadTruck: async (packageCount) => {
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
