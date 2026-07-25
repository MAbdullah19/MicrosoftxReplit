import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        fg: "hsl(var(--fg))",
        muted: "hsl(var(--muted))",
        "muted-fg": "hsl(var(--muted-fg))",
        border: "hsl(var(--border))",
        card: "hsl(var(--card))",
        brand: "hsl(var(--brand))",
        ok: "hsl(var(--ok))",
        warn: "hsl(var(--warn))",
        bad: "hsl(var(--bad))",
      },
    },
  },
  plugins: [],
} satisfies Config;
