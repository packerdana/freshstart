import { create } from 'zustand';
import { smartLoadMonitor } from '../services/smart-load-monitor';

const useBreakStore = create((set, get) => ({
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

  startLunch: () => {
    set({
      lunchActive: true,
      lunchTime: 30 * 60,
      lunchStartTime: Date.now(),
    });
  },

  endLunch: () => {
    const { lunchTime, todaysBreaks } = get();
    const duration = Math.round((30 * 60 - lunchTime) / 60);

    set({
      lunchActive: false,
      lunchStartTime: null,
      lunchTime: 30 * 60,
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
  },

  completeLunch: () => {
    const { todaysBreaks } = get();

    set({
      lunchActive: false,
      lunchStartTime: null,
      lunchTime: 30 * 60,
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

  startBreak: (type) => {
    set({
      breakActive: true,
      breakType: type,
      breakTime: type.countDown ? type.duration : 0,
      breakStartTime: Date.now(),
    });
  },

  endBreak: () => {
    const { breakTime, breakType, todaysBreaks } = get();
    let duration;

    if (breakType.countDown) {
      duration = Math.round((breakType.duration - breakTime) / 60);
    } else {
      duration = Math.round(breakTime / 60);
    }

    set({
      breakActive: false,
      breakType: null,
      breakTime: 0,
      breakStartTime: null,
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
  },

  completeBreak: () => {
    const { breakType, todaysBreaks } = get();
    const duration = Math.round(breakType.duration / 60);

    set({
      breakActive: false,
      breakType: null,
      breakTime: 0,
      breakStartTime: null,
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

  cancelBreak: () => {
    set({
      breakActive: false,
      breakType: null,
      breakTime: 0,
      breakStartTime: null,
    });
  },

  clearTodaysBreaks: () => {
    set({ todaysBreaks: [] });
  },

  startLoadTruck: (packageCount) => {
    console.log('Starting Load Truck Timer with', packageCount, 'packages');

    if (!packageCount || packageCount <= 0) {
      alert('Please enter a valid package count');
      return false;
    }

    set({
      loadTruckActive: true,
      loadTruckTime: 0,
      loadTruckStartTime: Date.now(),
      loadTruckPackageCount: packageCount,
      loadTruckWarning: false,
    });

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
}));

export default useBreakStore;
