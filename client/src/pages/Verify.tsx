/** §14.5 — the kill shot.
 *
 *  A stranger with no account and no wallet checks a verdict against the
 *  public blockchain. Steps 2 and 3 run entirely in this browser; step 4
 *  reads the root from the public RPC, NOT from our API. If our server had
 *  lied about any field of the record, the recomputed root would stop
 *  matching the chain and this page would go red — which is why the Tamper
 *  button is a feature and not a debug tool.
 *
 *  Visually this is the page the whole redesign builds toward. The checklist
 *  sits on an adapted Aceternity TracingBeam whose beam fills as each step
 *  passes and turns red at the step that fails; hashes resolve out of noise
 *  with React Bits' DecryptedText; success gets ElectricBorder + Meteors. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "wouter";
import { motion } from "motion/react";
import {
  Check,
  X,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  ExternalLink,
  Bug,
  Download,
  Upload,
} from "lucide-react";
import { leafHash, type VerdictRecord } from "@shared/canonical";
import { verifyProof } from "@shared/merkle";
import { STRINGS } from "@shared/strings";
import { apiGet, ApiError } from "@/lib/api";
import { readAnchorFromChain, contractAddress } from "@/lib/chain";
import { EXPLORER_URL } from "@/lib/explorer";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, FieldLabel } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/controls";
import {
  BackgroundBeams,
  DecryptedText,
  ElectricBorder,
  Meteors,
  TracingBeam,
  TextGenerateEffect,
} from "@/components/fx";
import { cn } from "@/lib/utils";

type VerifyPayload = {
  record: VerdictRecord;
  leaf: string;
  epoch: number;
  index: number;
  proof: string[];
  localRoot: string;
  anchor: {
    status: string;
    merkleRoot: string;
    txHash: string | null;
    blockNumber: number | null;
  } | null;
  chain: { enabled: boolean; contractAddress: string | null; chainId: number; explorer: string };
};

type StepState = "idle" | "running" | "ok" | "fail" | "amber";

type Step = {
  label: string;
  /** One line on what this step actually does, shown while idle. */
  hint: string;
  state: StepState;
  detail?: string;
  /** A hash worth watching resolve — rendered with DecryptedText. */
  hash?: string;
  /** populated on a hash mismatch so the two values sit side by side */
  expected?: string;
  actual?: string;
};

