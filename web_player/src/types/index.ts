export type Theme = 'dark' | 'light' | 'ink';

export interface Track {
  id: number;
  name: string;
  ext: string;
  buffer: AudioBuffer | null;
  duration: number;
  loading: boolean;
  error: boolean;
  // Android auto-sync: set when track is from device MediaStore
  uri?: string;
  artist?: string;
  album?: string;
}

export interface BeatData {
  beat: number;
  energy: number;
}
