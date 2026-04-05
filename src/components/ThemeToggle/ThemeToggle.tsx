import { usePlayerStore } from '../../store/playerStore';
import type { Theme } from '../../types';
import styles from './ThemeToggle.module.css';

const OPTIONS: { key: Theme; label: string }[] = [
  { key: 'dark',  label: 'Dark'  },
  { key: 'light', label: 'Light' },
  { key: 'ink',   label: 'Ink'   },
];

export function ThemeToggle() {
  const theme    = usePlayerStore((s) => s.theme);
  const setTheme = usePlayerStore((s) => s.setTheme);

  return (
    <div id="theme-btn" className={styles.pill}>
      {OPTIONS.map((opt, i) => (
        <>
          <button
            key={opt.key}
            className={`${styles.opt} ${theme === opt.key ? styles.active : ''}`}
            onClick={(e) => { e.stopPropagation(); setTheme(opt.key); }}
          >
            {opt.label}
          </button>
          {i < OPTIONS.length - 1 && <div key={`div-${opt.key}`} className={styles.divider} />}
        </>
      ))}
    </div>
  );
}
