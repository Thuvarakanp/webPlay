import { useRef, useState, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { extractFilesFromDataTransfer } from '../../utils/audio';
import styles from './DropOverlay.module.css';

interface Props {
  onFiles: (files: File[]) => void;
  onScan?: () => void;
  isAndroid?: boolean;
}

export function DropOverlay({ onFiles, onScan, isAndroid = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const musicLoaded = usePlayerStore((s) => s.musicLoaded);

  // Global drag-over / drop
  useEffect(() => {
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = (e: DragEvent) => {
      if (!(e.relatedTarget instanceof Node) || !document.body.contains(e.relatedTarget as Node)) {
        setDragOver(false);
      }
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer) {
        const files = await extractFilesFromDataTransfer(e.dataTransfer);
        if (files.length) onFiles(files);
      }
    };

    window.addEventListener('dragover',  onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop',      onDrop);
    return () => {
      window.removeEventListener('dragover',  onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop',      onDrop);
    };
  }, [onFiles]);

  if (musicLoaded) return null;

  if (isAndroid) {
    return (
      <div className={styles.overlay}>
        <div className={styles.logo}>Atom Ink</div>
        <div className={`${styles.ring}`}>
          <span className={styles.icon}>♪</span>
        </div>
        <div className={styles.text}>Tap to load music from your device</div>
        <button
          className={styles.scanBtn}
          onClick={() => onScan?.()}
        >
          Scan device music
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${styles.overlay} ${dragOver ? styles.dragOver : ''}`}
      onClick={() => fileInputRef.current?.click()}
    >
      <div className={styles.logo}>Atom Ink</div>
      <div className={`${styles.ring} ${dragOver ? styles.ringActive : ''}`}>
        <span className={styles.icon}>♪</span>
      </div>
      <div className={styles.text}>
        Drop music files here<br />or click to browse
      </div>
      <div className={styles.fmts}>
        MP3 · WAV · FLAC · OGG · AAC · M4A · OPUS · AIFF · WMA · WEBM
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
    </div>
  );
}
