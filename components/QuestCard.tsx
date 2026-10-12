"use client";

import Link from "next/link";
import { KIND_LABELS, isTrackB } from "../lib/constants";
import { formatEther } from "viem";

export interface QuestCardData {
  id: bigint;
  title: string;
  category: string;
  kind: number;
  reward: bigint;
  frameCount: bigint;
  completed: bigint;
  active: boolean;
  distanceMeters?: number;
  radiusMeters: number;
}

export function QuestCard({ quest }: { quest: QuestCardData }) {
  const trackB = isTrackB(quest.kind);
  const framesLeft = quest.frameCount - quest.completed;

  return (
    <Link
      href={`/quests/${quest.id.toString()}`}
      className="glass glass-hover block rounded-2xl p-4 transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-semibold text-white">{quest.title}</h3>
          <p className="mt-1 text-xs uppercase tracking-wide text-white/40">
            {quest.category} · {KIND_LABELS[quest.kind] ?? "Unknown"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${
            trackB
              ? "border-indigo/30 bg-indigo/10 text-indigo2"
              : "border-accent/30 bg-accent/10 text-accentSoft"
          }`}
        >
          {trackB ? "AI-judged" : "Instant"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="font-display font-medium text-accentSoft">{formatEther(quest.reward)} MON</span>
        <span className="text-white/50">
          {framesLeft.toString()} of {quest.frameCount.toString()} left
        </span>
      </div>

      {typeof quest.distanceMeters === "number" && (
        <p className="mt-2 text-xs text-white/40">
          {quest.distanceMeters <= quest.radiusMeters
            ? "Within range — check in now"
            : `${Math.round(quest.distanceMeters)}m away · need ${quest.radiusMeters}m`}
        </p>
      )}

      {!quest.active && (
        <p className="mt-2 text-xs font-medium text-red-400">Closed</p>
      )}
    </Link>
  );
}
