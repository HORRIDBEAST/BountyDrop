"use client";

// components/BusinessQuestCreatorForm.tsx
//
// This component itself uses react-leaflet (for the GPS pin picker), so —
// like QuestMap.tsx — it must be dynamically imported with { ssr: false }
// wherever it's used. See app/business/create/page.tsx.

import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { parseEther } from "viem";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useNetwork } from "../lib/network";
import { QUESTESCROW_ABI } from "../lib/abi";
import {
  KIND_OPTIONS,
  KIND_YESNO,
  KIND_RATING,
  KIND_TEXT,
  KIND_PHOTO,
  QUEST_CATEGORIES,
} from "../lib/constants";
import { toE7 } from "../lib/geo/haversine";
import { optionAnswerHash, textAnswerHash } from "../lib/answers";
import { decodeContractError } from "../lib/errors";

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006];

const pinIcon = L.icon({
  iconUrl: "/map/quest-marker-active.svg",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

function LocationPicker({
  position,
  onPick,
}: {
  position: [number, number];
  onPick: (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return <Marker position={position} icon={pinIcon} />;
}

type Kind = typeof KIND_OPTIONS | typeof KIND_YESNO | typeof KIND_RATING | typeof KIND_TEXT | typeof KIND_PHOTO;

export function BusinessQuestCreatorForm() {
  const { network } = useNetwork();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(QUEST_CATEGORIES[0]);
  const [kind, setKind] = useState<Kind>(KIND_PHOTO);
  const [optionsText, setOptionsText] = useState("Option A, Option B");
  const [rewardPerFrame, setRewardPerFrame] = useState("0.01");
  const [frameCount, setFrameCount] = useState("10");
  const [radiusMeters, setRadiusMeters] = useState(75);
  const [position, setPosition] = useState<[number, number]>(DEFAULT_CENTER);
  const [answersText, setAnswersText] = useState(""); // Track A: newline-separated golden answers, one per frame
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { data: receipt, isLoading: confirming } = useWaitForTransactionReceipt({ hash });

  const isTrackA = kind !== KIND_PHOTO;
  const options = optionsText.split(",").map((o) => o.trim()).filter(Boolean);

  /**
   * Returns `null` (rather than silently padding with the first line) if the
   * creator hasn't provided exactly one golden answer per frame — reusing
   * lines[0] for missing frames would create a quest where most frames
   * secretly share the same answer, which is a data-integrity footgun, not
   * a reasonable default.
   */
  function buildGoldenAnswers(count: number): `0x${string}`[] | null {
    if (kind === KIND_PHOTO) return [];
    const lines = answersText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length !== count) return null;

    return lines.map((line) => {
      if (kind === KIND_TEXT) return textAnswerHash(line);
      // options / yesno / rating: line is expected to be an option index
      const idx = Number.parseInt(line, 10);
      return optionAnswerHash(Number.isFinite(idx) ? idx : 0);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const count = Number.parseInt(frameCount, 10) || 1;
    const reward = parseEther(rewardPerFrame || "0");
    const goldenAnswers = buildGoldenAnswers(count);
    if (goldenAnswers === null) {
      setErrorMessage(
        `Enter exactly ${count} golden answer${count === 1 ? "" : "s"} — one per line, one per frame.`,
      );
      return;
    }
    const totalEscrow = reward * BigInt(count);

    writeContract(
      {
        address: network.questEscrowAddress,
        abi: QUESTESCROW_ABI,
        functionName: "createTask",
        args: [
          title,
          description,
          category,
          kind,
          kind === KIND_OPTIONS ? options.length : 0,
          kind === KIND_OPTIONS ? options : [],
          reward,
          BigInt(count),
          goldenAnswers,
          toE7(position[0]),
          toE7(position[1]),
          radiusMeters,
        ],
        value: totalEscrow,
      },
      {
        onError: (err) => {
          const decoded = decodeContractError(err, QUESTESCROW_ABI);
          setErrorMessage(decoded.message);
        },
      },
    );
  }

  const busy = isPending || confirming;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-sm text-white/70">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
        />
      </div>

      <div>
        <label className="text-sm text-white/70">
          {isTrackA ? "Description" : "Proof criteria (shown to the AI vision judge)"}
        </label>
        <textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={
            isTrackA
              ? "What should the worker verify?"
              : "e.g. Photo must show the store's front entrance with the OPEN sign clearly visible."
          }
          className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-white/70">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
          >
            {QUEST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-white/70">Verification</label>
          <select
            value={kind}
            onChange={(e) => setKind(Number(e.target.value) as Kind)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
          >
            <option value={KIND_PHOTO}>Track B — Photo proof (AI-judged)</option>
            <option value={KIND_OPTIONS}>Track A — Multiple choice (instant)</option>
            <option value={KIND_YESNO}>Track A — Yes / No (instant)</option>
            <option value={KIND_RATING}>Track A — Rating 1-5 (instant)</option>
            <option value={KIND_TEXT}>Track A — Free text (instant)</option>
          </select>
        </div>
      </div>

      {kind === KIND_OPTIONS && (
        <div>
          <label className="text-sm text-white/70">Options (comma-separated)</label>
          <input
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
          />
        </div>
      )}

      {isTrackA && (
        <div>
          <label className="text-sm text-white/70">
            Golden answers — one per frame, one per line (option index for
            multiple-choice/yes-no/rating, or the exact text for free text)
          </label>
          <textarea
            required
            value={answersText}
            onChange={(e) => setAnswersText(e.target.value)}
            rows={3}
            placeholder={"1\n1\n0"}
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-white/70">Reward per frame (MON)</label>
          <input
            required
            type="number"
            step="0.0001"
            min="0.0001"
            value={rewardPerFrame}
            onChange={(e) => setRewardPerFrame(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="text-sm text-white/70">Number of frames (submissions accepted)</label>
          <input
            required
            type="number"
            min="1"
            max="500"
            value={frameCount}
            onChange={(e) => setFrameCount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-white/70">
          Geofence radius: {radiusMeters}m
          <span className="ml-2 text-xs text-white/40">
            (a UX gate for check-in — not re-verified on-chain)
          </span>
        </label>
        <input
          type="range"
          min={10}
          max={500}
          step={5}
          value={radiusMeters}
          onChange={(e) => setRadiusMeters(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </div>

      <div>
        <label className="text-sm text-white/70">Click the map to drop the quest pin</label>
        <div className="mt-1 h-72 overflow-hidden rounded-xl border border-white/10">
          <MapContainer center={position} zoom={13} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationPicker position={position} onPick={setPosition} />
          </MapContainer>
        </div>
        <p className="mt-1 text-xs text-white/40">
          Pin: {position[0].toFixed(5)}, {position[1].toFixed(5)}
        </p>
      </div>

      <div className="glass rounded-xl p-3 text-sm text-white/60">
        Total escrow required:{" "}
        <span className="font-display font-medium text-accentSoft">
          {(Number(rewardPerFrame || 0) * (Number.parseInt(frameCount, 10) || 0)).toFixed(4)} MON
        </span>
      </div>

      {errorMessage && (
        <p className="rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{errorMessage}</p>
      )}

      {receipt && (
        <p className="rounded-lg bg-accent/15 p-3 text-sm text-accentSoft">
          Quest posted and escrow funded on-chain.
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accentSoft disabled:translate-y-0 disabled:opacity-50"
      >
        {busy ? "Confirming on-chain..." : "Post bounty"}
      </button>
    </form>
  );
}
