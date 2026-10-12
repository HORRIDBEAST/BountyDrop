"use client";

// Hand-rolled version of the "letters re-roll through random characters on
// hover" effect — same idea as the Kraken-style ScrambleText, re-implemented
// with plain requestAnimationFrame instead of framer-motion.

import { useEffect, useRef, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function ScrambleText({
  text,
  className,
  duration = 400,
}: {
  text: string;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(text);
  const rafRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  function run() {
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const settleAt = (i + 1) / text.length;
        out += ch === " " || t >= settleAt ? ch : CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      setDisplay(out);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(text);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  return (
    <span
      className={className}
      style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}
      onMouseEnter={run}
    >
      <span aria-hidden className="invisible">
        {text}
      </span>
      <span aria-label={text} style={{ position: "absolute", left: 0, top: 0 }}>
        {display}
      </span>
    </span>
  );
}
