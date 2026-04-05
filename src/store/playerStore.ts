import { create } from 'zustand';
import type { Track, Theme } from '../types';

interface PlayerStore {
  // ── Playlist ──────────────────────────────────────────
  playlist: Track[];
  currentIdx: number;

  // ── Playback ──────────────────────────────────────────
  isPlaying: boolean;
  looping: boolean;
  shuffling: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  musicLoaded: boolean;

  // ── EQ ────────────────────────────────────────────────
  eqGains: number[];       // [60, 230, 910, 3600, 14000]
  eqOpen: boolean;

  // ── UI ────────────────────────────────────────────────
  theme: Theme;
  playlistOpen: boolean;
  isPinned: boolean;
  isMiniMode: boolean;
  toastMessage: string | null;

  // ── Actions ───────────────────────────────────────────
  setTheme: (t: Theme) => void;
  setPlaylistOpen: (open: boolean) => void;
  togglePlaylist: () => void;
  setEqOpen: (open: boolean) => void;
  toggleEq: () => void;
  setPinned: (pinned: boolean) => void;
  setMiniMode: (mini: boolean) => void;

  addTracks: (tracks: Track[]) => void;
  updateTrack: (id: number, patch: Partial<Track>) => void;
  clearPlaylist: () => void;
  setCurrentIdx: (idx: number) => void;

  setIsPlaying: (v: boolean) => void;
  setLooping: (v: boolean) => void;
  setShuffling: (v: boolean) => void;
  setVolume: (v: number) => void;
  setCurrentTime: (v: number) => void;
  setDuration: (v: number) => void;
  setMusicLoaded: (v: boolean) => void;

  setEqGain: (band: number, gain: number) => void;

  showToast: (msg: string) => void;
  dismissToast: () => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  playlist: [],
  currentIdx: -1,

  isPlaying: false,
  looping: false,
  shuffling: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  musicLoaded: false,

  eqGains: [0, 0, 0, 0, 0],
  eqOpen: false,

  theme: 'dark',
  playlistOpen: true,
  isPinned: false,
  isMiniMode: false,
  toastMessage: null,

  // ── Theme ─────────────────────────────────────────────
  setTheme: (t) => {
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },

  // ── Playlist panel ────────────────────────────────────
  setPlaylistOpen: (open) => set({ playlistOpen: open }),
  togglePlaylist: () => set((s) => ({ playlistOpen: !s.playlistOpen })),

  // ── EQ panel ──────────────────────────────────────────
  setEqOpen: (open) => set({ eqOpen: open }),
  toggleEq: () => set((s) => ({ eqOpen: !s.eqOpen })),

  // ── Pin / mini ────────────────────────────────────────
  setPinned: (pinned) => set({ isPinned: pinned }),
  setMiniMode: (mini) => set({ isMiniMode: mini }),

  // ── Playlist data ─────────────────────────────────────
  addTracks: (tracks) => set((s) => ({ playlist: [...s.playlist, ...tracks] })),
  updateTrack: (id, patch) =>
    set((s) => ({
      playlist: s.playlist.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  clearPlaylist: () =>
    set({
      playlist: [],
      currentIdx: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      musicLoaded: false,
    }),
  setCurrentIdx: (idx) => set({ currentIdx: idx }),

  // ── Playback state ────────────────────────────────────
  setIsPlaying: (v) => set({ isPlaying: v }),
  setLooping: (v) => set({ looping: v }),
  setShuffling: (v) => set({ shuffling: v }),
  setVolume: (v) => set({ volume: v }),
  setCurrentTime: (v) => set({ currentTime: v }),
  setDuration: (v) => set({ duration: v }),
  setMusicLoaded: (v) => set({ musicLoaded: v }),

  // ── EQ ────────────────────────────────────────────────
  setEqGain: (band, gain) =>
    set((s) => {
      const gains = [...s.eqGains];
      gains[band] = gain;
      return { eqGains: gains };
    }),

  // ── Toast ─────────────────────────────────────────────
  showToast: (msg) => set({ toastMessage: msg }),
  dismissToast: () => set({ toastMessage: null }),
}));
