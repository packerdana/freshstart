import { useEffect, useRef } from 'react';

/**
 * Keep screen awake while active timers run.
 * This helps prevent mobile browsers from throttling timers + blocking audio alerts.
 *
 * Notes:
 * - Works best in Chrome/Android.
 * - Requires the page to be visible; wake lock is released when tab is hidden.
 */
export default function useWakeLock({ enabled, active }) {
  const lockRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const request = async () => {
      try {
        if (!enabled || !active) return;
        if (typeof navigator === 'undefined' || !navigator.wakeLock?.request) return;

        // Only request when visible (Wake Lock API requirement).
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          try { await lock.release(); } catch {}
          return;
        }

        lockRef.current = lock;

        lock.addEventListener('release', () => {
          lockRef.current = null;
        });
      } catch {
        // ignore (not supported or blocked)
      }
    };

    const release = async () => {
      try {
        const lock = lockRef.current;
        if (lock) {
          lockRef.current = null;
          await lock.release();
        }
      } catch {
        // ignore
      }
    };

    request();

    const onVis = () => {
      // If user returns to the app, re-request.
      if (document.visibilityState === 'visible') request();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }

    return () => {
      cancelled = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
      release();
    };
  }, [enabled, active]);
}
