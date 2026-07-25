/** /me — handle, tier, reputation, points; passkey sign-in and backup-code
 *  recovery when logged out (§14). Vote history and invite minting arrive
 *  with later milestones. */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound, LogOut, ShieldCheck, LifeBuoy } from "lucide-react";
import { STRINGS } from "@shared/strings";
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
