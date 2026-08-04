/** Header, footer and the ambient page backdrop.
 *
 *  The header is frosted and sticky; the active route is marked by a shared
 *  `layoutId` pill (the same motion trick Aceternity's Card Hover Effect uses)
 *  so navigation reads as one object moving rather than four states blinking. */
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "motion/react";
import { Menu, Moon, ShieldCheck, Sun, X } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { GradientText } from "@/components/fx";

const NAV = [
  { href: "/", label: "Check" },
  { href: "/verify", label: "Verify" },
  { href: "/join", label: "Join" },
  { href: "/me", label: "Account" },
];

function isActive(current: string, href: string) {
  if (href === "/") return current === "/" || current.startsWith("/s/") || current.startsWith("/c/");
  return current.startsWith(href);
}

function ThemeToggle() {
  const [theme, set] = useTheme();
  return (
    <button
      type="button"
      onClick={() => set(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-fg transition-colors hover:border-border-hi hover:text-fg"
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5" aria-hidden />
      ) : (
        <Moon className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}

export function Header() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [location]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        scrolled ? "glass border-b border-border" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-card">
            <ShieldCheck className="h-5 w-5 text-brand" aria-hidden />
            <span className="absolute inset-0 rounded-xl bg-brand/20 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
          </span>
          <GradientText className="text-lg font-semibold tracking-tight">
            {STRINGS.productName}
          </GradientText>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(location, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "text-fg" : "text-muted-fg hover:text-fg",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-lg border border-border bg-card-hi"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-fg transition-colors hover:text-fg sm:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border-t border-border sm:hidden"
          aria-label="Main"
        >
          <div className="mx-auto flex max-w-6xl flex-col px-4 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[48px] items-center rounded-lg px-3 text-base transition-colors",
                  isActive(location, item.href)
                    ? "bg-card-hi text-fg"
                    : "text-muted-fg hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </motion.nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-fg sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
          <span className="font-medium text-fg">{STRINGS.productName}</span>
          <span aria-hidden>·</span>
          <span>{STRINGS.tagline}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/verify" className="transition-colors hover:text-fg">
            Verify a verdict
          </Link>
          <Link href="/join" className="transition-colors hover:text-fg">
            Join
          </Link>
          <span className="text-muted-fg/70">No email. No phone. No tracking.</span>
        </div>
      </div>
    </footer>
  );
}

/** Fixed ambient backdrop: a masked dot grid plus two slow brand blooms.
 *  Sits behind everything at z-0 and never intercepts a pointer. */
export function PageBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="dot-grid absolute inset-0" />
      <div className="animate-aurora-drift absolute -left-1/4 -top-1/3 h-[70vh] w-[70vw] rounded-full bg-brand/[0.07] blur-[120px]" />
      <div
        className="animate-aurora-drift absolute -right-1/4 top-1/4 h-[60vh] w-[60vw] rounded-full bg-brand-2/[0.05] blur-[120px]"
        style={{ animationDelay: "-9s" }}
      />
    </div>
  );
}
