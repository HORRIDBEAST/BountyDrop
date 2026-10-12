"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useReadContract, useReadContracts } from "wagmi";
import { useNetwork } from "../../lib/network";
import { QUESTESCROW_ABI } from "../../lib/abi";
import { useUserLocation } from "../../hooks/useUserLocation";
import { checkGeofence, fromE7 } from "../../lib/geo/haversine";
import { QuestCard, type QuestCardData } from "../../components/QuestCard";
import type { QuestPin } from "../../components/QuestMap";

const QuestMap = dynamic(
  () => import("../../components/QuestMap").then((mod) => mod.QuestMap),
  { ssr: false },
);

type TaskStruct = {
  id: bigint;
  creator: `0x${string}`;
  title: string;
  description: string;
  category: string;
  kind: number;
  optionCount: number;
  options: readonly string[];
  reward: bigint;
  bounty: bigint;
  completed: bigint;
  rejected: bigint;
  frameCount: bigint;
  active: boolean;
  latE7: bigint;
  lngE7: bigint;
  radiusMeters: number;
};

export default function QuestsPage() {
  const { network } = useNetwork();
  const { coordinates } = useUserLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: taskCount } = useReadContract({
    address: network.questEscrowAddress,
    abi: QUESTESCROW_ABI,
    chainId: network.chainId,
    functionName: "taskCount",
    query: { refetchInterval: 5000 },
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

  const { data: taskResults } = useReadContracts({
    contracts,
    query: { enabled: count > 0, refetchInterval: 5000 },
  });

  const tasks: TaskStruct[] = useMemo(
    () =>
      (taskResults ?? [])
        .map((r) => (r.status === "success" ? (r.result as unknown as TaskStruct) : null))
        .filter((t): t is TaskStruct => t !== null && t.active),
    [taskResults],
  );

  const pins: QuestPin[] = tasks.map((t) => ({
    id: t.id.toString(),
    title: t.title,
    rewardLabel: `${(Number(t.reward) / 1e18).toFixed(4)} MON`,
    coordinates: { latitude: fromE7(t.latE7), longitude: fromE7(t.lngE7) },
    radiusMeters: t.radiusMeters,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="glass h-[420px] overflow-hidden rounded-2xl lg:h-[600px]">
        <QuestMap
          quests={pins}
          userCoordinates={coordinates}
          onSelectQuest={setSelectedId}
        />
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Live on-chain</p>
          <h1 className="font-display text-xl font-semibold text-white">
            {tasks.length} active quest{tasks.length === 1 ? "" : "s"}
          </h1>
        </div>
        {tasks.length === 0 && (
          <p className="text-sm text-white/50">
            No active quests yet. Be the first to{" "}
            <a href="/business/create" className="text-accentSoft hover:underline">
              post a bounty
            </a>
            .
          </p>
        )}
        <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
          {tasks.map((t) => {
            const distanceMeters = coordinates
              ? checkGeofence(
                  coordinates,
                  { latitude: fromE7(t.latE7), longitude: fromE7(t.lngE7) },
                  t.radiusMeters,
                ).distanceMeters
              : undefined;

            const card: QuestCardData = {
              id: t.id,
              title: t.title,
              category: t.category,
              kind: t.kind,
              reward: t.reward,
              frameCount: t.frameCount,
              completed: t.completed,
              active: t.active,
              radiusMeters: t.radiusMeters,
              distanceMeters,
            };

            return (
              <div
                key={t.id.toString()}
                className={selectedId === t.id.toString() ? "ring-2 ring-accent rounded-2xl" : ""}
              >
                <QuestCard quest={card} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
