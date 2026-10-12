# BountyDrop — Build Prompt for Claude Code

## Role

You are the lead engineer building BountyDrop, a location-based micro-bounty
platform on Monad Testnet, synthesized from `BOUNTYDROP_MASTER_SPEC.md`
(already written in this repo's root — read it in full before writing any
code). That spec extracted real, working patterns from three prior hackathon
projects (MicroWorks' golden-key quest/escrow engine, TapPay's NFC settlement
layer, SattelR's scoped spend-permission vault) and authored new GPS
geofencing code from scratch. Treat the spec as source-of-truth for anything
it fully specifies; treat it as a starting point, not gospel, anywhere it
flags an open design question.

## Two product decisions to lock in before writing code — do not silently skip these

1. **Photo-proof tasks need a real verification path, not hash-matching.**
   MicroWorks' golden-key model (compare a submitted hash to a pre-committed
   hash) only works for tasks with a known-in-advance correct answer
   (labelling, yes/no, rating). Most real bounty types in BountyDrop
   ("photograph this shelf," "confirm this venue is open") are photo-proof
   tasks with no pre-known hash. For this build: implement a **two-track
   verification system** —
   - Track A (reuse as-is): objective quests using the golden-key pattern,
     exactly as MicroWorks does it, for anything with a deterministic answer.
   - Track B (new): photo-proof quests, verified by a single AI vision call
     (any multimodal LLM API) that returns a pass/fail + confidence score
     against the quest's stated proof criteria, with the payout gated on
     that result. Log the AI's verdict and confidence on-chain alongside the
     payout event so a rejected worker can see why. Do not silently pretend
     photo tasks work through the golden-key path — they don't.

