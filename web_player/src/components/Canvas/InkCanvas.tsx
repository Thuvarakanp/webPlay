import { useRef, useEffect, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import type { BeatData } from '../../types';

const BLOB_N = 22;

interface Props {
  getBeat: () => BeatData;
  getFreqData: () => Uint8Array;
  isPlaying: React.MutableRefObject<boolean>;
}

export function InkCanvas({ getBeat, getFreqData, isPlaying }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const animRef     = useRef<number>(0);
  const inkTRef     = useRef(0);
  const blobPhase   = useRef<number[]>(Array.from({ length: BLOB_N }, () => Math.random() * Math.PI * 2));
  const blobSpeed   = useRef<number[]>(Array.from({ length: BLOB_N }, () => 0.005 + Math.random() * 0.01));
  const inkDropsRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    r: number; life: number; decay: number; tail: Array<{ x: number; y: number }>;
  }>>([]);

  const theme = usePlayerStore((s) => s.theme);

  const getColors = useCallback((t: string) => {
    if (t === 'ink') return {
      fill0: 'rgba(255,107,53,0.96)', fill1: 'rgba(255,179,71,0.98)', fill2: 'rgba(99,110,250,1)',
      sheen0: 'rgba(255,255,255,0.55)', sheen1: 'rgba(255,255,255,0.12)',
      rim: 'rgba(26,26,26,0.12)', drop: 'rgba(255,107,53,0.75)',
      ripple: 'rgba(255,107,53,', isInk: true, isLight: false,
    };
    if (t === 'light') return {
      fill0: 'rgba(180,170,158,0.96)', fill1: 'rgba(155,148,139,0.98)', fill2: 'rgba(130,124,116,1)',
      sheen0: 'rgba(255,255,255,0.55)', sheen1: 'rgba(255,255,255,0.12)',
      rim: 'rgba(0,0,0,0.12)', drop: 'rgba(0,0,0,0.55)',
      ripple: 'rgba(0,0,0,', isInk: false, isLight: true,
    };
    return {
      fill0: 'rgba(55,55,55,0.96)', fill1: 'rgba(15,15,15,0.98)', fill2: 'rgba(0,0,0,1)',
      sheen0: 'rgba(255,255,255,0.1)', sheen1: 'rgba(255,255,255,0.02)',
      rim: 'rgba(255,255,255,0.07)', drop: 'rgba(255,255,255,0.65)',
      ripple: 'rgba(255,255,255,', isInk: false, isLight: false,
    };
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const resize = () => {
      const rect = cv.getBoundingClientRect();
      cv.width  = Math.round(rect.width)  || 800;
      cv.height = Math.round(rect.height) || 600;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;

    const inkColors = ['#ff6b35', '#ffd60a', '#ffa500', '#6b6efa', '#ff006e'];

    const loop = () => {
      animRef.current = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, cv.width, cv.height);
      inkTRef.current += 0.016;
      const t = inkTRef.current;

      const { beat, energy } = isPlaying.current ? getBeat() : { beat: 0.02, energy: 0.01 };
      const freqData = getFreqData();
      const C = getColors(theme);

      const W = cv.width, H = cv.height;
      const ICX = W / 2, ICY = H / 2;
      const minDim   = Math.min(W, H);
      const baseR    = minDim * 0.20;
      const waveAmp  = minDim * 0.032;
      const freqAmp  = minDim * 0.14;
      const maxR     = minDim * 0.46;
      const glowMax  = minDim * 0.48;
      const sheenOff = minDim * 0.09;

      // Atmosphere glow
      const glowR = Math.min(minDim * 0.5, glowMax + beat * (minDim * 0.05));
      const glowA = 0.03 + energy * 0.06;
      const glow  = ctx.createRadialGradient(ICX, ICY, 0, ICX, ICY, glowR);
      if (C.isInk) {
        glow.addColorStop(0, `rgba(255,107,53,${glowA})`);
        glow.addColorStop(0.5, `rgba(99,110,250,${glowA * 0.4})`);
      } else {
        glow.addColorStop(0, C.isLight ? `rgba(0,0,0,${glowA})` : `rgba(255,255,255,${glowA})`);
        glow.addColorStop(0.5, C.isLight ? `rgba(0,0,0,${glowA * 0.4})` : `rgba(255,255,255,${glowA * 0.4})`);
      }
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(ICX, ICY, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Build blob control points
      const pts: Array<{ x: number; y: number; fv: number }> = [];
      for (let i = 0; i < BLOB_N; i++) {
        blobPhase.current[i] += blobSpeed.current[i] * (1 + energy * 2.5);
        const bandIdx = Math.floor((i / BLOB_N) * freqData.length * 0.45);
        const fv  = (freqData[bandIdx] ?? 0) / 255;
        const wave = Math.sin(blobPhase.current[i]) * waveAmp
                   + Math.sin(blobPhase.current[i] * 0.6 + t) * (waveAmp * 0.5);
        const r = Math.min(maxR, baseR + wave + fv * freqAmp * (1 + beat * 0.7));
        const angle = i * (Math.PI * 2 / BLOB_N) + t * 0.06;
        pts.push({ x: ICX + Math.cos(angle) * r, y: ICY + Math.sin(angle) * r, fv });
      }

      // Blob path
      ctx.beginPath();
      ctx.moveTo((pts[0].x + pts[BLOB_N - 1].x) / 2, (pts[0].y + pts[BLOB_N - 1].y) / 2);
      for (let i = 0; i < BLOB_N; i++) {
        const curr = pts[i], next = pts[(i + 1) % BLOB_N];
        ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
      }
      ctx.closePath();

      // Body fill
      const fill = ctx.createRadialGradient(ICX - sheenOff, ICY - sheenOff * 1.2, 0, ICX, ICY, baseR + minDim * 0.2);
      if (C.isInk) {
        [0, 0.25, 0.5, 0.75, 1].forEach((stop) => {
          const colorIdx = (Math.floor(t * 0.5) + Math.floor(stop * (inkColors.length - 1))) % inkColors.length;
          fill.addColorStop(stop, inkColors[colorIdx] + 'cc');
        });
      } else {
        fill.addColorStop(0,   C.fill0);
        fill.addColorStop(0.5, C.fill1);
        fill.addColorStop(1,   C.fill2);
      }
      ctx.fillStyle = fill;
      ctx.fill();

      // Sheen
      const sheen = ctx.createRadialGradient(
        ICX - sheenOff * 1.1, ICY - sheenOff * 1.3, 2,
        ICX - sheenOff * 0.8, ICY - sheenOff, sheenOff * 2.2 + beat * (minDim * 0.03),
      );
      sheen.addColorStop(0,   C.sheen0);
      sheen.addColorStop(0.6, C.sheen1);
      sheen.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fill();

      // Rim
      ctx.strokeStyle = C.rim.replace('0.07', String(0.07 + beat * 0.18 + energy * 0.1));
      ctx.lineWidth = 0.8 + beat * 1.4;
      ctx.stroke();

      // Ripple rings
      for (let r = 0; r < 4; r++) {
        const rr = baseR * 0.15 + r * (baseR * 0.18) + ((t * 4 + r * 2.1) % (Math.PI * 2)) * (baseR * 0.06);
        const ra = Math.max(0, 0.06 + beat * 0.05 - r * 0.014 - (rr / baseR) * 0.07);
        if (ra > 0.003) {
          ctx.beginPath();
          ctx.arc(ICX, ICY, rr, 0, Math.PI * 2);
          ctx.strokeStyle = C.ripple + ra + ')';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      // Ink drops
      if (beat > 0.48 && Math.random() < beat * 0.55) {
        const pi = Math.floor(Math.random() * pts.length);
        const p  = pts[pi];
        const ang = Math.atan2(p.y - ICY, p.x - ICX);
        const spd = (minDim * 0.06 + Math.random() * minDim * 0.14) * beat;
        inkDropsRef.current.push({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * spd * (0.5 + Math.random() * 0.7),
          vy: Math.sin(ang) * spd * (0.5 + Math.random() * 0.7) - minDim * 0.02,
          r: Math.random() * (minDim * 0.008) + minDim * 0.004,
          life: 1, decay: 0.018 + Math.random() * 0.022, tail: [],
        });
      }

      inkDropsRef.current = inkDropsRef.current.filter((d) => d.life > 0.02);
      for (const d of inkDropsRef.current) {
        d.tail.push({ x: d.x, y: d.y });
        if (d.tail.length > 10) d.tail.shift();

        for (let ti = 0; ti < d.tail.length - 1; ti++) {
          ctx.beginPath();
          ctx.moveTo(d.tail[ti].x, d.tail[ti].y);
          ctx.lineTo(d.tail[ti + 1].x, d.tail[ti + 1].y);
          const ta = (ti / d.tail.length) * d.life * 0.38;
          ctx.strokeStyle = C.isInk ? `rgba(255,107,53,${ta})` : C.ripple + ta + ')';
          ctx.lineWidth = d.r * (ti / d.tail.length) * d.life;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(d.x, d.y, Math.max(0.1, d.r * d.life), 0, Math.PI * 2);
        ctx.fillStyle = C.isInk
          ? `rgba(255,107,53,${d.life * 0.65})`
          : C.drop.replace('0.65', String(d.life * 0.65));
        ctx.fill();

        d.x  += d.vx * 0.016;
        d.y  += d.vy * 0.016;
        d.vy += (minDim * 0.15) * 0.016;
        d.vx *= 0.97; d.vy *= 0.97;
        d.life -= d.decay;
      }

      // Beat glow on canvas element
      cv.style.filter = beat > 0.4
        ? C.isLight
          ? `drop-shadow(0 0 ${18 + beat * 38}px rgba(0,0,0,${0.05 + beat * 0.08}))`
          : `drop-shadow(0 0 ${18 + beat * 38}px rgba(255,255,255,${0.05 + beat * 0.1}))`
        : 'none';
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [getBeat, getFreqData, isPlaying, getColors, theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: '10%', top: '10%',
        width: '80%', height: '80%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    />
  );
}
