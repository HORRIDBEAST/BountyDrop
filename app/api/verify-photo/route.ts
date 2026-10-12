// app/api/verify-photo/route.ts
//
// Server-side only, per BOUNTYDROP_BUILD_PROMPT.md's ground rules ("Keep
// the AI photo-judging call server-side, never client-side, since it needs
// an API key"). Flow:
//   1. Worker has already called QuestEscrow.submitPhotoProof(taskId,
//      frameId, proofRef) on-chain from the client (their own wallet signs
//      that tx — see ProofUploader.tsx).
//   2. Client POSTs the actual photo + quest context here.
//   3. This route calls the AI vision judge (lib/verification/photoJudge.ts).
//   4. If the judge is reachable, this route — acting as the photoOracle
//      wallet set on QuestEscrow at deploy time — submits
//      resolvePhotoTask(taskId, frameId, approved, confidenceBps) itself,
//      so the payout (or rejection) lands on-chain without the worker
//      needing a second signature.
//
// If the vision call throws (rate limit, bad key, network), this route
// returns an error and resolves nothing — better to leave a frame pending
// than to guess a verdict.

import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "../../../lib/monad";
import { QUEST_ESCROW_ADDRESS } from "../../../lib/constants";
import { QUESTESCROW_ABI } from "../../../lib/abi";
import { judgePhoto } from "../../../lib/verification/photoJudge";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("photo");
    const taskId = form.get("taskId");
    const frameId = form.get("frameId");
    const proofCriteria = form.get("proofCriteria");
    const questTitle = form.get("questTitle");

    if (!(file instanceof File) || typeof taskId !== "string" || typeof frameId !== "string") {
      return NextResponse.json(
        { error: "Missing required fields: photo, taskId, frameId." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const imageBase64 = bytes.toString("base64");

    const verdict = await judgePhoto({
      imageBase64,
      mimeType: file.type || "image/jpeg",
      proofCriteria: typeof proofCriteria === "string" ? proofCriteria : "",
      questTitle: typeof questTitle === "string" ? questTitle : "",
    });

    const oracleKey = process.env.PHOTO_ORACLE_PRIVATE_KEY;
    if (!oracleKey) {
      // Verification ran, but we can't submit the on-chain resolution
      // without the oracle key — surface the verdict so the UI can at
      // least show the worker why, without silently pretending it's final.
      return NextResponse.json({
        verdict,
        onChain: null,
        warning: "PHOTO_ORACLE_PRIVATE_KEY not set — verdict computed but not yet submitted on-chain.",
      });
    }

    const account = privateKeyToAccount(oracleKey as Hex);
    const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
    const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http() });

    const { request } = await publicClient.simulateContract({
      address: QUEST_ESCROW_ADDRESS,
      abi: QUESTESCROW_ABI,
      functionName: "resolvePhotoTask",
      args: [BigInt(taskId), BigInt(frameId), verdict.approved, verdict.confidenceBps],
      account,
    });

    const txHash = await walletClient.writeContract(request);

    return NextResponse.json({ verdict, onChain: { txHash } });
  } catch (err) {
    console.error("verify-photo failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error verifying photo." },
      { status: 500 },
    );
  }
}
