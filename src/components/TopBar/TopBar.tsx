import { useState, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import styles from './TopBar.module.css';

interface Props {
  onTogglePlaylist: () => void;
  onToggleEq: () => void;
  onToggleMini: () => void;
}

export function TopBar({ onTogglePlaylist, onToggleEq, onToggleMini }: Props) {
  const playlistOpen = usePlayerStore((s) => s.playlistOpen);
  const eqOpen       = usePlayerStore((s) => s.eqOpen);
  const isPinned     = usePlayerStore((s) => s.isPinned);
  const musicLoaded  = usePlayerStore((s) => s.musicLoaded);
  const setPinned    = usePlayerStore((s) => s.setPinned);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <>
      {/* Playlist toggle — top left */}
      <button
        id="playlist-toggle"
        className={`${styles.btn} ${styles.playlistToggle} ${playlistOpen ? styles.open : ''} ${musicLoaded ? '' : styles.hidden}`}
        onClick={onTogglePlaylist}
        title={playlistOpen ? 'Hide playlist' : 'Show playlist'}
        aria-label="Toggle playlist"
      >
        <div className={styles.barWrap}>
          <div className={styles.bar} />
          <div className={styles.bar} />
          <div className={styles.bar} />
        </div>
      </button>

      {/* Mini player button */}
      <button
        id="mini-btn"
        className={`${styles.btn} ${styles.miniBtn}`}
        onClick={onToggleMini}
        title="Mini Ink — floating mini player"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <rect x="8" y="13" width="8" height="6" rx="1"/>
          <line x1="8" y1="9" x2="16" y2="9"/>
          <line x1="8" y1="6" x2="12" y2="6"/>
        </svg>
      </button>

      {/* EQ button */}
      <button
        id="eq-btn"
        className={`${styles.btn} ${styles.eqBtn} ${eqOpen ? styles.active : ''}`}
        onClick={onToggleEq}
        title="Toggle Equalizer"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 22L4 15"/><path d="M4 11L4 2"/>
          <path d="M12 22L12 11"/><path d="M12 7L12 2"/>
          <path d="M20 22L20 18"/><path d="M20 14L20 2"/>
          <line x1="1" y1="11" x2="7" y2="11"/>
          <line x1="9" y1="7" x2="15" y2="7"/>
          <line x1="17" y1="14" x2="23" y2="14"/>
        </svg>
      </button>

      {/* Fullscreen button */}
      <button
        id="fullscreen-btn"
        className={`${styles.btn} ${styles.fsBtn}`}
        onClick={toggleFullscreen}
        title="Toggle fullscreen"
      >
        {isFullscreen
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
              <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
            </svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
        }
      </button>

      {/* Pin button — top right */}
      <button
        id="pin-btn"
        className={`${styles.btn} ${styles.pinBtn} ${isPinned ? styles.pinned : ''}`}
        onClick={() => setPinned(!isPinned)}
        title={isPinned ? 'Auto-hide is OFF — click to enable' : 'Auto-hide is ON — click to disable'}
      >
        {isPinned
          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
        }
      </button>
    </>
  );
}
