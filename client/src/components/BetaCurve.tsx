/** Beta(α, β) posterior density with the 90% credible band (recharts).
 *  Framed as a labelled well, with the score called out beside it — the curve
 *  is the interesting part but the number is what people came for. */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { CountUp } from "@/components/fx";

/** ln Γ via Lanczos — enough precision for a plot. */
function lnGamma(x: number): number {
  const g = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let ser = 1.000000000190015;
  let xx = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  for (let j = 0; j < 6; j++) ser += g[j] / ++xx;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betaPdf(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return 0;
  const lnB = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lnB);
}

export function BetaCurve({
  alpha,
  beta,
  ciLow,
  ciHigh,
  score,
}: {
  alpha: number;
  beta: number;
  ciLow: number | null;
  ciHigh: number | null;
  score: number;
}) {
  const data = Array.from({ length: 101 }, (_, i) => {
    const x = i / 100;
    return { x, y: betaPdf(x, alpha, beta) };
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-fg">Belief that this claim is true</p>
          <p className="tabular mt-0.5 text-3xl font-semibold tracking-tight text-fg">
            <CountUp to={score * 100} decimals={1} suffix="%" duration={1.2} />
          </p>
        </div>
        {ciLow != null && ciHigh != null && (
          <p className="tabular text-sm text-muted-fg">
            90% of the probability lies between{" "}
            <span className="font-medium text-fg">{(ciLow * 100).toFixed(0)}%</span> and{" "}
            <span className="font-medium text-fg">{(ciHigh * 100).toFixed(0)}%</span>
          </p>
        )}
      </div>

      <div
        className="mt-4 h-40 w-full"
        aria-label={`Belief curve, score ${score.toFixed(2)}`}
      >
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="beta-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tickFormatter={(v: number) => `${v * 100}%`}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-fg))" }}
              stroke="hsl(var(--border))"
              tickLine={false}
            />
            <YAxis hide domain={[0, "dataMax"]} />
            {ciLow != null && ciHigh != null && (
              <ReferenceArea x1={ciLow} x2={ciHigh} fill="hsl(var(--brand))" fillOpacity={0.1} />
            )}
            <ReferenceLine x={score} stroke="hsl(var(--brand))" strokeDasharray="4 3" />
            <Area
              type="monotone"
              dataKey="y"
              stroke="hsl(var(--brand))"
              strokeWidth={2}
              fill="url(#beta-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
