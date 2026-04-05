import { useRef, useEffect } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import type { BeatData } from '../../types';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; a: number;
}

interface Props {
  getBeat: () => BeatData;
  isPlaying: React.MutableRefObject<boolean>;
}

export function BackgroundCanvas({ getBeat, isPlaying }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const partsRef  = useRef<Particle[]>([]);
  const animRef   = useRef<number>(0);
  const theme     = usePlayerStore((s) => s.theme);

  // Resize + spawn particles
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const resize = () => {
      cv.width  = window.innerWidth;
      cv.height = window.innerHeight;
      partsRef.current = Array.from({ length: 50 }, () => ({
        x:  Math.random() * cv.width,
        y:  Math.random() * cv.height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r:  Math.random() * 0.8 + 0.1,
        a:  Math.random() * 0.1 + 0.02,
      }));
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Animation loop
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;

    const loop = () => {
      animRef.current = requestAnimationFrame(loop);
      const { beat, energy } = isPlaying.current ? getBeat() : { beat: 0, energy: 0 };

      ctx.clearRect(0, 0, cv.width, cv.height);
      const sp = 1 + energy * 4;
      let r: number, g: number, b: number;

      if (theme === 'ink') {
        r = 255; g = Math.floor(107 + beat * 50); b = Math.floor(53 + beat * 100);
      } else if (theme === 'light') {
        r = 0; g = 0; b = 0;
      } else {
        r = 255; g = 255; b = 255;
      }

      for (const p of partsRef.current) {
        p.x = (p.x + p.vx * sp + cv.width)  % cv.width;
        p.y = (p.y + p.vy * sp + cv.height) % cv.height;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + beat * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${p.a + beat * 0.08})`;
        ctx.fill();
      }
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [getBeat, isPlaying, theme]);

  return (
    <canvas
      id="main-canvas"
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
