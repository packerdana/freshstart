import { useEffect } from 'react';
import useBreakStore from '../stores/breakStore';

export default function useBreakTimer() {
  const lunchActive = useBreakStore((state) => state.lunchActive);
  const breakActive = useBreakStore((state) => state.breakActive);
  const loadTruckActive = useBreakStore((state) => state.loadTruckActive);
  const tickLunch = useBreakStore((state) => state.tickLunch);
  const tickBreak = useBreakStore((state) => state.tickBreak);
  const tickLoadTruck = useBreakStore((state) => state.tickLoadTruck);

  useEffect(() => {
    if (!lunchActive && !breakActive && !loadTruckActive) return;

    const tick = async () => {
      if (lunchActive) {
        tickLunch();
      }
      if (breakActive) {
        tickBreak();
      }
      if (loadTruckActive) {
        await tickLoadTruck();
      }
    };

    tick();

    const interval = setInterval(tick, 1000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        tick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lunchActive, breakActive, loadTruckActive, tickLunch, tickBreak, tickLoadTruck]);
}
