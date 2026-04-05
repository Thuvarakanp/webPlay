import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';

interface Deps {
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
}

export function useKeyboardShortcuts({ togglePlay, next, prev, setVolume }: Deps) {
  const lastVolRef = useRef(0.8);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      const { volume, showToast } = usePlayerStore.getState();

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
        case 'ArrowUp': {
          e.preventDefault();
          const v = Math.min(1, volume + 0.1);
          setVolume(v);
          showToast(`Volume: ${Math.round(v * 100)}%`);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const v = Math.max(0, volume - 0.1);
          setVolume(v);
          showToast(`Volume: ${Math.round(v * 100)}%`);
          break;
        }
        case 'm':
        case 'M':
          e.preventDefault();
          if (volume > 0) {
            lastVolRef.current = volume;
            setVolume(0);
            showToast('Muted');
          } else {
            setVolume(lastVolRef.current || 0.8);
            showToast(`Volume: ${Math.round((lastVolRef.current || 0.8) * 100)}%`);
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, next, prev, setVolume]);
}
