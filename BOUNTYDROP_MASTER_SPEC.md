# BOUNTYDROP MASTER TECHNICAL SPECIFICATION

## SECTION 1: MICROWORKS - QUEST & ESCROW ENGINE

> Source: `./MicroWorks/microworks` (Next.js 16 + React 19 + TypeScript app, with a Foundry subproject at `contracts/`). Findings below are extracted directly from the repository's source files, not inferred.

### 1. Monad RPC & Contract Configurations

**Chain definitions** — `lib/monad.ts` defines both Monad networks via viem's `defineChain` and builds the wagmi client:

```ts
import { defineChain, http } from "viem";
import { createConfig, injected } from "wagmi";

export const monadTestnet = defineChain({
  id: 10_143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Testnet Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad Mainnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadScan", url: "https://monadscan.com" },
  },
  testnet: false,
});

export function getConfig() {
  return createConfig({
    chains: [monadTestnet, monadMainnet],
    transports: {
      [monadTestnet.id]: http(),
      [monadMainnet.id]: http(),
    },
    connectors: [injected()],
    ssr: true,
  });
}
```

- **Chain IDs**: Monad Testnet = `10143`, Monad Mainnet = `143`.
- **RPC URLs**: Testnet `https://testnet-rpc.monad.xyz`, Mainnet `https://rpc.monad.xyz` — both via viem's default `http()` transport (no custom RPC provider, no env override).
- **Explorers**: Testnet `https://testnet.monadexplorer.com`, Mainnet `https://monadscan.com`.
- **Wallet connector**: only `injected()` (browser/MetaMask). RainbowKit is installed as a dependency but is **not actually wired up** — the app uses raw wagmi `useConnect`/`injected()` instead of RainbowKit's `ConnectButton`.

**Per-network contract registry** — `lib/network.tsx` is a React Context (`NetworkProvider` / `useNetwork()`) that maps each network to its deployed contract address and persists the active selection to `localStorage` under the key `mw-network`:

```ts
export const NETWORKS: Record<NetworkId, NetworkInfo> = {
  testnet: {
    id: "testnet",
    label: "Monad Testnet",
    shortLabel: "TESTNET",
    chain: monadTestnet,
    chainId: monadTestnet.id,
    contractAddress: "0x26e67271c65ac40d419dffe8d6ad7ffcb2755237",
    explorer: "https://testnet.monadexplorer.com",
    testnet: true,
  },
  mainnet: {
    id: "mainnet",
    label: "Monad Mainnet",
    shortLabel: "MAINNET",
    chain: monadMainnet,
    chainId: monadMainnet.id,
    contractAddress: "0x61ab6619031b483139ada409955c2dcd01579ed7",
    explorer: "https://monadscan.com",
    testnet: false,
  },
};
```

`setNetwork(id)` persists the choice to `localStorage` and calls wagmi's `useSwitchChain`. `app/providers.tsx` wires the stack top-down: `WagmiProvider config={getConfig()}` → `QueryClientProvider` → `NetworkProvider`.

`lib/constants.ts` also exports a flat, non-network-aware duplicate for convenience/legacy use (components actually read `useNetwork().network.contractAddress`, not this constant):

```ts
export const CONTRACT_ADDRESS =
  "0x26e67271c65ac40d419dffe8d6ad7ffcb2755237" as `0x${string}`;
export const FEE_BPS = 200n; // 2% protocol fee
export const EXPLORER = "https://testnet.monadexplorer.com";
export const TEAM_WALLET = "0x225BAa4D33dD7c5b745085095Aa758bb6A958474" as `0x${string}`;
```

**Foundry deploy config** — `contracts/foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
script = "script"
optimizer = true
optimizer_runs = 200
via_ir = true

[rpc_endpoints]
monad_testnet = "https://testnet-rpc.monad.xyz"
```

`contracts/.env.example`:

```
# Copy to `.env` and fill in (never commit `.env`)
# Private key of the wallet that deploys MicroTask and owns the 2% protocol fees.
# Use the wallet with testnet MON: 0x225BAa4D33dD7c5b745085095Aa758bb6A958474
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HEX_WITHOUT_0X

# Deployed contract address (filled in after `forge script` deploy)
# CONTRACT_ADDRESS=0x...
```

No `@wagmi/cli` codegen is used — the ABI (`lib/abi.ts`) is instead generated from Foundry build artifacts by a custom `scripts/gen-abi.mjs` script, and the file carries a "do not edit by hand" header.

Deployed addresses per project README: testnet `0x26e67271c65ac40d419dffe8d6ad7ffcb2755237`, mainnet `0x61ab6619031b483139ada409955c2dcd01579ed7` (mainnet source reportedly verified on MonadScan).

### NPM Dependencies (exact versions)

Root `package.json` (no separate `package.json` for the Foundry subproject — it uses `foundry.toml`/`foundry.lock` only):

```json
{
  "name": "microworks",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@rainbow-me/rainbowkit": "^2.2.11",
    "@tabler/icons-react": "^3.47.0",
    "@tanstack/react-query": "^5.103.1",
    "@x402/core": "^2.26.0",
    "@x402/evm": "^2.26.0",
    "@x402/extensions": "^2.26.0",
    "@x402/svm": "^2.26.0",
    "clsx": "^2.1.1",
    "framer-motion": "^13.4.0",
    "next": "16.3.5",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "tailwind-merge": "^3.7.0",
    "viem": "^2.56.8",
    "wagmi": "^2.19.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.5",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

> **Note for BountyDrop clean-room build**: `@x402/core`, `@x402/evm`, `@x402/extensions`, `@x402/svm` are installed but never imported anywhere in `app/`, `components/`, or `lib/` — a dead/leftover dependency in MicroWorks, not part of the live payout mechanism. Do not carry this forward as if it were load-bearing.

### 2. Escrow & Instant Payout Smart Contracts

MicroWorks has a single Solidity contract, `contracts/src/MicroTask.sol` (253 lines), which *is* the escrow, task/quest manager, and instant-payout engine combined — there is no separate `Escrow.sol` or `PayoutManager.sol`. Full source:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MicroTask
/// @notice Micro-task marketplace with golden-key on-chain judging and gamification.
///         Creators escrow MON and submit a golden answer hash per frame. The
///         contract grades every submission against that hash and pays out
///         instantly — proving the answer on-chain with zero review latency.
///         Every correct answer also mints XP, tracks win & daily streaks and
///         feeds a public leaderboard.
contract MicroTask {
    uint256 public constant MAX_FRAMES = 500;

    /// @dev XP granted per correct answer.
    uint256 public constant XP_PER_CORRECT = 100;

    /// @dev Task kinds: 0 = options, 1 = yes/no, 2 = rating, 3 = free text.
    uint8 public constant KIND_OPTIONS = 0;
    uint8 public constant KIND_YESNO = 1;
    uint8 public constant KIND_RATING = 2;
    uint8 public constant KIND_TEXT = 3;

    /// @dev Protocol fee in basis points. 200 == 2%.
    uint256 public protocolFee;

    address public immutable owner;

    uint256 public taskCount;

    struct Task {
        uint256 id;
        address creator;
        string title;
        string description;
        string category;
        uint8 kind;
        uint8 optionCount;
        string[] options;
        uint256 reward; // wei paid per correct frame (pre-fee)
        uint256 bounty; // MON still locked in escrow
        uint256 completed; // frames correctly paid
        uint256 rejected; // wrong submissions
        uint256 frameCount;
        bool active;
    }

    mapping(uint256 => Task) public tasks;

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    /// @dev taskId => frameId => golden answer hash (keccak of canonical answer)
    mapping(uint256 => mapping(uint256 => bytes32)) private _golden;

    /// @dev taskId => frameId => frame already paid to a worker
    mapping(uint256 => mapping(uint256 => bool)) private _framePaid;

    uint256 public accumulatedFees;

    // --- Gamification ---

    mapping(address => uint256) public points;
    mapping(address => uint32) public winStreak; // consecutive correct answers
    mapping(address => uint32) public dayStreak; // consecutive active days
    mapping(address => uint48) public lastCorrectDay; // day index (ts / 86400)

    address[] private _workers;
    mapping(address => bool) private _isWorker;

    event TaskCreated(uint256 indexed id, address creator, string category, uint256 reward);
    event AnswerAccepted(uint256 indexed taskId, uint256 frameId, address worker, uint256 amount);
    event AnswerRejected(uint256 indexed taskId, uint256 frameId, address worker, uint8 option);
    event AnswerPending(uint256 indexed taskId, uint256 frameId, address worker, uint8 option);
    event TaskClosed(uint256 indexed taskId);
    event XpEarned(address indexed worker, uint256 points, uint32 winStreak, uint32 dayStreak);

    constructor() {
        owner = msg.sender;
        protocolFee = 200;
    }

    function createTask(
        string calldata title,
        string calldata description,
        string calldata category,
        uint8 kind,
        uint8 optionCount,
        string[] calldata options,
        uint256 rewardPerFrame,
        uint256 frameCount,
        bytes32[] calldata goldenAnswers
    ) external payable returns (uint256 id) {
        require(rewardPerFrame > 0, "reward must be > 0");
        require(frameCount > 0 && frameCount <= MAX_FRAMES, "bad frame count");
        require(goldenAnswers.length == frameCount, "answer key must cover every frame");
        require(kind <= KIND_TEXT, "bad kind");
        if (kind == KIND_OPTIONS) {
            require(optionCount >= 2, "need >= 2 options");
            require(options.length == optionCount, "options mismatch");
        }
        require(msg.value >= rewardPerFrame * frameCount, "escrow too small");

        id = taskCount++;
        tasks[id] = Task({
            id: id,
            creator: msg.sender,
            title: title,
            description: description,
            category: category,
            kind: kind,
            optionCount: kind == KIND_OPTIONS ? optionCount : (kind == KIND_YESNO ? 2 : (kind == KIND_RATING ? 5 : 0)),
            options: options,
            reward: rewardPerFrame,
            bounty: msg.value,
            completed: 0,
            rejected: 0,
            frameCount: frameCount,
            active: true
        });

        for (uint256 i = 0; i < goldenAnswers.length; i++) {
            _golden[id][i] = goldenAnswers[i];
        }

        emit TaskCreated(id, msg.sender, category, rewardPerFrame);
    }

    /// @dev Judge an answer. `answer` is the keccak256 of the canonical answer
    ///      payload. For options/yesno/rating that is a single byte encoding the
    ///      chosen option; for free text it is the normalized text hash.
    function submitAnswer(uint256 taskId, uint256 frameId, bytes32 answer) external {
        Task storage t = tasks[taskId];
        require(t.active, "task closed");
        require(frameId < t.frameCount, "frame out of range");

        bytes32 golden = _golden[taskId][frameId];
        require(golden != bytes32(0), "no answer key for frame");

        if (answer == golden) {
            require(!_framePaid[taskId][frameId], "frame already claimed");
            _framePaid[taskId][frameId] = true;

            uint256 fee = (t.reward * protocolFee) / 10000;
            uint256 payout = t.reward - fee;
            accumulatedFees += fee;
            t.bounty -= t.reward;
            t.completed += 1;

            _grantPoints(msg.sender);

            emit AnswerAccepted(taskId, frameId, msg.sender, payout);

            (bool ok, ) = msg.sender.call{value: payout}("");
            require(ok, "payout failed");

            if (t.bounty == 0) t.active = false;
        } else {
            t.rejected += 1;
            winStreak[msg.sender] = 0;
            emit AnswerRejected(taskId, frameId, msg.sender, uint8(answer[0]));
        }
    }

    function closeTask(uint256 taskId) external {
        Task storage t = tasks[taskId];
        require(t.active, "not active");
        require(msg.sender == t.creator || msg.sender == owner, "not authorized");
        uint256 refund = t.bounty;
        t.bounty = 0;
        t.active = false;
        if (refund > 0) {
            (bool ok, ) = t.creator.call{value: refund}("");
            require(ok, "withdraw failed");
        }
        emit TaskClosed(taskId);
    }

    function withdrawFees() external {
        require(msg.sender == owner, "not owner");
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        (bool ok, ) = owner.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    function _grantPoints(address worker) internal {
        points[worker] += XP_PER_CORRECT;
        uint32 win = winStreak[worker] + 1;
        winStreak[worker] = win;

        uint48 today = uint48(block.timestamp / 86400) + 1; // +1 so 0 means "never"
        uint48 last = lastCorrectDay[worker];
        if (last == 0 || last < today - 1) {
            dayStreak[worker] = 1;
        } else if (last == today - 1) {
            dayStreak[worker] += 1;
        }
        lastCorrectDay[worker] = today;

        if (!_isWorker[worker]) {
            _isWorker[worker] = true;
            _workers.push(worker);
        }

        emit XpEarned(worker, points[worker], win, dayStreak[worker]);
    }

    function getLeaderboard(uint256 limit)
        external
        view
        returns (address[] memory addrs, uint256[] memory pts, uint32[] memory wins, uint32[] memory streakDays)
    {
        uint256 total = _workers.length;
        uint256 n = total < limit ? total : limit;

        address[] memory all = new address[](total);
        uint256[] memory allPts = new uint256[](total);
        uint32[] memory allWins = new uint32[](total);
        uint32[] memory allDays = new uint32[](total);

        for (uint256 i = 0; i < total; i++) {
            address w = _workers[i];
            all[i] = w;
            allPts[i] = points[w];
            allWins[i] = winStreak[w];
            allDays[i] = dayStreak[w];
        }

        for (uint256 i = 1; i < total; i++) {
            uint256 j = i;
            while (j > 0 && allPts[j] > allPts[j - 1]) {
                (all[j], all[j - 1]) = (all[j - 1], all[j]);
                (allPts[j], allPts[j - 1]) = (allPts[j - 1], allPts[j]);
                (allWins[j], allWins[j - 1]) = (allWins[j - 1], allWins[j]);
                (allDays[j], allDays[j - 1]) = (allDays[j - 1], allDays[j]);
                j--;
            }
        }

        addrs = new address[](n);
        pts = new uint256[](n);
        wins = new uint32[](n);
        streakDays = new uint32[](n);

        for (uint256 i = 0; i < n; i++) {
            addrs[i] = all[i];
            pts[i] = allPts[i];
            wins[i] = allWins[i];
            streakDays[i] = allDays[i];
        }
    }
}
```

