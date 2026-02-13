import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserRoutes, getRouteHistory } from '../services/routeHistoryService';
import { backfillDayTypesForRoute } from '../services/dayTypeBackfillService';
import { calculateRouteAverages } from '../services/routeAveragesService';
import { getWaypointsForRoute, createWaypoint, updateWaypoint, deleteWaypoint, deleteAllWaypoints } from '../services/waypointsService';
import { createRoute as createRouteService, updateRoute as updateRouteService, deleteRoute as deleteRouteService, setActiveRoute as setActiveRouteService } from '../services/routeManagementService';
import { getTemplatesForRoute, saveCurrentWaypointsAsTemplate, instantiateTemplates } from '../services/waypointTemplateService';
import { getLocalDateString } from '../utils/time';

const getPersistedRouteSelection = () => {
  try {
    const raw = localStorage?.getItem?.('routewise-storage');
    if (!raw) return { currentRouteId: null, currentRoute: null };
    const parsed = JSON.parse(raw);
    const state = parsed?.state || {};
    return {
      currentRouteId: state.currentRouteId || null,
      currentRoute: state.currentRoute || null,
    };
  } catch {
    return { currentRouteId: null, currentRoute: null };
  }
};

const useRouteStore = create(
  persist(
    (set, get) => ({
      // When enabled, the app will never auto-switch the selected route.
      // Route changes only happen when the user explicitly chooses a route.
      routeLockEnabled: true,
      setRouteLockEnabled: (enabled) => set({ routeLockEnabled: !!enabled }),

      currentRoute: null,
      currentRouteId: null,

      routes: {},

      history: [],
      averages: {},

      waypoints: [],
      waypointsLoading: false,

      templates: [],
      templatesLoading: false,
      hasTemplates: false,

      loading: false,
      error: null,

      todayInputs: {
        dps: 0,
        flats: 0,
        letters: 0,
        parcels: 0,
        scannerTotal: 0,
        curtailedLetters: 0,
        curtailedFlats: 0,
        packagesManuallyUpdated: false,
        sprs: 0,
        safetyTalk: 0, // FIXED: Default to 0 instead of 10
        hasBoxholder: false,
        casedBoxholder: false,
        casedBoxholderType: '',
        // Allows a one-off clock-in/start-time adjustment for "today" without changing the route default.
        startTimeOverride: '',
        // Captured when user taps Start Route (721): the actual leave-office time (HH:MM)
        leaveOfficeTime: '',
        // Captured when user taps Start Route (721): actual AM office time (722) in minutes
        actualOfficeTime: 0,
        // Captured when user finishes day: actual clock-out time (HH:MM)
        actualClockOut: '',
        // Legacy field (kept for compatibility; % to Standard currently uses total 722 time)
        casingWithdrawalMinutes: 0,
        // Daily Log: quick, structured reasons that explain variance and improve future predictions.
        dailyLog: {
          lateMail: false,
          lateParcels: false,
          casingInterruptionsMinutes: 0,
          waitingOnParcelsMinutes: 0,
          accountablesMinutes: 0,
          otherDelayMinutes: 0,
          notes: '',
        },
      },

      lastResetDate: null,

      routeStarted: false,

      // ADDED: Track pre-route loading time for carriers who load before starting route
      preRouteLoadingMinutes: 0,
      // ADDED: Once applied to the 721 timer, keep the preload seconds stable for the rest of the day
      // so navigation/refresh can’t make it “disappear”.
      streetPreloadSeconds: 0,

      setPreRouteLoadingMinutes: (minutes) => set({ preRouteLoadingMinutes: minutes }),
      setStreetPreloadSeconds: (seconds) => set({ streetPreloadSeconds: Math.max(0, Math.floor(seconds || 0)) }),

      checkAndResetDailyData: () => {
        const today = getLocalDateString(new Date());
        const lastReset = get().lastResetDate;

        if (lastReset !== today) {
          console.log('New day detected - resetting daily data');
          set({
            todayInputs: {
              dps: 0,
              flats: 0,
              letters: 0,
              parcels: 0,
              scannerTotal: 0,
              curtailedLetters: 0,
              curtailedFlats: 0,
              packagesManuallyUpdated: false,
              sprs: 0,
              safetyTalk: 0, // FIXED: Default to 0 instead of 10
              hasBoxholder: false,
              casedBoxholder: false,
              casedBoxholderType: '',
              startTimeOverride: '',
              leaveOfficeTime: '',
              actualOfficeTime: 0,
              actualClockOut: '',
              casingWithdrawalMinutes: 0,
              dailyLog: {
                lateMail: false,
                lateParcels: false,
                casingInterruptionsMinutes: 0,
                waitingOnParcelsMinutes: 0,
                accountablesMinutes: 0,
                otherDelayMinutes: 0,
                notes: '',
              },
            },
            routeStarted: false,
            preRouteLoadingMinutes: 0, // ADDED: Reset loading time daily
            streetPreloadSeconds: 0,
            lastResetDate: today,
            waypoints: [],
          });

          setTimeout(() => {
            get().autoPopulateWaypointsIfNeeded();
          }, 500);
        }
      },

      loadUserRoutes: async (explicitUserId = null) => {
        set({ loading: true, error: null });

        try {
          console.log('loadUserRoutes - starting. explicitUserId:', explicitUserId);
          const routes = await getUserRoutes(explicitUserId);
          console.log('loadUserRoutes - fetched routes:', routes);

          // If auth is slow/unready, routes query may return [] temporarily.
          // Do NOT clobber existing route selection in that case.
          if (routes && routes.length > 0) {
            const routesMap = {};

            routes.forEach(route => {
              routesMap[route.id] = {
                id: route.id,
                routeNumber: route.route_number,
                routeType: route.route_type || 'mixed',
                startTime: route.start_time,
                tourLength: route.tour_length,
                lunchDuration: route.lunch_duration,
                comfortStopDuration: route.comfort_stop_duration,
                stops: route.stops ?? null,
                baseParcels: route.base_parcels ?? null,
                manualStreetTime: route.manual_street_time,
                evaluatedStreetTime: route.evaluated_street_time,
                evaluatedOfficeTime: route.evaluated_office_time,
                evaluationDate: route.evaluation_date,
                isActive: !!route.is_active,
                history: [],
                averages: {},
              };
            });

            // Choose a stable current route:
            // 1) Prefer whatever the user already had selected (persisted currentRouteId)
            // 2) Else prefer the DB "active" route
            // 3) Else fall back to first route
            // Use in-memory selection if present, otherwise fall back to persisted selection.
            // This prevents "route jumping" on reload while hydration/auth is still settling.
            const persistedSel = getPersistedRouteSelection();
            const preferredId = get().currentRouteId || persistedSel.currentRouteId;

            const preferredExists = preferredId && routesMap[preferredId];
            const dbActive = routes.find((r) => r?.is_active);

            // If lock is enabled and we have a preferred route that still exists, keep it.
            // Otherwise fall back to DB active, then first route.
            const chosen = (get().routeLockEnabled && preferredExists)
              ? routes.find((r) => r.id === preferredId)
              : (preferredExists ? routes.find((r) => r.id === preferredId) : (dbActive || routes[0]));

            console.log('loadUserRoutes - choosing currentRouteId:', chosen?.id);

            set({
              routes: routesMap,
              currentRouteId: chosen?.id || null,
              currentRoute: chosen?.route_number || null,
              loading: false
            });

            if (chosen?.id) {
              await get().loadRouteHistory(chosen.id);
            }
          } else {
            console.warn('loadUserRoutes - no routes found (or not readable)');
            // IMPORTANT: Do NOT clobber existing routes/selection if auth is slow or a transient read returns [].
            // Just stop loading and keep whatever we had.
            set({ loading: false });
          }
        } catch (error) {
          console.error('Error loading routes:', error);
          set({ error: error.message, loading: false });
        }
      },

      loadRouteHistory: async (routeId) => {
        if (!routeId) {
          console.warn('No route ID provided for history load');
          return;
        }

        set({ loading: true, error: null });

        try {
          let history = await getRouteHistory(routeId, 90);

          // One-time backfill: ensure day_type is correct in Supabase (day-after-holiday, saturday, monday, etc.)
          // This runs only when needed and only updates rows that differ from our computed day type.
          try {
            const backfill = await backfillDayTypesForRoute(routeId, 365);
            if (backfill?.updated > 0) {
              // Reload so predictions/day-type grouping immediately reflect the corrected history.
              history = await getRouteHistory(routeId, 90);
            }
          } catch (bfErr) {
            console.warn('Day-type backfill skipped/failed:', bfErr?.message || bfErr);
          }

          const averages = calculateRouteAverages(history);

          set((state) => ({
            history,
            averages,
            routes: {
              ...state.routes,
              [routeId]: {
                ...state.routes[routeId],
                history,
                averages,
              }
            },
            loading: false,
          }));
        } catch (error) {
          console.error('Error loading history:', error);
          set({ error: error.message, loading: false });
        }
      },

      setCurrentRoute: (routeId) => {
        const prevRouteId = get().currentRouteId;
        const route = get().routes[routeId];
        if (route) {
          // If the user switches routes, don’t carry timing overrides from the previous route.
          if (prevRouteId && routeId && prevRouteId !== routeId) {
            get().clearTodayTimingOverrides();
          }

          set({
            currentRouteId: routeId,
            currentRoute: route.routeNumber,
            history: route.history || [],
            averages: route.averages || {}
          });

          if (!route.history || route.history.length === 0) {
            get().loadRouteHistory(routeId);
          }
        }
      },

      updateTodayInputs: (inputs) => set((state) => ({
        todayInputs: { ...state.todayInputs, ...inputs }
      })),

      // Clear one-off timing overrides that should never “stick” across user changes or route switches.
      clearTodayTimingOverrides: () => set((state) => ({
        todayInputs: {
          ...state.todayInputs,
          startTimeOverride: '',
          leaveOfficeTime: '',
        },
      })),

      clearTodayInputs: () => set({
        todayInputs: {
          dps: 0,
          flats: 0,
          letters: 0,
          parcels: 0,
          scannerTotal: 0,
          packagesManuallyUpdated: false,
          sprs: 0,
          safetyTalk: 0,
          hasBoxholder: false,
          startTimeOverride: '',
          leaveOfficeTime: '',
          actualOfficeTime: 0,
          casingWithdrawalMinutes: 0,
          dailyLog: {
            lateMail: false,
            lateParcels: false,
            casingInterruptionsMinutes: 0,
            waitingOnParcelsMinutes: 0,
            accountablesMinutes: 0,
            otherDelayMinutes: 0,
            notes: '',
          },
        }
      }),

      setRouteStarted: (started) => set({ routeStarted: started }),

      addHistoryEntry: (entry) => set((state) => {
        const currentRouteId = state.currentRouteId;
        const newHistory = [entry, ...state.history];
        const newAverages = calculateRouteAverages(newHistory);

        return {
          history: newHistory,
          averages: newAverages,
          routes: {
            ...state.routes,
            [currentRouteId]: {
              ...state.routes[currentRouteId],
              history: newHistory,
              averages: newAverages,
            }
          }
        };
      }),

      loadWaypoints: async (date = null) => {
        const routeId = get().currentRouteId;
        if (!routeId) {
          console.warn('No current route selected');
          return;
        }

        set({ waypointsLoading: true });

        try {
          const waypoints = await getWaypointsForRoute(routeId, date);
          set({ waypoints, waypointsLoading: false });
        } catch (error) {
          console.error('Error loading waypoints:', error);
          set({ error: error.message, waypointsLoading: false });
        }
      },

      addWaypoint: async (waypointData) => {
        const routeId = get().currentRouteId;
        if (!routeId) {
          throw new Error('No current route selected');
        }

        try {
          const newWaypoint = await createWaypoint({
            ...waypointData,
            route_id: routeId,
          });

          set((state) => ({
            waypoints: [...state.waypoints, newWaypoint]
          }));

          return newWaypoint;
        } catch (error) {
          console.error('Error adding waypoint:', error);
          throw error;
        }
      },

      updateWaypoint: async (waypointId, updates) => {
        try {
          const updatedWaypoint = await updateWaypoint(waypointId, updates);

          set((state) => ({
            waypoints: state.waypoints.map(w =>
              w.id === waypointId ? updatedWaypoint : w
            )
          }));

          return updatedWaypoint;
        } catch (error) {
          console.error('Error updating waypoint:', error);
          throw error;
        }
      },

      deleteWaypoint: async (waypointId) => {
        try {
          await deleteWaypoint(waypointId);

          set((state) => ({
            waypoints: state.waypoints.filter(w => w.id !== waypointId)
          }));
        } catch (error) {
          console.error('Error deleting waypoint:', error);
          throw error;
        }
      },

      clearAllWaypoints: async (date = null) => {
        const routeId = get().currentRouteId;
        if (!routeId) {
          throw new Error('No current route selected');
        }

        try {
          await deleteAllWaypoints(routeId, date);
          set({ waypoints: [] });
        } catch (error) {
          console.error('Error clearing waypoints:', error);
          throw error;
        }
      },

      loadTemplates: async () => {
        const routeId = get().currentRouteId;
        if (!routeId) {
          console.warn('No current route selected');
          return;
        }

        set({ templatesLoading: true });

        try {
          const templates = await getTemplatesForRoute(routeId);
          set({
            templates,
            hasTemplates: templates.length > 0,
            templatesLoading: false
          });
        } catch (error) {
          console.error('Error loading templates:', error);
          set({ error: error.message, templatesLoading: false });
        }
      },

      saveAsTemplate: async () => {
        const routeId = get().currentRouteId;
        const waypoints = get().waypoints;

        if (!routeId) {
          throw new Error('No current route selected');
        }

        if (waypoints.length === 0) {
          throw new Error('No waypoints to save as template');
        }

        try {
          const templates = await saveCurrentWaypointsAsTemplate(routeId, waypoints);
          set({
            templates,
            hasTemplates: true
          });
          return templates;
        } catch (error) {
          console.error('Error saving waypoints as template:', error);
          throw error;
        }
      },

      loadFromTemplate: async (date = null) => {
        const routeId = get().currentRouteId;
        if (!routeId) {
          throw new Error('No current route selected');
        }

        try {
          const newWaypoints = await instantiateTemplates(routeId, date);
          set({ waypoints: newWaypoints });
          return newWaypoints;
        } catch (error) {
          console.error('Error loading from template:', error);
          throw error;
        }
      },

      autoPopulateWaypointsIfNeeded: async () => {
        const routeId = get().currentRouteId;
        const waypoints = get().waypoints;
        const hasTemplates = get().hasTemplates;

        if (!routeId || waypoints.length > 0) {
          return;
        }

        try {
          const templates = await getTemplatesForRoute(routeId);

          if (templates.length > 0) {
            console.log('Auto-populating waypoints from template');
            const newWaypoints = await instantiateTemplates(routeId);
            set({
              waypoints: newWaypoints,
              templates,
              hasTemplates: true
            });
            return newWaypoints;
          }
        } catch (error) {
          console.error('Error auto-populating waypoints:', error);
        }
      },

      getCurrentRouteConfig: () => {
        const state = get();
        const routeId = state.currentRouteId;

        if (routeId && state.routes[routeId]) {
          return state.routes[routeId];
        }

        return {
          startTime: '07:30',
          tourLength: 8.5,
          lunchDuration: 30,
          comfortStopDuration: 10,
          stops: null,
          baseParcels: null,
          manualStreetTime: null,
          evaluatedStreetTime: null,
          evaluatedOfficeTime: null,
          evaluationDate: null,
        };
      },

      createRoute: async (routeData) => {
        try {
          const newRoute = await createRouteService(routeData);

          const routeForStore = {
            id: newRoute.id,
            routeNumber: newRoute.route_number,
            routeType: newRoute.route_type || 'mixed',
            startTime: newRoute.start_time,
            tourLength: newRoute.tour_length,
            lunchDuration: newRoute.lunch_duration,
            comfortStopDuration: newRoute.comfort_stop_duration,
            stops: newRoute.stops ?? null,
            baseParcels: newRoute.base_parcels ?? null,
            manualStreetTime: newRoute.manual_street_time,
            evaluatedStreetTime: newRoute.evaluated_street_time,
            evaluatedOfficeTime: newRoute.evaluated_office_time,
            evaluationDate: newRoute.evaluation_date,
            history: [],
            averages: {},
          };

          set((state) => ({
            routes: {
              ...state.routes,
              [newRoute.id]: routeForStore,
            },
            currentRouteId: newRoute.id,
            currentRoute: newRoute.route_number,
            history: [],
            averages: {},
          }));

          return newRoute;
        } catch (error) {
          console.error('Error creating route:', error);
          throw error;
        }
      },

      updateRoute: async (routeId, updates) => {
        try {
          const updatedRoute = await updateRouteService(routeId, updates);

          set((state) => ({
            routes: {
              ...state.routes,
              [routeId]: {
                ...state.routes[routeId],
                routeNumber: updatedRoute.route_number,
                routeType: updatedRoute.route_type || state.routes[routeId]?.routeType || 'mixed',
                startTime: updatedRoute.start_time,
                tourLength: updatedRoute.tour_length,
                lunchDuration: updatedRoute.lunch_duration,
                comfortStopDuration: updatedRoute.comfort_stop_duration,
                stops: updatedRoute.stops ?? null,
                baseParcels: updatedRoute.base_parcels ?? state.routes[routeId]?.baseParcels ?? null,
              },
            },
          }));

          if (get().currentRouteId === routeId) {
            set({ currentRoute: updatedRoute.route_number });
          }

          return updatedRoute;
        } catch (error) {
          console.error('Error updating route:', error);
          throw error;
        }
      },

      deleteRoute: async (routeId) => {
        try {
          await deleteRouteService(routeId);

          const state = get();
          const newRoutes = { ...state.routes };
          delete newRoutes[routeId];

          const remainingRoutes = Object.values(newRoutes);
          const newCurrentRouteId = remainingRoutes.length > 0 ? remainingRoutes[0].id : null;
          const newCurrentRoute = remainingRoutes.length > 0 ? remainingRoutes[0].routeNumber : null;

          set({
            routes: newRoutes,
            currentRouteId: newCurrentRouteId,
            currentRoute: newCurrentRoute,
            history: remainingRoutes.length > 0 ? remainingRoutes[0].history || [] : [],
            averages: remainingRoutes.length > 0 ? remainingRoutes[0].averages || {} : {},
          });

          if (newCurrentRouteId && (!remainingRoutes[0].history || remainingRoutes[0].history.length === 0)) {
            await get().loadRouteHistory(newCurrentRouteId);
          }
        } catch (error) {
          console.error('Error deleting route:', error);
          throw error;
        }
      },

      // Reset the store to initial defaults (used on account switch/logout)
      resetStore: () => {
        set({
          currentRoute: null,
          currentRouteId: null,
          routes: {},
          history: [],
          averages: {},
          waypoints: [],
          waypointsLoading: false,
          templates: [],
          templatesLoading: false,
          hasTemplates: false,
          loading: false,
          error: null,
          todayInputs: {
            dps: 0,
            flats: 0,
            letters: 0,
            parcels: 0,
            scannerTotal: 0,
            curtailedLetters: 0,
            curtailedFlats: 0,
            packagesManuallyUpdated: false,
            sprs: 0,
            safetyTalk: 0,
            hasBoxholder: false,
            casedBoxholder: false,
            casedBoxholderType: '',
            startTimeOverride: '',
            leaveOfficeTime: '',
            actualOfficeTime: 0,
            actualClockOut: '',
            casingWithdrawalMinutes: 0,
            dailyLog: {
              lateMail: false,
              lateParcels: false,
              casingInterruptionsMinutes: 0,
              waitingOnParcelsMinutes: 0,
              accountablesMinutes: 0,
              otherDelayMinutes: 0,
              notes: '',
            },
          },
          lastResetDate: null,
          routeStarted: false,
          preRouteLoadingMinutes: 0,
          streetPreloadSeconds: 0,
        });
      },


      activateRoute: async (routeId) => {
        if (!routeId) return;

        // Optimistic switch immediately (feels instant), then persist to DB.
        get().setCurrentRoute(routeId);

        try {
          await setActiveRouteService(routeId);
        } catch (e) {
          console.warn('Failed to persist active route; keeping local selection:', e?.message || e);
        }

        // Reload routes so ordering / is_active flags stay consistent across refreshes.
        try {
          await get().loadUserRoutes();
        } catch {}
      },

      switchToRoute: (routeId) => {
        get().setCurrentRoute(routeId);
      },
    }),
    {
      name: 'routewise-storage',
      version: 7,
      // Preserve persisted data across version bumps (prevents "today" inputs from disappearing after deploy).
      migrate: (persistedState, fromVersion) => {
        try {
          const s = persistedState || {};

          // Ensure todayInputs exists and includes all expected keys.
          const defaults = {
            dps: 0,
            flats: 0,
            letters: 0,
            parcels: 0,
            scannerTotal: 0,
            packagesManuallyUpdated: false,
            sprs: 0,
            safetyTalk: 0,
            hasBoxholder: false,
            startTimeOverride: '',
            leaveOfficeTime: '',
            actualOfficeTime: 0,
            actualClockOut: '',
            casingWithdrawalMinutes: 0,
            dailyLog: {
              lateMail: false,
              lateParcels: false,
              casingInterruptionsMinutes: 0,
              waitingOnParcelsMinutes: 0,
              accountablesMinutes: 0,
              otherDelayMinutes: 0,
              notes: '',
            },
          };

          const todayInputs = {
            ...defaults,
            ...(s.todayInputs || {}),
            dailyLog: {
              ...defaults.dailyLog,
              ...((s.todayInputs || {}).dailyLog || {}),
            },
          };

          return {
            ...s,
            todayInputs,
            routeStarted: !!s.routeStarted,
            lastResetDate: s.lastResetDate || null,
            preRouteLoadingMinutes: Number(s.preRouteLoadingMinutes || 0) || 0,
            routeLockEnabled: s.routeLockEnabled !== undefined ? !!s.routeLockEnabled : true,
            currentRouteId: s.currentRouteId || null,
            currentRoute: s.currentRoute || null,
          };
        } catch {
          return persistedState;
        }
      },
      partialize: (state) => ({
        todayInputs: state.todayInputs,
        routeStarted: state.routeStarted,
        lastResetDate: state.lastResetDate,
        preRouteLoadingMinutes: state.preRouteLoadingMinutes, // ADDED: Persist loading time
        routeLockEnabled: state.routeLockEnabled,
        // Persist selected route so refreshes don't jump to a different "active" route.
        currentRouteId: state.currentRouteId,
        currentRoute: state.currentRoute,
      }),
    }
  )
);

export default useRouteStore;
