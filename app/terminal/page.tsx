"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import { useNetwork } from "../../lib/network";
import { SPENDVAULT_ABI } from "../../lib/abi";
import { decodeContractError } from "../../lib/errors";
import { useUserLocation } from "../../hooks/useUserLocation";
import { toE7 } from "../../lib/geo/haversine";
import { SpendTerminalKeypad } from "../../components/SpendTerminalKeypad";

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

export default function SpendTerminalPage() {
  const { address, isConnected } = useAccount();
  const { network } = useNetwork();
  const { coordinates, start: startLocation } = useUserLocation({ autoStart: false });

  const [amount, setAmount] = useState("0");
  const [merchant, setMerchant] = useState<`0x${string}` | "">("");
  const [orderId, setOrderId] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState<`0x${string}` | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: policyCount } = useReadContract({
    address: network.spendVaultAddress,
    abi: SPENDVAULT_ABI,
    chainId: network.chainId,
    functionName: "policyCount",
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

  const { data: policyResults, refetch: refetchPolicies } = useReadContracts({
    contracts: policyContracts,
    query: { enabled: policyIds.length > 0, refetchInterval: 6000 },
  });

  const myPolicies = policyIds
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
    .filter((p): p is { id: `0x${string}`; policy: PolicyView } => p !== null)
    .filter((p) => !!address && p.policy.agent.toLowerCase() === address.toLowerCase());

  const selected = myPolicies.find((p) => p.id === selectedPolicyId) ?? myPolicies[0] ?? null;

  useEffect(() => {
    if (selected && !selectedPolicyId) setSelectedPolicyId(selected.id);
    // Only request GPS when the selected policy actually needs it.
    if (selected?.policy.geofenced) startLocation();
  }, [selected, selectedPolicyId, startLocation]);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { data: receipt, isLoading: confirming } = useWaitForTransactionReceipt({ hash });

  function handleSpend() {
    if (!selected) return;
    setErrorMessage(null);

    const amt = Number.parseFloat(amount || "0");
    if (!amt || amt <= 0) {
      setErrorMessage("Enter an amount greater than zero.");
      return;
    }
    if (!merchant) {
      setErrorMessage("Choose a merchant from this policy's allowlist.");
      return;
    }

    const spendLatE7 = selected.policy.geofenced && coordinates ? toE7(coordinates.latitude) : 0n;
    const spendLngE7 = selected.policy.geofenced && coordinates ? toE7(coordinates.longitude) : 0n;

    writeContract(
      {
        address: network.spendVaultAddress,
        abi: SPENDVAULT_ABI,
        functionName: "spend",
        args: [selected.id, merchant, parseEther(amount), selected.policy.category, orderId || "n/a", spendLatE7, spendLngE7],
      },
      {
        onSuccess: () => refetchPolicies(),
        onError: (err) => setErrorMessage(decodeContractError(err, SPENDVAULT_ABI).message),
      },
    );
  }

  if (!isConnected) {
    return <p className="text-white/60">Connect the terminal wallet to redeem a spend policy.</p>;
  }

  if (myPolicies.length === 0) {
    return (
      <p className="text-white/60">
        No spend policies have been granted to this wallet yet. Ask the vault
        owner to grant one from{" "}
        <Link href="/business/vault" className="text-accentSoft hover:underline">
          the Spend Vault management page
        </Link>
        .
      </p>
    );
  }

  const remaining = selected ? selected.policy.amountLimit - selected.policy.spent : 0n;
  const busy = isPending || confirming;

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Redeem a spend policy</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">Spend Terminal</h1>
      </div>

      <div>
        <label className="text-sm text-white/70">Policy</label>
        <select
          value={selected?.id ?? ""}
          onChange={(e) => setSelectedPolicyId(e.target.value as `0x${string}`)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
        >
          {myPolicies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.policy.category} — {formatEther(p.policy.amountLimit - p.policy.spent)} MON left
              {p.policy.geofenced ? " · geofenced" : ""}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          <div>
            <label className="text-sm text-white/70">Merchant (from this policy's allowlist)</label>
            <select
              value={merchant}
              onChange={(e) => setMerchant(e.target.value as `0x${string}`)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
            >
              <option value="">Select a merchant</option>
              {selected.policy.allowedMerchants.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/70">Order reference (optional)</label>
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. table 4"
              className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
            />
          </div>

          <SpendTerminalKeypad value={amount} onChange={setAmount} />

          <p className="text-xs text-white/40">
            {formatEther(remaining)} MON remaining on this policy
            {selected.policy.geofenced &&
              (coordinates
                ? " · using live device location for the merchant geofence check"
                : " · this policy requires location — enable GPS before confirming")}
          </p>

          {errorMessage && (
            <p className="rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{errorMessage}</p>
          )}
          {receipt && (
            <p className="rounded-lg bg-accent/15 p-3 text-sm text-accent">Payment sent.</p>
          )}

          <button
            onClick={handleSpend}
            disabled={busy}
            className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accentSoft disabled:translate-y-0 disabled:opacity-50"
          >
            {busy ? "Confirming..." : "Confirm redemption"}
          </button>
        </>
      )}
    </div>
  );
}
