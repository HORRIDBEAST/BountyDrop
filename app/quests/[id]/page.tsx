"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog, formatEther } from "viem";
import { useNetwork } from "../../../lib/network";
import { QUESTESCROW_ABI } from "../../../lib/abi";
import {
  KIND_LABELS,
  KIND_OPTIONS,
  KIND_YESNO,
  KIND_RATING,
  KIND_TEXT,
  isTrackB,
} from "../../../lib/constants";
import { fromE7 } from "../../../lib/geo/haversine";
import { optionAnswerHash, textAnswerHash, YES_NO_OPTIONS, RATING_OPTIONS } from "../../../lib/answers";
import { decodeContractError } from "../../../lib/errors";
import { CheckInButton } from "../../../components/CheckInButton";
import { ProofUploader } from "../../../components/ProofUploader";

export default function QuestDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = BigInt(params.id);
  const { network } = useNetwork();

  const { data: task, refetch } = useReadContract({
    address: network.questEscrowAddress,
    abi: QUESTESCROW_ABI,
    chainId: network.chainId,
    functionName: "getTask",
    args: [taskId],
    query: { refetchInterval: 6000 },
  });

  const [checkedIn, setCheckedIn] = useState(false);

  if (!task) {
    return <p className="text-white/50">Loading quest...</p>;
  }

  const t = task as unknown as {
    title: string;
    description: string;
    category: string;
    kind: number;
    options: readonly string[];
    reward: bigint;
    bounty: bigint;
    completed: bigint;
    frameCount: bigint;
    active: boolean;
    latE7: bigint;
    lngE7: bigint;
    radiusMeters: number;
  };

  const nextFrameId = t.completed; // simplest "next open frame" heuristic for this build
  const trackB = isTrackB(t.kind);
  const targetCoordinates = { latitude: fromE7(t.latE7), longitude: fromE7(t.lngE7) };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/40">
          {t.category} · {KIND_LABELS[t.kind]}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white">{t.title}</h1>
        <p className="mt-2 text-white/60">{t.description}</p>
      </div>

      <div className="glass flex items-center gap-4 rounded-xl p-4 text-sm">
        <span className="font-display font-semibold text-accentSoft">{formatEther(t.reward)} MON</span>
        <span className="text-white/50">per submission</span>
        <span className="ml-auto text-white/50">
          {t.completed.toString()} / {t.frameCount.toString()} claimed
        </span>
      </div>

      {/* Once checked in, keep showing the submission UI (and whatever
          verdict/outcome it's displaying) even if the quest's `active` flag
          flips false in the background — e.g. right after your own
          submission fully claims the last frame. Otherwise the very
          confirmation you're waiting for gets unmounted by the next poll. */}
      {!t.active && !checkedIn && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          This quest is closed — either fully claimed or closed by its creator.
        </p>
      )}

      {t.active && !checkedIn && (
        <CheckInButton
          targetCoordinates={targetCoordinates}
          radiusMeters={t.radiusMeters}
          onCheckedIn={() => setCheckedIn(true)}
        />
      )}

      {checkedIn && trackB && (
        <ProofUploader
          taskId={taskId}
          frameId={nextFrameId}
          questTitle={t.title}
          proofCriteria={t.description}
        />
      )}

      {checkedIn && !trackB && (
        <TrackAAnswerForm
          taskId={taskId}
          frameId={nextFrameId}
          kind={t.kind}
          options={t.options}
          onSettled={() => refetch()}
        />
      )}
    </div>
  );
}