const INITIAL: Step[] = [
  {
    label: "Fetch the signed record",
    hint: "The only thing this page asks our server for.",
    state: "idle",
  },
  {
    label: "Recompute the leaf hash in your browser",
    hint: "Your machine hashes the record itself. This is the step tampering breaks.",
    state: "idle",
  },
  {
    label: "Walk the Merkle proof to a root",
    hint: "A handful of sibling hashes, combined in order, must reach one root.",
    state: "idle",
  },
  {
    label: "Read the anchored root from Base Sepolia",
    hint: "Read straight from the public chain — not from us.",
    state: "idle",
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Highlight the first differing character of two hex strings. */
function HashDiff({ expected, actual }: { expected: string; actual: string }) {
  const at = [...expected].findIndex((ch, i) => ch !== actual[i]);
  const mark = (s: string) =>
    at < 0 ? (
      <span>{s}</span>
    ) : (
      <>
        <span>{s.slice(0, at)}</span>
        <span className="rounded bg-bad/30 px-0.5 font-bold text-bad">{s.slice(at, at + 6)}</span>
        <span>{s.slice(at + 6)}</span>
      </>
    );
  return (
    <div className="well mt-2 space-y-1 overflow-x-auto p-3 font-mono text-xs">
      <div className="break-all">
        <span className="text-muted-fg">expected </span>
        {mark(expected)}
      </div>
      <div className="break-all">
        <span className="text-muted-fg">computed </span>
        {mark(actual)}
      </div>
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  const base = "grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-colors";
  if (state === "ok")
    return (
      <motion.span
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        className={cn(base, "border-ok bg-ok/15 text-ok")}
      >
        <Check className="h-5 w-5" />
      </motion.span>
    );
  if (state === "fail")
    return (
      <span className={cn(base, "border-bad bg-bad/15 text-bad")}>
        <X className="h-5 w-5" />
      </span>
    );
  if (state === "amber")
    return (
      <span className={cn(base, "border-warn bg-warn/15 text-warn")}>
        <TriangleAlert className="h-5 w-5" />
      </span>
    );
  if (state === "running")
    return (
      <span className={cn(base, "border-brand bg-brand/15 text-brand")}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </span>
    );
  return <span className={cn(base, "border-border text-muted-fg")} />;
}

export default function Verify() {
  const search = useSearch();
  const initialId = new URLSearchParams(search).get("claim") ?? "";

  const [claimId, setClaimId] = useState(initialId);
  const [steps, setSteps] = useState<Step[]>(INITIAL);
  const [payload, setPayload] = useState<VerifyPayload | null>(null);
  const [running, setRunning] = useState(false);
  const [tampered, setTampered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setStep = (i: number, patch: Partial<Step>) =>
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  /** Runs steps 2–4 against a record. `data` may hold a tampered record. */
  const runChecks = useCallback(async (data: VerifyPayload, isTampered: boolean) => {
    // 2. Recompute the leaf. This is the step tampering breaks.
    setStep(1, { state: "running" });
    await sleep(320);
    const recomputed = leafHash(data.record);
    if (recomputed !== data.leaf) {
      setStep(1, {
        state: "fail",
        detail: isTampered
          ? "The record was altered, so it no longer hashes to the published leaf."
          : "The record does not hash to the published leaf.",
        expected: data.leaf,
        actual: recomputed,
      });
      return;
    }
    setStep(1, { state: "ok", detail: "Leaf hash", hash: recomputed });

    // 3. Walk the proof.
    setStep(2, { state: "running" });
    await sleep(320);
    const okProof = verifyProof(recomputed, data.proof, data.index, data.localRoot);
    if (!okProof) {
      setStep(2, {
        state: "fail",
        detail: `The proof does not reach the published root (${data.proof.length} sibling hashes, index ${data.index}).`,
      });
      return;
    }
    setStep(2, {
      state: "ok",
      detail: `${data.proof.length} sibling ${data.proof.length === 1 ? "hash" : "hashes"} → root`,
      hash: data.localRoot,
    });

    // 4. The root from the CHAIN, not from our API.
    setStep(3, { state: "running" });
    await sleep(320);
    if (!contractAddress || !data.chain.enabled) {
      setStep(3, { state: "amber", detail: STRINGS.verify.localOnly });
      return;
    }
    try {
      const onChain = await readAnchorFromChain(data.epoch);
      if (!onChain) {
        setStep(3, {
          state: "amber",
          detail: `Epoch ${data.epoch} is not anchored on-chain yet. ${STRINGS.verify.localOnly}`,
        });
        return;
      }
      const chainRoot = onChain.root.replace(/^0x/, "").toLowerCase();
      if (chainRoot !== data.localRoot.toLowerCase()) {
        setStep(3, {
          state: "fail",
          detail: "The root on the blockchain does not match this record's tree.",
          expected: chainRoot,
          actual: data.localRoot,
        });
        return;
      }
      setStep(3, {
        state: "ok",
        detail: `Root matches the anchor for epoch ${data.epoch}.`,
        hash: chainRoot,
      });
    } catch {
      setStep(3, {
        state: "amber",
        detail: "Could not reach the public RPC. Try again, or check your connection.",
      });
    }
  }, []);

  const start = useCallback(
    async (id: string) => {
      if (!id.trim()) return;
      setRunning(true);
      setTampered(false);
      setError(null);
      setSteps(INITIAL);
      setPayload(null);

      setStep(0, { state: "running" });
      await sleep(320);
      try {
        const data = await apiGet<VerifyPayload>(`/verify/${id.trim()}`);
        setPayload(data);
        setStep(0, { state: "ok", detail: `Resolved ${data.record.status} · epoch ${data.epoch}` });
        await runChecks(data, false);
      } catch (e) {
        const code = e instanceof ApiError ? e.code : "unknown_error";
        setStep(0, {
          state: "fail",
          detail:
            code === "not_resolved"
              ? "This claim has not resolved yet, so there is nothing anchored to check."
              : code === "not_found"
                ? "No claim with that ID."
                : "Could not load the record.",
        });
        setError(code);
      } finally {
        setRunning(false);
      }
    },
    [runChecks],
  );

  // Deep link from a claim page: /verify?claim=…
  useEffect(() => {
    if (initialId) void start(initialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The Tamper button (§14.5). Mutates ONE character of the local copy and
   *  re-runs the checks. The record carries no free text — score is the
   *  demo-legible field, so we nudge its last digit. */
  async function tamper() {
    if (!payload) return;
    setRunning(true);
    setTampered(true);
    setSteps((prev) => [prev[0], ...INITIAL.slice(1)]);
    const digits = payload.record.score;
    const last = digits.slice(-1);
    const bumped = digits.slice(0, -1) + (last === "9" ? "8" : String(Number(last) + 1));
    await runChecks({ ...payload, record: { ...payload.record, score: bumped } }, true);
    setRunning(false);
  }

  function downloadCertificate() {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attest-certificate-${payload.record.claimId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onFile(file: File) {
    try {
      const data = JSON.parse(await file.text()) as VerifyPayload;
      if (!data?.record?.claimId) throw new Error("bad file");
      setPayload(data);
      setClaimId(data.record.claimId);
      setTampered(false);
      setSteps([
        { ...INITIAL[0], state: "ok", detail: "Loaded from your file" },
        ...INITIAL.slice(1),
      ]);
      setRunning(true);
      await runChecks(data, false);
      setRunning(false);
    } catch {
      setError("bad_certificate");
    }
  }

  const failed = steps.find((s) => s.state === "fail");
  const amber = steps.some((s) => s.state === "amber");
  const allOk = steps.every((s) => s.state === "ok");

  /** Beam fill: how far down the checklist the proof has actually got. */
  const settled = steps.filter((s) => s.state !== "idle" && s.state !== "running").length;
  const progress = useMemo(() => {
    const failedAt = steps.findIndex((s) => s.state === "fail");
    return (failedAt >= 0 ? failedAt + 1 : settled) / steps.length;
  }, [steps, settled]);
  const beamTone = failed ? "bad" : allOk ? "ok" : amber ? "warn" : "brand";

  return (
    <main className="relative">
      <BackgroundBeams className="opacity-60" />

      <div className="relative mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6">
        {/* ---------------------------------------------------------- Intro */}
        <header className="space-y-3">
          <Badge tone="brand">Trustless check</Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Verify it yourself</h1>
          <TextGenerateEffect
            words="This runs in your browser and reads the blockchain directly — it does not take our word for anything. No account, no wallet, no crypto needed."
            className="max-w-2xl text-base leading-relaxed text-muted-fg sm:text-lg"
          />
        </header>

        {/* ---------------------------------------------------------- Input */}
        <Card variant="glass" pad="lg" className="space-y-4">
          <div className="space-y-2">
            <FieldLabel htmlFor="claim-id">Claim ID</FieldLabel>
            <Input
              id="claim-id"
              value={claimId}
              onChange={(e) => setClaimId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void start(claimId)}
              placeholder="Paste a claim ID"
              className="font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void start(claimId)} disabled={running || !claimId.trim()}>
              {running ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="h-5 w-5" aria-hidden />
              )}
              {running ? "Checking…" : "Check it"}
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={running}>
              <Upload className="h-5 w-5" aria-hidden />
              Load a certificate file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
            />
          </div>
        </Card>

        {/* ------------------------------------------------------- Checklist */}
        <section className="space-y-4">
          <CardTitle className="text-lg">The check, step by step</CardTitle>

          <TracingBeam progress={progress} tone={beamTone}>
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={i}>
                  <Card
                    pad="sm"
                    className={cn(
                      "flex gap-4 transition-colors",
                      s.state === "ok" && "border-ok/30",
                      s.state === "fail" && "border-bad/50 bg-bad/[0.04]",
                      s.state === "amber" && "border-warn/40 bg-warn/[0.03]",
                      s.state === "running" && "border-brand/40",
                      s.state === "idle" && "opacity-60",
                    )}
                  >
                    <StepIcon state={s.state} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p
                        className={cn(
                          "text-base",
                          s.state === "idle" && "text-muted-fg",
                          s.state === "fail" && "font-semibold text-bad",
                          s.state === "ok" && "font-medium text-fg",
                        )}
                      >
                        <span className="tabular text-muted-fg">{i + 1}.</span> {s.label}
                      </p>

                      {s.state === "idle" ? (
                        <p className="text-sm text-muted-fg">{s.hint}</p>
                      ) : (
                        s.detail && <p className="break-words text-sm text-muted-fg">{s.detail}</p>
                      )}

                      {s.hash && (
                        <p className="hash mt-1 text-xs text-ok">
                          <DecryptedText
                            text={s.hash}
                            className="text-ok"
                            encryptedClassName="text-muted-fg"
                            speed={6}
                          />
                        </p>
                      )}

                      {s.expected && s.actual && (
                        <HashDiff expected={s.expected} actual={s.actual} />
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          </TracingBeam>
        </section>

        {/* Verdict banner for the check itself — icon + word + colour (I12). */}
        {failed && (
          <Card
            pad="lg"
            className="animate-[shake_0.4s] border-2 border-bad bg-bad/5 shadow-glow-bad"
          >
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-bad/15">
                <X className="h-7 w-7 text-bad" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-semibold text-bad">
                  {tampered ? "Tampering detected" : "This record does not check out"}
                </p>
                <p className="mt-1 text-base leading-relaxed text-muted-fg">
                  Failed at step {steps.findIndex((s) => s.state === "fail") + 1}: {failed.label}.
                  {tampered && " We changed one digit — and the proof caught it."}
                </p>
              </div>
            </div>
          </Card>
        )}

        {allOk && (
          <ElectricBorder color="hsl(var(--ok))" borderRadius={20} chaos={0.08}>
            <div className="relative overflow-hidden rounded-[20px] border border-ok/30 bg-card p-6">
              <Meteors number={14} />
              <div className="relative flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ok/15">
                  <ShieldCheck className="h-7 w-7 text-ok" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-ok">Verified against the blockchain</p>
                  <p className="mt-1 text-base leading-relaxed text-muted-fg">
                    Your browser recomputed this verdict's hash and matched it to a root published
                    on Base Sepolia. We could not have faked it.
                  </p>
                  {payload?.anchor?.txHash && (
                    <a
                      className="mt-2 inline-flex items-center gap-1.5 text-base text-brand underline-offset-4 hover:underline"
                      href={`${EXPLORER_URL}/tx/${payload.anchor.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      See the transaction <ExternalLink className="h-4 w-4" aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </ElectricBorder>
        )}

        {!failed && amber && (
          <Card pad="lg" className="border-2 border-warn bg-warn/5">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warn/15">
                <TriangleAlert className="h-7 w-7 text-warn" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-semibold text-warn">Checked locally, not yet on-chain</p>
                <p className="mt-1 text-base leading-relaxed text-muted-fg">
                  {STRINGS.verify.localOnly}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* ---------------------------------------------------- The record */}
        {payload && (
          <Card pad="lg" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>The record</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={downloadCertificate}>
                  <Download className="h-4 w-4" aria-hidden /> Certificate
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void tamper()}
                  disabled={running}
                >
                  <Bug className="h-4 w-4" aria-hidden /> {STRINGS.verify.tamper}
                </Button>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-muted-fg">
              Every number here is a fixed 6-decimal string, so the hash is identical in every
              language. Press Tamper to change one digit and watch the check fail.
            </p>

            <div className="relative">
              <CopyButton
                text={JSON.stringify(payload.record, null, 2)}
                className="absolute right-2 top-2 z-10 bg-card"
              />
              <pre className="well max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed text-muted-fg">
                {JSON.stringify(payload.record, null, 2)}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              {payload.chain.contractAddress && (
                <Badge tone="muted" className="font-mono">
                  contract {payload.chain.contractAddress.slice(0, 10)}…
                </Badge>
              )}
              <Badge tone="muted" className="font-mono">
                chain {payload.chain.chainId}
              </Badge>
              <Badge tone="muted" className="font-mono">
                epoch {payload.epoch} · index {payload.index}
              </Badge>
            </div>
          </Card>
        )}

        {error === "bad_certificate" && (
          <p className="text-sm text-bad" role="alert">
            That file is not an Attest certificate.
          </p>
        )}
      </div>
    </main>
  );
}
