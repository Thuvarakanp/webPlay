import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import styles from './MiniPlayer.module.css';

// ── Electron IPC (present when running inside Electron via preload.js) ──────
const eAPI = window.electronMini ?? null;

// ── Document PiP styles injected into the floating OS window ────────────────
const PIP_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body{width:100%;height:100%;overflow:hidden;background:transparent;}
  #wrap{width:100%;height:100%;background:#1e222d;border-radius:10px;overflow:hidden;
    display:flex;flex-direction:column;font-family:'DM Sans',sans-serif;position:relative;
    box-shadow:0 8px 40px rgba(0,0,0,.8);}
  #seek{position:absolute;top:0;left:0;right:0;height:3px;background:rgba(255,255,255,.08);z-index:1;}
  #seek-fill{height:100%;width:0%;background:#FDB94E;pointer-events:none;transition:width .1s linear;}
  #row{display:flex;align-items:center;padding:14px 12px 12px;gap:10px;height:100%;}
  #info{flex:1;min-width:0;}
  #title{font-weight:600;font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4;}
  #meta{font-size:10px;color:#858a93;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  #ctrls{display:flex;align-items:center;gap:1px;flex-shrink:0;}
  .btn{background:none;border:none;cursor:pointer;color:#fff;opacity:.6;
    display:flex;align-items:center;justify-content:center;padding:7px;border-radius:7px;
    transition:opacity .15s,background .15s;}
  .btn:hover{opacity:1;background:rgba(255,255,255,.06);}
  #play{width:30px;height:30px;border-radius:50%;background:#FDB94E;border:none;
    cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;
    transition:transform .12s;flex-shrink:0;margin:0 3px;}
  #play:hover{transform:scale(1.07);}
  #expand{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.35);
    display:flex;align-items:center;justify-content:center;padding:7px;border-radius:7px;
    transition:color .15s,background .15s;}
  #expand:hover{color:#fff;background:rgba(255,255,255,.06);}
`;

const PREV_ICO  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>`;
const NEXT_ICO  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`;
const EXPD_ICO  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
const PLAY_ICO  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 3 20 12 7 21 7 3"/></svg>`;
const PAUSE_ICO = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

function buildPipHTML(title: string, meta: string, playing: boolean) {
  return `<div id="wrap"><div id="seek"><div id="seek-fill"></div></div>
    <div id="row"><div id="info">
      <div id="title">${title.replace(/</g, '&lt;')}</div>
      <div id="meta">${meta.replace(/</g, '&lt;')}</div>
    </div>
    <div id="ctrls">
      <button class="btn" id="prev">${PREV_ICO}</button>
      <button id="play">${playing ? PAUSE_ICO : PLAY_ICO}</button>
      <button class="btn" id="next">${NEXT_ICO}</button>
      <button id="expand" title="Restore player">${EXPD_ICO}</button>
    </div></div></div>`;
}

interface Props {
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onExpand: () => void;
  currentPos: () => number;
}

export interface MiniPlayerHandle {
  /** Call during a user gesture (e.g. play button) to pre-open the hidden popup so it can
   *  appear on-screen instantly when the browser window is minimized. No-op in Electron. */
  ensureHiddenPopup: () => void;
}

