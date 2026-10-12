// lib/constants.ts
//
// Flat, non-network-aware exports for convenience — mirrors MicroWorks'
// lib/constants.ts pattern. Components should generally read
// useNetwork().network.questEscrowAddress instead of these directly once a
// second network is added, but for this Testnet-only build both paths
// resolve to the same values.

export const QUEST_ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_QUEST_ESCROW_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const SPEND_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_SPEND_VAULT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const PHOTO_ORACLE_ADDRESS = (process.env.NEXT_PUBLIC_PHOTO_ORACLE_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const FEE_BPS = 200n; // 2% protocol fee, matches QuestEscrow.sol
export const EXPLORER = "https://testnet.monadexplorer.com";

// Task kinds — mirrors QuestEscrow.sol's uint8 constants.
export const KIND_OPTIONS = 0; // Track A: golden-key, multiple choice
export const KIND_YESNO = 1; // Track A: golden-key, yes/no
export const KIND_RATING = 2; // Track A: golden-key, 1-5 rating
export const KIND_TEXT = 3; // Track A: golden-key, normalized free text
export const KIND_PHOTO = 4; // Track B: AI vision judge, no pre-known hash

export const TRACK_A_KINDS = [KIND_OPTIONS, KIND_YESNO, KIND_RATING, KIND_TEXT] as const;
export const TRACK_B_KINDS = [KIND_PHOTO] as const;

export function isTrackB(kind: number): boolean {
  return kind === KIND_PHOTO;
}

export const KIND_LABELS: Record<number, string> = {
  [KIND_OPTIONS]: "Multiple choice",
  [KIND_YESNO]: "Yes / No",
  [KIND_RATING]: "Rating (1-5)",
  [KIND_TEXT]: "Free text",
  [KIND_PHOTO]: "Photo proof",
};

// Location/venue category taxonomy for quests. Carried forward from
// MicroWorks' `label, poll, caption, verify, transcribe, qa` set (see spec
// Section 1) but adapted toward location-based bounty types, since the
// on-chain `category` field is an arbitrary string either way.
export const QUEST_CATEGORIES = [
  "shelf-check",
  "venue-open",
  "price-check",
  "cleanliness",
  "signage",
  "foot-traffic",
  "other",
] as const;
export type QuestCategory = (typeof QUEST_CATEGORIES)[number];

// Category taxonomy for SpendVault merchant policies.
export const SPEND_CATEGORIES = ["food", "transit", "retail", "services", "other"] as const;
export type SpendCategory = (typeof SPEND_CATEGORIES)[number];

// Pure client-side XP level derivation from on-chain `points` reads.
// Carried forward from MicroWorks' lib/constants.ts.
export interface XpLevel {
  name: string;
  threshold: number;
}

export const XP_LEVELS: XpLevel[] = [
  { name: "Rookie", threshold: 0 },
  { name: "Helper", threshold: 500 },
  { name: "Contributor", threshold: 1500 },
  { name: "Expert", threshold: 3000 },
  { name: "Grandmaster", threshold: 6000 },
];

export function xpLevelFor(points: number): XpLevel {
  let current = XP_LEVELS[0];
  for (const level of XP_LEVELS) {
    if (points >= level.threshold) current = level;
  }
  return current;
}
