import { useCallback, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';
import type { Track } from '../types';

// ── Capacitor MusicScanner bridge ─────────────────────────────────────────────
type ScanTrack = {
  id: number;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  uri: string;
  mimeType: string;
  fileName: string;
};

type CapMusicScanner = {
  checkPermission:  () => Promise<{ status: string }>;
  requestPermission: () => Promise<{ status: string }>;
  scanMusic:        () => Promise<{ tracks: ScanTrack[] }>;
  readTrackData:    (opts: { uri: string }) => Promise<{ data: string }>;
};

function capScanner(): CapMusicScanner | null {
  return (window as unknown as {
    Capacitor?: { Plugins?: { MusicScanner?: CapMusicScanner } }
  })?.Capacitor?.Plugins?.MusicScanner ?? null;
}

const isAndroid = (): boolean =>
  typeof window !== 'undefined' &&
  !!(window as unknown as { Capacitor?: { getPlatform?: () => string } })
    ?.Capacitor?.getPlatform?.()?.toLowerCase().includes('android');

let trackIdCounter = 100_000; // offset from file-loaded tracks

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useMusicScanner() {
  const scannedRef = useRef(false);

  // Decode base64 + decode audio — runs in JS, returns AudioBuffer
  const loadBuffer = useCallback(async (uri: string): Promise<AudioBuffer | null> => {
    const scanner = capScanner();
    if (!scanner) return null;
    try {
      const { data } = await scanner.readTrackData({ uri });
      // base64 → ArrayBuffer
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      return await ctx.decodeAudioData(bytes.buffer);
    } catch {
      return null;
    }
  }, []);

  const scanAndLoad = useCallback(async () => {
    const scanner = capScanner();
    if (!scanner) return;

    // Check / request permission
    let { status } = await scanner.checkPermission();
    if (status !== 'granted') {
      ({ status } = await scanner.requestPermission());
    }
    if (status !== 'granted') {
      usePlayerStore.getState().showToast('Storage permission denied');
      return;
    }

    usePlayerStore.getState().showToast('Scanning device music…');

    const { tracks: raw } = await scanner.scanMusic();
    if (!raw.length) {
      usePlayerStore.getState().showToast('No music found on device');
      return;
    }

    // Build Track stubs — buffers loaded lazily on playTrack()
    const newTracks: Track[] = raw.map((t) => ({
      id:       ++trackIdCounter,
      name:     t.title,
      ext:      (t.mimeType.split('/').pop() ?? t.fileName.split('.').pop() ?? 'audio').toUpperCase(),
      buffer:   null,
      duration: t.durationMs / 1000,
      loading:  false,
      error:    false,
      uri:      t.uri,
      artist:   t.artist,
      album:    t.album,
    }));

    usePlayerStore.getState().addTracks(newTracks);
    usePlayerStore.getState().showToast(`Loaded ${newTracks.length} tracks`);
    scannedRef.current = true;
  }, []);

  // Re-scan when the app becomes visible again (e.g. returning from Files app)
  useEffect(() => {
    if (!isAndroid()) return;

    const onVisible = () => {
      if (document.visibilityState === 'visible' && scannedRef.current) {
        scanAndLoad();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [scanAndLoad]);

  return { scanAndLoad, loadBuffer, isAndroid: isAndroid() };
}
