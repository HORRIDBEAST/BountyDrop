"use client";

// components/VaultPoliciesList.tsx
//
// Read-only overview (+ revoke) of every policy ever granted on this
// SpendVault, plus its live balance. No Leaflet here, so — unlike
// VaultManagerForm — this is safe to render directly, no dynamic/ssr:false
// import needed.

import { useMemo } from "react";
import { useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import { useNetwork } from "../lib/network";
import { SPENDVAULT_ABI } from "../lib/abi";
import { decodeContractError } from "../lib/errors";

type PolicyView = {
  agent: `0x${string}`;
  amountLimit: bigint;
  spent: bigint;
  category: string;
  allowedMerchants: readonly `0x${string}`[];
  expiry: bigint;
  singleUse: boolean;
  used: boolean;
  active: boolean;
  geofenced: boolean;
};

function shorten(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function VaultPoliciesList() {
  const { network } = useNetwork();
  const { writeContract } = useWriteContract();

  const { data: vaultBalance } = useReadContract({
    address: network.spendVaultAddress,
    abi: SPENDVAULT_ABI,
    chainId: network.chainId,
    functionName: "vaultBalance",
    query: { refetchInterval: 6000 },
  });

  const { data: policyCount } = useReadContract({
    address: network.spendVaultAddress,
    abi: SPENDVAULT_ABI,
    chainId: network.chainId,
    functionName: "policyCount",
    query: { refetchInterval: 6000 },
  });

  const count = Number(policyCount ?? 0n);
  const idContracts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        address: network.spendVaultAddress,
        abi: SPENDVAULT_ABI,
        chainId: network.chainId,
        functionName: "policyIdAt" as const,
        args: [BigInt(i)] as const,
      })),
    [count, network.spendVaultAddress, network.chainId],
  );

  const { data: idResults } = useReadContracts({ contracts: idContracts, query: { enabled: count > 0 } });
  const policyIds = (idResults ?? [])
    .map((r) => (r.status === "success" ? (r.result as `0x${string}`) : null))
    .filter((id): id is `0x${string}` => id !== null);

  const policyContracts = useMemo(
    () =>
      policyIds.map((id) => ({
        address: network.spendVaultAddress,
        abi: SPENDVAULT_ABI,
        chainId: network.chainId,
        functionName: "getPolicy" as const,
        args: [id] as const,
      })),
    [policyIds, network.spendVaultAddress, network.chainId],
  );

  const { data: policyResults, refetch } = useReadContracts({
    contracts: policyContracts,
    query: { enabled: policyIds.length > 0, refetchInterval: 6000 },
  });

  const policies = policyIds
    .map((id, i) => {
      const result = policyResults?.[i];
      if (result?.status !== "success") return null;
      const [agent, amountLimit, spent, category, allowedMerchants, expiry, singleUse, used, active, geofenced] =
        result.result as unknown as [
          `0x${string}`,
          bigint,
          bigint,
          string,
          readonly `0x${string}`[],
          bigint,
          boolean,
          boolean,
          boolean,
          boolean,
        ];
      return {
        id,
        policy: { agent, amountLimit, spent, category, allowedMerchants, expiry, singleUse, used, active, geofenced } as PolicyView,
      };
    })
    .filter((p): p is { id: `0x${string}`; policy: PolicyView } => p !== null);

  function revoke(policyId: `0x${string}`) {
    writeContract(
      {
        address: network.spendVaultAddress,
        abi: SPENDVAULT_ABI,
        functionName: "revokePermission",
        args: [policyId],
      },
      {
        onSuccess: () => refetch(),
        onError: (err) => console.error(decodeContractError(err, SPENDVAULT_ABI)),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass flex items-center justify-between rounded-xl p-4">
        <span className="text-sm text-white/60">Vault balance</span>
        <span className="font-display font-semibold text-accentSoft">
          {vaultBalance !== undefined ? formatEther(vaultBalance) : "..."} MON
        </span>
      </div>

      {policies.length === 0 ? (
        <p className="text-sm text-white/50">No policies granted yet.</p>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => (
            <div key={p.id} className="glass glass-hover rounded-xl p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono2 text-xs text-white/40">{shorten(p.id)}</p>
                  <p className="mt-1 text-white">
                    {shorten(p.policy.agent)} · {p.policy.category}
                    {p.policy.geofenced && " · geofenced"}
                  </p>
                </div>
                {p.policy.active ? (
                  <button
                    onClick={() => revoke(p.id)}
                    className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-red-400 hover:text-red-300"
                  >
                    Revoke
                  </button>
                ) : (
                  <span className="shrink-0 text-xs font-medium text-red-400">
                    {p.policy.used ? "Used" : "Revoked"}
                  </span>
                )}
              </div>
              <p className="mt-2 text-white/50">
                {formatEther(p.policy.amountLimit - p.policy.spent)} / {formatEther(p.policy.amountLimit)} MON left
                {p.policy.singleUse && " · single-use"}
                {p.policy.expiry > 0n &&
                  ` · expires ${new Date(Number(p.policy.expiry) * 1000).toLocaleDateString()}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
