import { useRef, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';

interface Props {
  getTimeData: () => Uint8Array;
  getBeat: () => { beat: number; energy: number };
  isPlaying: React.MutableRefObject<boolean>;
}

export function WaveformCanvas({ getTimeData, getBeat, isPlaying }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const theme     = usePlayerStore((s) => s.theme);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;

    const loop = () => {
      animRef.current = requestAnimationFrame(loop);
      if (!isPlaying.current) return;

      const W = cv.offsetWidth;
      if (W > 0 && cv.width !== W) cv.width = W;
      const H = cv.height;
      ctx.clearRect(0, 0, cv.width, H);

      const { beat } = getBeat();
      const timeData = getTimeData();
      if (!timeData.length) return;

      const step = cv.width / timeData.length;
      ctx.beginPath();

      if (theme === 'ink') {
        ctx.strokeStyle = `rgba(255,${107 + beat * 50},${53 + beat * 100},${0.3 + beat * 0.5})`;
      } else if (theme === 'light') {
        ctx.strokeStyle = `rgba(0,0,0,${0.3 + beat * 0.5})`;
      } else {
        ctx.strokeStyle = `rgba(255,255,255,${0.25 + beat * 0.5})`;
      }

      ctx.lineWidth = 0.8 + beat * 1.4;
      ctx.lineJoin  = 'round';

      for (let i = 0; i < timeData.length; i++) {
        const y = ((timeData[i] / 128) - 1) * (H / 2) + H / 2;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
      }
      ctx.stroke();
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [getBeat, getTimeData, isPlaying, theme]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={44}
      style={{ display: 'none' }}
    />
  );
}