#### How the contract handles deposit, verification, and instant payout

**Deposit (MON only — no ERC-20/USDC support anywhere in the repo).**
`createTask(...)` is `payable`. The creator sends native MON as `msg.value` ≥ `rewardPerFrame * frameCount`; this becomes `Task.bounty`, tracked per-task inside the contract's own balance (there is no separate vault/escrow contract — `MicroTask` *is* the escrow). In the same transaction, the creator must also supply `goldenAnswers` — a `bytes32[]` of keccak256 hashes, one per frame — committed on-chain up front rather than revealed later. `closeTask` lets the creator (or `owner`) reclaim unspent `bounty` early. `withdrawFees` lets only `owner` (the deployer) sweep the accumulated 2% protocol cut (`protocolFee = 200` bps).

**Task verification — the "golden key" model.**
Despite the name, this is **not** a cryptographic signature/EIP-712 release mechanism — it is a deterministic, permissionless, on-chain hash-comparison lookup:
1. At creation, each frame's canonical answer is stored as a keccak256 hash in `_golden[taskId][frameId]`.
2. A worker calls `submitAnswer(taskId, frameId, bytes32 answer)`, where `answer` is computed **client-side** (see `lib/answers.ts`) as the keccak256 of either a single option byte or a normalized free-text string.
3. The contract does one `if (answer == golden)` comparison in the same transaction — no oracle, no admin approval, no queue.

**Instant payout, sub-second.**
On a match: `_framePaid[taskId][frameId]` is flipped true (blocks double-claiming that frame), the 2% fee is computed and added to `accumulatedFees`, `bounty` and `completed` are updated, XP/streaks are granted via `_grantPoints`, `AnswerAccepted` is emitted, and the payout is sent **immediately** in the same call via `msg.sender.call{value: payout}("")` — no separate claim transaction. If `bounty` reaches 0, the task auto-deactivates. On a mismatch: `rejected` increments, the worker's `winStreak` resets to 0, `AnswerRejected` fires, no funds move. The `AnswerPending` event is declared but **never emitted** anywhere in the contract — it is vestigial (the frontend still listens for it defensively).

**Task/quest metadata.** 4 kinds: `KIND_OPTIONS`(0), `KIND_YESNO`(1), `KIND_RATING`(2, 1–5), `KIND_TEXT`(3, free text hash). `MAX_FRAMES = 500` caps frames per task. `getTask(taskId)` is the safe read path (returns the full struct including the dynamic `options[]` array); the auto-generated public `tasks(uint256)` getter is explicitly avoided client-side because Solidity drops dynamic array fields from struct auto-getters.

### 3. Frontend Hooks & Verification State

MicroWorks has **no dedicated `hooks/` directory** — all data-fetching and event-watching logic lives inline inside `components/*.tsx` using wagmi hooks directly (`useReadContract`, `useReadContracts`, `useWriteContract`, `useWaitForTransactionReceipt`, `useWatchContractEvent`).

**`components/DoTask.tsx` — submit proof, decode receipt for payout/XP.**
Builds the answer hash client-side via `lib/answers.ts` (`optionAnswerHash` / `textAnswerHash`), calls `writeContract({ functionName: "submitAnswer", args: [task.id, BigInt(frameId), answerHash] })` through `useWriteContract`, awaits the receipt via `useWaitForTransactionReceipt`, then manually decodes the receipt's logs to drive UI/sound feedback:

```tsx
const ACCEPTED_TOPIC = getEventSelector("AnswerAccepted(uint256,uint256,address,uint256)");
const REJECTED_TOPIC = getEventSelector("AnswerRejected(uint256,uint256,address,uint8)");
const XP_TOPIC = getEventSelector("XpEarned(address,uint256,uint32,uint32)");
...
useEffect(() => {
  if (!receipt || !hash) return;
  let sawAccepted = false;
  let sawRejected = false;
  let streakCount = 0;
  for (const log of receipt.logs) {
    if (log.address?.toLowerCase() !== network.contractAddress.toLowerCase()) continue;
    const topic = log.topics?.[0]?.toLowerCase();
    try {
      const ev = decodeEventLog({ abi: CONTRACT_ABI, data: log.data, topics: log.topics as never });
      if (ev.eventName === "AnswerAccepted") {
        const { amount } = ev.args as { amount: bigint };
        setLastPayout(formatEther(amount));
        sawAccepted = true;
      } else if (ev.eventName === "AnswerRejected") {
        sawRejected = true;
      } else if (ev.eventName === "XpEarned") {
        const { points, winStreak: w, dayStreak: d } = ev.args as { points: bigint; winStreak: number; dayStreak: number };
        setXpGain(Number(points));
        streakCount = Number(w);
        setWinStreak(streakCount);
        setDayStreak(Number(d));
      }
      if (topic === ACCEPTED_TOPIC) sawAccepted = true;
      if (topic === REJECTED_TOPIC) sawRejected = true;
    } catch { /* skip malformed log */ }
  }
  if (sawAccepted) {
    setOutcome("accepted");
    if (streakCount > 1) sounds.playCombo(); else sounds.playCoin();
  } else if (sawRejected) {
    setOutcome("rejected");
    sounds.playMiss();
  } else {
    setOutcome("pending");
  }
}, [receipt, hash, network.contractAddress]);
```

**`components/PayoutTicker.tsx` — live settlement feed via `useWatchContractEvent`.**
Watches four events in parallel (`AnswerAccepted`, `AnswerRejected`, `AnswerPending`, `TaskCreated`), each its own `useWatchContractEvent` call, normalizing logs into `FeedEvent` records pushed to local `useState` (capped at `MAX_ITEMS = 35`, pruned every 15s past 120s age):

```tsx
useWatchContractEvent({
  address: network.contractAddress,
  chainId: network.chainId,
  abi: CONTRACT_ABI,
  eventName: "AnswerAccepted",
  onLogs: (logs) =>
    logs.forEach((log) =>
      push.current({
        kind: "accepted",
        taskId: log.args.taskId?.toString() ?? "?",
        frameId: log.args.frameId?.toString() ?? "?",
        worker: log.args.worker,
        amount: log.args.amount,
      }),
    ),
});
```
(repeated similarly for `AnswerRejected`, `AnswerPending`, `TaskCreated`). It also computes an `isMine` flag by comparing `worker.toLowerCase()` against `useAccount().address`, and supports filter tabs (all / mine / accepted).

**`components/PlayerHQ.tsx` — worker XP/streak reads (the closest thing to a "balance" feed).**
Three `useReadContract` calls (`points`, `winStreak`, `dayStreak`), each keyed on the connected `address`, each polling every 4s:

```tsx
const { data: pointsData } = useReadContract({
  address: network.contractAddress, abi: CONTRACT_ABI, chainId: network.chainId,
  functionName: "points", args: address ? [address] : undefined,
  query: { enabled: !!address, refetchInterval: 4000 },
});
```
(identical pattern repeated for `winStreak`, `dayStreak`.) **Important**: `MicroTask.sol` has no persistent claimable-balance ledger — payouts go straight to the wallet inside `submitAnswer`, so "balance" in this UI means gamification XP, not an accrued MON balance. No `useBalance` call exists anywhere in the inspected components.

**`components/TaskList.tsx` — quest board polling.**
`useReadContract("taskCount")` + batched `useReadContracts` (`getTask(i)` for every `i` in `0..count`, rebuilt via `useMemo`), plus a manual 5s poll:
```tsx
useEffect(() => {
  const t = setInterval(() => { refetch(); refetchCount(); }, 5000);
  return () => clearInterval(t);
}, [refetch, refetchCount]);
```

**`components/Leaderboard.tsx`** reads `getLeaderboard(20n)` via `useReadContract` with `refetchInterval: 4000`, sorted client-side by XP.

**`components/CreateTask.tsx`** builds `goldenAnswers[]` client-side (auto-generate or manual `frame:answer` parsing) and calls `writeContract({ functionName: "createTask", ..., value: escrow })` where `escrow = rewardWei * BigInt(frameCount)`.

#### State management flow

