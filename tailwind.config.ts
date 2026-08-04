import type { Config } from "tailwindcss";

/** Keyframes marked "(<library>)" are required by a ported component and are
 *  copied from that library's own tailwind.config — see design-plan.md §3. */
export default {
  darkMode: "class",
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        "bg-soft": "hsl(var(--bg-soft))",
        fg: "hsl(var(--fg))",
        muted: "hsl(var(--muted))",
        "muted-fg": "hsl(var(--muted-fg))",
        border: "hsl(var(--border))",
        "border-hi": "hsl(var(--border-hi))",
        card: "hsl(var(--card))",
        "card-hi": "hsl(var(--card-hi))",
        brand: "hsl(var(--brand))",
        "brand-2": "hsl(var(--brand-2))",
        ring: "hsl(var(--ring))",
        ok: "hsl(var(--ok))",
        warn: "hsl(var(--warn))",
        bad: "hsl(var(--bad))",
      },
      fontFamily: {
        sans: [
          "Inter var",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        card: "0 1px 0 0 hsl(var(--fg) / 0.04) inset, 0 8px 24px -12px rgb(0 0 0 / 0.6)",
        glow: "0 0 0 1px hsl(var(--brand) / 0.35), 0 8px 40px -8px hsl(var(--brand) / 0.45)",
        "glow-ok": "0 0 0 1px hsl(var(--ok) / 0.35), 0 8px 40px -8px hsl(var(--ok) / 0.4)",
        "glow-bad": "0 0 0 1px hsl(var(--bad) / 0.4), 0 8px 40px -8px hsl(var(--bad) / 0.45)",
      },
      keyframes: {
        // (Aceternity — Meteors)
        "meteor-effect": {
          "0%": { transform: "rotate(215deg) translateX(0)", opacity: "1" },
          "70%": { opacity: "1" },
          "100%": {
            transform: "rotate(215deg) translateX(-500px)",
            opacity: "0",
          },
        },
        // (Aceternity — Infinite Moving Cards)
        scroll: {
          to: { transform: "translate(calc(-50% - 0.5rem))" },
        },
        // (React Bits — Star Border)
        "star-movement-bottom": {
          "0%": { transform: "translate(0%, 0%)", opacity: "1" },
          "100%": { transform: "translate(-100%, 0%)", opacity: "0" },
        },
        "star-movement-top": {
          "0%": { transform: "translate(0%, 0%)", opacity: "1" },
          "100%": { transform: "translate(100%, 0%)", opacity: "0" },
        },
        // Local: header underline, skeletons, ambient drift.
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "aurora-drift": {
          "0%, 100%": { transform: "translate3d(-4%, -2%, 0) scale(1)" },
          "50%": { transform: "translate3d(4%, 3%, 0) scale(1.12)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        "meteor-effect": "meteor-effect linear infinite",
        scroll: "scroll var(--animation-duration, 40s) var(--animation-direction, forwards) linear infinite",
        "star-movement-bottom": "star-movement-bottom linear infinite alternate",
        "star-movement-top": "star-movement-top linear infinite alternate",
        shimmer: "shimmer 1.8s infinite",
        "aurora-drift": "aurora-drift 18s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.2, 0.8, 0.4, 1) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
