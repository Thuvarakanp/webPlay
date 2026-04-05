import { useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { fmtTime } from '../../utils/format';
import type { Track } from '../../types';
import styles from './PlaylistPanel.module.css';

interface Props {
  onPlayTrack: (track: Track) => void;
  onAddFiles: (files: File[]) => void;
  onClear: () => void;
}

export function PlaylistPanel({ onPlayTrack, onAddFiles, onClear }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playlist     = usePlayerStore((s) => s.playlist);
  const currentIdx   = usePlayerStore((s) => s.currentIdx);
  const isPlaying    = usePlayerStore((s) => s.isPlaying);
  const open         = usePlayerStore((s) => s.playlistOpen);

  return (
    <div className={`${styles.panel} ${open ? '' : styles.collapsed}`}>
      {/* Header */}
      <div className={styles.label}>
        <div className={styles.titleRow}>Playlist</div>
        <div className={styles.actionsRow}>
          <span className={styles.count}>
            {playlist.length} track{playlist.length !== 1 ? 's' : ''}
          </span>
          <button className={styles.clearBtn} onClick={onClear} title="Clear all tracks">
            Clear
          </button>
        </div>
      </div>

      {/* Track list */}
      <div className={styles.scroll}>
        {playlist.length === 0 ? (
          <div className={styles.empty}>No tracks yet.<br />Add music to begin.</div>
        ) : (
          playlist.map((track, i) => (
            <PlaylistItem
              key={track.id}
              track={track}
              index={i}
              isActive={i === currentIdx}
              isPlaying={isPlaying && i === currentIdx}
              onClick={() => onPlayTrack(track)}
            />
          ))
        )}
      </div>

      {/* Add button */}
      <button className={styles.addBtn} onClick={() => fileInputRef.current?.click()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add tracks
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) onAddFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
    </div>
  );
}

function PlaylistItem({
  track, index, isActive, isPlaying, onClick,
}: {
  track: Track; index: number; isActive: boolean; isPlaying: boolean; onClick: () => void;
}) {
  return (
    <div
      className={`${styles.item} ${isActive ? styles.active : ''}`}
      onClick={onClick}
    >
      <div className={styles.num}>{index + 1}</div>
      <div className={styles.info}>
        <div className={styles.name}>
          {track.name}
          {track.loading && <span className={styles.tag}> …</span>}
          {track.error   && <span className={`${styles.tag} ${styles.err}`}> err</span>}
        </div>
        <div className={styles.dur}>
          {track.duration ? fmtTime(track.duration) : '—'} · {track.ext}
        </div>
      </div>
      {isActive && (
        <div className={`${styles.bars} ${isPlaying ? styles.playing : ''}`}>
          <div className={styles.bar} style={{ height: 2 }} />
          <div className={styles.bar} style={{ height: 7 }} />
          <div className={styles.bar} style={{ height: 4 }} />
        </div>
      )}
    </div>
  );
}
