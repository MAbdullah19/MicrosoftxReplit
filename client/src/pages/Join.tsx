/** /join — Turnstile → create passkey → optional invite → backup codes shown
 *  ONCE (§14, spec copy). The invite is a code; a QR is only one transport —
 *  nobody needs two devices.
 *
 *  The React Bits step rail across the top exists because the backup-code
 *  screen is a one-shot: someone who does not know a third step is coming is
 *  much more likely to close the tab on it. */
import { useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { startRegistration } from "@simplewebauthn/browser";
import { ShieldCheck, KeyRound, Ticket, Check, TriangleAlert } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { post, ApiError } from "../lib/api";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "../components/TurnstileWidget";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, FieldLabel } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/controls";
import { StepRail, Reveal, Spotlight } from "@/components/fx";

const STEPS = ["Invite", "Passkey", "Backup codes"];

export default function Join() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"intro" | "codes">("intro");
  const [inviteCode, setInviteCode] = useState(new URLSearchParams(search).get("i") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    handle: string;
    tier: number;
    backupCodes: string[];
  } | null>(null);
  const [saved, setSaved] = useState(false);
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

  // The rail is 1-based: the passkey ceremony is step 2 while it is in flight.
  const currentStep = step === "codes" ? 3 : busy ? 2 : 1;

  return (
    <main className="relative">
      <Spotlight />
      <div className="relative mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-14 sm:px-6">
        <Reveal distance={12} className="space-y-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card">
            <ShieldCheck className="h-7 w-7 text-brand" aria-hidden />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Join {STRINGS.productName}
          </h1>
          <p className="text-base leading-relaxed text-muted-fg">{STRINGS.join.noPii}</p>
        </Reveal>

        <StepRail steps={STEPS} current={currentStep} />

        {step === "intro" && (
          <Reveal distance={12}>
            <Card pad="lg" className="space-y-5">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-brand" aria-hidden />
                  {STRINGS.join.haveInvite}
                </CardTitle>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-fg">
                  An invite lets you vote. Without one you can still post claims and evidence.
                  Paste it here or follow the link you were given.
                </p>
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="invite">Invite code (optional)</FieldLabel>
                <Input
                  id="invite"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono tracking-wide"
                />
              </div>

              <TurnstileWidget onToken={setTurnstileToken} />

              <Button
                className="w-full"
                size="lg"
                onClick={enrol}
                disabled={busy || (!!TURNSTILE_SITE_KEY && !turnstileToken)}
              >
                <KeyRound className="h-5 w-5" aria-hidden />
                {busy ? "Waiting for your passkey…" : STRINGS.join.createPasskey}
              </Button>

              {error && (
                <p className="flex items-start gap-2 text-sm text-bad" role="alert">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {error}
                </p>
              )}
            </Card>
          </Reveal>
        )}

        {step === "codes" && result && (
          <Reveal distance={12}>
            <Card pad="lg" className="space-y-5 border-warn/40">
              <div>
                <CardTitle>
                  You are <span className="font-mono text-brand">{result.handle}</span>
                </CardTitle>
                <p className="mt-1 text-sm text-muted-fg">
                  {result.tier >= 2 ? "Verified voter (T2)" : "Guest (no invite used)"}
                </p>
              </div>

              <p className="flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/[0.06] p-3 text-sm font-medium leading-relaxed text-warn">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                These backup codes are shown once and never again. They are the only way to recover
                your account.
              </p>

              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {result.backupCodes.map((c) => (
                  <li
                    key={c}
                    className="tabular rounded-lg border border-border bg-bg-soft px-3 py-2 font-mono text-sm"
                  >
                    {c}
                  </li>
                ))}
              </ul>

              <CopyButton
                text={result.backupCodes.join("\n")}
                label="Copy all codes"
                className="w-full justify-center"
              />

              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-base transition-colors hover:border-border-hi">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[hsl(var(--brand))]"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                />
                {STRINGS.join.savedCodes}
              </label>

              <Button className="w-full" size="lg" disabled={!saved} onClick={() => navigate("/me")}>
                <Check className="h-5 w-5" aria-hidden />
                Continue
              </Button>
            </Card>
          </Reveal>
        )}

        <p className="text-center text-sm text-muted-fg">
          Already have an account?{" "}
          <Link href="/me" className="text-brand underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