export const MiniPlayer = forwardRef<MiniPlayerHandle, Props>(function MiniPlayer(
  { onTogglePlay, onPrev, onNext, onExpand, currentPos },
  ref,
) {
  const isMiniMode  = usePlayerStore((s) => s.isMiniMode);
  const setMiniMode = usePlayerStore((s) => s.setMiniMode);
  const [useFallback, setUseFallback] = useState(false);

  // pipWinRef: Document PiP window (null when using Electron or not open)
  const pipWinRef   = useRef<Window | null>(null);
  const rafRef      = useRef<number>(0);
  // autoRef: true = mini was opened automatically (browser minimize), not by user clicking mini btn
  const autoRef     = useRef(false);
  // miniOpenRef: true = Electron mini BrowserWindow is currently open
  const miniOpenRef = useRef(false);
  // hiddenPopupRef: pre-opened off-screen popup for browser auto-minimize support
  const hiddenPopupRef = useRef<Window | null>(null);

  // State mirror for rAF loops — avoids re-renders
  const stateRef = useRef({ isPlaying: false, title: '—', meta: 'ATOM INK', duration: 0, musicLoaded: false });
  useEffect(() => {
    return usePlayerStore.subscribe((s) => {
      const track = s.playlist[s.currentIdx];
      stateRef.current = {
        isPlaying:   s.isPlaying,
        title:       track?.name ?? '—',
        meta:        track ? `${track.ext} · ATOM INK` : 'ATOM INK',
        duration:    s.duration,
        musicLoaded: s.musicLoaded,
      };
    });
  }, []);

  // ── Shared exit ────────────────────────────────────────────────────────────
  const exitMini = useCallback((restoreFocus = false) => {
    cancelAnimationFrame(rafRef.current);
    document.body.classList.remove('mini-mode');

    if (restoreFocus) window.focus(); // unminimize / bring browser to front

    if (eAPI && miniOpenRef.current) {
      miniOpenRef.current = false;
      try { eAPI.close(); } catch (_) {}
    } else {
      try { pipWinRef.current?.close(); } catch (_) {}
      pipWinRef.current = null;
    }
  }, []);

  // ── Document PiP / popup sync loop ────────────────────────────────────────
  const startPipSync = useCallback((doc: Document) => {
    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      try {
        const { isPlaying, title, meta, duration } = stateRef.current;
        const sf = doc.getElementById('seek-fill') as HTMLDivElement | null;
        if (sf && duration > 0) sf.style.width = (currentPos() / duration * 100) + '%';
        const pb = doc.getElementById('play');
        if (pb) { const ico = isPlaying ? PAUSE_ICO : PLAY_ICO; if (pb.innerHTML !== ico) pb.innerHTML = ico; }
        const ti = doc.getElementById('title');
        if (ti && ti.textContent !== title) ti.textContent = title;
        const me = doc.getElementById('meta');
        if (me && me.textContent !== meta) me.textContent = meta;
      } catch (_) { return; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [currentPos]);

  // ── Electron sync loop ─────────────────────────────────────────────────────
  const startElectronSync = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      try {
        const { isPlaying, title, meta, duration } = stateRef.current;
        eAPI!.pushState({
          title,
          meta,
          playing: isPlaying,
          seek: duration > 0 ? (currentPos() / duration * 100) : 0,
        });
      } catch (_) { return; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [currentPos]);

  // ── Enter: Electron native BrowserWindow ───────────────────────────────────
  const enterElectron = useCallback((auto: boolean) => {
    if (miniOpenRef.current) return; // already open
    miniOpenRef.current = true;
    autoRef.current     = auto;
    const { title, meta, isPlaying, duration } = stateRef.current;
    eAPI!.open({
      title,
      meta,
      playing: isPlaying,
      seek: duration > 0 ? (currentPos() / duration * 100) : 0,
    });
    if (!auto) document.body.classList.add('mini-mode');
    startElectronSync();
  }, [currentPos, startElectronSync]);

  // ── Wire controls + close handler into any popup/pip window doc ───────────
  const wirePipDoc = useCallback((win: Window, auto: boolean) => {
    const doc = win.document;
    doc.getElementById('prev')!.addEventListener('click', () => onPrev());
    doc.getElementById('next')!.addEventListener('click', () => onNext());
    doc.getElementById('play')!.addEventListener('click', () => onTogglePlay());
    doc.getElementById('expand')!.addEventListener('click', () => {
      exitMini(true);
      if (!autoRef.current) onExpand();
      else setMiniMode(false);
    });
    // 'pagehide' fires for Document PiP; 'beforeunload' fires for window.open popups
    const onClose = () => {
      pipWinRef.current = null;
      document.body.classList.remove('mini-mode');
      if (!autoRef.current) setMiniMode(false);
    };
    win.addEventListener('pagehide',     onClose);
    win.addEventListener('beforeunload', onClose);

    if (!auto) document.body.classList.add('mini-mode');
    startPipSync(doc);
  }, [exitMini, onExpand, onNext, onPrev, onTogglePlay, setMiniMode, startPipSync]);

  // ── Inject CSS + HTML into a blank window document ────────────────────────
  const injectIntoDoc = useCallback((doc: Document, title: string, meta: string, isPlaying: boolean) => {
    const s = doc.createElement('style');
    s.textContent = PIP_CSS;
    doc.head.appendChild(s);
    doc.title = 'ATOM INK';
    doc.body.innerHTML = buildPipHTML(title, meta, isPlaying);
  }, []);

  // ── Pre-open a hidden popup during user gesture for auto-minimize support ──
  //    Called from App.tsx when user clicks play. Positions popup off-screen
  //    so visibilitychange can move it on-screen instantly (no gesture needed).
  const ensureHiddenPopup = useCallback(() => {
    if (eAPI) return; // Electron handles auto-minimize natively — no popup needed
    if (hiddenPopupRef.current && !hiddenPopupRef.current.closed) return; // already ready

    const popup = window.open(
      'about:blank',
      'atom-ink-mini-hidden',
      'width=320,height=130,resizable=no,scrollbars=no,status=no,menubar=no,toolbar=no,location=no',
    );
    if (!popup) return; // blocked by browser — auto-minimize won't work (fallback overlay used instead)

    // Park it far off-screen immediately so it's invisible
    popup.moveTo(-9999, -9999);

    const { title, meta, isPlaying } = stateRef.current;
    const charset = popup.document.createElement('meta');
    charset.setAttribute('charset', 'UTF-8');
    popup.document.head.appendChild(charset);
    injectIntoDoc(popup.document, title, meta, isPlaying);

    // Wire controls — expand just restores the main window (visibilitychange will hide popup)
    const doc = popup.document;
    doc.getElementById('prev')!.addEventListener('click', () => onPrev());
    doc.getElementById('next')!.addEventListener('click', () => onNext());
    doc.getElementById('play')!.addEventListener('click', () => onTogglePlay());
    doc.getElementById('expand')!.addEventListener('click', () => {
      // Move off-screen first, then focus main window (triggers visibilitychange → visible)
      popup.moveTo(-9999, -9999);
      cancelAnimationFrame(rafRef.current);
      autoRef.current = false;
      window.focus();
    });

    // If user closes the popup via OS title bar, clean up so next gesture re-creates it
    popup.addEventListener('beforeunload', () => {
      hiddenPopupRef.current = null;
      cancelAnimationFrame(rafRef.current);
      autoRef.current = false;
    });

    hiddenPopupRef.current = popup;
  }, [injectIntoDoc, onNext, onPrev, onTogglePlay]);

  // Expose handle to parent
  useImperativeHandle(ref, () => ({ ensureHiddenPopup }), [ensureHiddenPopup]);

  // ── Enter: Document PiP (Chrome 116+) or window.open popup (all browsers) ─
  const enterPip = useCallback(async (auto: boolean) => {
    if (pipWinRef.current) return;
    autoRef.current = auto;
    const { title, meta, isPlaying } = stateRef.current;

    // ① Try Document PiP — Chrome 116+, truly always-on-top over all apps
    if (typeof documentPictureInPicture !== 'undefined') {
      try {
        const pip = await documentPictureInPicture.requestWindow({ width: 300, height: 80 });
        pipWinRef.current = pip;
        injectIntoDoc(pip.document, title, meta, isPlaying);
        wirePipDoc(pip, auto);
        return;
      } catch (_) {
        // Falls through to popup approach
      }
    }

    // ② window.open() popup — works in every browser (Safari, Firefox, Chrome < 116)
    //    Creates a real separate OS window that stays visible when the main window is minimized.
    //    Note: requires a user-gesture context, so only reliable on manual trigger (not auto).
    if (!auto) {
      const popup = window.open(
        'about:blank',
        'atom-ink-mini',
        'width=320,height=130,resizable=no,scrollbars=no,status=no,menubar=no,toolbar=no,location=no',
      );

      if (popup && !popup.closed) {
        pipWinRef.current = popup;
        // about:blank already has <head>/<body> — inject directly, no document.write needed
        const meta_ = document.createElement('meta');
        meta_.setAttribute('charset', 'UTF-8');
        popup.document.head.appendChild(meta_);
        injectIntoDoc(popup.document, title, meta, isPlaying);
        wirePipDoc(popup, auto);
        return;
      }

      // ③ Popup blocked by browser → fall back to in-page draggable overlay
      setUseFallback(true);
    }
  }, [injectIntoDoc, wirePipDoc]);

  // ── Unified enter ──────────────────────────────────────────────────────────
  const enterMini = useCallback((auto: boolean) => {
    if (eAPI) enterElectron(auto);
    else      enterPip(auto);
  }, [enterElectron, enterPip]);

  // ── Electron IPC listeners (wired once) ───────────────────────────────────
  useEffect(() => {
    if (!eAPI) return;
    eAPI.onCmd((cmd) => {
      if (cmd === 'toggle') onTogglePlay();
      else if (cmd === 'prev') onPrev();
      else if (cmd === 'next') onNext();
      else if (cmd === 'expand') {
        exitMini(true);
        if (!autoRef.current) onExpand();
        else setMiniMode(false);
      }
    });
    eAPI.onClosed(() => {
      cancelAnimationFrame(rafRef.current);
      miniOpenRef.current = false;
      document.body.classList.remove('mini-mode');
      if (!autoRef.current) setMiniMode(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manual mini-mode toggle (TopBar button) ────────────────────────────────
  useEffect(() => {
    if (isMiniMode) {
      enterMini(false);
    } else {
      if (!autoRef.current) exitMini();
      setUseFallback(false);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isMiniMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto mini: open when browser/Electron window is minimized ─────────────
  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      if (hidden && stateRef.current.isPlaying && stateRef.current.musicLoaded) {
        if (eAPI) {
          // Electron: no gesture restriction — works perfectly
          enterElectron(true);
        } else if (hiddenPopupRef.current && !hiddenPopupRef.current.closed) {
          // Browser: move the pre-opened hidden popup to the bottom-right corner
          autoRef.current = true;
          const x = Math.max(0, screen.availWidth  - 330);
          const y = Math.max(0, screen.availHeight - 140);
          hiddenPopupRef.current.moveTo(x, y);
          hiddenPopupRef.current.resizeTo(320, 130);
          hiddenPopupRef.current.focus();
          startPipSync(hiddenPopupRef.current.document);
        }
        // If no pre-opened popup exists: gesture restriction prevents opening here.
        // User must click play first (which calls ensureHiddenPopup) to enable auto-minimize.
      } else if (!hidden && autoRef.current) {
        if (eAPI) {
          exitMini(false);
        } else if (hiddenPopupRef.current && !hiddenPopupRef.current.closed) {
          // Move popup back off-screen (don't close — keep it ready for next minimize)
          cancelAnimationFrame(rafRef.current);
          hiddenPopupRef.current.moveTo(-9999, -9999);
          autoRef.current = false;
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enterElectron, exitMini, startPipSync]);

  return (
    <FallbackOverlay
      visible={isMiniMode && useFallback}
      onTogglePlay={onTogglePlay}
      onPrev={onPrev}
      onNext={onNext}
      onExpand={onExpand}
      currentPos={currentPos}
    />
  );
});

// ── Draggable overlay for Safari / Firefox (in-browser only) ─────────────────
function FallbackOverlay({ visible, onTogglePlay, onPrev, onNext, onExpand, currentPos }: {
  visible: boolean; onTogglePlay: () => void; onPrev: () => void;
  onNext: () => void; onExpand: () => void; currentPos: () => number;
}) {
  const isPlaying  = usePlayerStore((s) => s.isPlaying);
  const duration   = usePlayerStore((s) => s.duration);
  const playlist   = usePlayerStore((s) => s.playlist);
  const currentIdx = usePlayerStore((s) => s.currentIdx);
  const track      = playlist[currentIdx];

  const [pos, setPos] = useState({ x: window.innerWidth - 294, y: window.innerHeight - 96 });
  const dragRef     = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const seekFillRef = useRef<HTMLDivElement>(null);
  const rafRef      = useRef<number>(0);

  useEffect(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      if (duration > 0 && seekFillRef.current)
        seekFillRef.current.style.width = (currentPos() / duration * 100) + '%';
    };
    if (visible) rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible, currentPos, duration]);

  const onMD = useCallback((e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const mv = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - 270, dragRef.current.origX + e.clientX - dragRef.current.startX)),
        y: Math.max(0, Math.min(window.innerHeight - 72,  dragRef.current.origY + e.clientY - dragRef.current.startY)),
      });
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
  }, []);

  if (!visible) return null;

  return (
    <div className={`${styles.mini} ${dragRef.current ? styles.dragging : ''}`}
      style={{ left: pos.x, top: pos.y }} onMouseDown={onMD}>
      <div className={styles.seek}><div className={styles.seekFill} ref={seekFillRef} /></div>
      <div className={styles.content}>
        <div className={styles.info}>
          <div className={styles.title}>{track?.name ?? '—'}</div>
          <div className={styles.meta}>{track ? `${track.ext} · ATOM INK` : 'ATOM INK'}</div>
        </div>
        <div className={styles.controls}>
          <button className={styles.ctrl} onMouseDown={(e) => e.stopPropagation()} onClick={onPrev}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
          </button>
          <button className={styles.playBtn} onMouseDown={(e) => e.stopPropagation()} onClick={onTogglePlay}>
            {isPlaying
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 3 20 12 7 21 7 3"/></svg>}
          </button>
          <button className={styles.ctrl} onMouseDown={(e) => e.stopPropagation()} onClick={onNext}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
          </button>
          <button className={styles.expand} onMouseDown={(e) => e.stopPropagation()} onClick={onExpand}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
