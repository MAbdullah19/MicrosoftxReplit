/** Aceternity UI — "Text Generate Effect".
 *  https://ui.aceternity.com/components/text-generate-effect
 *  Ported as-is; the hard-coded `dark:text-white text-black` and font sizing
 *  are dropped so the caller owns typography, which is what makes it reusable
 *  across the hero and the verify intro. */
import { useEffect } from "react";
import { motion, stagger, useAnimate } from "motion/react";
import { cn } from "@/lib/utils";

export function TextGenerateEffect({
  words,
  className,
  filter = true,
  duration = 0.5,
  delay = 0,
}: {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
  delay?: number;
}) {
  const [scope, animate] = useAnimate();
  const wordsArray = words.split(" ");

  useEffect(() => {
    animate(
      "span",
      { opacity: 1, filter: filter ? "blur(0px)" : "none" },
      { duration, delay: stagger(0.08, { startDelay: delay }) },
    );
  }, [scope.current]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.p ref={scope} className={cn(className)}>
      {wordsArray.map((word, idx) => (
        <motion.span
          key={word + idx}
          className="opacity-0"
          style={{ filter: filter ? "blur(10px)" : "none" }}
        >
          {word}{" "}
        </motion.span>
      ))}
    </motion.p>
  );
}