- **No Redux/Zustand/MobX.** State is a mix of React Context, TanStack React Query (via wagmi), and local component state.
- **React Context** (`lib/network.tsx`): `NetworkProvider`/`useNetwork()` holds the active `NetworkInfo` (chain, contract address, explorer), persisted to `localStorage` (`mw-network`). Wraps the app in `app/providers.tsx`: `WagmiProvider` → `QueryClientProvider` → `NetworkProvider`.
- **TanStack React Query** (wagmi's built-in cache layer, single shared `QueryClient`): backs every `useReadContract`/`useReadContracts` call and drives the `refetchInterval` polling for XP/streaks (4s), leaderboard (4s), and (via manual `setInterval` + `refetch()`) the task list (5s).
- **Local `useState`/`useRef`**: the live payout feed in `PayoutTicker.tsx` is plain `useState<FeedEvent[]>` fed by `useWatchContractEvent` `onLogs` callbacks (wrapped in a `useRef` to dodge stale closures), pruned on a timer. `DoTask.tsx` uses local state for per-submission outcome/payout/XP/streak, populated from decoded receipt logs.
- There is **no global worker-balance store** — because the contract itself has no claimable-balance ledger. Live payout amounts are ephemeral: derived per-event from `AnswerAccepted.amount`, held only in the transient ticker feed and the `DoTask` success banner, never accumulated into a running total in the frontend.

#### Other notable findings (carry-forward candidates for BountyDrop)

- Category taxonomy (`lib/constants.ts`): `label, poll, caption, verify, transcribe, qa`.
- XP/level system (`lib/constants.ts`, pure client-side derivation from on-chain reads): Rookie(0) → Helper(500) → Contributor(1500) → Expert(3000) → Grandmaster(6000).
- `contracts/test/MicroTask.t.sol` exists (README claims 12 passing tests) — not yet read in full; pull on demand if BountyDrop's escrow tests need a reference.
- Deployed addresses: testnet `0x26e67271c65ac40d419dffe8d6ad7ffcb2755237`, mainnet `0x61ab6619031b483139ada409955c2dcd01579ed7`.

---

## SECTION 2: TAPPAY - NFC SPEND TERMINAL & LEDGER

> Source: `./TapPay/tappay`. This is a **React Native 0.87.1 mobile app** (Android-first; iOS project scaffold exists but has no NFC/HCE implementation), not a web app — a structurally different stack from MicroWorks (no wagmi/viem; uses `ethers` v6 directly, Hardhat instead of Foundry). Findings below are extracted directly from the repository's source files.

### Project structure

```
tappay/
├── App.tsx, index.js, app.json, babel.config.js, metro.config.js, tsconfig.json
├── android/                          # full native Android project (package com.tappay)
│   └── app/src/main/java/com/tappay/nfc/   — TapNfcReaderModule.kt, TapNfcReaderPackage.kt
│   └── app/src/main/java/com/reactnativehce/  — vendored react-native-hce Java source
├── ios/                              # Xcode project; no NFC-specific native code
├── contracts/                        # Hardhat project
│   ├── TapPayLedger.sol
│   ├── UsernameRegistry.sol
│   └── test/ReentrancyAttacker.sol
├── test/                             # TapPayLedger.test.js, UsernameRegistry.test.js
├── scripts/deploy.js
├── hardhat.config.js
└── src/
    ├── config/monad.ts, supabase.ts
    ├── context/WalletContext.tsx
    ├── navigation/AppNavigator.tsx
    ├── screens/           — Home, WalletSetup, SendTap, ReceiveTap, SendPayment,
    │                        UsernamePay, TransactionStatus, TransactionHistory,
    │                        AccountInfo, Settings, Network, About
    ├── services/          — hce.ts, nfcReader.ts, tapNfcNative.ts, tapPayment.ts,
    │                        wallet.ts, registry.ts, history.ts
    ├── utils/             — apdu.ts, type4Nfc.ts, format.ts, validation.ts, haptics.ts
    └── components/        — ConfirmPaymentModal, InsufficientBalanceModal,
                              NfcNotAvailableModal, NfcWaitingCard, GlobalAlert,
                              PulsingRadar, AppIcons, BrandLogo
```

Package manager: npm. Node engine: `>= 22.11.0`. No `hooks/` and no `useNFC`/`useTapToPay` custom hook — NFC flow is implemented as plain async service functions called directly from `SendTapScreen.tsx`/`ReceiveTapScreen.tsx`.

### 1. On-Chain NFC Ledger Contract

TapPay has **two** contracts, both `pragma solidity ^0.8.24`, both built on OpenZeppelin v5 (`^5.6.1`) — `ReentrancyGuard`, `Pausable`, `Ownable2Step`.

#### `contracts/TapPayLedger.sol` (full source, 239 lines)

This is **not an escrow** — it never custodies funds. It's a pass-through payment logger with session-based replay protection: the sender's MON is forwarded to the recipient atomically within the same transaction, and the transfer is logged on-chain with a `sessionId` that ties back to the off-chain NFC handshake.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title TapPayLedger
 * @notice Hardened payment logging contract with session-based replay protection for TapPay on Monad.
 * @dev The actual payment rail. Sender calls payWithLog() with msg.value; it forwards
 *      to receiver and logs the tap-pay event with a sessionId linking back to the
 *      off-chain NFC handshake.
 *
 *      No custody: contract never holds funds beyond a single atomic transaction.
 *      It's a pass-through logger, not an escrow.
 *
 *      Security layers:
 *      - ReentrancyGuard (defense in depth — .call forwards all gas)
 *      - Checks-effects-interactions pattern (usedSessionIds marked BEFORE external call)
 *      - Pausable emergency stop
 *      - Ownable2Step (safer ownership transfer)
 *      - Payment limits (min/max) to prevent dust-spam and limit exposure
 *      - Deadline enforcement for session expiry
 *      - Direct ETH send rejection (no accidental fund locking)
 */
contract TapPayLedger is ReentrancyGuard, Pausable, Ownable2Step {
    // ──────────────────────────────────────────────
    // Custom Errors (saves ~200 gas/revert vs require strings)
    // ──────────────────────────────────────────────
    error InvalidRecipient();
    error SelfPayment();
    error ZeroAmount();
    error BelowMinPayment(uint256 amount, uint256 minPayment);
    error AboveMaxPayment(uint256 amount, uint256 maxPayment);
    error SessionAlreadyUsed(bytes32 sessionId);
    error SessionExpired(bytes32 sessionId, uint256 deadline);
    error TransferFailed();
    error DirectTransferNotAllowed();
    error InvalidPaymentLimits(uint256 min, uint256 max);
    error BatchLengthMismatch();
    error BatchEmpty();
    error BatchTooLarge(uint256 length, uint256 maxBatchSize);
    error BatchValueMismatch(uint256 sent, uint256 required);

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────
    event PaymentLogged(
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 sessionId,
        uint256 timestamp
    );

    event PaymentLimitsUpdated(uint256 minPayment, uint256 maxPayment);

    // ──────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────
    uint256 public constant MAX_BATCH_SIZE = 10;

    // ──────────────────────────────────────────────
    // Storage — payment limits (configurable by owner)
    // ──────────────────────────────────────────────
    uint256 public minPayment;
    uint256 public maxPayment;

    // ──────────────────────────────────────────────
    // Storage — analytics
    // ──────────────────────────────────────────────
    uint256 public totalPayments;
    uint256 public totalVolume;

    // ──────────────────────────────────────────────
    // Storage — replay protection
    // ──────────────────────────────────────────────
    mapping(bytes32 => bool) public usedSessionIds;

    // ──────────────────────────────────────────────
    // Constructor — OZ v5 pattern
    // ──────────────────────────────────────────────
    constructor() Ownable(msg.sender) {
        // Default limits: 0.0001 MON min, 10,000 MON max
        minPayment = 0.0001 ether;
        maxPayment = 10_000 ether;
    }

    // ──────────────────────────────────────────────
    // External Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Pay a recipient with an on-chain event log and session replay protection
     * @param to The recipient wallet address
     * @param sessionId Session identifier from the NFC handshake (prevents replay)
     * @param deadline Unix timestamp after which the session is expired (0 = no deadline)
     * @dev Checks-effects-interactions: usedSessionIds marked BEFORE external .call
     */
    function payWithLog(address to, bytes32 sessionId, uint256 deadline)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        _validateAndPay(to, msg.value, sessionId, deadline);
    }

    /**
     * @notice Backward-compatible payWithLog without deadline (deadline = 0 = no expiry)
     * @param to The recipient wallet address
     * @param sessionId Session identifier from the NFC handshake (prevents replay)
     */
    function payWithLog(address to, bytes32 sessionId)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        _validateAndPay(to, msg.value, sessionId, 0);
    }

    /**
     * @notice Batch payment — pay multiple recipients in a single transaction
     * @param recipients Array of recipient addresses
     * @param amounts Array of payment amounts (must match recipients length)
     * @param sessionIds Array of session IDs (must match recipients length)
     * @dev Total msg.value must equal sum of amounts. Gas-efficient for multi-tap flows.
     */
    function payMultiple(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32[] calldata sessionIds
    )
        external
        payable
        whenNotPaused
        nonReentrant
    {
        uint256 len = recipients.length;
        if (len == 0) revert BatchEmpty();
        if (len > MAX_BATCH_SIZE) revert BatchTooLarge(len, MAX_BATCH_SIZE);
        if (amounts.length != len || sessionIds.length != len) revert BatchLengthMismatch();

        // Verify total value matches sum of amounts
        uint256 totalRequired = 0;
        for (uint256 i = 0; i < len; i++) {
            totalRequired += amounts[i];
        }
        if (msg.value != totalRequired) revert BatchValueMismatch(msg.value, totalRequired);

        // Process each payment with its individual amount
        for (uint256 i = 0; i < len; i++) {
            _validateAndPay(recipients[i], amounts[i], sessionIds[i], 0);
        }
    }

    /**
     * @notice Check if a session ID has already been used
     * @param sessionId Session identifier to check
     * @return Whether the session has been used
     * @dev Useful for client-side pre-checks to avoid wasted gas on a guaranteed revert
     */
    function isSessionUsed(bytes32 sessionId) external view returns (bool) {
        return usedSessionIds[sessionId];
    }

    // ──────────────────────────────────────────────
    // Owner Controls
    // ──────────────────────────────────────────────

    /**
     * @notice Update payment limits
     * @param _minPayment New minimum payment amount (can be 0 to disable)
     * @param _maxPayment New maximum payment amount (must be >= _minPayment, 0 = unlimited)
     */
    function setPaymentLimits(uint256 _minPayment, uint256 _maxPayment) external onlyOwner {
        if (_maxPayment != 0 && _maxPayment < _minPayment) {
            revert InvalidPaymentLimits(_minPayment, _maxPayment);
        }
        minPayment = _minPayment;
        maxPayment = _maxPayment;
        emit PaymentLimitsUpdated(_minPayment, _maxPayment);
    }

    // ──────────────────────────────────────────────
    // Emergency Controls (owner-only)
    // ──────────────────────────────────────────────
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ──────────────────────────────────────────────
    // Reject direct ETH sends (prevent accidental fund locking)
    // ──────────────────────────────────────────────
    receive() external payable {
        revert DirectTransferNotAllowed();
    }

    fallback() external payable {
        revert DirectTransferNotAllowed();
    }

    // ──────────────────────────────────────────────
    // Internal
    // ──────────────────────────────────────────────

    /**
     * @dev Core payment logic — shared by single and batch payment functions
     * @param to Recipient address
     * @param amount Payment amount in wei
     * @param sessionId Session identifier for replay protection
     * @param deadline Unix timestamp for session expiry (0 = no deadline)
     */
    function _validateAndPay(address to, uint256 amount, bytes32 sessionId, uint256 deadline) internal {
        if (to == address(0)) revert InvalidRecipient();
        if (to == msg.sender) revert SelfPayment();
        if (amount == 0) revert ZeroAmount();
        if (amount < minPayment) revert BelowMinPayment(amount, minPayment);
        if (maxPayment != 0 && amount > maxPayment) revert AboveMaxPayment(amount, maxPayment);
        if (usedSessionIds[sessionId]) revert SessionAlreadyUsed(sessionId);
        if (deadline != 0 && block.timestamp > deadline) revert SessionExpired(sessionId, deadline);

        // Effects: mark session as used BEFORE external call (CEI pattern)
        usedSessionIds[sessionId] = true;

        // Analytics
        unchecked {
            totalPayments++;
            totalVolume += amount;
        }

        // Interactions: forward native MON to recipient
        (bool sent, ) = to.call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit PaymentLogged(msg.sender, to, amount, sessionId, block.timestamp);
    }
}
```

Note: `payWithLog` is overloaded (with and without `deadline`) — the app's `wallet.ts` only ever calls the 2-arg overload (no deadline enforcement in practice today).

#### `contracts/UsernameRegistry.sol` (full source, 164 lines)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title UsernameRegistry
 * @notice Hardened on-chain mapping between human-readable usernames and Monad wallet addresses for TapPay.
 * @dev Fully on-chain identity layer — the hackathon differentiator.
 *      One username per address, enforced on-chain.
 *      Lowercase-only + alphanumeric + underscore charset enforced on-chain.
 *      Uses OZ v5 Pausable + Ownable2Step for safety.
 *
 *      Security additions:
 *      - Admin force-remove for abusive/inappropriate usernames
 *      - Registration counter for analytics
 *      - isAvailable() view for UI pre-checks
 *      - Indexed username hash in events for efficient off-chain filtering
 */
contract UsernameRegistry is Pausable, Ownable2Step {
    // ──────────────────────────────────────────────
    // Custom Errors (saves gas vs require strings)
    // ──────────────────────────────────────────────
    error InvalidUsernameLength(uint256 length);
    error InvalidCharacter(bytes1 char, uint256 position);
    error UsernameTaken(string username);
    error AlreadyRegistered(address user);
    error NotRegistered(address user);
    error CannotRemoveZeroAddress();

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────
    event UsernameRegistered(string username, address indexed owner, bytes32 indexed usernameHash);
    event UsernameReleased(string username, address indexed owner, bytes32 indexed usernameHash);
    event UsernameForceRemoved(string username, address indexed formerOwner, address indexed removedBy);

    // ──────────────────────────────────────────────
    // Constants
    // ──────────────────────────────────────────────
    uint8 public constant MIN_LEN = 3;
    uint8 public constant MAX_LEN = 20;

    // ──────────────────────────────────────────────
    // Storage
    // ──────────────────────────────────────────────
    mapping(string => address) private _usernameToAddress;
    mapping(address => string) private _addressToUsername;

    // Analytics
    uint256 public totalRegistrations;

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────
    modifier validUsername(string calldata username) {
        bytes memory b = bytes(username);
        if (b.length < MIN_LEN || b.length > MAX_LEN) revert InvalidUsernameLength(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (!(
                (c >= 0x61 && c <= 0x7A) || // a-z
                (c >= 0x30 && c <= 0x39) || // 0-9
                (c == 0x5F)                 // _
            )) revert InvalidCharacter(c, i);
        }
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor — OZ v5 pattern
    // ──────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ──────────────────────────────────────────────
    // External Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Register a unique username for msg.sender
     * @param username The chosen username (3-20 characters: a-z, 0-9, _)
     */
    function register(string calldata username) external whenNotPaused validUsername(username) {
        if (_usernameToAddress[username] != address(0)) revert UsernameTaken(username);
        if (bytes(_addressToUsername[msg.sender]).length > 0) revert AlreadyRegistered(msg.sender);

        _usernameToAddress[username] = msg.sender;
        _addressToUsername[msg.sender] = username;

        unchecked {
            totalRegistrations++;
        }

        emit UsernameRegistered(username, msg.sender, keccak256(bytes(username)));
    }

    /**
     * @notice Release the current username held by msg.sender, freeing both slots
     * @dev Non-custodial: users can free their username without admin intervention
     */
    function release() external {
        string memory username = _addressToUsername[msg.sender];
        if (bytes(username).length == 0) revert NotRegistered(msg.sender);

        delete _usernameToAddress[username];
        delete _addressToUsername[msg.sender];

        emit UsernameReleased(username, msg.sender, keccak256(bytes(username)));
    }

    /**
     * @notice Resolve a username to its corresponding wallet address
     * @param username The username to resolve
     * @return The bound address, or address(0) if not found
     */
    function resolve(string calldata username) external view returns (address) {
        return _usernameToAddress[username];
    }

    /**
     * @notice Reverse-resolve an address to its registered username
     * @param user The wallet address
     * @return The registered username, or empty string if unregistered
     */
    function reverseResolve(address user) external view returns (string memory) {
        return _addressToUsername[user];
    }

    /**
     * @notice Check if a username is available for registration
     * @param username The username to check
     * @return True if the username is not taken
     */
    function isAvailable(string calldata username) external view returns (bool) {
        return _usernameToAddress[username] == address(0);
    }

    // ──────────────────────────────────────────────
    // Admin Controls (owner-only)
    // ──────────────────────────────────────────────

    /**
     * @notice Force-remove a user's username (for abusive/inappropriate names)
     * @param user The address whose username should be removed
     * @dev Only callable by the contract owner. Clears both mappings.
     */
    function adminRemove(address user) external onlyOwner {
        if (user == address(0)) revert CannotRemoveZeroAddress();
        string memory username = _addressToUsername[user];
        if (bytes(username).length == 0) revert NotRegistered(user);

        delete _usernameToAddress[username];
        delete _addressToUsername[user];

        emit UsernameForceRemoved(username, user, msg.sender);
    }

    // ──────────────────────────────────────────────
    // Emergency Controls (owner-only)
    // ──────────────────────────────────────────────
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
```

