"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import { useNetwork } from "../../lib/network";
import { QUESTESCROW_ABI } from "../../lib/abi";
import { KIND_LABELS } from "../../lib/constants";
import { decodeContractError } from "../../lib/errors";

type TaskStruct = {
  id: bigint;
  creator: `0x${string}`;
  title: string;
  category: string;
  kind: number;
  reward: bigint;
  bounty: bigint;
  completed: bigint;
  frameCount: bigint;
  active: boolean;
};

export default function BusinessDashboardPage() {
  const { address, isConnected } = useAccount();
  const { network } = useNetwork();
  const { writeContract } = useWriteContract();

  const { data: taskCount } = useReadContract({
    address: network.questEscrowAddress,
    abi: QUESTESCROW_ABI,
    chainId: network.chainId,
    functionName: "taskCount",
    query: { refetchInterval: 6000 },
  });

  const count = Number(taskCount ?? 0n);
  const contracts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        address: network.questEscrowAddress,
        abi: QUESTESCROW_ABI,
        chainId: network.chainId,
        functionName: "getTask" as const,
        args: [BigInt(i)] as const,
      })),
    [count, network.questEscrowAddress, network.chainId],
  );

  const { data: taskResults, refetch } = useReadContracts({
    contracts,
    query: { enabled: count > 0, refetchInterval: 6000 },
  });

  const myTasks: TaskStruct[] = (taskResults ?? [])
    .map((r) => (r.status === "success" ? (r.result as unknown as TaskStruct) : null))
    .filter((t): t is TaskStruct => t !== null && !!address && t.creator.toLowerCase() === address.toLowerCase());

  function closeTask(taskId: bigint) {
    writeContract(
      {
        address: network.questEscrowAddress,
        abi: QUESTESCROW_ABI,
        functionName: "closeTask",
        args: [taskId],
      },
      { onSuccess: () => refetch(), onError: (err) => console.error(decodeContractError(err, QUESTESCROW_ABI)) },
    );
  }

  if (!isConnected) {
    return (
      <p className="text-white/60">Connect your wallet to see the quests you've posted.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Business dashboard</p>
          <h1 className="font-display text-2xl font-semibold text-white">Your quests</h1>
        </div>
        <Link
          href="/business/create"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accentSoft"
        >
          + Post a bounty
        </Link>
      </div>

      {myTasks.length === 0 && (
        <p className="text-white/50">You haven't posted any bounties yet.</p>
      )}

      <div className="space-y-3">
        {myTasks.map((t) => (
          <div
            key={t.id.toString()}
            className="glass glass-hover flex items-center justify-between rounded-2xl p-4"
          >
            <div>
              <p className="font-semibold text-white">{t.title}</p>
              <p className="text-xs text-white/40">
                {t.category} · {KIND_LABELS[t.kind]} · {formatEther(t.reward)} MON/frame
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-white/60">
                {t.completed.toString()} / {t.frameCount.toString()} claimed
              </span>
              <span className="text-sm text-white/60">
                {formatEther(t.bounty)} MON left
              </span>
              {t.active ? (
                <button
                  onClick={() => closeTask(t.id)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-red-400 hover:text-red-300"
                >
                  Close & refund
                </button>
              ) : (
                <span className="text-xs font-medium text-red-400">Closed</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
