import { usePlayerStore } from '../../store/playerStore';
import styles from './EqPanel.module.css';

const BANDS = ['60', '230', '910', '3.6k', '14k'];

interface Props {
  onGainChange: (band: number, gain: number) => void;
  onReset: () => void;
}

export function EqPanel({ onGainChange, onReset }: Props) {
  const eqOpen  = usePlayerStore((s) => s.eqOpen);
  const eqGains = usePlayerStore((s) => s.eqGains);

  return (
    <div id="eq-panel" className={`${styles.panel} ${eqOpen ? styles.open : ''}`}>
      <div className={styles.header}>
        <span>Equalizer</span>
        <button className={styles.resetBtn} onClick={onReset} title="Reset all bands to 0">
          Reset
        </button>
      </div>

      <div className={styles.bands}>
        {BANDS.map((label, i) => (
          <div className={styles.band} key={label}>
            <div className={styles.sliderWrapper}>
              <input
                type="range"
                className={styles.slider}
                min="-12"
                max="12"
                step="0.1"
                value={eqGains[i]}
                onChange={(e) => onGainChange(i, parseFloat(e.target.value))}
              />
            </div>
            <div className={styles.label}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
