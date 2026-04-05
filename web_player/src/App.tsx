import { useCallback, useEffect, useRef } from 'react';
import { usePlayerStore } from './store/playerStore';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useMusicScanner } from './hooks/useMusicScanner';
import { useIdleTimer } from './hooks/useIdleTimer';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

import { BackgroundCanvas } from './components/Canvas/BackgroundCanvas';
import { InkCanvas }        from './components/Canvas/InkCanvas';
import { WaveformCanvas }   from './components/Canvas/WaveformCanvas';
import { DropOverlay }      from './components/DropOverlay/DropOverlay';
import { PlaylistPanel }    from './components/PlaylistPanel/PlaylistPanel';
import { PlayerBar }        from './components/PlayerBar/PlayerBar';
import { TopBar }           from './components/TopBar/TopBar';
import { EqPanel }          from './components/EqPanel/EqPanel';
import { MiniPlayer, type MiniPlayerHandle } from './components/MiniPlayer/MiniPlayer';
import { ThemeToggle }      from './components/ThemeToggle/ThemeToggle';
import { Toast }            from './components/Toast/Toast';

import styles from './App.module.css';

export function App() {
  const {
    loadFiles, playTrack, togglePlay, next, prev,
    seekTo, setVolume, setEqGain, resetEq,
    toggleLoop, toggleShuffle, clearPlaylist,
    getBeat, getTimeData, getFreqData, currentPos,
    isPlayingRef, setBufferLoader,
  } = useAudioEngine();

  const { scanAndLoad, loadBuffer, isAndroid } = useMusicScanner();

  // Register the lazy buffer loader so playTrack can decode on-demand
  useEffect(() => {
    setBufferLoader(loadBuffer);
  }, [setBufferLoader, loadBuffer]);

  const miniRef = useRef<MiniPlayerHandle>(null);

  const togglePlaylist = usePlayerStore((s) => s.togglePlaylist);
  const toggleEq       = usePlayerStore((s) => s.toggleEq);
  const setMiniMode    = usePlayerStore((s) => s.setMiniMode);
  const musicLoaded    = usePlayerStore((s) => s.musicLoaded);

  // Wrap togglePlay so every play gesture pre-opens the hidden popup (enables auto-minimize)
  const handleTogglePlay = useCallback(() => {
    if (musicLoaded) miniRef.current?.ensureHiddenPopup();
    togglePlay();
  }, [musicLoaded, togglePlay]);

  useIdleTimer();
  useKeyboardShortcuts({ togglePlay: handleTogglePlay, next, prev, setVolume });

  const handleFiles = useCallback((files: File[]) => {
    loadFiles(files);
  }, [loadFiles]);

  const handleToggleMini = useCallback(() => {
    setMiniMode(true);
  }, [setMiniMode]);

  const handleExpandMini = useCallback(() => {
    setMiniMode(false);
  }, [setMiniMode]);

  return (
    <div className={styles.root}>
      {/* Loading bar (DOM element, updated imperatively by audio engine) */}
      <div id="loading-bar" />

      {/* ── Canvas layers ── */}
      <BackgroundCanvas getBeat={getBeat} isPlaying={isPlayingRef} />

      {/* ── Global overlays ── */}
      <DropOverlay onFiles={handleFiles} onScan={scanAndLoad} isAndroid={isAndroid} />
      <Toast />

      {/* ── Fixed top-bar chrome ── */}
      <ThemeToggle />
      <TopBar
        onTogglePlaylist={togglePlaylist}
        onToggleEq={toggleEq}
        onToggleMini={handleToggleMini}
      />
      <EqPanel onGainChange={setEqGain} onReset={resetEq} />

      {/* ── Mini player ── */}
      <MiniPlayer
        onTogglePlay={togglePlay}
        onPrev={prev}
        onNext={next}
        onExpand={handleExpandMini}
        currentPos={currentPos}
      />

      {/* ── Main layout ── */}
      <div id="app" className={styles.layout}>
        <PlaylistPanel
          onPlayTrack={playTrack}
          onAddFiles={handleFiles}
          onClear={clearPlaylist}
        />

        {/* Center — liquid ink visualization */}
        <div className={styles.center}>
          <InkCanvas
            getBeat={getBeat}
            getFreqData={getFreqData}
            isPlaying={isPlayingRef}
          />
          <WaveformCanvas
            getTimeData={getTimeData}
            getBeat={getBeat}
            isPlaying={isPlayingRef}
          />
          {!musicLoaded && (
            <div className={styles.hint}>Drop music to begin</div>
          )}
        </div>
      </div>

      {/* ── Bottom player bar ── */}
      <PlayerBar
        onTogglePlay={togglePlay}
        onPrev={prev}
        onNext={next}
        onSeek={seekTo}
        onVolume={setVolume}
        onToggleLoop={toggleLoop}
        onToggleShuffle={toggleShuffle}
        currentPos={currentPos}
      />
    </div>
  );
}
