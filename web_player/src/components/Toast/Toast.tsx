import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import styles from './Toast.module.css';

export function Toast() {
  const message     = usePlayerStore((s) => s.toastMessage);
  const dismissToast = usePlayerStore((s) => s.dismissToast);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(dismissToast, 2400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [message, dismissToast]);

  return (
    <div className={`${styles.toast} ${message ? styles.show : ''}`}>
      {message}
    </div>
  );
}
