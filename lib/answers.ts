// lib/answers.ts
//
// Client-side answer hash builders for Track A (golden-key) submissions,
// referenced in BOUNTYDROP_MASTER_SPEC.md Section 1 as MicroWorks'
// lib/answers.ts. The contract only ever compares keccak256 hashes — it
// never sees the plaintext answer — so the hashing scheme here MUST match
// exactly what the quest creator used to build `goldenAnswers[]` at
// createTask() time (see BusinessQuestCreatorForm.tsx).

import { encodePacked, keccak256, toBytes } from "viem";

/** Multiple-choice / yes-no / rating answers: a single option index (0-255). */
export function optionAnswerHash(optionIndex: number): `0x${string}` {
  return keccak256(encodePacked(["uint8"], [optionIndex]));
}

/**
 * Free-text answers: normalize before hashing (trim, lowercase, collapse
 * whitespace) so trivially different formatting of the same answer still
 * matches the creator's golden hash.
 */
export function normalizeText(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function textAnswerHash(input: string): `0x${string}` {
  return keccak256(toBytes(normalizeText(input)));
}

export const YES_NO_OPTIONS = ["No", "Yes"] as const;
export const RATING_OPTIONS = ["1", "2", "3", "4", "5"] as const;
