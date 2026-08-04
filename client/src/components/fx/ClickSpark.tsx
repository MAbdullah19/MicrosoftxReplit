/** React Bits — "Click Spark".
 *  https://reactbits.dev/animations/click-spark
 *  Ported as-is (canvas, rAF loop, eased radial lines). Two changes: it listens
 *  on the window rather than a wrapper div so it can sit at the app root
 *  without becoming a click target itself, and it renders nothing under
 *  `prefers-reduced-motion` — a canvas cannot be neutered by the CSS duration
 *  override the way a transition can. */
import { useCallback, useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/theme";

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

export function ClickSpark({
  sparkColor = "hsl(var(--brand))",
  sparkSize = 9,
  sparkRadius = 16,
  sparkCount = 8,
  duration = 420,
  easing = "ease-out",
  extraScale = 1,
}: {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  extraScale?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const reduced = usePrefersReducedMotion();

  const easeFunc = useCallback(
    (t: number) => {
      switch (easing) {
        case "linear":
          return t;
        case "ease-in":
          return t * t;
        case "ease-in-out":
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing],
  );

  useEffect(() => {
    if (reduced) return;
    // Bound to a const the hoisted `draw` below can see as non-null; reading
    // canvasRef.current inside it would lose the narrowing.
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) return;
    const el = canvas;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    let animationId = 0;
    let idle = true;

    // Upstream runs the rAF loop forever, clearing the whole canvas every
    // frame even with nothing on it. This is mounted app-wide, so it only
    // spins while sparks are alive and parks itself again once they expire.
    const wake = () => {
      if (!idle) return;
      idle = false;
      animationId = requestAnimationFrame(draw);
    };

    // Sparks land where the click did, in viewport coordinates — the canvas is
    // fixed, so no scroll offset is involved.
    const onClick = (e: MouseEvent) => {
      const now = performance.now();
      sparksRef.current.push(
        ...Array.from({ length: sparkCount }, (_, i) => ({
          x: e.clientX,
          y: e.clientY,
          angle: (2 * Math.PI * i) / sparkCount,
          startTime: now,
        })),
      );
      wake();
    };
    window.addEventListener("click", onClick);

    function draw(timestamp: number) {
      if (ctx) {
        ctx.clearRect(0, 0, el.width, el.height);
        // Resolve the CSS variable once per frame: the colour has to follow the
        // theme toggle, and getComputedStyle on the canvas gives us the value.
        const stroke = getComputedStyle(el).color;

        sparksRef.current = sparksRef.current.filter((spark) => {
          const elapsed = timestamp - spark.startTime;
          if (elapsed >= duration) return false;

          const eased = easeFunc(elapsed / duration);
          const distance = eased * sparkRadius * extraScale;
          const lineLength = sparkSize * (1 - eased);

          const x1 = spark.x + distance * Math.cos(spark.angle);
          const y1 = spark.y + distance * Math.sin(spark.angle);
          const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
          const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

          ctx.strokeStyle = stroke;
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          return true;
        });
      }

      if (sparksRef.current.length === 0) {
        idle = true;
        return;
      }
      animationId = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("click", onClick);
    };
  }, [reduced, sparkCount, duration, easeFunc, sparkRadius, sparkSize, extraScale]);

  if (reduced) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ color: sparkColor }}
      className="pointer-events-none fixed inset-0 z-[100]"
    />
  );
}
