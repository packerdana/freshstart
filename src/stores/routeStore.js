import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserRoutes, getRouteHistory } from '../services/routeHistoryService';
import { calculateRouteAverages } from '../services/routeAveragesService';
import { getWaypointsForRoute, createWaypoint, updateWaypoint, deleteWaypoint, deleteAllWaypoints } from '../services/waypointsService';
import { createRoute as createRouteService, updateRoute as updateRouteService, deleteRoute as deleteRouteService } from '../services/routeManagementService';
import { getTemplatesForRoute, saveCurrentWaypointsAsTemplate, instantiateTemplates } from '../services/waypointTemplateService';
import { getLocalDateString } from '../utils/time';

const useRouteStore = create(
  persist(
    (set, get) => ({
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
        packagesManuallyUpdated: false,
        sprs: 0,
        safetyTalk: 0, // FIXED: Default to 0 instead of 10
        hasBoxholder: false,
        // Allows a one-off clock-in/start-time adjustment for "today" without changing the route default.
        startTimeOverride: '',
      },

      lastResetDate: null,

      routeStarted: false,

      // ADDED: Track pre-route loading time for carriers who load before starting route
      preRouteLoadingMinutes: 0,

      setPreRouteLoadingMinutes: (minutes) => set({ preRouteLoadingMinutes: minutes }),

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
              packagesManuallyUpdated: false,
              sprs: 0,
              safetyTalk: 0, // FIXED: Default to 0 instead of 10
              hasBoxholder: false,
              startTimeOverride: '',
            },
            routeStarted: false,
            preRouteLoadingMinutes: 0, // ADDED: Reset loading time daily
            lastResetDate: today,
            waypoints: [],
          });

          setTimeout(() => {
            get().autoPopulateWaypointsIfNeeded();
          }, 500);
        }
      },

      loadUserRoutes: async () => {
        set({ loading: true, error: null });

        try {
          const routes = await getUserRoutes();
          console.log('loadUserRoutes - fetched routes:', routes);

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
                manualStreetTime: route.manual_street_time,
                evaluatedStreetTime: route.evaluated_street_time,
                evaluatedOfficeTime: route.evaluated_office_time,
                evaluationDate: route.evaluation_date,
                history: [],
                averages: {},
              };
            });

            console.log('loadUserRoutes - setting currentRouteId to:', routes[0].id);

            set({
              routes: routesMap,
              currentRouteId: routes[0].id,
              currentRoute: routes[0].route_number,
              loading: false
            });

            await get().loadRouteHistory(routes[0].id);
          } else {
            console.warn('loadUserRoutes - no routes found');
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
          const history = await getRouteHistory(routeId, 90);
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
        const route = get().routes[routeId];
        if (route) {
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

      clearTodayInputs: () => set({
        todayInputs: { dps: 0, flats: 0, letters: 0, parcels: 0, scannerTotal: 0, packagesManuallyUpdated: false, sprs: 0, safetyTalk: 0, hasBoxholder: false, startTimeOverride: '' }
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

      switchToRoute: (routeId) => {
        get().setCurrentRoute(routeId);
      },
    }),
    {
      name: 'routewise-storage',
      version: 6,
      partialize: (state) => ({
        todayInputs: state.todayInputs,
        routeStarted: state.routeStarted,
        lastResetDate: state.lastResetDate,
        preRouteLoadingMinutes: state.preRouteLoadingMinutes, // ADDED: Persist loading time
      }),
    }
  )
);

export default useRouteStore;