**How wallet addresses and usernames are actually resolved and mapped**: on paper, `UsernameRegistry.sol` is the identity layer — one username per address, `register`/`release`/`resolve`/`reverseResolve`/`isAvailable`, deployed on-chain at `0xEebB05F9AF06908eCb7bFa5F916Dde1EEa231aDD` (testnet). **But the running app never calls this contract.** `src/services/registry.ts` talks directly to a **Supabase Postgres table** (`usernames`, columns `username`/`normalized_username`/`wallet_address`) instead:
- `registerUsername(username)` inserts a row, applying homoglyph normalization (`0`→`o`, `1`→`l`, lowercase) to block lookalike-username squatting; on a unique-constraint violation (Postgres `23505`) it generates 3 randomized-suffix suggestions.
- `resolveUsername(username)` queries `usernames.wallet_address` by exact `username` (callers pre-lowercase/trim before calling).
- `reverseResolveAddress(address)` queries `usernames.username` by `wallet_address`.
- `releaseUsername()` is stubbed — returns an error, unimplemented — even though the on-chain contract's `release()` works.

**Flag for BountyDrop's clean-room build**: this is a real architectural discrepancy in TapPay, not a design to copy uncritically — an on-chain identity registry exists and is deployed, but production username resolution actually runs off-chain via Supabase. If BountyDrop wants trust-minimized identity, wire the registry contract directly into the client; if speed/UX wins, be deliberate about choosing Supabase and document it as authoritative (don't let the two silently diverge as they have here).

Also present: `contracts/test/ReentrancyAttacker.sol`, a Hardhat test helper exercising `TapPayLedger`'s reentrancy guard (see `test/TapPayLedger.test.js`).

### 2. NFC & Hardware Handshake Pipeline

**Architecture: "One-Way NFC".** The RECEIVER's phone acts as an HCE card, broadcasting *only their wallet address* (never a key or a signed payload). The SENDER's phone acts as an NFC reader that reads that address, then broadcasts the actual payment as a normal signed transaction over Monad RPC — the payment itself never travels over NFC, only the recipient's address does.

There is **no Web NFC API usage anywhere in this repo** (`NDEFReader`/`navigator.nfc` appear only in prose inside a markdown doc, not in code) — this is a native mobile app. NFC is implemented via two parallel paths: a custom native Android module (`TapNfcReaderModule.kt`, preferred) plus the `react-native-hce` library (card-emulation/broadcast side) and `react-native-nfc-manager` (a pure-JS IsoDep fallback reader).

**Receiver side — HCE broadcast.** `src/services/hce.ts` (full source):

```typescript
/**
 * HCE Service — Host Card Emulation session management for One-Way NFC
 *
 * Receiver acts as Card (HCE) broadcasting their address.
 */

import {HCESession, NFCTagType4, NFCTagType4NDEFContentType} from 'react-native-hce';
import {SESSION_TIMEOUT_MS} from '../config/monad';
import {encodeReceiverAddress} from '../utils/apdu';

let _activeSession: HCESession | null = null;
let _sessionTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleExpiry(): void {
  if (_sessionTimer) {
    clearTimeout(_sessionTimer);
  }
  _sessionTimer = setTimeout(() => {
    stopHceSession();
  }, SESSION_TIMEOUT_MS);
}

async function ensureSession(): Promise<HCESession> {
  if (!_activeSession) {
    _activeSession = await HCESession.getInstance();
  }
  return _activeSession;
}

/**
 * Start an HCE session broadcasting the receiver's address.
 */
export async function startHceReceiverSession(
  receiverAddress: string,
): Promise<boolean> {
  try {
    // Stop any existing session first
    await stopHceSession();

    const encodedAddress = encodeReceiverAddress(receiverAddress);
    console.log('[HCE] Broadcasting address:', encodedAddress);

    const tag = new NFCTagType4({
      type: NFCTagType4NDEFContentType.Text,
      content: encodedAddress,
      writable: false,
    });

    const session = await ensureSession();

    // IMPORTANT: Set application content BEFORE enabling the service
    // so CardService.onCreate reads the correct data from SharedPreferences
    await session.setApplication(tag);

    // Small pause to ensure SharedPreferences commit completes
    await new Promise(resolve => setTimeout(resolve, 100));

    await session.setEnabled(true);

    // Pause for Android to fully register the HostApduService with the NFC subsystem
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('[HCE] Session enabled and broadcasting');
    scheduleExpiry();
    return true;
  } catch (error) {
    console.error('Failed to start HCE session:', error);
    return false;
  }
}

/**
 * Stop the active HCE session.
 */
export async function stopHceSession(): Promise<void> {
  try {
    if (_sessionTimer) {
      clearTimeout(_sessionTimer);
      _sessionTimer = null;
    }

    if (_activeSession) {
      await _activeSession.setEnabled(false);
    }
  } catch (error) {
    console.error('Failed to stop HCE session:', error);
  }
}

export function isHceActive(): boolean {
  return _activeSession?.enabled ?? false;
}

export function teardownHce(): void {
  stopHceSession();
}

export {HCESession};
```

Payload encoding — `src/utils/apdu.ts` (full source): the broadcast content is literally `"RECV" + <40 hex chars of the address>`, no signature, no checksum, no version byte (an `APDU_VERSION` constant is declared in `monad.ts` but unused):

```typescript
/**
 * APDU Binary Encoding/Decoding Utilities for One-Way NFC Architecture
 *
 * Receiver broadcasts their address as a hex string via NDEF.
 */

export const RECEIVER_NDEF_PREFIX = 'RECV';

/**
 * Encode a receiver's address into an NDEF content string (hex).
 */
export function encodeReceiverAddress(receiverAddress: string): string {
  const addrHex = receiverAddress.replace('0x', '');
  return `${RECEIVER_NDEF_PREFIX}${addrHex}`;
}

/**
 * Decode a receiver's address from an NDEF content string.
 */
export function decodeReceiverAddress(text: string): string | null {
  if (!text || !text.startsWith(RECEIVER_NDEF_PREFIX)) {
    return null;
  }

  const hex = text.slice(RECEIVER_NDEF_PREFIX.length);
  if (hex.length !== 40) {
    return null; // A valid Ethereum address is 40 hex characters (20 bytes)
  }

  return `0x${hex}`;
}
```

**Sender side — native Android reader.** `android/app/src/main/java/com/tappay/nfc/TapNfcReaderModule.kt` (full source, custom module preferred over `react-native-nfc-manager` for reliability) uses `Activity.enableReaderMode()` and manually walks the ISO-DEP APDU sequence (SELECT Type-4 NDEF app → SELECT NDEF file → READ BINARY length → READ BINARY message) to pull the NDEF text record off the receiver's HCE card:

