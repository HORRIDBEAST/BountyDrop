// lib/network.tsx
//
// Adapted from MicroWorks' lib/network.tsx pattern. MicroWorks keyed this by
// network id (testnet/mainnet) because it supported both; BountyDrop targets
// Monad Testnet only for this build, so the "network registry" collapses to
// a single entry, but the Context/useNetwork() shape is kept so a mainnet
// entry can be added later without touching every call site.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSwitchChain } from "wagmi";
import { monadTestnet, CANONICAL_EXPLORER_URL } from "./monad";
import { QUEST_ESCROW_ADDRESS, SPEND_VAULT_ADDRESS } from "./constants";

export type NetworkId = "testnet";

export interface NetworkInfo {
  id: NetworkId;
  label: string;
  shortLabel: string;
  chain: typeof monadTestnet;
  chainId: number;
  questEscrowAddress: `0x${string}`;
  spendVaultAddress: `0x${string}`;
  explorer: string;
  testnet: boolean;
}

export const NETWORKS: Record<NetworkId, NetworkInfo> = {
  testnet: {
    id: "testnet",
    label: "Monad Testnet",
    shortLabel: "TESTNET",
    chain: monadTestnet,
    chainId: monadTestnet.id,
    questEscrowAddress: QUEST_ESCROW_ADDRESS,
    spendVaultAddress: SPEND_VAULT_ADDRESS,
    explorer: CANONICAL_EXPLORER_URL,
    testnet: true,
  },
};

const STORAGE_KEY = "bountydrop-network";

interface NetworkContextValue {
  network: NetworkInfo;
  setNetwork: (id: NetworkId) => void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const { switchChain } = useSwitchChain();
  const [networkId, setNetworkId] = useState<NetworkId>("testnet");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as NetworkId | null;
    if (stored && NETWORKS[stored]) {
      setNetworkId(stored);
    }
  }, []);

  const setNetwork = useCallback(
    (id: NetworkId) => {
      setNetworkId(id);
      window.localStorage.setItem(STORAGE_KEY, id);
      switchChain?.({ chainId: NETWORKS[id].chainId });
    },
    [switchChain],
  );

  const value = useMemo<NetworkContextValue>(
    () => ({ network: NETWORKS[networkId], setNetwork }),
    [networkId, setNetwork],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error("useNetwork() must be used inside <NetworkProvider>");
  }
  return ctx;
}
