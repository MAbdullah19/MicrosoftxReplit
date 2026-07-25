/** /me — handle, tier, reputation, points; passkey sign-in and backup-code
 *  recovery when logged out (§14). Vote history and invite minting arrive
 *  with later milestones. */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound, LogOut, ShieldCheck, LifeBuoy, Ticket } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { SCORING } from "@shared/config";
import { post, ApiError } from "../lib/api";

interface Me {
  handle: string;
  tier: number;
  reputation: number;
  points: number;
  pointsStaked: number;
  invitesMinted: number;
  backupRemaining: number;
  createdAt: string;
}

interface PastVote {
  claimId: string;
  statement: string;
  status: string;
  stance: "support" | "refute";
  confidence: number;
  stake: number;
  brier: number | null;
  settledAt: string | null;
  createdAt: string;
}

/** Invite minting (§14.2): T2, reputation ≥ 0.6, under the per-user cap.
 *  The code is shown ONCE — it is never stored in plaintext or logged (I6). */
function InviteMinter({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const eligible =
    me.tier >= 2 &&
    me.reputation >= SCORING.INVITE_MINT_MIN_REP &&
    me.invitesMinted < SCORING.INVITE_MINT_PER_USER;

  if (!eligible) return null;

  async function mint() {
    setErr(null);
    try {
      const r = await post<{ code: string }>("/api/invites/mint");
      setCode(r.code);
      await qc.invalidateQueries({ queryKey: ["/auth/me"] });
    } catch (e) {
      setErr(
        e instanceof ApiError && e.code === "reputation_too_low"
          ? "Your reputation is not high enough yet."
          : "Could not mint an invite.",
      );
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-3">
      <h2 className="text-base font-semibold">Invite someone</h2>
      <p className="text-sm text-muted-fg">
        You have {SCORING.INVITE_MINT_PER_USER - me.invitesMinted} invite
        {SCORING.INVITE_MINT_PER_USER - me.invitesMinted === 1 ? "" : "s"} left. Codes are shown
        once — copy it before you leave this page.
      </p>
      {code ? (
        <div className="space-y-2">
          <p className="rounded-md bg-muted p-3 font-mono text-base break-all tabular-nums">{code}</p>
          <button
            className="min-h-11 rounded-md border border-border px-4 text-sm"
            onClick={() => void navigator.clipboard.writeText(code)}
          >
            Copy code
          </button>
        </div>
      ) : (
        <button className="min-h-11 rounded-md bg-brand px-4 text-base text-white" onClick={mint}>
          <Ticket className="inline h-5 w-5 mr-2" aria-hidden />
          Mint an invite code
        </button>
      )}
      {err && <p className="text-sm text-bad">{err}</p>}
    </div>
  );
}

/** Past votes with the outcome and the centred Brier delta that graded it. */
function VoteHistory() {
  const { data } = useQuery<{ votes: PastVote[] }>({
    queryKey: ["/auth/me/votes"],
    retry: false,
  });
  if (!data || data.votes.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-3">
      <h2 className="text-base font-semibold">Your votes</h2>
      <ul className="divide-y divide-border">
        {data.votes.map((v) => {
          const graded = v.brier != null;
          const right = graded && v.brier! > 0;
          return (
            <li key={v.claimId} className="py-3 space-y-1">
              <Link href={`/c/${v.claimId}`} className="text-base hover:underline line-clamp-2">
                {v.statement}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-fg tabular-nums">
                <span>
                  You said <strong className="text-fg">{v.stance === "support" ? "true" : "false"}</strong> at{" "}
                  {Math.round(v.confidence * 100)}%
                </span>
                <span>·</span>
                <span>stake {v.stake}</span>
                <span>·</span>
                {graded ? (
                  <span className={right ? "text-ok" : "text-bad"}>
                    {v.status === "verified" ? "Resolved true" : "Resolved false"} · Δ{" "}
                    {v.brier! >= 0 ? "+" : "−"}
                    {Math.abs(v.brier!).toFixed(3)}
                  </span>
                ) : v.settledAt ? (
                  <span>Unresolved — stake returned, reputation untouched</span>
                ) : (
                  <span>Still open</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-fg">
        Δ is the centred Brier score. Hedging at 50% is exactly break-even, so being honest about
        how sure you are is your best strategy — that is a theorem, not a house rule.
      </p>
    </div>
  );
}

export default function MePage() {
  const qc = useQueryClient();
  const { data: me, isLoading, error } = useQuery<Me>({ queryKey: ["/auth/me"], retry: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [handle, setHandle] = useState("");
  const [backupCode, setBackupCode] = useState("");

  async function login() {
    setBusy(true);
    setMsg(null);
    try {
      const options = await post<any>("/api/auth/begin");
      const credential = await startAuthentication({ optionsJSON: options });
      await post("/api/auth/finish", { credential });
      await qc.invalidateQueries({ queryKey: ["/auth/me"] });
    } catch (e) {
      setMsg(
        e instanceof ApiError
          ? e.code === "counter_regression"
            ? "This passkey looks cloned — sign-in refused."
            : "Sign-in failed. Unknown passkey?"
          : "Passkey sign-in was cancelled.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function recover() {
    setBusy(true);
    setMsg(null);
    try {
      await post("/api/auth/recover", { handle, backupCode });
      await qc.invalidateQueries({ queryKey: ["/auth/me"] });
    } catch {
      setMsg("Recovery failed — check the handle and code. Each code works once.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await post("/api/auth/logout");
    await qc.invalidateQueries({ queryKey: ["/auth/me"] });
  }

  if (isLoading) return <main className="min-h-screen grid place-items-center text-muted-fg">Loading…</main>;

  if (error || !me) {
    return (
      <main className="min-h-screen flex flex-col items-center px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <button
            className="w-full min-h-11 rounded-md bg-brand text-white text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={login}
            disabled={busy}
          >
            <KeyRound className="h-5 w-5" aria-hidden /> Sign in with your passkey
          </button>
          {msg && <p className="text-sm text-bad">{msg}</p>}
          <button
            className="text-sm text-muted-fg underline min-h-11"
            onClick={() => setShowRecovery((v) => !v)}
          >
            <LifeBuoy className="inline h-4 w-4 mr-1" aria-hidden />
            Lost your passkey? Use a backup code
          </button>
          {showRecovery && (
            <div className="rounded-lg border border-border bg-card p-6 space-y-3">
              <input
                className="w-full min-h-11 rounded-md border border-border bg-bg px-3 text-base font-mono"
                placeholder="your handle, e.g. fox-8813"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
              <input
                className="w-full min-h-11 rounded-md border border-border bg-bg px-3 text-base font-mono"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
              />
              <button
                className="w-full min-h-11 rounded-md border border-border text-base disabled:opacity-50"
                onClick={recover}
                disabled={busy || !handle || !backupCode}
              >
                Recover account
              </button>
            </div>
          )}
          <p className="text-sm text-muted-fg">
            No account? <Link href="/join" className="text-brand underline">Join with a passkey</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight font-mono">{me.handle}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm">
            <ShieldCheck className={`h-4 w-4 ${me.tier >= 2 ? "text-ok" : "text-muted-fg"}`} aria-hidden />
            {me.tier >= 2 ? "Verified (T2)" : "Guest (T1)"}
          </span>
        </div>
        <dl className="rounded-lg border border-border bg-card p-6 grid grid-cols-2 gap-4 tabular-nums">
          <div><dt className="text-sm text-muted-fg">Reputation</dt><dd className="text-base font-medium">{me.reputation.toFixed(3)}</dd></div>
          <div><dt className="text-sm text-muted-fg">Points</dt><dd className="text-base font-medium">{me.points}</dd></div>
          <div><dt className="text-sm text-muted-fg">Staked</dt><dd className="text-base font-medium">{me.pointsStaked}</dd></div>
          <div><dt className="text-sm text-muted-fg">Backup codes left</dt><dd className="text-base font-medium">{me.backupRemaining}</dd></div>
        </dl>
        {me.tier < 2 && (
          <p className="text-sm text-muted-fg">
            You are a guest — you can post claims and evidence, but voting needs an invite code.
          </p>
        )}

        <InviteMinter me={me} />
        <VoteHistory />

        <button
          className="min-h-11 rounded-md border border-border px-4 text-base flex items-center gap-2"
          onClick={logout}
        >
          <LogOut className="h-5 w-5" aria-hidden /> Log out
        </button>
      </div>
    </main>
  );
}
