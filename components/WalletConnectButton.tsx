"use client";

// Raw wagmi useConnect/injected(), same as MicroWorks — no RainbowKit. See
// BOUNTYDROP_MASTER_SPEC.md Section 1: RainbowKit was a dead dependency in
// the source repo, never actually wired up.

import { useAccount, useConnect, useDisconnect } from "wagmi";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="rounded-full border border-white/10 bg-panel px-4 py-2 text-sm font-medium text-white/90 hover:border-white/20"
        title="Disconnect wallet"
      >
        {shortenAddress(address)}
      </button>
    );
  }

  const injectedConnector = connectors.find((c) => c.id === "injected") ?? connectors[0];

  return (
    <button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={isPending || !injectedConnector}
      className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accentMuted disabled:opacity-50"
    >
      {isPending ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
