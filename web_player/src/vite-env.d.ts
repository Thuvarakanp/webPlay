/// <reference types="vite/client" />

// Electron IPC bridge — exposed by preload.js when running inside Electron
interface ElectronMiniAPI {
  open:      (state: { title: string; meta: string; playing: boolean; seek: number }) => void;
  close:     () => void;
  pushState: (state: { title: string; meta: string; playing: boolean; seek: number }) => void;
  onCmd:     (cb: (cmd: string) => void) => void;
  onClosed:  (cb: () => void) => void;
}
interface Window { electronMini?: ElectronMiniAPI; }

// Document Picture-in-Picture API (Chrome 116+)
interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
}
interface DocumentPictureInPicture extends EventTarget {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  readonly window: Window | null;
}
declare const documentPictureInPicture: DocumentPictureInPicture | undefined;
