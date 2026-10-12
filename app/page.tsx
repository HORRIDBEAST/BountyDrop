"use client";

import Link from "next/link";
import { Reveal } from "../components/ui/Reveal";
import { useCountUp } from "../components/ui/useCountUp";
import { ScrambleText } from "../components/ui/ScrambleText";
import { SplineHero } from "../components/ui/SplineHero";
import {
  SectionBadge,
  SectionHeading,
  GlassCard,
  GlowBlob,
  PrimaryButton,
  SecondaryButton,
} from "../components/ui/Primitives";

export default function LandingPage() {
  return (
    <div className="space-y-28 pb-20">
      <Hero />
      <HowItWorks />
      <VerificationTracks />
      <SpendTerminalTeaser />
      <FinalCta />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate -mt-6 min-h-[640px] overflow-hidden rounded-3xl border border-white/5 px-6 py-20 sm:px-10 sm:py-28">
      {/* 3D background scene — isolated client component, fails silently to
          the CSS gradient/glow-blob fallback below if it can't load. */}
      <SplineHero />

      <GlowBlob variant="accent" className="-left-24 -top-24 h-72 w-72 animate-drift-slow opacity-40" />
      <GlowBlob variant="indigo" className="-bottom-24 -right-16 h-80 w-80 animate-drift opacity-30" />
      <div className="absolute inset-0 -z-10 bg-grid-fade opacity-30" aria-hidden />
      {/* darken + vignette over the 3D scene so text/glass stay legible */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/20 via-ink/55 to-ink"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <Reveal variant="scale">
          <SectionBadge>Live on Monad Testnet</SectionBadge>
        </Reveal>

        <Reveal delay={80}>
          <h1
            className="mt-6 text-balance font-display text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            Real-world micro-bounties,
            <br />
            <span className="bg-gradient-to-r from-accentSoft via-accent to-indigo2 bg-clip-text text-transparent">
              paid out instantly in MON.
            </span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mx-auto mt-6 max-w-xl text-balance text-white/60">
            Businesses drop bounties tied to a real GPS pin. Workers check in
            on-site, submit proof, and get paid the moment it's verified —
            deterministic answers settle on-chain in one transaction, photo
            proof is judged by an AI vision call.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <PrimaryButton href="/quests">Find quests near me</PrimaryButton>
            <SecondaryButton href="/business/create">Post a bounty</SecondaryButton>
          </div>
        </Reveal>
      </div>

      <Reveal delay={320} variant="scale">
        <div className="relative mx-auto mt-16 max-w-3xl">
          <GlassCard className="grid grid-cols-2 gap-px overflow-hidden sm:grid-cols-4">
            <StatCell label="Chain" value="Monad" suffix=" Testnet" isNumber={false} />
            <StatCell label="Block finality" value={1} suffix="s" />
            <StatCell label="Verification tracks" value={2} />
            <StatCell label="Protocol fee" value={2} suffix="%" />
          </GlassCard>
        </div>
      </Reveal>
    </section>
  );
}

function StatCell({
  label,
  value,
  suffix = "",
  isNumber = true,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  isNumber?: boolean;
}) {
  const { ref, value: animated } = useCountUp(isNumber ? (value as number) : 0, 900);
  return (
    <div className="border-white/5 px-5 py-6 sm:border-l sm:first:border-l-0">
      <p className="font-display text-2xl font-semibold text-white">
        {isNumber ? (
          <>
            <span ref={ref}>{animated}</span>
            {suffix}
          </>
        ) : (
          <>
            {value}
            <span className="text-white/40">{suffix}</span>
          </>
        )}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Drop a bounty",
      body: "Pin a location on the map, set a radius, a reward per submission, and how proof gets judged — an exact answer, or a photo.",
      href: "/business/create",
      cta: "Post a bounty",
    },
    {
      n: "02",
      title: "Check in on-site",
      body: "Workers see live bounty pins on a map, walk into range, and check in with their device's GPS — a UX gate, never a security guarantee.",
      href: "/quests",
      cta: "Browse the map",
    },
    {
      n: "03",
      title: "Get paid instantly",
      body: "Objective answers settle in one transaction via an on-chain hash match. Photos are judged by an AI vision call, verdict and confidence logged on-chain.",
      href: "/quests",
      cta: "See it in action",
    },
  ];

  return (
    <section>
      <Reveal>
        <SectionHeading
          badge="How it works"
          title="Three steps from pin to payout."
          subtitle="No off-chain database decides who gets paid — every claim, every verdict, every transfer is a contract call you can verify on-chain."
        />
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 90}>
            <GlassCard className="group h-full p-6 transition-colors">
              <span className="font-mono2 text-xs text-accent/70">{s.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{s.body}</p>
              <Link
                href={s.href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent"
              >
                <ScrambleText text={s.cta} />
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
            </GlassCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function VerificationTracks() {
  return (
    <section>
      <Reveal>
        <SectionHeading
          badge="Two verification tracks"
          title="Pick how your bounty gets judged."
          subtitle="Same escrow contract, same instant payout — just two different ways to decide who earned it."
        />
      </Reveal>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Reveal delay={0} variant="scale">
          <GlassCard className="h-full p-7">
            <span className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accentSoft">
              Track A · Instant
            </span>
            <h3 className="mt-4 font-display text-xl font-semibold text-white">Golden-key, deterministic</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              For yes/no, multiple-choice, rating, or exact-text answers. The
              business commits a keccak256 "golden answer" on-chain at
              creation. A worker's submission is compared in a single
              transaction — match, and the payout lands in the same call,
              sub-second, with zero review latency.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-white/50">
              <li>→ Is this venue currently open?</li>
              <li>→ What's the listed price on the menu board?</li>
              <li>→ Rate how busy this location is right now</li>
            </ul>
          </GlassCard>
        </Reveal>

        <Reveal delay={90} variant="scale">
          <GlassCard className="h-full p-7">
            <span className="inline-flex rounded-full border border-indigo2/30 bg-indigo/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo2">
              Track B · AI-judged
            </span>
            <h3 className="mt-4 font-display text-xl font-semibold text-white">Photo proof, vision-judged</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              For anything that can't be reduced to one pre-known answer. The
              worker's photo claim is registered on-chain first, then a
              multimodal AI call judges it strictly against the business's
              stated criteria — the verdict and confidence score are logged
              on-chain alongside the payout.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-white/50">
              <li>→ Photograph the shelf — fully stocked, no gaps</li>
              <li>→ Confirm the storefront signage is lit</li>
              <li>→ Show the venue's current line/queue</li>
            </ul>
          </GlassCard>
        </Reveal>
      </div>
    </section>
  );
}

function SpendTerminalTeaser() {
  return (
    <section>
      <Reveal variant="scale">
        <GlassCard className="relative overflow-hidden p-8 sm:p-10" hover={false}>
          <GlowBlob variant="indigo" className="-right-10 -top-10 h-56 w-56 animate-drift opacity-40" />
          <div className="relative grid gap-6 sm:grid-cols-[1.4fr_1fr] sm:items-center">
            <div>
              <SectionBadge>Also on BountyDrop</SectionBadge>
              <h2 className="mt-4 font-display text-2xl font-semibold text-white sm:text-3xl">
                Spend what you earn, locally.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
                The Spend Terminal lets a business or worker grant a
                restricted MON spend policy to a vendor terminal — a capped
                budget, a category, an on-chain merchant allowlist, and an
                optional location check — without ever exposing a private
                key to the terminal itself.
              </p>
            </div>
            <div className="flex sm:justify-end">
              <SecondaryButton href="/terminal">Open the Spend Terminal →</SecondaryButton>
            </div>
          </div>
        </GlassCard>
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="text-center">
      <Reveal variant="scale">
        <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">
          No backend decides who gets paid. The chain does.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-white/60">
          Every quest, every claim, every payout lives on Monad Testnet —
          nothing cached, nothing hidden behind a database.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <PrimaryButton href="/quests">Find quests near me</PrimaryButton>
          <SecondaryButton href="/business/create">Post a bounty</SecondaryButton>
        </div>
      </Reveal>
    </section>
  );
}
