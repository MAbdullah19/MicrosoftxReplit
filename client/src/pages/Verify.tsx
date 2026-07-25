/** §14.5 — the kill shot.
 *
 *  A stranger with no account and no wallet checks a verdict against the
 *  public blockchain. Steps 2 and 3 run entirely in this browser; step 4
 *  reads the root from the public RPC, NOT from our API. If our server had
 *  lied about any field of the record, the recomputed root would stop
 *  matching the chain and this page would go red — which is why the Tamper
 *  button is a feature and not a debug tool. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import {
  Check, X, Loader2, ShieldCheck, TriangleAlert, ExternalLink, Bug, Download,
} from "lucide-react";
import { leafHash, type VerdictRecord } from "@shared/canonical";
import { verifyProof } from "@shared/merkle";
import { STRINGS } from "@shared/strings";
import { apiGet, ApiError } from "@/lib/api";
import { readAnchorFromChain, contractAddress } from "@/lib/chain";
import { EXPLORER_URL } from "@/lib/explorer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  state: StepState;
  detail?: string;
  /** populated on a hash mismatch so the two values sit side by side */
  expected?: string;
  actual?: string;
};

const INITIAL: Step[] = [
  { label: "Fetch the signed record", state: "idle" },
  { label: "Recompute the leaf hash in your browser", state: "idle" },
  { label: "Walk the Merkle proof to a root", state: "idle" },
  { label: "Read the anchored root from Base Sepolia", state: "idle" },
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
    <div className="space-y-1 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
      <div>
        <span className="text-muted-fg">expected </span>
        {mark(expected)}
      </div>
      <div>
        <span className="text-muted-fg">computed </span>
        {mark(actual)}
      </div>
    </div>
  );
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
    await sleep(250);
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
    setStep(1, { state: "ok", detail: `leaf ${recomputed.slice(0, 16)}…` });

    // 3. Walk the proof.
    setStep(2, { state: "running" });
    await sleep(250);
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
      detail: `${data.proof.length} sibling hashes → root ${data.localRoot.slice(0, 16)}…`,
    });

    // 4. The root from the CHAIN, not from our API.
    setStep(3, { state: "running" });
    await sleep(250);
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
      setStep(3, { state: "ok", detail: `Root matches the anchor for epoch ${data.epoch}.` });
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
      await sleep(250);
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
      setSteps([{ ...INITIAL[0], state: "ok", detail: "Loaded from your file" }, ...INITIAL.slice(1)]);
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

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Verify it yourself</h1>
        <p className="text-base text-muted-fg">
          Check a verdict against the public blockchain. This runs in your browser and reads the
          blockchain directly — it does not take our word for anything. No account, no wallet, no
          crypto needed.
        </p>
      </div>

      <Card className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm text-muted-fg">Claim ID</span>
          <Input
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void start(claimId)}
            placeholder="Paste a claim ID"
            aria-label="Claim ID"
            className="font-mono"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void start(claimId)} disabled={running || !claimId.trim()}>
            {running ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
            {running ? "Checking…" : "Check it"}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={running}>
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

      <Card className="space-y-4">
        <h2 className="text-base font-semibold">The check, step by step</h2>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 shrink-0" aria-hidden>
                {s.state === "ok" ? (
                  <Check className="h-6 w-6 text-ok" />
                ) : s.state === "fail" ? (
                  <X className="h-6 w-6 text-bad" />
                ) : s.state === "amber" ? (
                  <TriangleAlert className="h-6 w-6 text-warn" />
                ) : s.state === "running" ? (
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                ) : (
                  <span className="block h-6 w-6 rounded-full border-2 border-border" />
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p
                  className={cn(
                    "text-base",
                    s.state === "idle" && "text-muted-fg",
                    s.state === "fail" && "font-semibold text-bad",
                    s.state === "ok" && "font-medium",
                  )}
                >
                  {i + 1}. {s.label}
                </p>
                {s.detail && <p className="break-words text-sm text-muted-fg">{s.detail}</p>}
                {s.expected && s.actual && (
                  <HashDiff expected={s.expected} actual={s.actual} />
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {/* Verdict banner for the check itself — icon + word + colour (I12). */}
      {failed && (
        <Card className="animate-[shake_0.4s] border-2 border-bad bg-bad/5">
          <div className="flex items-center gap-3">
            <X className="h-8 w-8 shrink-0 text-bad" aria-hidden />
            <div>
              <p className="text-lg font-semibold text-bad">
                {tampered ? "Tampering detected" : "This record does not check out"}
              </p>
              <p className="text-base text-muted-fg">
                Failed at step {steps.findIndex((s) => s.state === "fail") + 1}: {failed.label}.
                {tampered && " We changed one digit — and the proof caught it."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {allOk && (
        <Card className="border-2 border-ok bg-ok/5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 shrink-0 text-ok" aria-hidden />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-ok">Verified against the blockchain</p>
              <p className="text-base text-muted-fg">
                Your browser recomputed this verdict's hash and matched it to a root published on
                Base Sepolia. We could not have faked it.
              </p>
              {payload?.anchor?.txHash && (
                <a
                  className="mt-1 inline-flex items-center gap-1 text-base text-brand underline-offset-2 hover:underline"
                  href={`${EXPLORER_URL}/tx/${payload.anchor.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  See the transaction <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              )}
            </div>
          </div>
        </Card>
      )}

      {!failed && amber && (
        <Card className="border-2 border-warn bg-warn/5">
          <div className="flex items-center gap-3">
            <TriangleAlert className="h-8 w-8 shrink-0 text-warn" aria-hidden />
            <div>
              <p className="text-lg font-semibold text-warn">Checked locally, not yet on-chain</p>
              <p className="text-base text-muted-fg">{STRINGS.verify.localOnly}</p>
            </div>
          </div>
        </Card>
      )}

      {payload && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">The record</h2>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={downloadCertificate}>
                <Download className="h-4 w-4" aria-hidden /> Certificate
              </Button>
              <Button variant="danger" size="sm" onClick={() => void tamper()} disabled={running}>
                <Bug className="h-4 w-4" aria-hidden /> {STRINGS.verify.tamper}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-fg">
            Every number here is a fixed 6-decimal string, so the hash is identical in every
            language. Press Tamper to change one digit and watch the check fail.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
            {JSON.stringify(payload.record, null, 2)}
          </pre>
          {payload.chain.contractAddress && (
            <Badge tone="muted" className="font-mono">
              contract {payload.chain.contractAddress.slice(0, 10)}… · chain{" "}
              {payload.chain.chainId}
            </Badge>
          )}
        </Card>
      )}

      {error === "bad_certificate" && (
        <p className="text-sm text-bad" role="alert">
          That file is not an Attest certificate.
        </p>
      )}
    </main>
  );
}
