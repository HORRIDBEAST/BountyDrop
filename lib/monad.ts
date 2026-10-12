// lib/monad.ts
//
// Adapted from MicroWorks' lib/monad.ts pattern (see BOUNTYDROP_MASTER_SPEC.md
// Section 1). For this build we target Monad Testnet only, and — unlike the
// three source repos, which each used a different explorer URL
// (testnet.monadexplorer.com / (none, TapPay is off-chain-logged only) /
// testnet.monadvision.com) — we pick ONE canonical explorer and use it
// everywhere: https://testnet.monadexplorer.com. Never mix explorer URLs
// across files.

import { defineChain, http } from "viem";
import { createConfig, injected } from "wagmi";

export const CANONICAL_EXPLORER_URL = "https://testnet.monadexplorer.com";

export const monadTestnet = defineChain({
  id: 10_143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Testnet Explorer",
      url: CANONICAL_EXPLORER_URL,
    },
  },
  testnet: true,
});

let cachedConfig: ReturnType<typeof createConfig> | undefined;

/**
 * Single wagmi config for the app. Memoized so repeated calls (e.g. from
 * providers re-rendering in dev/HMR) don't recreate a new WalletConnect/
 * injected connector instance each time.
 */
export function getConfig() {
  if (cachedConfig) return cachedConfig;
  cachedConfig = createConfig({
    chains: [monadTestnet],
    transports: {
      [monadTestnet.id]: http(),
    },
    connectors: [injected()],
    ssr: true,
  });
  return cachedConfig;
}
