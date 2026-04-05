import { useRef, useCallback, useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { isAudioFile } from '../utils/audio';
import type { Track } from '../types';

const EQ_BANDS = [60, 230, 910, 3600, 14000] as const;
const FFT_SIZE = 2048;

// ── Capacitor bridge (no-op in browser / Electron) ────────────────────────────
type CapMediaPlayer = {
  startService: () => Promise<void>;
  stopService:  () => Promise<void>;
  updateMetadata: (opts: { title: string; artist: string; album: string; duration: number }) => Promise<void>;
  updatePlaybackState: (opts: { playing: boolean; position: number }) => Promise<void>;
};
function capMP(): CapMediaPlayer | null {
  return (window as unknown as { Capacitor?: { Plugins?: { MediaPlayer?: CapMediaPlayer } } })
    ?.Capacitor?.Plugins?.MediaPlayer ?? null;
}

let trackIdCounter = 0;

export function useAudioEngine() {
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const gainRef      = useRef<GainNode | null>(null);
  const eqNodesRef   = useRef<BiquadFilterNode[]>([]);
  const sourceRef    = useRef<AudioBufferSourceNode | null>(null);

  // Injectable buffer loader — set by useMusicScanner on Android
  const bufferLoaderRef = useRef<((uri: string) => Promise<AudioBuffer | null>) | null>(null);
  const setBufferLoader = useCallback((fn: (uri: string) => Promise<AudioBuffer | null>) => {
    bufferLoaderRef.current = fn;
  }, []);

  const startedAtRef = useRef(0);
  const pausedAtRef  = useRef(0);
  const durationRef  = useRef(0);
  const isPlayingRef = useRef(false);

  // Beat detection state
  const beatHistRef    = useRef(new Float32Array(40));
  const beatHIdxRef    = useRef(0);
  const beatSmoothRef  = useRef(0);
  const energySmoothRef = useRef(0);
  const freqDataRef    = useRef(new Uint8Array(1));
  const timeDataRef    = useRef(new Uint8Array(1));

  // ── Context init ──────────────────────────────────────
  const initCtx = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioCtxRef.current = ctx;

    const gains = usePlayerStore.getState().eqGains;
    const eqNodes: BiquadFilterNode[] = EQ_BANDS.map((freq, i) => {
      const node = ctx.createBiquadFilter();
      node.type = freq === 60 ? 'lowshelf' : freq === 14000 ? 'highshelf' : 'peaking';
      node.frequency.value = freq;
      node.gain.value = gains[i];
      return node;
    });
    for (let i = 0; i < eqNodes.length - 1; i++) eqNodes[i].connect(eqNodes[i + 1]);
    eqNodesRef.current = eqNodes;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.82;
    eqNodes[eqNodes.length - 1].connect(analyser);
    analyserRef.current = analyser;

    const gain = ctx.createGain();
    gain.gain.value = usePlayerStore.getState().volume;
    analyser.connect(gain);
    gain.connect(ctx.destination);
    gainRef.current = gain;

    freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    timeDataRef.current = new Uint8Array(analyser.frequencyBinCount);
  }, []);

  // ── Stop source ───────────────────────────────────────
  const stopSource = useCallback(() => {
    if (!sourceRef.current) return;
    sourceRef.current.onended = null;
    try { sourceRef.current.stop(); } catch (_) {}
    try { sourceRef.current.disconnect(); } catch (_) {}
    sourceRef.current = null;
  }, []);

  // ── Current position ──────────────────────────────────
  const currentPos = useCallback((): number => {
    const ctx = audioCtxRef.current;
    if (!ctx) return pausedAtRef.current;
    if (!isPlayingRef.current) return pausedAtRef.current;
    const dur = durationRef.current;
    const s = usePlayerStore.getState();
    if (s.looping && dur > 0) return (ctx.currentTime - startedAtRef.current) % dur;
    return Math.min(dur, ctx.currentTime - startedAtRef.current);
  }, []);

  // ── Play ──────────────────────────────────────────────
  const play = useCallback((buffer: AudioBuffer) => {
    const ctx = audioCtxRef.current;
    if (!ctx || eqNodesRef.current.length === 0) return;
    if (ctx.state === 'suspended') ctx.resume();
    stopSource();

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = usePlayerStore.getState().looping;
    src.connect(eqNodesRef.current[0]);
    const offset = Math.max(0, Math.min(pausedAtRef.current, durationRef.current - 0.01));
    src.start(0, offset);
    startedAtRef.current = ctx.currentTime - offset;
    sourceRef.current = src;
    isPlayingRef.current = true;

    usePlayerStore.getState().setIsPlaying(true);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
      try {
        navigator.mediaSession.setPositionState({
          duration: durationRef.current,
          playbackRate: 1,
          position: offset,
        });
      } catch (_) {}
    }
    capMP()?.updatePlaybackState({ playing: true, position: Math.round(offset * 1000) });

    src.onended = () => {
      const pos = ctx.currentTime - startedAtRef.current;
      if (pos < durationRef.current - 0.5) return; // interrupted, not natural end
      const s = usePlayerStore.getState();
      if (s.looping) return;
      isPlayingRef.current = false;
      pausedAtRef.current = 0;
      usePlayerStore.getState().setIsPlaying(false);
      usePlayerStore.getState().setCurrentTime(0);

      const { playlist, currentIdx, shuffling } = s;
      if (shuffling && playlist.length > 1) {
        let n: number;
        do { n = Math.floor(Math.random() * playlist.length); } while (n === currentIdx);
        setTimeout(() => playTrack(playlist[n]), 120);
      } else if (currentIdx < playlist.length - 1) {
        setTimeout(() => playTrack(playlist[currentIdx + 1]), 120);
      }
    };
  }, [stopSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pause ─────────────────────────────────────────────
  const pause = useCallback(() => {
    if (!isPlayingRef.current) return;
    pausedAtRef.current = currentPos();
    stopSource();
    isPlayingRef.current = false;
    usePlayerStore.getState().setIsPlaying(false);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    capMP()?.updatePlaybackState({ playing: false, position: Math.round(pausedAtRef.current * 1000) });
  }, [currentPos, stopSource]);

  // ── Seek ──────────────────────────────────────────────
  const seekTo = useCallback((pos: number) => {
    const s = usePlayerStore.getState();
    const buf = s.playlist[s.currentIdx]?.buffer;
    if (!buf) return;
    pos = Math.max(0, Math.min(durationRef.current, pos));
    pausedAtRef.current = pos;
    usePlayerStore.getState().setCurrentTime(pos);
    if (isPlayingRef.current) play(buf);
  }, [play]);

  // ── Play track by index ───────────────────────────────
  const playTrack = useCallback((track: Track) => {
    if (!track.buffer) {
      // Lazy-load from Android MediaStore URI if a loader is registered
      if (track.uri && bufferLoaderRef.current) {
        usePlayerStore.getState().updateTrack(track.id, { loading: true });
        bufferLoaderRef.current(track.uri).then((buf) => {
          if (!buf) {
            usePlayerStore.getState().updateTrack(track.id, { loading: false, error: true });
            usePlayerStore.getState().showToast('Cannot decode: ' + track.name);
            return;
          }
          usePlayerStore.getState().updateTrack(track.id, {
            buffer: buf, duration: buf.duration, loading: false,
          });
          playTrack({ ...track, buffer: buf, duration: buf.duration });
        }).catch(() => {
          usePlayerStore.getState().updateTrack(track.id, { loading: false, error: true });
          usePlayerStore.getState().showToast('Load failed: ' + track.name);
        });
        return;
      }
      usePlayerStore.getState().showToast('Track not ready');
      return;
    }
    const { playlist } = usePlayerStore.getState();
    const idx = playlist.findIndex((t) => t.id === track.id);

    stopSource();
    isPlayingRef.current = false;
    pausedAtRef.current = 0;
    durationRef.current = track.duration;

    usePlayerStore.getState().setCurrentIdx(idx);
    usePlayerStore.getState().setDuration(track.duration);
    usePlayerStore.getState().setCurrentTime(0);
    usePlayerStore.getState().setMusicLoaded(true);

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist: 'ATOM INK PLAYER',
        album: track.ext,
      });
      navigator.mediaSession.setActionHandler('play',  () => play(track.buffer!));
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('stop',  () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        const s = usePlayerStore.getState();
        const ci = s.playlist.findIndex((t) => t.id === track.id);
        if (ci > 0) playTrack(s.playlist[ci - 1]);
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        const s = usePlayerStore.getState();
        const ci = s.playlist.findIndex((t) => t.id === track.id);
        if (ci < s.playlist.length - 1) playTrack(s.playlist[ci + 1]);
      });
      try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime != null) seekTo(details.seekTime);
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          seekTo(Math.max(0, currentPos() - (details.seekOffset ?? 10)));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          seekTo(Math.min(durationRef.current, currentPos() + (details.seekOffset ?? 10)));
        });
      } catch (_) {}
    }

    // Notify Android AudioService
    capMP()?.startService();
    capMP()?.updateMetadata({
      title:    track.name,
      artist:   'ATOM INK PLAYER',
      album:    track.ext,
      duration: Math.round(track.duration * 1000),
    });

    play(track.buffer);
  }, [pause, play, stopSource]);

  // ── Toggle play ───────────────────────────────────────
  const togglePlay = useCallback(() => {
    const s = usePlayerStore.getState();
    const buf = s.playlist[s.currentIdx]?.buffer;
    if (!buf) { s.showToast('Load a track first'); return; }
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    if (isPlayingRef.current) pause(); else play(buf);
  }, [pause, play]);

  // ── Next / Prev ───────────────────────────────────────
  const next = useCallback(() => {
    const { playlist, currentIdx, shuffling, showToast } = usePlayerStore.getState();
    if (shuffling && playlist.length > 1) {
      let n: number;
      do { n = Math.floor(Math.random() * playlist.length); } while (n === currentIdx);
      playTrack(playlist[n]);
    } else if (currentIdx < playlist.length - 1) {
      playTrack(playlist[currentIdx + 1]);
    } else {
      showToast('End of playlist');
    }
  }, [playTrack]);

  const prev = useCallback(() => {
    const { playlist, currentIdx } = usePlayerStore.getState();
    const pos = currentPos();
    if (pos > 2) {
      seekTo(0);
    } else if (currentIdx > 0) {
      playTrack(playlist[currentIdx - 1]);
    } else {
      seekTo(0);
    }
  }, [currentPos, playTrack, seekTo]);

  // ── Load files ────────────────────────────────────────
  const loadFiles = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter(isAudioFile);
    const s = usePlayerStore.getState();
    if (!valid.length) { s.showToast('Please drop audio files (MP3, WAV, FLAC…)'); return; }
    initCtx();
    const ctx = audioCtxRef.current!;
    if (ctx.state === 'suspended') ctx.resume();

    let decoded = 0;
    const startIdx = s.playlist.length;
    const newTracks: Track[] = valid.map((file) => {
      const name = file.name.replace(/\.[^.]+$/, '') || 'Track';
      const ext  = (file.name.split('.').pop() ?? '').toUpperCase();
      return { id: ++trackIdCounter, name, ext, buffer: null, duration: 0, loading: true, error: false };
    });

    s.addTracks(newTracks);

    valid.forEach((file, i) => {
      const track = newTracks[i];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const ab = (ev.target!.result as ArrayBuffer).slice(0);
        ctx.decodeAudioData(ab,
          (buf) => {
            usePlayerStore.getState().updateTrack(track.id, {
              buffer: buf, duration: buf.duration, loading: false,
            });
            decoded++;
            const setBar = document.getElementById('loading-bar');
            if (setBar) setBar.style.width = (decoded / valid.length * 100) + '%';
            if (decoded === valid.length) setTimeout(() => { if (setBar) setBar.style.width = '0%'; }, 500);

            const ss = usePlayerStore.getState();
            if (ss.currentIdx === -1) {
              // First track ever — play it
              const updated = ss.playlist.find((t) => t.id === track.id);
              if (updated?.buffer) playTrack(updated);
            }
          },
          () => {
            usePlayerStore.getState().updateTrack(track.id, { loading: false, error: true });
            usePlayerStore.getState().showToast('Cannot decode: ' + track.name);
            decoded++;
          },
        );
      };
      reader.onerror = () => { decoded++; s.showToast('File read error: ' + track.name); };
      reader.readAsArrayBuffer(file);
    });

    // Suppress unused variable warning
    void startIdx;
  }, [initCtx, playTrack]);

  // ── Volume ────────────────────────────────────────────
  const setVolume = useCallback((v: number) => {
    usePlayerStore.getState().setVolume(v);
    if (gainRef.current) gainRef.current.gain.value = v;
  }, []);

  // ── EQ ────────────────────────────────────────────────
  const setEqGain = useCallback((band: number, gain: number) => {
    usePlayerStore.getState().setEqGain(band, gain);
    if (eqNodesRef.current[band]) eqNodesRef.current[band].gain.value = gain;
  }, []);

  const resetEq = useCallback(() => {
    eqNodesRef.current.forEach((node, i) => {
      node.gain.value = 0;
      usePlayerStore.getState().setEqGain(i, 0);
    });
    usePlayerStore.getState().showToast('EQ Reset');
  }, []);

  // ── Loop ──────────────────────────────────────────────
  const toggleLoop = useCallback(() => {
    const looping = !usePlayerStore.getState().looping;
    usePlayerStore.getState().setLooping(looping);
    if (sourceRef.current) sourceRef.current.loop = looping;
    usePlayerStore.getState().showToast(looping ? 'Loop ON' : 'Loop OFF');
  }, []);

  // ── Shuffle ───────────────────────────────────────────
  const toggleShuffle = useCallback(() => {
    const shuffling = !usePlayerStore.getState().shuffling;
    usePlayerStore.getState().setShuffling(shuffling);
    usePlayerStore.getState().showToast(shuffling ? 'Shuffle ON' : 'Shuffle OFF');
  }, []);

  // ── Capacitor media command listener ─────────────────
  useEffect(() => {
    const mp = capMP();
    if (!mp) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = (window as any).Capacitor;
    if (!cap?.Plugins?.MediaPlayer?.addListener) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = cap.Plugins.MediaPlayer.addListener('mediaCommand', (data: any) => {
      const cmd: string = data?.command ?? '';
      if (cmd === 'play')       { const b = usePlayerStore.getState().playlist[usePlayerStore.getState().currentIdx]?.buffer; if (b) play(b); }
      else if (cmd === 'pause') pause();
      else if (cmd === 'stop')  pause();
      else if (cmd === 'next')  next();
      else if (cmd === 'prev')  prev();
      else if (cmd === 'play_pause') togglePlay();
      else if (cmd.startsWith('seek:')) seekTo(parseInt(cmd.slice(5), 10) / 1000);
    });
    return () => { handle?.remove?.(); };
  }, [next, pause, play, prev, seekTo, togglePlay]);

  // ── Clear playlist ────────────────────────────────────
  const clearPlaylist = useCallback(() => {
    stopSource();
    isPlayingRef.current = false;
    pausedAtRef.current  = 0;
    durationRef.current  = 0;
    usePlayerStore.getState().clearPlaylist();
    usePlayerStore.getState().showToast('Playlist cleared');
  }, [stopSource]);

  // ── Beat detection (called per frame) ─────────────────
  const getBeat = useCallback((): { beat: number; energy: number } => {
    const analyser = analyserRef.current;
    if (!analyser) return { beat: 0, energy: 0 };
    analyser.getByteFrequencyData(freqDataRef.current);

    let bass = 0;
    for (let i = 0; i < 8; i++) bass += freqDataRef.current[i];
    const bn = bass / (8 * 255);

    let full = 0;
    for (let i = 0; i < freqDataRef.current.length; i++) full += freqDataRef.current[i];
    const fn = full / (freqDataRef.current.length * 255);

    beatHistRef.current[beatHIdxRef.current++ % 40] = bn;
    const avg = beatHistRef.current.reduce((a, b) => a + b, 0) / 40;
    const raw = Math.max(0, (bn - avg * 1.4) / (1 - avg * 1.4 + 0.001));
    beatSmoothRef.current   += (raw - beatSmoothRef.current) * 0.35;
    energySmoothRef.current += (fn  - energySmoothRef.current) * 0.12;

    return {
      beat:   Math.min(1, beatSmoothRef.current * 2.8),
      energy: Math.min(1, energySmoothRef.current * 3.2),
    };
  }, []);

  const getTimeData = useCallback(() => {
    if (analyserRef.current) analyserRef.current.getByteTimeDomainData(timeDataRef.current);
    return timeDataRef.current;
  }, []);

  const getFreqData = useCallback(() => freqDataRef.current, []);

  return {
    // Controls
    loadFiles,
    playTrack,
    setBufferLoader,
    togglePlay,
    play,
    pause,
    seekTo,
    next,
    prev,
    setVolume,
    setEqGain,
    resetEq,
    toggleLoop,
    toggleShuffle,
    clearPlaylist,
    currentPos,
    // Analysis
    getBeat,
    getTimeData,
    getFreqData,
    // Refs (for canvas hooks)
    analyserRef,
    isPlayingRef,
    durationRef,
  };
}