```kotlin
package com.tappay.nfc

import android.app.Activity
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Native NFC reader for phone-to-phone HCE Type 4 tag reading.
 * Uses Activity.enableReaderMode() which is required for reliable HCE detection.
 */
class TapNfcReaderModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()
  private val readerActive = AtomicBoolean(false)
  private var readerCallback: NfcAdapter.ReaderCallback? = null

  override fun getName(): String = "TapNfcReader"

  @ReactMethod
  fun startReaderMode(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "App must be in foreground to scan NFC")
      return
    }

    val adapter = NfcAdapter.getDefaultAdapter(activity)
    if (adapter == null || !adapter.isEnabled) {
      promise.reject("NFC_DISABLED", "NFC is disabled on this device")
      return
    }

    try {
      stopReaderModeInternal(activity, adapter)

      val flags =
        NfcAdapter.FLAG_READER_NFC_A or
          NfcAdapter.FLAG_READER_NFC_B or
          NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK or
          NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS

      readerCallback = NfcAdapter.ReaderCallback { tag ->
        if (!readerActive.get()) {
          return@ReaderCallback
        }
        executor.execute { handleTag(tag) }
      }

      adapter.enableReaderMode(activity, readerCallback, flags, null)
      readerActive.set(true)
      promise.resolve(true)
    } catch (e: Exception) {
      Log.e(TAG, "startReaderMode failed", e)
      promise.reject("READER_START_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun stopReaderMode(promise: Promise) {
    val activity = reactContext.currentActivity
    val adapter = activity?.let { NfcAdapter.getDefaultAdapter(it) }
    if (activity != null && adapter != null) {
      stopReaderModeInternal(activity, adapter)
    } else {
      readerActive.set(false)
      readerCallback = null
    }
    promise.resolve(true)
  }

  @ReactMethod
  fun isReaderModeActive(promise: Promise) {
    promise.resolve(readerActive.get())
  }

  private fun stopReaderModeInternal(activity: Activity, adapter: NfcAdapter) {
    try {
      adapter.disableReaderMode(activity)
    } catch (e: Exception) {
      Log.w(TAG, "disableReaderMode: ${e.message}")
    }
    readerActive.set(false)
    readerCallback = null
  }

  private fun handleTag(tag: Tag) {
    try {
      val isoDep = IsoDep.get(tag) ?: run {
        emitError("Tag does not support ISO-DEP (required for Tap Pay HCE)")
        return
      }

      isoDep.connect()
      isoDep.timeout = 5000

      val text = readType4NdefText(isoDep)
      isoDep.close()

      if (text != null) {
        emitTagRead(text)
      } else {
        emitError("Could not read payment data from HCE card")
      }
    } catch (e: Exception) {
      Log.e(TAG, "handleTag failed", e)
      emitError(e.message ?: "NFC read failed")
    }
  }

  private fun readType4NdefText(isoDep: IsoDep): String? {
    val selectApp =
      byteArrayOf(
        0x00,
        0xA4.toByte(),
        0x04,
        0x00,
        0x07,
        0xD2.toByte(),
        0x76,
        0x00,
        0x00,
        0x85.toByte(),
        0x01,
        0x01,
        0x00,
      )

    if (!isApduSuccess(isoDep.transceive(selectApp))) {
      // Some devices omit Le — retry without trailing 0x00
      val selectAppNoLe =
        byteArrayOf(
          0x00,
          0xA4.toByte(),
          0x04,
          0x00,
          0x07,
          0xD2.toByte(),
          0x76,
          0x00,
          0x00,
          0x85.toByte(),
          0x01,
          0x01,
        )
      if (!isApduSuccess(isoDep.transceive(selectAppNoLe))) {
        return null
      }
    }

    val selectFile = byteArrayOf(0x00, 0xA4.toByte(), 0x00, 0x0C, 0x02, 0xE1.toByte(), 0x04)
    if (!isApduSuccess(isoDep.transceive(selectFile))) {
      return null
    }

    val lenResponse = isoDep.transceive(byteArrayOf(0x00, 0xB0.toByte(), 0x00, 0x00, 0x02))
    if (!isApduSuccess(lenResponse)) {
      return null
    }

    val lenData = lenResponse.copyOf(lenResponse.size - 2)
    val nlen = ((lenData[0].toInt() and 0xFF) shl 8) or (lenData[1].toInt() and 0xFF)
    if (nlen <= 0 || nlen > 0x7FFD) {
      return null
    }

    val readLength = nlen + 2
    val ndefResponse =
      isoDep.transceive(
        byteArrayOf(0x00, 0xB0.toByte(), 0x00, 0x00, readLength.toByte()),
      )
    if (!isApduSuccess(ndefResponse)) {
      return null
    }

    val ndefWithPrefix = ndefResponse.copyOf(ndefResponse.size - 2)
    val ndefMessageBytes = ndefWithPrefix.copyOfRange(2, 2 + nlen)

    val message = NdefMessage(ndefMessageBytes)
    if (message.records.isEmpty()) {
      return null
    }

    val record = message.records[0]
    if (
      record.tnf == NdefRecord.TNF_WELL_KNOWN &&
        record.type.contentEquals(NdefRecord.RTD_TEXT)
    ) {
      val payload = record.payload
      if (payload.size <= 3) {
        return null
      }
      return String(payload.copyOfRange(3, payload.size), Charsets.UTF_8)
    }

    return String(record.payload, Charsets.UTF_8)
  }

  private fun isApduSuccess(response: ByteArray): Boolean {
    return response.size >= 2 &&
      response[response.size - 2] == 0x90.toByte() &&
      response[response.size - 1] == 0x00.toByte()
  }

  private fun emitTagRead(text: String) {
    val params: WritableMap = Arguments.createMap()
    params.putString("text", text)
    sendEvent(EVENT_TAG_READ, params)
  }

  private fun emitError(message: String) {
    val params: WritableMap = Arguments.createMap()
    params.putString("error", message)
    sendEvent(EVENT_TAG_ERROR, params)
  }

  private fun sendEvent(event: String, params: WritableMap) {
    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(event, params)
    } catch (e: Exception) {
      Log.w(TAG, "sendEvent($event) failed: ${e.message}")
    }
  }

  // Required by React Native 0.65+ for modules that emit events
  @ReactMethod
  fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {
    // No-op: required by NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {
    // No-op: required by NativeEventEmitter
  }

  override fun invalidate() {
    val activity = reactContext.currentActivity
    val adapter = activity?.let { NfcAdapter.getDefaultAdapter(it) }
    if (activity != null && adapter != null) {
      stopReaderModeInternal(activity, adapter)
    }
    executor.shutdownNow()
    super.invalidate()
  }

  companion object {
    private const val TAG = "TapNfcReader"
    const val EVENT_TAG_READ = "TapNfcTagRead"
    const val EVENT_TAG_ERROR = "TapNfcTagError"
  }
}
```

The HCE card-emulation service itself (vendored `react-native-hce` library) — `android/app/src/main/java/com/reactnativehce/services/CardService.java` (full source, 65 lines), a standard Android `HostApduService` that dispatches incoming APDUs to whichever registered `IHCEApplication` (here, `NFCTagType4`) claims the SELECT command:

```java
/*
 * Copyright (c) 2020-2022 Mateusz Falkowski (appidea.pl) and contributors. All rights reserved.
 * This file is part of "react-native-hce" library: https://github.com/appidea/react-native-hce
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 */

package com.reactnativehce.services;

import android.content.Context;
import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;
import android.util.Log;

import com.reactnativehce.utils.ApduHelper;
import com.reactnativehce.managers.HceViewModel;
import com.reactnativehce.IHCEApplication;
import com.reactnativehce.managers.PrefManager;
import com.reactnativehce.apps.nfc.NFCTagType4;

import java.util.ArrayList;

public class CardService extends HostApduService {
    private static final String TAG = "CardService";

    private final ArrayList<IHCEApplication> registeredHCEApplications = new ArrayList<>();
    private IHCEApplication currentHCEApplication = null;

    @Override
    public byte[] processCommandApdu(byte[] command, Bundle extras) {
      if (currentHCEApplication != null) {
        return currentHCEApplication.processCommand(command);
      }

      if (ApduHelper.commandByRangeEquals(command, 0, 4, ApduHelper.C_APDU_SELECT_APP)) {
        for (IHCEApplication app : registeredHCEApplications) {
          if (app.assertSelectCommand(command)) {
            currentHCEApplication = app;
            return ApduHelper.R_APDU_OK;
          }
        }
      }

      return ApduHelper.R_APDU_ERROR;
    }

    @Override
    public void onCreate() {
      Log.d(TAG, "Starting service");
      Context context = getApplicationContext();

      registeredHCEApplications.add(new NFCTagType4(
        PrefManager.getInstance(context),
        HceViewModel.getInstance(context)
      ));
    }

    @Override
    public void onDeactivated(int reason) {
      Log.d(TAG, "Deactivated: reason=" + reason);
      if (this.currentHCEApplication != null) {
        this.currentHCEApplication.onDestroy(reason);
        this.currentHCEApplication = null;
      }
    }
}
```

**Native module bridge** — `src/services/tapNfcNative.ts` (full source), exposes the Kotlin module to JS and guards platform availability:

```typescript
/**
 * Native Android NFC reader bridge (TapNfcReaderModule)
 * Uses Activity.enableReaderMode for reliable phone-to-phone HCE detection.
 */

import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

type TapNfcReaderNative = {
  startReaderMode: () => Promise<boolean>;
  stopReaderMode: () => Promise<boolean>;
  isReaderModeActive: () => Promise<boolean>;
};

const NativeTapNfcReader: TapNfcReaderNative | undefined =
  NativeModules.TapNfcReader;

const emitter =
  Platform.OS === 'android' && NativeTapNfcReader
    ? new NativeEventEmitter(NativeModules.TapNfcReader)
    : null;

export const TAP_NFC_TAG_READ = 'TapNfcTagRead';
export const TAP_NFC_TAG_ERROR = 'TapNfcTagError';

export function isNativeTapReaderAvailable(): boolean {
  return Platform.OS === 'android' && !!NativeTapNfcReader;
}

export async function startNativeReaderMode(): Promise<boolean> {
  if (!NativeTapNfcReader) {
    return false;
  }
  return await NativeTapNfcReader.startReaderMode();
}

export async function stopNativeReaderMode(): Promise<boolean> {
  if (!NativeTapNfcReader) {
    return false;
  }
  try {
    return await NativeTapNfcReader.stopReaderMode();
  } catch {
    return false;
  }
}

export function subscribeNativeTagRead(
  onText: (text: string) => void,
  onError?: (message: string) => void,
): () => void {
  if (!emitter) {
    return () => {};
  }

  const readSub = emitter.addListener(TAP_NFC_TAG_READ, (event: {text?: string}) => {
    if (event?.text) {
      onText(event.text);
    }
  });

  const errorSub = emitter.addListener(TAP_NFC_TAG_ERROR, (event: {error?: string}) => {
    if (event?.error && onError) {
      onError(event.error);
    }
  });

  return () => {
    readSub.remove();
    errorSub.remove();
  };
}

/**
 * Ensure sender phone is NOT in reader mode before starting HCE
 */
export async function prepareSenderNfc(): Promise<void> {
  await stopNativeReaderMode();
}
```

`src/services/nfcReader.ts` (242 lines) is the orchestration layer that chooses the native reader (above) when available on Android, falling back to `react-native-nfc-manager`'s IsoDep reader in `src/utils/type4Nfc.ts` (a pure-JS re-implementation of the same SELECT-AID → SELECT-NDEF-file → READ-BINARY APDU sequence) otherwise. It exposes `initNfc()`, `isNfcSupported()`, `isNfcEnabled()`, `openNfcSettings()`, `startContinuousHceScan()`/`stopContinuousHceScan()`, `readReceiverAddress()` (returns a `NfcReadResponse` with status `SUCCESS | DISCONNECTED | INVALID_PAYLOAD | TIMEOUT | CANCELLED | ERROR`), and `cancelNfcRead()`. Read timeout: `SCAN_TIMEOUT_MS = 15_000`.

