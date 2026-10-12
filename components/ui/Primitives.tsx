import type { ReactNode } from "react";
import Link from "next/link";

/** Small uppercase eyebrow pill used above section headings, app-wide. */
export function SectionBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white/70">
      <span className="h-1.5 w-1.5 rounded-sm bg-gradient-to-b from-accentSoft to-accent" />
      {children}
    </span>
  );
}

/** Consistent glass-panel card used across quests/business/terminal pages. */
export function GlassCard({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`glass ${hover ? "glass-hover" : ""} rounded-2xl ${className}`}>{children}</div>
  );
}

/** Blurred ambient glow blob — pure CSS, positioned by the caller. */
export function GlowBlob({
  className = "",
  variant = "accent",
}: {
  className?: string;
  variant?: "accent" | "indigo";
}) {
  return (
    <div
      className={`glow-blob ${variant === "accent" ? "bg-glow-radial" : "bg-glow-radial-indigo"} ${className}`}
    />
  );
}

export function PrimaryButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accentSoft active:translate-y-0 ${className}`}
    >
      {children}
    </Link>
  );
}

export function SecondaryButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[0.03] active:translate-y-0 ${className}`}
    >
      {children}
    </Link>
  );
}

/** Headline block: eyebrow badge + tight-tracking display heading. */
export function SectionHeading({
  badge,
  title,
  subtitle,
  align = "left",
}: {
  badge: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <SectionBadge>{badge}</SectionBadge>
      <h2
        className="mt-4 font-display text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl"
        style={{ letterSpacing: "-0.02em" }}
      >
        {title}
      </h2>
      {subtitle && <p className={`mt-3 text-white/60 ${align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl"}`}>{subtitle}</p>}
    </div>
  );
}
