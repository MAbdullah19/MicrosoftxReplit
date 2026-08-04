/** /me — handle, tier, reputation, points; passkey sign-in and backup-code
 *  recovery when logged out (§14). Vote history and invite minting included.
 *
 *  Laid out as a dashboard: identity, then the four numbers that describe your
 *  standing (CountUp so they land rather than appear), then invites, then
 *  every vote you have cast with the score that graded it. */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  KeyRound,
  LogOut,
  ShieldCheck,
  LifeBuoy,
  Ticket,
  TrendingUp,
  Coins,
  Lock,
  LifeBuoy as Buoy,
  TriangleAlert,
} from "lucide-react";
import { STRINGS } from "@shared/strings";
import { SCORING } from "@shared/config";
import { post, ApiError } from "../lib/api";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, FieldLabel } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyButton, Progress, Skeleton } from "@/components/ui/controls";
import { CountUp, GlowingEffect, Reveal, StarBorder } from "@/components/fx";
import { cn } from "@/lib/utils";

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

function StatTile({
  icon: Icon,
  label,
  value,
  decimals = 0,
  sub,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: number;
  decimals?: number;
  sub?: React.ReactNode;
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-4">
      <GlowingEffect spread={30} borderWidth={1} />
      <div className="relative flex items-center gap-2 text-xs uppercase tracking-wider text-muted-fg">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <p className="tabular relative mt-2 text-2xl font-semibold tracking-tight text-fg">
        <CountUp to={value} decimals={decimals} duration={1.2} />
      </p>
      {sub && <div className="relative mt-2">{sub}</div>}
    </div>
  );
}

/** Invite minting (§14.2): T2, reputation ≥ 0.6, under the per-user cap.
 *  The code is shown ONCE — it is never stored in plaintext or logged (I6). */
function InviteMinter({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const remaining = SCORING.INVITE_MINT_PER_USER - me.invitesMinted;
  const eligible =
    me.tier >= 2 && me.reputation >= SCORING.INVITE_MINT_MIN_REP && remaining > 0;

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
    <Card pad="lg" className="space-y-4">
      <div>
        <CardTitle>Invite someone</CardTitle>
        <p className="mt-1 text-sm leading-relaxed text-muted-fg">
          You have {remaining} invite{remaining === 1 ? "" : "s"} left. Codes are shown once — copy
          it before you leave this page.
        </p>
      </div>

      {code ? (
        <div className="space-y-3">
          <p className="tabular hash rounded-xl border border-brand/30 bg-brand/[0.06] p-3 text-base text-fg">
            {code}
          </p>
          <CopyButton text={code} label="Copy code" />
        </div>
      ) : (
        <StarBorder onClick={mint}>
          <Ticket className="h-5 w-5 text-brand" aria-hidden />
          Mint an invite code
        </StarBorder>
      )}

      {err && (
        <p className="text-sm text-bad" role="alert">
          {err}
        </p>
      )}
    </Card>
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
    <Card pad="lg" className="space-y-4">
      <CardTitle>Your votes</CardTitle>

      <ul className="divide-y divide-border">
        {data.votes.map((v) => {
          const graded = v.brier != null;
          const right = graded && v.brier! > 0;
          return (
            <li key={v.claimId} className="space-y-2 py-4 first:pt-0 last:pb-0">
              <Link
                href={`/c/${v.claimId}`}
                className="line-clamp-2 text-base text-fg hover:underline"
              >
                {v.statement}
              </Link>

              <div className="tabular flex flex-wrap items-center gap-2 text-sm text-muted-fg">
                <Badge tone={v.stance === "support" ? "ok" : "bad"} size="sm">
                  said {v.stance === "support" ? "true" : "false"}
                </Badge>
                <span>at {Math.round(v.confidence * 100)}%</span>
                <span aria-hidden>·</span>
                <span>stake {v.stake}</span>
                <span aria-hidden>·</span>
                {graded ? (
                  <span className={cn("font-medium", right ? "text-ok" : "text-bad")}>
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

      <p className="rounded-xl border border-border bg-bg-soft p-3 text-sm leading-relaxed text-muted-fg">
        Δ is the centred Brier score. Hedging at 50% is exactly break-even, so being honest about
        how sure you are is your best strategy — that is a theorem, not a house rule.
      </p>
    </Card>
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

  if (isLoading)
    return (
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-14 sm:px-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </main>
    );

  /* ------------------------------------------------------------ Logged out */
  if (error || !me) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-14 sm:px-6">
        <Reveal distance={12} className="space-y-3 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card">
            <KeyRound className="h-7 w-7 text-brand" aria-hidden />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-base text-muted-fg">
            Your passkey is your account. Nothing else was ever stored.
          </p>
        </Reveal>

        <Button className="w-full" size="lg" onClick={login} disabled={busy}>
          <KeyRound className="h-5 w-5" aria-hidden /> Sign in with your passkey
        </Button>

        {msg && (
          <p className="flex items-start gap-2 text-sm text-bad" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {msg}
          </p>
        )}

        <button
          className="inline-flex min-h-[44px] items-center justify-center gap-2 text-sm text-muted-fg transition-colors hover:text-fg"
          onClick={() => setShowRecovery((v) => !v)}
        >
          <LifeBuoy className="h-4 w-4" aria-hidden />
          Lost your passkey? Use a backup code
        </button>

        {showRecovery && (
          <Card pad="lg" className="space-y-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="handle">Your handle</FieldLabel>
              <Input
                id="handle"
                placeholder="e.g. fox-8813"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="backup">Backup code</FieldLabel>
              <Input
                id="backup"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                className="font-mono"
              />
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={recover}
              disabled={busy || !handle || !backupCode}
            >
              Recover account
            </Button>
          </Card>
        )}

        <p className="text-center text-sm text-muted-fg">
          No account?{" "}
          <Link href="/join" className="text-brand underline-offset-4 hover:underline">
            Join with a passkey
          </Link>
        </p>
      </main>
    );
  }

  /* ------------------------------------------------------------- Logged in */
  const verified = me.tier >= 2;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-14 sm:px-6">
      <Reveal distance={12} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-fg">Your account</p>
          <h1 className="font-mono text-3xl font-semibold tracking-tight">{me.handle}</h1>
        </div>
        <Badge tone={verified ? "ok" : "muted-warn"}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {verified ? "Verified (T2)" : "Guest (T1)"}
        </Badge>
      </Reveal>

      <Reveal distance={12} delay={0.05} className="grid grid-cols-2 gap-3">
        <StatTile
          icon={TrendingUp}
          label="Reputation"
          value={me.reputation}
          decimals={3}
          sub={<Progress value={me.reputation} label="Reputation" />}
        />
        <StatTile icon={Coins} label="Points" value={me.points} />
        <StatTile icon={Lock} label="Staked" value={me.pointsStaked} />
        <StatTile icon={Buoy} label="Backup codes left" value={me.backupRemaining} />
      </Reveal>

      {!verified && (
        <Card className="flex items-start gap-3 border-warn/40 bg-warn/[0.04]">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-fg">
            You are a guest — you can post claims and evidence, but voting needs an invite code.
          </p>
        </Card>
      )}

      <InviteMinter me={me} />
      <VoteHistory />

      <Button variant="secondary" onClick={logout}>
        <LogOut className="h-5 w-5" aria-hidden /> Log out
      </Button>
    </main>
  );
}
