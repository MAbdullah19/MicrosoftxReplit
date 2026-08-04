import { Link } from "wouter";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackgroundBeams, BlurText } from "@/components/fx";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-6">
      <BackgroundBeams className="opacity-50" />
      <div className="relative flex flex-col items-center gap-5 text-center">
        <span className="text-7xl font-semibold tracking-tight text-muted-fg/40">404</span>
        <BlurText
          as="h1"
          text="Page not found"
          animateBy="letters"
          delay={30}
          className="justify-center text-3xl font-semibold tracking-tight sm:text-4xl"
        />
        <p className="max-w-sm text-base text-muted-fg">
          This page does not exist. The verdicts, however, are still where you left them.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/">
            <Button>
              <ArrowLeft className="h-5 w-5" aria-hidden /> Back to search
            </Button>
          </Link>
          <Link href="/verify">
            <Button variant="secondary">
              <ShieldCheck className="h-5 w-5" aria-hidden /> Verify a verdict
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
