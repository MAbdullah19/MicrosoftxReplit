/** /join — Turnstile → create passkey → optional invite → backup codes shown
 *  ONCE (§14, spec copy). The invite is a code; a QR is only one transport —
 *  nobody needs two devices. */
import { useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { startRegistration } from "@simplewebauthn/browser";
import { ShieldCheck, KeyRound, Ticket, Copy, Check } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { post, ApiError } from "../lib/api";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "../components/TurnstileWidget";

type Step = "intro" | "invite" | "codes";

export default function Join() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("intro");
  const [inviteCode, setInviteCode] = useState(
    new URLSearchParams(search).get("i") ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ handle: string; tier: number; backupCodes: string[] } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function enrol() {
    setBusy(true);
    setError(null);
    try {
      const options = await post<any>("/api/enrol/begin", {
        turnstileToken: turnstileToken ?? undefined,
      });
      const credential = await startRegistration({ optionsJSON: options });
      const r = await post<{ handle: string; tier: number; backupCodes: string[] }>(
        "/api/enrol/finish",
        { credential, inviteCode: inviteCode.trim() || undefined },
      );
      setResult(r);
      setStep("codes");
    } catch (e) {
      if (e instanceof ApiError) {
        setError(
          e.code === "invite_invalid"
            ? "That invite code is invalid, already used, or expired."
            : e.code === "rate_limited"
              ? STRINGS.errors.rateLimited
              : e.code === "passkey_exists"
                ? "This passkey already has an account. Try signing in instead."
                : "Something went wrong. Please try again.",
        );
      } else {
        setError("Passkey creation was cancelled or is not supported here.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyAll() {
    if (!result) return;
    await navigator.clipboard.writeText(result.backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-brand" aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight">Join {STRINGS.productName}</h1>
        </div>
        <p className="text-base text-muted-fg">{STRINGS.join.noPii}</p>

        {step === "intro" && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-medium flex items-center gap-2">
              <Ticket className="h-5 w-5 text-brand" aria-hidden /> {STRINGS.join.haveInvite}
            </h2>
            <p className="text-sm text-muted-fg">
              An invite lets you vote. Without one you can still post claims and evidence.
              Paste it here or follow the link you were given.
            </p>
            <input
              className="w-full min-h-11 rounded-md border border-border bg-bg px-3 text-base font-mono tracking-wide"
              placeholder="XXXX-XXXX-XXXX-XXXX (optional)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <TurnstileWidget onToken={setTurnstileToken} />
            <button
              className="w-full min-h-11 rounded-md bg-brand text-white text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={enrol}
              disabled={busy || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
            >
              <KeyRound className="h-5 w-5" aria-hidden />
              {busy ? "Waiting for your passkey…" : STRINGS.join.createPasskey}
            </button>
            {error && <p className="text-sm text-bad">{error}</p>}
          </div>
        )}

        {step === "codes" && result && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-medium">
              You are <span className="font-mono">{result.handle}</span>
              {result.tier >= 2 ? " — verified voter" : " — guest (no invite used)"}
            </h2>
            <p className="text-sm text-bad font-medium">
              These backup codes are shown once and never again. They are the only way to
              recover your account.
            </p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm tabular-nums">
              {result.backupCodes.map((c) => (
                <li key={c} className="rounded border border-border px-2 py-1.5">{c}</li>
              ))}
            </ul>
            <button
              className="w-full min-h-11 rounded-md border border-border text-base flex items-center justify-center gap-2"
              onClick={copyAll}
            >
              {copied ? <Check className="h-5 w-5 text-ok" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
              {copied ? "Copied" : "Copy all"}
            </button>
            <label className="flex items-center gap-3 min-h-11 text-base">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
              />
              {STRINGS.join.savedCodes}
            </label>
            <button
              className="w-full min-h-11 rounded-md bg-brand text-white text-base font-medium disabled:opacity-50"
              disabled={!saved}
              onClick={() => navigate("/me")}
            >
              Continue
            </button>
          </div>
        )}

        <p className="text-sm text-muted-fg">
          Already have an account? <Link href="/me" className="text-brand underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
