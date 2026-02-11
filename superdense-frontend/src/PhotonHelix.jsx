import React, { useEffect, useRef } from 'react';

/**
 * PhotonHelix renders a temporary double-helix photon animation between two points.
 * - start: { x, y } in parent coordinate space
 * - end: { x, y }
 * - durationMs: animation time
 * - strandColors: [color1, color2]
 * - thickness: helix radius in px
 * - photonCount: number of photons per strand
 * - onComplete: callback after animation ends
 */
export default function PhotonHelix({
  start,
  end,
  durationMs = 3500,
  strandColors = ['#16a4ff', '#16a4ff'],
  thickness = 16,
  photonCount = 60,
  onComplete,
  className,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !start || !end) return;
    const ctx = canvas.getContext('2d');

    // Size canvas to parent
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Vectors
    const vx = end.x - start.x;
    const vy = end.y - start.y;
    const len = Math.max(1, Math.hypot(vx, vy));
    const ux = vx / len;
    const uy = vy / len;
    // Perpendicular unit vector
    const px = -uy;
    const py = ux;

    // Photons with staggered phases along the path
    const photons = Array.from({ length: photonCount }).map((_, i) => ({
      strand: i % 2, // 0 or 1
      offset: (i / photonCount), // initial position 0..1
      speed: 0.25 + Math.random() * 0.35, // slower relative speed
      wobble: 0.6 + Math.random() * 0.6, // amplitude factor
      size: 2 + Math.random() * 2.5,
    }));

    let startTime = performance.now();

    const draw = (now) => {
      const tNorm = Math.min(1, (now - startTime) / durationMs);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // trailing alpha as it completes
      const globalAlpha = 1 - Math.pow(tNorm, 2);
      ctx.globalAlpha = Math.max(0.1, globalAlpha);
      // No guide line; photons only

      // Draw photons on two strands (phase shifted)
      photons.forEach((p) => {
        const travel = (p.offset + tNorm * p.speed) % 1; // 0..1, slower via p.speed
        // strand phase: 0 or PI for opposite sides
        const phase = p.strand === 0 ? 0 : Math.PI;
        const helixTurns = 6; // number of twists
        const sinus = Math.sin(travel * Math.PI * helixTurns * 2 + phase);
        const radius = thickness * p.wobble * 0.5;

        const bx = start.x + ux * len * travel + px * (sinus * radius);
        const by = start.y + uy * len * travel + py * (sinus * radius);

        // Glow
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = p.strand === 0 ? strandColors[0] : strandColors[1];
        ctx.shadowBlur = 12;
        ctx.fillStyle = p.strand === 0 ? strandColors[0] : strandColors[1];
        ctx.beginPath();
        ctx.arc(bx, by, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      if (tNorm < 1) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (onComplete) onComplete();
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [start, end, durationMs, strandColors, thickness, photonCount, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9,
      }}
    />
  );
}