`src/services/tapPayment.ts` (234 lines) ties the NFC read to the on-chain send: `createSessionId()` (random UUID for the ledger's `sessionId`), `completeSenderTap()` (reads receiver address via NFC, then calls `sendPayment()`), `startReceiverBroadcast()`/`stopReceiverBroadcast()`, `cancelTapSession()`, `lookupIncomingPayment()` (filters `PaymentLogged` events on `TapPayLedger` over the last 64 blocks so the receiver can identify who paid them), and `waitForIncomingPayment()` (polls `getBalance()` every 500ms for up to 60s).

Proprietary AID note: `monad.ts` declares `TAPPAY_AID = 'F0546170506179'`, but the actual SELECT-APP APDU in both the Kotlin reader and the JS fallback always selects the **standard NFC Forum Type 4 NDEF Tag Application AID** (`D2760000850101`), not the proprietary TapPay AID — that constant is currently unused/vestigial.

### Fallback: QR/Keypad settlement when NFC is unavailable

**There is no QR code fallback in this repo** — no `react-native-qrcode-svg`, no camera library, and a `grep` for `QR|qrcode|QRCode` across `src/` returns no code matches (only prose in markdown docs). The actual fallback is **username or raw-address entry via a numeric keypad** ("Direct Pay").

`src/components/NfcNotAvailableModal.tsx` (157 lines) is shown whenever `isNfcSupported()` returns false on the Send/Receive Tap screens, and its CTA routes to the fallback flow:

```tsx
<View style={styles.alternativeCard}>
  <Text style={styles.altHeading}>Alternative Payment Mode:</Text>
  <Text style={styles.altBody}>
    You can still send and receive payments instantly on Monad using @usernames or direct wallet addresses.
  </Text>
</View>
<TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={onSwitchToUsernamePay}>
  <Text style={styles.primaryText}>Use Direct Pay</Text>
</TouchableOpacity>
```

`src/screens/SendPaymentScreen.tsx` (684 lines) is the actual fallback flow: a `@Username` / `Address` mode toggle, a `TextInput` for entering either, `resolveUsername()` (Supabase lookup) or a raw `0x...` regex validation, then the same numeric-keypad amount entry as the NFC sender flow, `ConfirmPaymentModal`, and `sendPayment()`.

**Important settlement-path distinction for the spec**: this fallback path does **not** go through `TapPayLedger.payWithLog` — `wallet.ts`'s `sendPayment()` only calls the ledger contract `if (MONAD_CONFIG.contracts.tapPayLedger && sessionIdHash)`. Since the keypad fallback has no NFC session and therefore no `sessionId`, it executes a **raw EOA-to-EOA native MON transfer** instead, bypassing the ledger's replay protection, limits, and `PaymentLogged` event entirely. Only the NFC-triggered tap path is actually logged on-chain via the ledger contract. A near-duplicate `src/screens/UsernamePayScreen.tsx` (322 lines) implements the same username-search → keypad → confirm → send flow independently, appearing to be an earlier/parallel version of the same feature.

### 3. Merchant Terminal & Keypad UI Components

TapPay has **no distinct merchant/POS terminal screen** — it's a peer-to-peer consumer wallet, not a merchant-facing app. The closest equivalents, useful as a component-schema reference for BountyDrop's actual TapPay Spend Terminal (which *does* need a merchant-facing redemption UI):

**Payment keypad** — a Cash-App-style amount entry reused identically across `SendTapScreen.tsx`, `SendPaymentScreen.tsx`, and `UsernamePayScreen.tsx`: a `KEYS` 4×3 grid `[['1','2','3'],['4','5','6'],['7','8','9'],['.','0','⌫']]` rendered as `TouchableOpacity` cells, with an `onKeyPress` handler enforcing no leading zeros, at most one decimal point, at most 6 decimal places, and a 12-character cap.

**Address resolver (username → wallet address)** — `src/services/registry.ts` (134 lines, detailed in Section 1 above): `registerUsername`, `resolveUsername`, `reverseResolveAddress`/`reverseResolve`, and a stubbed, unimplemented `releaseUsername`. Used by `SendPaymentScreen.tsx` and `UsernamePayScreen.tsx` for forward lookup, and by `SendTapScreen.tsx`/`ReceiveTapScreen.tsx` for reverse lookup (to show `@username` instead of a raw address after an NFC tap completes).

**Receipt generator/display** — `src/screens/TransactionStatusScreen.tsx` (665 lines) is the closest equivalent to a receipt: a Sent/Received card with a directional arrow icon (↑ red / ↓ green), the amount in MON, formatted timestamp, `PartyRow` components showing `@username` (with truncated address as secondary line) for both parties, a Monad asset badge with signed delta, a truncated tx-hash "Signature" row, a "Network: Monad Testnet" meta row, and a "View Raw Transaction" link to Monadscan. It runs a `pending → confirmed | failed` state machine, polling `waitForReceipt(txHash)` (or, for the receiver side of a tap — which has no signed tx of its own — polling balance via `waitForIncomingPayment` and recovering the sender via `lookupIncomingPayment`'s `PaymentLogged` event filter).

`ConfirmPaymentModal.tsx` is an Apple-Pay-style bottom sheet shown just before broadcast: Recipient (`@username` + truncated address), Estimated Gas, Total (amount + gas), and a "Monad Testnet • ~1s Finality" badge.

### Additional notes for BountyDrop's clean-room build

- **Key management pattern worth reusing**: `src/services/wallet.ts` generates keys client-side via `ethers.Wallet.createRandom()` and stores them in the Android Keystore through `react-native-keychain` (`ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE`, `SECURITY_LEVEL.SECURE_HARDWARE`, `STORAGE_TYPE.AES_GCM`), re-prompting biometrics on every send/sign.
- **RPC resilience pattern worth reusing**: 3-endpoint failover rotation (`testnet-rpc.monad.xyz` → Ankr → `monadinfra.com`) via a `withRpcFailover()` wrapper — more resilient than MicroWorks' single-endpoint viem `http()` transport.
- Gas handling: `GAS_LIMIT_FALLBACK = 100_000n`, +20% safety margin on `estimateGas`, 50 gwei fallback gas price.
- Tx confirmation polling: `TX_POLL_INTERVAL_MS = 500`, `TX_MAX_WAIT_MS = 30_000` (tuned for Monad's ~1s blocks) — same tuning philosophy BountyDrop should apply to its own instant-payout confirmation UX.
- **Security/hygiene flags found, not to be repeated in BountyDrop**: Supabase URL + anon key hardcoded directly in `src/config/supabase.ts` source rather than env-loaded (low severity since anon keys are expected client-side, but should rely on Supabase RLS policies, and BountyDrop should env-load regardless); a dev-only LAN IP (`192.168.7.101:3001`) hardcoded as `apiBaseUrl` in `monad.ts` for an API that's never actually called; a debug keystore committed to the Android project (standard for RN dev builds, not a production signing key, but shouldn't be treated as a template for BountyDrop's release process).
- No `wagmi`/`viem` anywhere in TapPay (uses `ethers` v6 directly) — if BountyDrop's worker/business web dashboard and its NFC spend-terminal mobile surface need to share chain logic, that's a deliberate library choice to make, not something to inherit by default from either source repo.

---

## SECTION 3: SATTELR - PREPAID PERMISSIONS & SPEND GUARDRAILS

> Source: `./SattelR/SattelR` (note the nested folder — the actual project root is the inner `SattelR/SattelR` directory). Next.js 14 App Router + TypeScript + viem, with a Foundry (not Hardhat) contracts subproject. Built for AI shopping agents spending a human's MON under owner-granted policies, not for human-to-human payments — the closest architectural analog to BountyDrop's "spend earned MON within budget/category rules" need.

### Project structure

```
SattelR/SattelR/
├── app/                        Next.js 14 App Router
│   ├── api/                    route handlers (balance, invoices, orders, products,
│   │                            tokens, topup, wallet/connect)
│   ├── dashboard/page.tsx      owner UI: top up vault + issue agent tokens
│   ├── merchant/page.tsx       demo storefront
│   ├── invoices/, tokens/, topup/
│   └── layout.tsx, page.tsx
├── bot/                        off-chain AI shopping agents
│   ├── agent.ts                deterministic bot
│   ├── grok.ts                 xAI Grok tool-calling agent
│   └── tools.ts                shared tool functions / OpenAI-style tool schemas
├── contracts/                  Foundry project
│   ├── src/AgentPayVault.sol   the core contract
│   ├── test/AgentPayVault.t.sol
│   └── script/Deploy.s.sol, script/SmokeTest.s.sol
├── lib/                        shared server logic
│   ├── abi.ts                  ABI + hand-rolled viem chain config
│   ├── contract.ts             viem client, on-chain read/write helpers
│   ├── db.ts                   flat-file JSON "database"
│   └── orders.ts, products.ts, tokens.ts, types.ts
└── scripts/pay_e2e.py          Python end-to-end smoke test
```

Package manager: npm. On-chain library: **viem only** (no wagmi, no ethers). Contracts: **Foundry**, `solc 0.8.24`, `via_ir = true`, `optimizer_runs = 200`, `evm_version = "paris"`. No wallet-connect UI anywhere — every on-chain transaction is signed server-side from raw private keys (`OWNER_PRIVATE_KEY`, `DEMO_PRIVATE_KEY`) held in Next.js server env vars via viem's `privateKeyToAccount`. Persistence is a flat JSON file (`lib/db.ts` → `data/db.json`, or OS temp dir on Vercel — ephemeral) despite a `DATABASE_URL` env var being declared and unused.

### 1. Restricted Purchase Permission Contract

Single contract, `contracts/src/AgentPayVault.sol` (353 lines). Unlike TapPay's ledger, this contract **is** the escrow — deposited MON sits in the contract's own balance and is only released when a spend passes every policy check. Full source:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentPayVault
 * @notice Per-human vault on Monad. The deployer (human) owns the vault,
 *         tops up native MON, and grants restricted spend permissions to an
 *         AI agent wallet. The agent can only pay merchants within policy limits.
 *
 * Flow:
 *   1. Human deploys this contract (owner = msg.sender).
 *   2. Human calls topUp() with MON (or sends MON to the contract).
 *   3. Human calls grantPermission(...) for an agent wallet + rules.
 *   4. Agent calls spend(...) to pay a merchant in native MON.
 *   5. Human can revokePermission / withdraw anytime.
 */
contract AgentPayVault {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Policy {
        address agent;
        uint256 amountLimit; // max total spend in wei (native MON)
        uint256 spent; // amount already spent in wei
        string category; // e.g. "electronics"
        string[] allowedWebsites; // e.g. ["trusted-gadgets.example"]
        uint256 expiry; // unix timestamp; 0 = no expiry
        bool singleUse;
        bool used;
        bool active;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public immutable owner;

    mapping(bytes32 => Policy) private _policies;
    bytes32[] private _policyIds;

    uint256 private _locked; // simple reentrancy guard

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotAgent();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientVaultBalance();
    error PolicyNotFound();
    error PolicyInactive();
    error PolicyExpired();
    error PolicyAlreadyUsed();
    error AmountLimitExceeded();
    error CategoryNotAllowed();
    error MerchantNotAllowed();
    error TransferFailed();
    error Reentrancy();
    error EmptyCategory();
    error EmptyAllowlist();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TopUp(address indexed from, uint256 amount, uint256 vaultBalance);
    event Withdrawn(address indexed to, uint256 amount);
    event PermissionGranted(
        bytes32 indexed policyId,
        address indexed agent,
        uint256 amountLimit,
        string category,
        uint256 expiry,
        bool singleUse
    );
    event PermissionRevoked(bytes32 indexed policyId, address indexed agent);
    event PaymentAuthorized(
        bytes32 indexed policyId,
        address indexed agent,
        address indexed merchant,
        uint256 amount,
        string category,
        string website,
        string orderId
    );

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @dev Deployer becomes the human owner. Agent never owns the vault.
    constructor() {
        owner = msg.sender;
    }

    // -------------------------------------------------------------------------
    // Funding (human)
    // -------------------------------------------------------------------------

    /// @notice Deposit native MON into the vault.
    function topUp() external payable onlyOwner {
        if (msg.value == 0) revert ZeroAmount();
        emit TopUp(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Accept plain MON transfers as top-ups (from owner only for clarity).
    receive() external payable {
        if (msg.sender != owner) revert NotOwner();
        if (msg.value == 0) revert ZeroAmount();
        emit TopUp(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Human withdraws unused MON.
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > address(this).balance) revert InsufficientVaultBalance();

        (bool ok, ) = owner.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(owner, amount);
    }

    /// @notice Withdraw entire vault balance.
    function withdrawAll() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert ZeroAmount();

        (bool ok, ) = owner.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(owner, amount);
    }

    // -------------------------------------------------------------------------
    // Permissions (human → agent)
    // -------------------------------------------------------------------------

    /**
     * @notice Grant the AI agent wallet a restricted spend permission.
     * @param agent Agent wallet that will call spend()
     * @param amountLimit Max MON the agent may spend under this policy (wei)
     * @param category Allowed product category (exact match)
     * @param allowedWebsites Domains the agent may pay on
     * @param expiry Unix expiry; pass 0 for no expiry
     * @param singleUse If true, policy dies after one successful spend
     * @return policyId Identifier the agent must pass to spend()
     */
    function grantPermission(
        address agent,
        uint256 amountLimit,
        string calldata category,
        string[] calldata allowedWebsites,
        uint256 expiry,
        bool singleUse
    ) external onlyOwner returns (bytes32 policyId) {
        if (agent == address(0)) revert ZeroAddress();
        if (amountLimit == 0) revert ZeroAmount();
        if (bytes(category).length == 0) revert EmptyCategory();
        if (allowedWebsites.length == 0) revert EmptyAllowlist();

        policyId = keccak256(
            abi.encode(
                owner,
                agent,
                amountLimit,
                category,
                allowedWebsites,
                expiry,
                singleUse,
                block.timestamp,
                _policyIds.length
            )
        );

        Policy storage p = _policies[policyId];
        p.agent = agent;
        p.amountLimit = amountLimit;
        p.spent = 0;
        p.category = category;
        p.expiry = expiry;
        p.singleUse = singleUse;
        p.used = false;
        p.active = true;

        for (uint256 i = 0; i < allowedWebsites.length; i++) {
            p.allowedWebsites.push(allowedWebsites[i]);
        }

        _policyIds.push(policyId);

        emit PermissionGranted(policyId, agent, amountLimit, category, expiry, singleUse);
    }

    /// @notice Human revokes an agent permission immediately.
    function revokePermission(bytes32 policyId) external onlyOwner {
        Policy storage p = _policies[policyId];
        if (p.agent == address(0)) revert PolicyNotFound();
        p.active = false;
        emit PermissionRevoked(policyId, p.agent);
    }

    // -------------------------------------------------------------------------
    // Spending (AI agent)
    // -------------------------------------------------------------------------

    /**
     * @notice Agent pays a merchant in native MON under a granted policy.
     * @param policyId Permission granted by the human
     * @param merchant Recipient wallet (website checkout settlement address)
     * @param amount MON to send (wei)
     * @param category Product category (must match policy)
     * @param website Domain being paid (must be on allowlist)
     * @param orderId Off-chain order reference stored in the event / invoice
     */
    function spend(
        bytes32 policyId,
        address merchant,
        uint256 amount,
        string calldata category,
        string calldata website,
        string calldata orderId
    ) external nonReentrant {
        Policy storage p = _policies[policyId];

        if (p.agent == address(0)) revert PolicyNotFound();
        if (msg.sender != p.agent) revert NotAgent();
        if (!p.active) revert PolicyInactive();
        if (p.expiry != 0 && block.timestamp > p.expiry) revert PolicyExpired();
        if (p.singleUse && p.used) revert PolicyAlreadyUsed();
        if (merchant == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (p.spent + amount > p.amountLimit) revert AmountLimitExceeded();
        if (!_eq(p.category, category)) revert CategoryNotAllowed();
        if (!_websiteAllowed(p, website)) revert MerchantNotAllowed();
        if (amount > address(this).balance) revert InsufficientVaultBalance();

        // Effects before interaction
        p.spent += amount;
        if (p.singleUse) {
            p.used = true;
            p.active = false;
        }

        (bool ok, ) = merchant.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit PaymentAuthorized(
            policyId,
            msg.sender,
            merchant,
            amount,
            category,
            website,
            orderId
        );
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getPolicy(bytes32 policyId)
        external
        view
        returns (
            address agent,
            uint256 amountLimit,
            uint256 spent,
            string memory category,
            string[] memory allowedWebsites,
            uint256 expiry,
            bool singleUse,
            bool used,
            bool active
        )
    {
        Policy storage p = _policies[policyId];
        if (p.agent == address(0)) revert PolicyNotFound();
        return (
            p.agent,
            p.amountLimit,
            p.spent,
            p.category,
            p.allowedWebsites,
            p.expiry,
            p.singleUse,
            p.used,
            p.active
        );
    }

    function remainingAllowance(bytes32 policyId) external view returns (uint256) {
        Policy storage p = _policies[policyId];
        if (p.agent == address(0)) revert PolicyNotFound();
        if (!p.active) return 0;
        if (p.expiry != 0 && block.timestamp > p.expiry) return 0;
        if (p.singleUse && p.used) return 0;
        return p.amountLimit - p.spent;
    }

    function policyCount() external view returns (uint256) {
        return _policyIds.length;
    }

    function policyIdAt(uint256 index) external view returns (bytes32) {
        return _policyIds[index];
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    function _websiteAllowed(Policy storage p, string calldata website) private view returns (bool) {
        bytes32 needle = keccak256(bytes(website));
        uint256 len = p.allowedWebsites.length;
        for (uint256 i = 0; i < len; i++) {
            if (keccak256(bytes(p.allowedWebsites[i])) == needle) {
                return true;
            }
        }
        return false;
    }

    function _eq(string storage a, string calldata b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
```

#### Where each guardrail lives in the code

- **Budget cap**: `Policy.amountLimit` + `Policy.spent`. Enforced by `if (p.spent + amount > p.amountLimit) revert AmountLimitExceeded();` inside `spend()`. Cumulative across multiple spends under the same policy (not single-shot) unless `singleUse` is also set.
- **Category enforcement**: `Policy.category` is a single string, exact-match checked via `_eq(p.category, category)` — reverts `CategoryNotAllowed`. One category per policy, not a bitmap/flags set.
- **Merchant/website allowlist**: `Policy.allowedWebsites` (string array) checked via `_websiteAllowed()` — reverts `MerchantNotAllowed`. Important nuance: this checks the **self-reported website domain string**, not the recipient's on-chain address — the `merchant` address parameter itself is unconstrained by the contract; only the caller-supplied `website` string is checked against the allowlist. This is a deliberate trust boundary worth being explicit about in BountyDrop's own design.
- **Single-use rule**: `Policy.singleUse` + `Policy.used` booleans — a one-shot flag rather than an incrementing nonce. After a successful single-use spend, both `used=true` and `active=false` are set together, so a second attempt reverts `PolicyInactive` (the `active` check runs before the `used` check). The `policyId` itself is `keccak256(abi.encode(..., block.timestamp, _policyIds.length))` — the trailing `_policyIds.length` acts as an implicit nonce so identical `grantPermission` calls still mint distinct IDs.
- **Expiry**: `Policy.expiry` (unix timestamp, `0` = no expiry), checked via `if (p.expiry != 0 && block.timestamp > p.expiry) revert PolicyExpired();`.
- **Escrow release conditions**: the contract itself holds the funds (`topUp()`/`receive()` deposit into contract balance). `spend()` only forwards MON via `merchant.call{value: amount}("")` after *every* check above passes, using checks-effects-interactions (`p.spent` and the `used`/`active` flags are updated **before** the external call) plus a hand-rolled `nonReentrant` modifier (`_locked` flag) as defense in depth.

**No ERC-20/allowance pattern and no EIP-712 signature voucher.** `grantPermission` is a plain `onlyOwner` on-chain transaction that writes a `Policy` struct directly into contract storage; there's no off-chain-signed, later-redeemed authorization. The agent doesn't need to present a signature — only `msg.sender == p.agent` is checked in `spend()`.

### 2. Guardrail Logic Integration — how BountyDrop can reuse this pattern

SattelR's `AgentPayVault` was built for a human delegating restricted spend to an AI shopping agent, but the mechanism transfers directly to BountyDrop's need to let **local vendors or automated redemption agents settle payments safely within budget bounds without ever touching a worker's or business's private key**:

- **The core primitive to reuse**: a `Policy`-style struct (budget cap, category, allowlist, expiry, single-use flag) granted by the fund owner (`onlyOwner`) and redeemed only by the pre-designated spender address (`msg.sender == p.agent` equivalent), with the vault itself custodying funds and releasing them atomically inside the same guarded call that checks every rule. For BountyDrop this maps to: a business or worker (owner) grants a *spend policy* to a specific vendor terminal or redemption-agent wallet, capping total MON, restricting it to a category (e.g. "food", "transit"), an expiry, and — for BountyDrop specifically — this is also where **GPS-derived merchant/location constraints could slot in** as an additional on-chain check (analogous to `allowedWebsites`, but a geofenced merchant address or venue ID instead of a domain string).
- **No private key exposure**: exactly like SattelR's agent wallet, the vendor/terminal never receives or needs the owner's private key — it only needs to be the `agent` address on a policy the owner separately granted. Revocation (`revokePermission`) lets the owner cut off a compromised or misbehaving terminal instantly without touching the vault's remaining balance.
- **Two things to fix, not copy, from SattelR when building BountyDrop's version**:
  1. SattelR checks a self-reported `website` string, not the recipient address — for a payments product handling real value, BountyDrop should bind the policy to the actual on-chain merchant/terminal *address* (or a hash of a registered merchant record) rather than a free-text string the caller supplies, closing the gap where a compromised agent could pay any address while just labeling the call with an allowed website name.
  2. SattelR's off-chain mirror (`verifyTokenPolicy` in `lib/tokens.ts`) duplicates the on-chain rules for fast pre-flight UX but is not authoritative — every real spend still simulates/executes against the contract. BountyDrop should keep this same split (cheap off-chain pre-check for UI responsiveness, on-chain call as the only source of truth) rather than trusting a cached/off-chain balance the way TapPay's abandoned `UsernameRegistry` shows can silently drift from on-chain reality (see Section 2).
- **Settlement flow worth carrying over wholesale**: `simulateContract` before `writeContract` (dry-run the spend to surface the exact revert reason before spending real gas), then decode custom errors from revert data (`decodeErrorResult`) into stable string codes for the UI — this is a clean, reusable error-handling pattern for BountyDrop's own guarded spend calls (NFC terminal redemption, quest payout claims, etc.).
- **Chain config for reference**: `lib/abi.ts` hand-rolls the same Monad Testnet definition (`id: 10143`, RPC `https://testnet-rpc.monad.xyz`) as MicroWorks and TapPay, but points its explorer at `https://testnet.monadvision.com` (a third, different explorer URL than either other repo used) — BountyDrop should pick one canonical explorer URL rather than inheriting any single source repo's choice. Deployed `AgentPayVault` addresses: testnet `0x3d63a735225e4Ab159039fB9048E7408f7A35bf2`, mainnet (chain 143) — identical address, same deployer nonce-0 deploy.

#### Additional notes for BountyDrop

- SattelR's category set (`["electronics", "home", "apparel", "accessories", "domains"]`) is a UI-level pick list mapped down to the on-chain string via `normalizeCategory()` — the on-chain `category` field itself is an arbitrary string, so BountyDrop's own category taxonomy (see MicroWorks' `label, poll, caption, verify, transcribe, qa` in Section 1, or a location/venue-type taxonomy for quests) can be substituted directly without contract changes.
- No blocklist mode exists on-chain (only in SattelR's off-chain TypeScript mirror) — if BountyDrop wants blocklist semantics for merchants/vendors, that needs to be a genuine on-chain policy field, not an off-chain-only illusion of enforcement.
- SattelR's persistence layer (flat JSON file, ephemeral on Vercel) is a hackathon shortcut, not a pattern to inherit — BountyDrop's off-chain cache/UX layer should use a real database.

---

## SECTION 4: NATIVE GPS GEOFENCING & MAP ENGINE

> This section is newly authored for BountyDrop — none of the source repos (MicroWorks, TapPay, SattelR) contain GPS/geofencing/mapping code. It is written to sit alongside the MicroWorks-derived Quest Escrow contract (Section 1) and follows the same Next.js + TypeScript conventions used across the other sections.

### 1. Haversine Distance Verification Utility

`lib/geo/haversine.ts` — pure functions, no external dependencies. The Haversine formula computes great-circle distance between two lat/lng points on a sphere approximating Earth; this is what verifies a worker's live GPS position is within a quest's geofence radius before allowing check-in / proof submission.

```typescript
// lib/geo/haversine.ts

/**
 * Mean Earth radius in meters (WGS-84 mean radius). Good enough for
 * geofence-radius checks at the scale of meters-to-kilometers; not
 * intended for surveying-grade precision.
 */
const EARTH_RADIUS_METERS = 6_371_000;

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Validate a coordinate pair is within legal lat/lng bounds.
 * Throws rather than silently clamping, since a bad coordinate
 * (e.g. from a spoofed or malformed GPS reading) should never be
 * treated as "far away" by accident.
 */
export function assertValidCoordinates(coords: GeoCoordinates): void {
  const { latitude, longitude } = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new RangeError(`Non-finite coordinates: ${JSON.stringify(coords)}`);
  }
  if (latitude < -90 || latitude > 90) {
    throw new RangeError(`Latitude out of range [-90, 90]: ${latitude}`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new RangeError(`Longitude out of range [-180, 180]: ${longitude}`);
  }
}

/**
 * Great-circle distance between two coordinates, in meters, via the
 * Haversine formula.
 *
 * d = 2 * R * asin( sqrt( sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2) ) )
 */
export function haversineDistanceMeters(
  from: GeoCoordinates,
  to: GeoCoordinates,
): number {
  assertValidCoordinates(from);
  assertValidCoordinates(to);

  const phi1 = toRadians(from.latitude);
  const phi2 = toRadians(to.latitude);
  const deltaPhi = toRadians(to.latitude - from.latitude);
  const deltaLambda = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Whether `userCoords` lies within `radiusMeters` of `targetCoords`.
 * This is the check-in gate for quest proof submission: the caller
 * should still treat this as a client-side pre-check only — the
 * authoritative check (see Section 1's escrow contract pattern)
 * should be re-verified server-side or on-chain before releasing
 * any payout, since browser/device GPS coordinates are trivially
 * spoofable by the client.
 */
export function isWithinRadius(
  userCoords: GeoCoordinates,
  targetCoords: GeoCoordinates,
  radiusMeters: number,
): boolean {
  if (radiusMeters <= 0) {
    throw new RangeError(`radiusMeters must be > 0, got ${radiusMeters}`);
  }
  return haversineDistanceMeters(userCoords, targetCoords) <= radiusMeters;
}

/**
 * Convenience wrapper returning both the boolean gate and the raw
 * distance, so UI can show "142m away — get within 50m to check in"
 * without a second distance computation.
 */
export interface GeofenceCheckResult {
  withinRadius: boolean;
  distanceMeters: number;
  radiusMeters: number;
}

export function checkGeofence(
  userCoords: GeoCoordinates,
  targetCoords: GeoCoordinates,
  radiusMeters: number,
): GeofenceCheckResult {
  const distanceMeters = haversineDistanceMeters(userCoords, targetCoords);
  return {
    withinRadius: distanceMeters <= radiusMeters,
    distanceMeters,
    radiusMeters,
  };
}
```

### 2. HTML5 Geolocation Custom React Hook

`hooks/useUserLocation.ts` — wraps the browser `navigator.geolocation` API with high-accuracy tracking (`watchPosition`, not one-shot `getCurrentPosition`, since a worker walking toward a quest needs live updates), explicit permission-state modeling, and cleanup on unmount.

```typescript
// hooks/useUserLocation.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoCoordinates } from "../lib/geo/haversine";

export type LocationPermissionState =
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

export interface UseUserLocationResult {
  /** Latest known coordinates, or null before the first fix arrives. */
  coordinates: GeoCoordinates | null;
  /** GPS accuracy radius in meters, as reported by the device. */
  accuracyMeters: number | null;
  /** Current permission/support state. */
  permissionState: LocationPermissionState;
  /** True while actively watching (i.e. between start() and stop()/error). */
  isWatching: boolean;
  /** Human-readable error message, if the last attempt failed. */
  error: string | null;
  /** Unix ms timestamp of the last successful fix. */
  lastUpdatedAt: number | null;
  /** Begin/resume watching the device's position. */
  start: () => void;
  /** Stop watching (e.g. when leaving the quest-check-in screen). */
  stop: () => void;
}

interface UseUserLocationOptions {
  /** Start watching automatically on mount. Default: true. */
  autoStart?: boolean;
  enableHighAccuracy?: boolean;
  /** Max age (ms) of a cached position the browser may return. Default: 0 (always fresh). */
  maximumAge?: number;
  /** Timeout (ms) for acquiring a position. Default: 15000. */
  timeout?: number;
}

function mapGeolocationError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied. Enable location access to check in to quests.";
    case err.POSITION_UNAVAILABLE:
      return "Unable to determine your location. Try moving to an area with a clearer GPS signal.";
    case err.TIMEOUT:
      return "Location request timed out. Please try again.";
    default:
      return "An unknown location error occurred.";
  }
}

export function useUserLocation(
  options: UseUserLocationOptions = {},
): UseUserLocationResult {
  const {
    autoStart = true,
    enableHighAccuracy = true,
    maximumAge = 0,
    timeout = 15_000,
  } = options;

  const [coordinates, setCoordinates] = useState<GeoCoordinates | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [permissionState, setPermissionState] =
    useState<LocationPermissionState>("prompt");
  const [isWatching, setIsWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setCoordinates({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    setAccuracyMeters(position.coords.accuracy);
    setLastUpdatedAt(position.timestamp);
    setPermissionState("granted");
    setError(null);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    setError(mapGeolocationError(err));
    if (err.code === err.PERMISSION_DENIED) {
      setPermissionState("denied");
      setIsWatching(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermissionState("unsupported");
      setError("Geolocation is not supported on this device/browser.");
      return;
    }

    // Already watching — avoid stacking duplicate watchers.
    if (watchIdRef.current !== null) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy, maximumAge, timeout },
    );
    setIsWatching(true);
  }, [enableHighAccuracy, maximumAge, timeout, handleSuccess, handleError]);

  // Reflect the Permissions API state when available, so UI can show
  // "denied" before the user even triggers a geolocation request.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) {
      return;
    }

    let permissionStatus: PermissionStatus | null = null;

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        permissionStatus = status;
        setPermissionState(status.state as LocationPermissionState);
        status.onchange = () => {
          setPermissionState(status.state as LocationPermissionState);
        };
      })
      .catch(() => {
        // Permissions API not fully supported (e.g. Safari) — fall back
        // to inferring state from watchPosition callbacks instead.
      });

    return () => {
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    coordinates,
    accuracyMeters,
    permissionState,
    isWatching,
    error,
    lastUpdatedAt,
    start,
    stop,
  };
}
```

### 3. Interactive Leaflet Map Integration

`components/QuestMap.tsx` — renders active bounty pins, a geofence radius circle per quest, and centers/tracks the worker's live position. Leaflet manipulates the DOM directly and is not SSR-safe, so this component must be dynamically imported with `ssr: false` wherever it's used in a Next.js App Router page.

NPM dependencies (also listed in Section 1's package matrix for the combined project): `leaflet`, `react-leaflet`, `@types/leaflet` (dev).

```typescript
// components/QuestMap.tsx
"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoCoordinates } from "../lib/geo/haversine";
import { checkGeofence } from "../lib/geo/haversine";

export interface QuestPin {
  id: string;
  title: string;
  rewardLabel: string; // e.g. "0.05 MON"
  coordinates: GeoCoordinates;
  radiusMeters: number;
}

interface QuestMapProps {
  quests: QuestPin[];
  userCoordinates: GeoCoordinates | null;
  /** Called when the user selects a quest pin. */
  onSelectQuest?: (questId: string) => void;
  /** Map height; defaults to filling its container. */
  heightClassName?: string;
}

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006]; // fallback: NYC
const DEFAULT_ZOOM = 14;

// Leaflet's default marker icon paths break under Next.js bundling
// unless explicitly re-pointed at hosted assets.
const workerIcon = L.icon({
  iconUrl: "/map/worker-marker.svg",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const questIcon = L.icon({
  iconUrl: "/map/quest-marker.svg",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -32],
});

const questIconInRange = L.icon({
  iconUrl: "/map/quest-marker-active.svg",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -36],
});

/** Recenters the map imperatively whenever the user's live position changes. */
function RecenterOnUser({ coordinates }: { coordinates: GeoCoordinates | null }) {
  const map = useMap();

  useMemo(() => {
    if (coordinates) {
      map.setView([coordinates.latitude, coordinates.longitude], map.getZoom(), {
        animate: true,
      });
    }
    // Only recenter on coordinate change, not on every render/zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates?.latitude, coordinates?.longitude]);

  return null;
}

export function QuestMap({
  quests,
  userCoordinates,
  onSelectQuest,
  heightClassName = "h-full w-full",
}: QuestMapProps) {
  const initialCenter: [number, number] = userCoordinates
    ? [userCoordinates.latitude, userCoordinates.longitude]
    : DEFAULT_CENTER;

  return (
    <div className={heightClassName}>
      <MapContainer
        center={initialCenter}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full rounded-2xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userCoordinates && (
          <>
            <RecenterOnUser coordinates={userCoordinates} />
            <Marker
              position={[userCoordinates.latitude, userCoordinates.longitude]}
              icon={workerIcon}
              zIndexOffset={1000}
            >
              <Popup>You are here</Popup>
            </Marker>
          </>
        )}

        {quests.map((quest) => {
          const geofence = userCoordinates
            ? checkGeofence(userCoordinates, quest.coordinates, quest.radiusMeters)
            : null;
          const inRange = geofence?.withinRadius ?? false;

          return (
            <div key={quest.id}>
              <Circle
                center={[quest.coordinates.latitude, quest.coordinates.longitude]}
                radius={quest.radiusMeters}
                pathOptions={{
                  color: inRange ? "#22c55e" : "#6366f1",
                  fillColor: inRange ? "#22c55e" : "#6366f1",
                  fillOpacity: 0.12,
                  weight: 2,
                }}
              />
              <Marker
                position={[quest.coordinates.latitude, quest.coordinates.longitude]}
                icon={inRange ? questIconInRange : questIcon}
                eventHandlers={{
                  click: () => onSelectQuest?.(quest.id),
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold">{quest.title}</p>
                    <p className="text-sm text-emerald-600">{quest.rewardLabel}</p>
                    {geofence && (
                      <p className="text-xs text-gray-500">
                        {inRange
                          ? "Within range — check in now"
                          : `${Math.round(geofence.distanceMeters)}m away (need ${quest.radiusMeters}m)`}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
```

Usage note (Next.js App Router — dynamic, SSR-disabled import, since `window`/`document` aren't available during server rendering):

```typescript
// app/quests/page.tsx
"use client";

import dynamic from "next/dynamic";

const QuestMap = dynamic(
  () => import("../../components/QuestMap").then((mod) => mod.QuestMap),
  { ssr: false },
);

export default function QuestsPage() {
  // ...fetch quests, wire up useUserLocation(), render <QuestMap quests={...} userCoordinates={...} />
  return null;
}
```

=======================================================================================

