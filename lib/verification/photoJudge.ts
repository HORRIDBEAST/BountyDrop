// lib/verification/photoJudge.ts
//
// Server-side only (imported from app/api/verify-photo/route.ts, never from
// client components — it needs OPENAI_API_KEY). Calls a multimodal LLM
// vision endpoint once per submission and returns a structured pass/fail +
// confidence verdict against the quest's stated proof criteria. This is
// Track B of BOUNTYDROP_BUILD_PROMPT.md's two-track verification system:
// there is no pre-known hash for "photograph this shelf" / "confirm this
// venue is open" tasks, so a single AI vision call stands in for the
// golden-key comparison Track A uses.

export interface PhotoJudgeInput {
  /** Raw image bytes, base64-encoded (no data: URI prefix). */
  imageBase64: string;
  /** e.g. "image/jpeg", "image/png". */
  mimeType: string;
  /** The quest's stated proof criteria, e.g. "Photo must show the store's
   *  front entrance with the OPEN sign clearly visible." */
  proofCriteria: string;
  /** Quest title/description, for extra context. */
  questTitle: string;
}

export interface PhotoJudgeResult {
  approved: boolean;
  /** 0-10000 (basis points), logged on-chain alongside the payout event. */
  confidenceBps: number;
  reasoning: string;
}

const MODEL = "gpt-4o";
const APPROVAL_CONFIDENCE_THRESHOLD_BPS = 7000; // 70% — below this, reject even if the model leans "pass"

const SYSTEM_PROMPT = `You are a strict but fair verification judge for a location-based micro-bounty app called BountyDrop.
A worker has submitted a photo as proof of completing a quest. Judge ONLY whether the photo satisfies the
stated proof criteria — do not judge photo quality, composition, or anything not in the criteria.
Respond with ONLY a JSON object, no other text, no markdown fences:
{"approved": boolean, "confidence": number (0-100), "reasoning": string (1-2 sentences)}`;

/**
 * Calls the OpenAI Chat Completions API (vision-capable model) with an
 * inline base64 image and parses a strict-JSON verdict. Throws on
 * network/parse failure — the caller (the API route) should treat that as
 * "verification unavailable" and leave the frame unresolved rather than
 * silently approving or rejecting.
 */
export async function judgePhoto(input: PhotoJudgeInput): Promise<PhotoJudgeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — cannot run the photo judge server-side.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Quest: "${input.questTitle}"\nProof criteria: "${input.proofCriteria}"\n\nDoes this photo satisfy the proof criteria?`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${input.mimeType};base64,${input.imageBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Vision judge request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Vision judge returned no text content to parse.");
  }

  let parsed: { approved: boolean; confidence: number; reasoning: string };
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    throw new Error(`Vision judge returned non-JSON output: ${text}`);
  }

  const confidenceBps = Math.max(0, Math.min(10000, Math.round(parsed.confidence * 100)));

  return {
    approved: Boolean(parsed.approved) && confidenceBps >= APPROVAL_CONFIDENCE_THRESHOLD_BPS,
    confidenceBps,
    reasoning: parsed.reasoning ?? "",
  };
}
