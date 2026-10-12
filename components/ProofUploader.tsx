"use client";

// components/ProofUploader.tsx
//
// Track B (photo-proof) submission flow:
//   1. Worker picks/captures a photo.
//   2. Client hashes the photo bytes and calls
//      QuestEscrow.submitPhotoProof(taskId, frameId, proofRefHash) — the
//      worker's own wallet signs this, registering their claim to the frame
//      on-chain (audit trail only; the photo itself is never on-chain).
//   3. Once that tx confirms, the client POSTs the actual photo to
//      /api/verify-photo, which runs the AI vision judge server-side and,
//      if configured with the oracle key, submits resolvePhotoTask itself.
//   4. The verdict (approved/rejected, confidence, reasoning) is shown here.

import { useState } from "react";
import { keccak256 } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useNetwork } from "../lib/network";
import { QUESTESCROW_ABI } from "../lib/abi";
import { decodeContractError } from "../lib/errors";

interface ProofUploaderProps {
  taskId: bigint;
  frameId: bigint;
  questTitle: string;
  proofCriteria: string;
}

type Verdict = {
  approved: boolean;
  confidenceBps: number;
  reasoning: string;
};

export function ProofUploader({ taskId, frameId, questTitle, proofCriteria }: ProofUploaderProps) {
  const { network } = useNetwork();
  const { address } = useAccount();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "submitting-ref" | "judging" | "done" | "error">("idle");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setStage("idle");
    setVerdict(null);
    setErrorMessage(null);
  }

  async function handleSubmit() {
    if (!file || !address) return;
    setErrorMessage(null);

    try {
      setStage("submitting-ref");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const proofRef = keccak256(bytes);

      const submitTxHash = await writeContractAsync({
        address: network.questEscrowAddress,
        abi: QUESTESCROW_ABI,
        functionName: "submitPhotoProof",
        args: [taskId, frameId, proofRef],
      });
      setTxHash(submitTxHash);

      setStage("judging");
      const form = new FormData();
      form.set("photo", file);
      form.set("taskId", taskId.toString());
      form.set("frameId", frameId.toString());
      form.set("proofCriteria", proofCriteria);
      form.set("questTitle", questTitle);

      const res = await fetch("/api/verify-photo", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Verification failed.");
      }

      setVerdict(data.verdict);
      if (data.onChain?.txHash) setTxHash(data.onChain.txHash);
      setStage("done");
    } catch (err) {
      const decoded = decodeContractError(err, QUESTESCROW_ABI);
      setErrorMessage(err instanceof Error && decoded.code === "UNKNOWN" ? err.message : decoded.message);
      setStage("error");
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-panel p-4">
      <p className="text-sm text-white/70">
        Proof criteria: <span className="text-white">{proofCriteria || "See quest description."}</span>
      </p>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Proof preview" className="max-h-64 w-full rounded-lg object-cover" />
      )}

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="block w-full text-sm text-white/60 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
      />

      <button
        onClick={handleSubmit}
        disabled={!file || stage === "submitting-ref" || stage === "judging"}
        className="w-full rounded-full bg-indigo px-4 py-2 text-sm font-semibold text-white hover:bg-indigo/80 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
      >
        {stage === "submitting-ref" && "Registering submission on-chain..."}
        {stage === "judging" && "Verifying with AI vision judge..."}
        {(stage === "idle" || stage === "done" || stage === "error") && "Submit photo proof"}
      </button>

      {stage === "done" && verdict && (
        <div
          className={`rounded-lg p-3 text-sm ${
            verdict.approved ? "bg-accent/15 text-accent" : "bg-red-500/15 text-red-300"
          }`}
        >
          <p className="font-semibold">
            {verdict.approved ? "Approved — payout sent" : "Not approved"} (
            {(verdict.confidenceBps / 100).toFixed(0)}% confidence)
          </p>
          <p className="mt-1 text-white/70">{verdict.reasoning}</p>
        </div>
      )}

      {errorMessage && (
        <p className="rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{errorMessage}</p>
      )}

      {txHash && (
        <a
          href={`${network.explorer}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-white/40 hover:text-white/70"
        >
          View transaction on explorer →
        </a>
      )}
    </div>
  );
}