2. **GPS check-in is a UX gate, not a security boundary — say so in the UI copy.**
   Implement `checkGeofence()` from the spec as the check-in gate, but do not
   present "GPS verified" as if it were a security guarantee anywhere in the
   product copy or docs. If time allows, add one real anti-spoofing signal
   (e.g., cross-checking the browser's `navigator.geolocation` accuracy
   value and rejecting suspiciously perfect/instant fixes, or requiring the
   photo's EXIF GPS tag to roughly match the reported position) — but treat
   this as a "raise the bar," not "solve it," given the timeline.

## Tech stack (locked, from the spec)

- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind, wagmi + viem
  for chain interaction (follow MicroWorks' `lib/monad.ts` pattern exactly)
- Contracts: Solidity `^0.8.24`, Foundry, `via_ir = true`, `optimizer_runs = 200`
- Chain: Monad Testnet only for this build. Chain ID `10143`, RPC
  `https://testnet-rpc.monad.xyz`. Pick **one** canonical explorer URL
  (`https://testnet.monadexplorer.com`) and use it everywhere — do not mix
  explorer URLs across files the way the three source repos did.
- Maps: `leaflet` + `react-leaflet` + `@types/leaflet`, dynamically imported
  with `ssr: false` (Leaflet touches `window`/`document` directly)
- No Redux/Zustand — React Context for network/wallet state (mirror
  MicroWorks' `lib/network.tsx` pattern) + wagmi's built-in React Query cache
  for all on-chain reads

## Directory structure to create

```
bountydrop/
├── BOUNTYDROP_MASTER_SPEC.md        (already exists — read, don't overwrite)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── app/
│   ├── layout.tsx
│   ├── page.tsx                     landing page
│   ├── providers.tsx                WagmiProvider > QueryClientProvider > NetworkProvider
│   ├── business/
│   │   ├── page.tsx                 business dashboard (list own quests)
│   │   └── create/page.tsx          Business Quest Creator (bounty, GPS, radius, criteria)
│   ├── quests/
│   │   └── page.tsx                 Worker Mobile Quest View (map + list)
│   ├── quests/[id]/
│   │   └── page.tsx                 single quest detail + check-in + proof submission
│   ├── terminal/
│   │   └── page.tsx                 TapPay-style Spend Terminal (redeem MON locally)
│   └── api/
│       └── verify-photo/route.ts    server route calling the AI vision judge (Track B)
├── components/
│   ├── QuestMap.tsx                 (from spec Section 4 — use near-verbatim)
│   ├── QuestCard.tsx
│   ├── BusinessQuestCreatorForm.tsx
│   ├── ProofUploader.tsx            camera capture + upload, shows AI verdict
│   ├── CheckInButton.tsx            wraps useUserLocation + checkGeofence
│   ├── SpendTerminalKeypad.tsx      adapt TapPay's keypad component pattern
│   └── WalletConnectButton.tsx
├── hooks/
│   └── useUserLocation.ts           (from spec Section 4 — use near-verbatim)
├── lib/
│   ├── monad.ts                     chain config (adapt from MicroWorks lib/monad.ts)
│   ├── network.tsx                  NetworkProvider/useNetwork (adapt from MicroWorks)
│   ├── constants.ts                 contract addresses, category taxonomy
│   ├── abi.ts                       generated from Foundry build artifacts — do not hand-write
│   ├── geo/
│   │   └── haversine.ts             (from spec Section 4 — use verbatim)
│   └── verification/
│       └── photoJudge.ts            AI vision call + response parsing for Track B
├── contracts/
│   ├── foundry.toml
│   ├── src/
│   │   ├── QuestEscrow.sol          adapted from MicroTask.sol: add geofence lat/lng/radius
│   │   │                            fields to the Task struct; keep golden-key path for
│   │   │                            Track A tasks; add an owner/oracle-only
│   │   │                            `resolvePhotoTask(taskId, frameId, approved)` entrypoint
│   │   │                            for Track B tasks judged off-chain by the AI verifier
│   │   └── SpendVault.sol           adapted from AgentPayVault.sol: bind policies to a
│   │                                registered merchant address (not a free-text string —
│   │                                fix the SattelR gap noted in the spec), add an optional
│   │                                geofenced-merchant-location check
│   ├── test/
│   │   ├── QuestEscrow.t.sol
│   │   └── SpendVault.t.sol
│   └── script/
│       └── Deploy.s.sol
├── scripts/
│   └── gen-abi.mjs                  regenerate lib/abi.ts from Foundry artifacts
└── public/
    └── map/                         worker-marker.svg, quest-marker.svg, quest-marker-active.svg
```

## Build order (work through these phases in order; confirm each phase runs before starting the next)

1. **Scaffold + chain config** — Next.js app, Tailwind, `lib/monad.ts`,
   `lib/network.tsx`, `app/providers.tsx`. Confirm wallet connect works
   against Monad Testnet before touching contracts.
2. **Contracts** — write `QuestEscrow.sol` and `SpendVault.sol` per the specs
   above, adapting (not copy-pasting blindly) the source contracts from
   `BOUNTYDROP_MASTER_SPEC.md`. Write Foundry tests for both. Deploy to
   Monad Testnet, save addresses into `lib/constants.ts`.
3. **Geo layer** — drop in `lib/geo/haversine.ts` and `hooks/useUserLocation.ts`
   from the spec verbatim, then `components/QuestMap.tsx`. Get a page
   rendering live quest pins + user position before wiring any contract reads.
4. **Worker flow** — quest list/map → quest detail → GPS check-in gate →
   proof submission (golden-key for Track A, photo upload + AI judge call
   for Track B) → on-chain `submitAnswer`/`resolvePhotoTask` call → payout
   confirmation UI (mirror MicroWorks' `DoTask.tsx` receipt-decoding pattern).
5. **Business flow** — quest creation form (bounty amount, GPS pin picker on
   the map, radius slider, proof criteria text, Track A vs Track B toggle) →
   `createTask` escrow transaction.
6. **Spend terminal** — merchant-facing redemption screen using
   `SpendVault.sol`, adapting TapPay's keypad component and confirm-modal
   pattern for a merchant-initiated redemption instead of P2P NFC tap.
7. **Polish pass** — loading states, error decoding (`decodeErrorResult` for
   custom Solidity errors, per SattelR's pattern), empty states.

## Ground rules

- Every phase should end in something that actually runs — don't leave
  contracts half-deployed or a page that only renders with mocked data if
  a real integration was the point of that phase.
- When the spec is ambiguous or silent, make the smallest reasonable
  decision and say explicitly what you chose and why, rather than picking
  silently or stalling to ask.
- Do not carry forward flagged anti-patterns from the source repos: TapPay's
  on-chain registry that's silently unused in favor of an off-chain DB,
  SattelR's free-text merchant matching instead of address-based matching,
  or any single-endpoint RPC with no failover if time allows adding one.
- Keep the AI photo-judging call server-side (`app/api/verify-photo/route.ts`),
  never client-side, since it needs an API key.
