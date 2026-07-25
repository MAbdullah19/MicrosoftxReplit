/** Beta(α, β) posterior density with the 90% credible band (recharts). */
import { AreaChart, Area, XAxis, YAxis, ReferenceArea, ReferenceLine, ResponsiveContainer } from "recharts";

/** ln Γ via Lanczos — enough precision for a plot. */
function lnGamma(x: number): number {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
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
    <div className="h-40 w-full" aria-label={`Belief curve, score ${score.toFixed(2)}`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-fg))" }}
            stroke="hsl(var(--border))"
          />
          <YAxis hide domain={[0, "dataMax"]} />
          {ciLow != null && ciHigh != null && (
            <ReferenceArea x1={ciLow} x2={ciHigh} fill="hsl(var(--brand))" fillOpacity={0.12} />
          )}
          <ReferenceLine x={score} stroke="hsl(var(--brand))" strokeDasharray="4 2" />
          <Area
            type="monotone"
            dataKey="y"
            stroke="hsl(var(--brand))"
            fill="hsl(var(--brand))"
            fillOpacity={0.25}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-center text-sm text-muted-fg">
        Belief that the claim is true — the shaded band holds 90% of the probability.
      </p>
    </div>
  );
}
