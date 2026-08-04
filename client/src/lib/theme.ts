/** Theme + reduced-motion. Both read the DOM/media query rather than holding
 *  state in React, so the inline script in index.html stays the source of
 *  truth for first paint and nothing flashes. */
import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const KEY = "attest-theme";

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function setTheme(next: Theme) {
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.classList.toggle("light", next === "light");
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode — the toggle still works for this session */
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>(getTheme);
  return [
    theme,
    (next: Theme) => {
      setTheme(next);
      set(next);
    },
  ];
}

/** The canvas/WebGL-ish effects (ClickSpark, ElectricBorder, Meteors) cannot
 *  be neutered by the CSS duration override, so they ask here and render
 *  nothing instead (I12). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return reduced;
}
