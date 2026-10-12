"use client";

// Lightweight scroll-reveal primitive — pure IntersectionObserver + CSS
// transitions (see .reveal / .reveal-scale in globals.css). Deliberately NOT
// framer-motion: this project avoids adding new npm dependencies this close
// to a deadline, and CSS transitions get ~95% of the same "premium" feel for
// zero install risk.

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** ms delay before the transition starts, once in view. */
  delay?: number;
  /** "up" = slide up + fade (default), "scale" = pop in from 94% scale + fade. */
  variant?: "up" | "scale";
  className?: string;
}

export function Reveal({ children, delay = 0, variant = "up", className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isIn, setIsIn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${variant === "scale" ? "reveal-scale" : "reveal"} ${isIn ? "is-in" : ""} ${className}`}
      style={{ ["--reveal-delay" as string]: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
