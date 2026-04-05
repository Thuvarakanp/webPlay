import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../store/playerStore';

const IDLE_DELAY = 3000;

export function useIdleTimer() {
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPinned  = usePlayerStore((s) => s.isPinned);
  const isPinnedRef = useRef(isPinned);
  isPinnedRef.current = isPinned;

  const resetIdle = useCallback(() => {
    document.body.classList.remove('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isPinnedRef.current) {
      timerRef.current = setTimeout(() => {
        document.body.classList.add('idle');
      }, IDLE_DELAY);
    }
  }, []);

  useEffect(() => {
    // When pinned, clear idle immediately
    if (isPinned) {
      document.body.classList.remove('idle');
      if (timerRef.current) clearTimeout(timerRef.current);
      document.body.classList.add('pinned');
    } else {
      document.body.classList.remove('pinned');
      resetIdle();
    }
  }, [isPinned, resetIdle]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((e) => document.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      events.forEach((e) => document.removeEventListener(e, resetIdle));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetIdle]);

  return { resetIdle };
}
