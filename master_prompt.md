Role: Principal Web3 Systems Architect & Lead Engineer.

Task: 
Analyze the existing repositories in this workspace (MicroWorks, TapPay, and any other available repos) to extract, synthesize, and build a clean-room implementation blueprint called `BOUNTYDROP_MASTER_SPEC.md`.

We are building "BountyDrop" — a real-world DePIN and gig-economy platform on Monad where businesses post location-based micro-tasks, AI/math verifies proof-of-work, workers earn instant micro-payouts on Monad, and users can spend earned MON locally via NFC tap-to-pay.

Since location-based quest logic (GPS geofencing and maps) needs to be built natively, synthesize the on-chain quest engine from MicroWorks, the NFC settlement from TapPay, and write new specifications for the GPS geofencing stack.

Please compile `BOUNTYDROP_MASTER_SPEC.md` following this structure:

1. ARCHITECTURAL MAP & DEPENDENCIES
- Monad Testnet setup, Chain ID (10143), RPC configurations, and Wagmi/Viem setups extracted from MicroWorks/TapPay.
- NPM packages needed for UI maps (e.g., `leaflet`, `react-leaflet`, `@types/leaflet`).

2. SMART CONTRACT SPECIFICATIONS (Clean Sol Files)
- Quest Escrow & Instant Payout Contract: Adapt MicroWorks' golden key / instant payout architecture for location quests.
- NFC Payment Registry Contract: Extract TapPay's TapPayLedger and registry logic.

3. HARDWARE & GPS GEOFENCING MODULES
- NFC Tap-to-Pay: Extract the exact Web NFC / Android HCE implementation logic from TapPay.
- Native GPS Geofencing Module: Write out TypeScript utility functions for:
  a) Browser HTML5 Geolocation API hook.
  b) Haversine distance formula calculation (verifying if worker latitude/longitude is within radius meters of quest location).

4. FRONTEND COMPONENT & UI SCHEMA (Next.js + Tailwind)
- Business Quest Creator Dashboard (Set bounty, GPS latitude/longitude, radius in meters, image verification criteria).
- Worker Mobile Quest View (Interactive Leaflet map displaying active bounties, GPS "Check-In" button, photo proof uploader, and instant MON wallet balance).
- TapPay Spend Terminal (NFC tap-to-pay terminal interface for redeeming MON at local shops).

OUTPUT REQUIREMENT:
Write `BOUNTYDROP_MASTER_SPEC.md` directly into the root folder. Ensure every code block, contract, math utility, and hook is complete, fully functional, and ready for clean project initialization.