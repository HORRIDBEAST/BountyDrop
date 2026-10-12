"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnectButton } from "./WalletConnectButton";
import { ScrambleText } from "./ui/ScrambleText";

const links = [
  { href: "/quests", label: "Find quests" },
  { href: "/business", label: "Business" },
  { href: "/terminal", label: "Spend terminal" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5 font-display font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accentSoft to-accent text-sm transition-transform duration-200 group-hover:scale-105">
            📍
          </span>
          <span className="text-[15px] tracking-tight">BountyDrop</span>
          <span className="rounded-full border border-indigo/30 bg-indigo/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo2">
            Monad Testnet
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          {links.map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative py-1 transition-colors ${
                  active ? "text-white" : "text-white/60 hover:text-white"
                }`}
              >
                <ScrambleText text={l.label} />
                {active && (
                  <span className="absolute -bottom-[14px] left-0 right-0 h-px bg-gradient-to-r from-accentSoft to-accent" />
                )}
              </Link>
            );
          })}
          <WalletConnectButton />
        </nav>
      </div>
    </header>
  );
}