function TrackAAnswerForm({
  taskId,
  frameId,
  kind,
  options,
  onSettled,
}: {
  taskId: bigint;
  frameId: bigint;
  kind: number;
  options: readonly string[];
  onSettled: () => void;
}) {
  const { network } = useNetwork();
  const [textAnswer, setTextAnswer] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"accepted" | "rejected" | null>(null);
  const [lastPayout, setLastPayout] = useState<string | null>(null);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { data: receipt } = useWaitForTransactionReceipt({ hash });

  // DoTask.tsx receipt-decoding pattern, carried over from MicroWorks (see
  // BOUNTYDROP_MASTER_SPEC.md Section 1): manually decode the confirmed
  // receipt's logs to drive payout/outcome UI feedback.
  useEffect(() => {
    if (!receipt || !hash) return;
    let sawAccepted = false;
    let sawRejected = false;

    for (const log of receipt.logs) {
      if (log.address?.toLowerCase() !== network.questEscrowAddress.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi: QUESTESCROW_ABI, data: log.data, topics: log.topics });
        if (ev.eventName === "AnswerAccepted") {
          const { amount } = ev.args as { amount: bigint };
          setLastPayout(formatEther(amount));
          sawAccepted = true;
        } else if (ev.eventName === "AnswerRejected") {
          sawRejected = true;
        }
      } catch {
        /* skip logs from other contracts / malformed events */
      }
    }

    if (sawAccepted) setOutcome("accepted");
    else if (sawRejected) setOutcome("rejected");
    onSettled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, hash]);

  function submitOption(optionIndex: number) {
    setErrorMessage(null);
    writeContract(
      {
        address: network.questEscrowAddress,
        abi: QUESTESCROW_ABI,
        functionName: "submitAnswer",
        args: [taskId, frameId, optionAnswerHash(optionIndex)],
      },
      {
        onError: (err) => {
          const decoded = decodeContractError(err, QUESTESCROW_ABI);
          setErrorMessage(decoded.message);
        },
      },
    );
  }

  function submitText() {
    if (!textAnswer.trim()) return;
    setErrorMessage(null);
    writeContract(
      {
        address: network.questEscrowAddress,
        abi: QUESTESCROW_ABI,
        functionName: "submitAnswer",
        args: [taskId, frameId, textAnswerHash(textAnswer)],
      },
      {
        onError: (err) => {
          const decoded = decodeContractError(err, QUESTESCROW_ABI);
          setErrorMessage(decoded.message);
        },
      },
    );
  }

  const busy = isPending || (!!hash && !receipt);

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-panel p-4">
      {kind === KIND_OPTIONS && (
        <div className="flex flex-wrap gap-2">
          {options.map((opt, i) => (
            <button
              key={opt + i}
              onClick={() => submitOption(i)}
              disabled={busy}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white hover:border-accent disabled:opacity-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {kind === KIND_YESNO && (
        <div className="flex gap-2">
          {YES_NO_OPTIONS.map((opt, i) => (
            <button
              key={opt}
              onClick={() => submitOption(i)}
              disabled={busy}
              className="flex-1 rounded-full border border-white/15 px-4 py-2 text-sm text-white hover:border-accent disabled:opacity-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {kind === KIND_RATING && (
        <div className="flex gap-2">
          {RATING_OPTIONS.map((opt, i) => (
            <button
              key={opt}
              onClick={() => submitOption(i)}
              disabled={busy}
              className="flex-1 rounded-full border border-white/15 px-4 py-2 text-sm text-white hover:border-accent disabled:opacity-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {kind === KIND_TEXT && (
        <div className="flex gap-2">
          <input
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="Type your answer"
            className="flex-1 rounded-lg border border-white/15 bg-ink px-3 py-2 text-sm text-white"
          />
          <button
            onClick={submitText}
            disabled={busy}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      )}

      {busy && <p className="text-xs text-white/40">Confirming on-chain...</p>}

      {outcome === "accepted" && (
        <p className="rounded-lg bg-accent/15 p-3 text-sm text-accent">
          Correct! {lastPayout} MON paid out instantly.
        </p>
      )}
      {outcome === "rejected" && (
        <p className="rounded-lg bg-red-500/15 p-3 text-sm text-red-300">
          Not quite — no funds moved. You can try again on the next open frame.
        </p>
      )}
      {errorMessage && (
        <p className="rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{errorMessage}</p>
      )}
    </div>
  );
}
