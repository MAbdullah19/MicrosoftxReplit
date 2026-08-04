/** React Bits — "Decrypted Text".
 *  https://reactbits.dev/text-animations/decrypted-text
 *  Ported and trimmed: upstream supports four trigger modes and a reversible
 *  toggle. Here it only ever runs forward on view or hover, which is the only
 *  behaviour /verify needs — a hash that resolves out of noise as the check
 *  passes. The scramble character set defaults to hex, so a 64-character
 *  digest never briefly renders as punctuation.
 *
 *  The real text is always in the DOM for assistive tech; only the visible
 *  layer scrambles. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/theme";

const HEX = "0123456789abcdef";

export function DecryptedText({
  text,
  speed = 32,
  maxIterations = 12,
  sequential = true,
  characters = HEX,
  className = "",
  encryptedClassName = "text-muted-fg",
  parentClassName = "",
  animateOn = "view",
}: {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  parentClassName?: string;
  animateOn?: "view" | "hover";
}) {
  const reduced = usePrefersReducedMotion();
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(true);

  const containerRef = useRef<HTMLSpanElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAnimated = useRef(false);

  const availableChars = useMemo(() => characters.split(""), [characters]);

  const shuffle = useCallback(
    (original: string, currentRevealed: Set<number>) =>
      original
        .split("")
        .map((char, i) => {
          if (char === " ") return " ";
          if (currentRevealed.has(i)) return original[i];
          return availableChars[Math.floor(Math.random() * availableChars.length)];
        })
        .join(""),
    [availableChars],
  );

  const trigger = useCallback(() => {
    if (reduced) return;
    setRevealed(new Set());
    setDone(false);
    setIsAnimating(true);
  }, [reduced]);

  useEffect(() => {
    if (!isAnimating) return;
    let iteration = 0;

    intervalRef.current = setInterval(() => {
      setRevealed((prev) => {
        if (sequential) {
          if (prev.size < text.length) {
            const next = new Set(prev);
            next.add(prev.size);
            setDisplayText(shuffle(text, next));
            return next;
          }
          clearInterval(intervalRef.current ?? undefined);
          setIsAnimating(false);
          setDone(true);
          return prev;
        }

        setDisplayText(shuffle(text, prev));
        iteration++;
        if (iteration >= maxIterations) {
          clearInterval(intervalRef.current ?? undefined);
          setIsAnimating(false);
          setDisplayText(text);
          setDone(true);
        }
        return prev;
      });
    }, speed);

    return () => clearInterval(intervalRef.current ?? undefined);
  }, [isAnimating, text, speed, maxIterations, sequential, shuffle]);

  // Re-run whenever the text itself changes — on /verify the hash is different
  // for every claim, and a stale "already animated" flag would freeze it.
  useEffect(() => {
    hasAnimated.current = false;
    setDisplayText(text);
    setRevealed(new Set());
    setDone(true);
    if (animateOn === "view" && !reduced) {
      const t = setTimeout(trigger, 40);
      return () => clearTimeout(t);
    }
  }, [text, animateOn, reduced, trigger]);

  const hoverProps =
    animateOn === "hover"
      ? {
          onMouseEnter: () => {
            if (!isAnimating) trigger();
          },
        }
      : {};

  return (
    <span
      ref={containerRef}
      className={cn("inline-block whitespace-pre-wrap", parentClassName)}
      {...hoverProps}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {displayText.split("").map((char, index) => (
          <span
            key={index}
            className={revealed.has(index) || (!isAnimating && done) ? className : encryptedClassName}
          >
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}
