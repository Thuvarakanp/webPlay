import { useRef, useEffect, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { fmtTime } from '../../utils/format';
import styles from './PlayerBar.module.css';

interface Props {
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (pos: number) => void;
  onVolume: (v: number) => void;
  onToggleLoop: () => void;
  onToggleShuffle: () => void;
  currentPos: () => number;
}

export function PlayerBar({
  onTogglePlay, onPrev, onNext, onSeek, onVolume,
  onToggleLoop, onToggleShuffle, currentPos,
}: Props) {
  const musicLoaded  = usePlayerStore((s) => s.musicLoaded);
  const isPlaying    = usePlayerStore((s) => s.isPlaying);
  const looping      = usePlayerStore((s) => s.looping);
  const shuffling    = usePlayerStore((s) => s.shuffling);
  const volume       = usePlayerStore((s) => s.volume);
  const duration     = usePlayerStore((s) => s.duration);
  const playlist     = usePlayerStore((s) => s.playlist);
  const currentIdx   = usePlayerStore((s) => s.currentIdx);
  const playlistOpen = usePlayerStore((s) => s.playlistOpen);

  const track = playlist[currentIdx];

  // Seek bar refs
  const seekTrackRef  = useRef<HTMLDivElement>(null);
  const seekFillRef   = useRef<HTMLDivElement>(null);
  const curTimeRef    = useRef<HTMLSpanElement>(null);
  const durTimeRef    = useRef<HTMLSpanElement>(null);
  const seekDragRef   = useRef(false);
  const pendingPosRef = useRef(-1);

  // Volume refs
  const volTrackRef = useRef<HTMLDivElement>(null);
  const volFillRef  = useRef<HTMLDivElement>(null);
  const volDragRef  = useRef(false);

  // Sync seek bar from audio position each frame
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      if (!seekDragRef.current && duration > 0) {
        const pos = currentPos();
        if (seekFillRef.current) seekFillRef.current.style.width = (pos / duration * 100) + '%';
        if (curTimeRef.current)  curTimeRef.current.textContent  = fmtTime(pos);
        if (durTimeRef.current)  durTimeRef.current.textContent  = fmtTime(duration);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [currentPos, duration]);

  // Sync volume fill
  useEffect(() => {
    if (volFillRef.current) volFillRef.current.style.width = (volume * 100) + '%';
  }, [volume]);

  // ── Seek interactions ──────────────────────────────────
  const updateSeekUI = useCallback((cx: number) => {
    const r = seekTrackRef.current;
    if (!r || duration <= 0) return;
    const rect = r.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    pendingPosRef.current = pct * duration;
    if (curTimeRef.current)  curTimeRef.current.textContent = fmtTime(pendingPosRef.current);
    if (seekFillRef.current) seekFillRef.current.style.width = (pct * 100) + '%';
  }, [duration]);

  const finishSeek = useCallback(() => {
    if (!seekDragRef.current) return;
    seekDragRef.current = false;
    if (pendingPosRef.current >= 0) { onSeek(pendingPosRef.current); pendingPosRef.current = -1; }
  }, [onSeek]);

  useEffect(() => {
    const onMove = (e: MouseEvent)  => { if (seekDragRef.current) updateSeekUI(e.clientX); };
    const onTMove = (e: TouchEvent) => { if (seekDragRef.current) updateSeekUI(e.touches[0].clientX); };
    const onUp   = () => finishSeek();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTMove, { passive: false });
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchend',  onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchend',  onUp);
    };
  }, [finishSeek, updateSeekUI]);

  // ── Volume interactions ───────────────────────────────
  const applyVol = useCallback((cx: number) => {
    const r = volTrackRef.current;
    if (!r) return;
    const rect = r.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    onVolume(v);
    if (volFillRef.current) volFillRef.current.style.width = (v * 100) + '%';
  }, [onVolume]);

  useEffect(() => {
    const onMove  = (e: MouseEvent)  => { if (volDragRef.current) applyVol(e.clientX); };
    const onTMove = (e: TouchEvent)  => { if (volDragRef.current) applyVol(e.touches[0].clientX); };
    const onUp    = () => { volDragRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTMove, { passive: false });
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchend',  onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTMove);
      window.removeEventListener('mouseup',   onUp);
      window.removeEventListener('touchend',  onUp);
    };
  }, [applyVol]);

  const isMobile = window.innerWidth <= 768;

  return (
    <div id="player-bar" className={`${styles.bar} ${musicLoaded ? styles.active : ''} ${playlistOpen && !isMobile ? styles.playlistOpen : ''}`}>

      {/* Seek line — absolute top of bar */}
      <div className={styles.seek}>
        <span className={styles.tLabel} ref={curTimeRef}>0:00</span>
        <div
          className={styles.seekTrack}
          ref={seekTrackRef}
          onMouseDown={(e) => { seekDragRef.current = true; updateSeekUI(e.clientX); }}
          onTouchStart={(e) => { seekDragRef.current = true; updateSeekUI(e.touches[0].clientX); }}
        >
          <div className={styles.seekFill} ref={seekFillRef} />
        </div>
        <span className={styles.tLabel} ref={durTimeRef} style={{ textAlign: 'right' }}>0:00</span>
      </div>

      {/* LEFT — track info */}
      <div className={styles.left}>
        <div className={styles.info}>
          <div className={styles.title}>{track?.name ?? '—'}</div>
          <div className={styles.meta}>{track ? `${track.ext} · ATOM INK` : 'ATOM INK'}</div>
        </div>
      </div>

      {/* CENTER — transport */}
      <div className={styles.center}>
        <div className={styles.transport}>
          <button className={styles.ctrlBtn} onClick={onPrev} title="Previous">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
            </svg>
          </button>

          <button
            className={styles.playBtn}
            onClick={onTogglePlay}
            disabled={!musicLoaded}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 3 20 12 7 21 7 3"/></svg>
            }
          </button>

          <button className={styles.ctrlBtn} onClick={onNext} title="Next">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
            </svg>
          </button>
        </div>
      </div>

      {/* RIGHT — shuffle + loop + volume */}
      <div className={styles.right}>
        <button
          className={`${styles.ctrlBtn} ${shuffling ? styles.on : ''}`}
          onClick={onToggleShuffle}
          title="Shuffle"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
          </svg>
        </button>

        <button
          className={`${styles.ctrlBtn} ${looping ? styles.on : ''}`}
          onClick={onToggleLoop}
          title="Loop"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>

        <div className={styles.volGroup}>
          <svg className={styles.volIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
          <div
            className={styles.volTrack}
            ref={volTrackRef}
            onMouseDown={(e) => { volDragRef.current = true; applyVol(e.clientX); }}
            onTouchStart={(e) => { volDragRef.current = true; applyVol(e.touches[0].clientX); }}
          >
            <div className={styles.volFill} ref={volFillRef} style={{ width: (volume * 100) + '%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
