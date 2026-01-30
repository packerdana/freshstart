// Minimal ambient typings to let strict TS compile while some files remain JS/JSX.
// Keep this file small; prefer migrating JS/JSX to TS/TSX over time.

declare module './components/screens/TodayScreen' {
  const Component: any;
  export default Component;
}

declare module './components/screens/RoutesScreen' {
  const Component: any;
  export default Component;
}

declare module './components/screens/WaypointsScreen' {
  const Component: any;
  export default Component;
}

declare module './components/screens/WaypointHistoryScreen' {
  const Component: any;
  export default Component;
}

declare module './components/screens/StreetTimeHistoryScreen' {
  const Component: any;
  export default Component;
}

declare module './components/screens/BreaksScreen' {
  const Component: any;
  export default Component;
}

declare module './components/screens/StatsScreen' {
  const Component: any;
  export default Component;
}

declare module './components/screens/SettingsScreen' {
  const Component: any;
  export default Component;
}

declare module './components/screens/LoginScreen' {
  const Component: any;
  export default Component;
}

declare module './components/screens/SignupScreen' {
  const Component: any;
  export default Component;
}

declare module './components/layout/BottomNav' {
  const Component: any;
  export default Component;
}

declare module './stores/routeStore' {
  const store: any;
  export default store;
}

declare module './stores/authStore' {
  const store: any;
  export default store;
}

declare module './hooks/useBreakTimer' {
  const hook: any;
  export default hook;
}
