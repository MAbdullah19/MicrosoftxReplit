/** React Bits — "Electric Border".
 *  https://reactbits.dev/animations/electric-border
 *  Ported as-is: the octaved value-noise displacing a rounded-rect path on a
 *  canvas, plus the three blurred border layers underneath. Reserved for one
 *  moment — a verdict that just verified against the public chain — because a
 *  crackling border everywhere would be noise, and here it is the payoff.
 *
 *  Under reduced motion it degrades to a plain glowing border rather than
 *  disappearing, since it is carrying meaning at that point, not decoration. */
import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/theme";

function withAlpha(color: string, alpha: number): string {
  // Works for both `hsl(var(--x))` and hex, which is all this is ever given.
  if (color.startsWith("hsl(")) return color.replace(/\)$/, ` / ${alpha})`);
  const h = color.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = parseInt(full.slice(0, 6), 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

export function ElectricBorder({
  children,
  color = "hsl(var(--ok))",
  speed = 1,
  chaos = 0.1,
  borderRadius = 20,
  className,
  style,
}: {
  children?: ReactNode;
  color?: string;
  speed?: number;
  chaos?: number;
  borderRadius?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const reduced = usePrefersReducedMotion();

  const random = useCallback((x: number) => (Math.sin(x * 12.9898) * 43758.5453) % 1, []);

  const noise2D = useCallback(
    (x: number, y: number) => {
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;
      const a = random(i + j * 57);
      const b = random(i + 1 + j * 57);
      const c = random(i + (j + 1) * 57);
      const d = random(i + 1 + (j + 1) * 57);
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    },
    [random],
  );

  const octavedNoise = useCallback(
    (x: number, time: number, seed: number, amplitude: number) => {
      const octaves = 10;
      const lacunarity = 1.6;
      const gain = 0.7;
      let y = 0;
      let amp = amplitude;
      let frequency = 10;
      for (let i = 0; i < octaves; i++) {
        // Upstream flattens the first octave to zero (baseFlatness = 0).
        const octaveAmplitude = i === 0 ? 0 : amp;
        y += octaveAmplitude * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
        frequency *= lacunarity;
        amp *= gain;
      }
      return y;
    },
    [noise2D],
  );

  const cornerPoint = useCallback(
    (cx: number, cy: number, r: number, startAngle: number, arc: number, t: number) => {
      const angle = startAngle + t * arc;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    },
    [],
  );

  const roundedRectPoint = useCallback(
    (t: number, left: number, top: number, width: number, height: number, radius: number) => {
      const sw = width - 2 * radius;
      const sh = height - 2 * radius;
      const arc = (Math.PI * radius) / 2;
      const total = 2 * sw + 2 * sh + 4 * arc;
      const d = t * total;
      let acc = 0;

      if (d <= acc + sw) return { x: left + radius + ((d - acc) / sw) * sw, y: top };
      acc += sw;
      if (d <= acc + arc)
        return cornerPoint(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2, (d - acc) / arc);
      acc += arc;
      if (d <= acc + sh) return { x: left + width, y: top + radius + ((d - acc) / sh) * sh };
      acc += sh;
      if (d <= acc + arc)
        return cornerPoint(left + width - radius, top + height - radius, radius, 0, Math.PI / 2, (d - acc) / arc);
      acc += arc;
      if (d <= acc + sw) return { x: left + width - radius - ((d - acc) / sw) * sw, y: top + height };
      acc += sw;
      if (d <= acc + arc)
        return cornerPoint(left + radius, top + height - radius, radius, Math.PI / 2, Math.PI / 2, (d - acc) / arc);
      acc += arc;
      if (d <= acc + sh) return { x: left, y: top + height - radius - ((d - acc) / sh) * sh };
      acc += sh;
      return cornerPoint(left + radius, top + radius, radius, Math.PI, Math.PI / 2, (d - acc) / arc);
    },
    [cornerPoint],
  );

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displacement = 60;
    const borderOffset = 60;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width + borderOffset * 2;
      const height = rect.height + borderOffset * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      return { width, height };
    };

    let { width, height } = updateSize();

    const drawFrame = (currentTime: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      timeRef.current += ((currentTime - lastFrameTimeRef.current) / 1000) * speed;
      lastFrameTimeRef.current = currentTime;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // Resolve the CSS variable each frame so the arc follows the theme.
      ctx.strokeStyle = getComputedStyle(canvas).color;
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const bw = width - 2 * borderOffset;
      const bh = height - 2 * borderOffset;
      const radius = Math.min(borderRadius, Math.min(bw, bh) / 2);
      const perimeter = 2 * (bw + bh) + 2 * Math.PI * radius;
      const samples = Math.floor(perimeter / 2);

      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const p = roundedRectPoint(t, borderOffset, borderOffset, bw, bh, radius);
        const dx = octavedNoise(t * 8, timeRef.current, 0, chaos) * displacement;
        const dy = octavedNoise(t * 8, timeRef.current, 1, chaos) * displacement;
        if (i === 0) ctx.moveTo(p.x + dx, p.y + dy);
        else ctx.lineTo(p.x + dx, p.y + dy);
      }
      ctx.closePath();
      ctx.stroke();

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    const ro = new ResizeObserver(() => {
      const s = updateSize();
      width = s.width;
      height = s.height;
    });
    ro.observe(container);
    animationRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      ro.disconnect();
    };
  }, [reduced, color, speed, chaos, borderRadius, octavedNoise, roundedRectPoint]);

  return (
    <div
      ref={containerRef}
      className={cn("relative isolate overflow-visible", className)}
      style={{ borderRadius, ...style }}
    >
      {!reduced && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2">
          <canvas ref={canvasRef} className="block" style={{ color }} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]">
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ border: `2px solid ${withAlpha(color, 0.6)}`, filter: "blur(1px)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ border: `2px solid ${color}`, filter: "blur(4px)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-[1] scale-105 rounded-[inherit] opacity-30"
          style={{
            filter: "blur(32px)",
            background: `linear-gradient(-30deg, ${color}, transparent, ${color})`,
          }}
        />
      </div>
      <div className="relative z-[1] rounded-[inherit]">{children}</div>
    </div>
  );
}
