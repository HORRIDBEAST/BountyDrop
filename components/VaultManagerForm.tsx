"use client";

// components/VaultManagerForm.tsx
//
// Owner-side UI for SpendVault: top up the vault's MON balance, and grant a
// restricted spend policy to a vendor terminal / redemption-agent wallet.
// Uses react-leaflet for the optional geofence merchant pin — like
// BusinessQuestCreatorForm.tsx, must be dynamically imported with
// { ssr: false } wherever it's used (see app/business/vault/page.tsx).
//
// The contract itself enforces onlyOwner on both topUp() and
// grantPermission() — if the connected wallet isn't the vault's deployer,
// the transaction simply reverts with NotOwner, surfaced via
// decodeContractError() same as every other guarded call in this app.

import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { parseEther } from "viem";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useNetwork } from "../lib/network";
import { SPENDVAULT_ABI } from "../lib/abi";
import { SPEND_CATEGORIES } from "../lib/constants";
import { toE7, metersPerDegreeLongitudeAt } from "../lib/geo/haversine";
import { decodeContractError } from "../lib/errors";

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006];

const pinIcon = L.icon({
  iconUrl: "/map/quest-marker-active.svg",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
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

export function VaultManagerForm() {
  const { network } = useNetwork();

  // --- Top up ---
  const [topUpAmount, setTopUpAmount] = useState("0.1");
  const { writeContract: writeTopUp, data: topUpHash, isPending: topUpPending } = useWriteContract();
  const { data: topUpReceipt, isLoading: topUpConfirming } = useWaitForTransactionReceipt({ hash: topUpHash });
  const [topUpError, setTopUpError] = useState<string | null>(null);

  function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    setTopUpError(null);
    writeTopUp(
      {
        address: network.spendVaultAddress,
        abi: SPENDVAULT_ABI,
        functionName: "topUp",
        value: parseEther(topUpAmount || "0"),
      },
      { onError: (err) => setTopUpError(decodeContractError(err, SPENDVAULT_ABI).message) },
    );
  }

  // --- Grant policy ---
  const [agent, setAgent] = useState("");
  const [amountLimit, setAmountLimit] = useState("0.1");
  const [category, setCategory] = useState<string>(SPEND_CATEGORIES[0]);
  const [merchantsText, setMerchantsText] = useState("");
  const [expiry, setExpiry] = useState(""); // date string, empty = no expiry
  const [singleUse, setSingleUse] = useState(false);
  const [geofenced, setGeofenced] = useState(false);
  const [merchantPosition, setMerchantPosition] = useState<[number, number]>(DEFAULT_CENTER);
  const [radiusMeters, setRadiusMeters] = useState(100);
  const [grantError, setGrantError] = useState<string | null>(null);

  const { writeContract: writeGrant, data: grantHash, isPending: grantPending } = useWriteContract();
  const { data: grantReceipt, isLoading: grantConfirming } = useWaitForTransactionReceipt({ hash: grantHash });

  function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setGrantError(null);

    const merchants = merchantsText
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean) as `0x${string}`[];

    if (!agent.startsWith("0x") || agent.length !== 42) {
      setGrantError("Enter a valid agent (terminal) wallet address.");
      return;
    }
    if (merchants.length === 0) {
      setGrantError("Enter at least one allowed merchant address.");
      return;
    }

    const expirySeconds = expiry ? BigInt(Math.floor(new Date(expiry).getTime() / 1000)) : 0n;
    const metersPerDegLng = geofenced
      ? BigInt(Math.round(metersPerDegreeLongitudeAt(merchantPosition[0])))
      : 0n;

    writeGrant(
      {
        address: network.spendVaultAddress,
        abi: SPENDVAULT_ABI,
        functionName: "grantPermission",
        args: [
          agent as `0x${string}`,
          parseEther(amountLimit || "0"),
          category,
          merchants,
          expirySeconds,
          singleUse,
          geofenced,
          geofenced ? toE7(merchantPosition[0]) : 0n,
          geofenced ? toE7(merchantPosition[1]) : 0n,
          geofenced ? radiusMeters : 0,
          metersPerDegLng,
        ],
      },
      { onError: (err) => setGrantError(decodeContractError(err, SPENDVAULT_ABI).message) },
    );
  }

  const topUpBusy = topUpPending || topUpConfirming;
  const grantBusy = grantPending || grantConfirming;

  return (
    <div className="space-y-6">
      {/* Top up */}
      <form onSubmit={handleTopUp} className="glass space-y-3 rounded-2xl p-5">
        <h2 className="font-display font-semibold text-white">Top up the vault</h2>
        <p className="text-sm text-white/50">
          Deposit native MON into SpendVault's own balance — this is what
          funds every policy's spend() payout.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.0001"
            min="0.0001"
            value={topUpAmount}
            onChange={(e) => setTopUpAmount(e.target.value)}
            className="flex-1 rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
          />
          <button
            type="submit"
            disabled={topUpBusy}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accentSoft disabled:translate-y-0 disabled:opacity-50"
          >
            {topUpBusy ? "Confirming..." : "Top up"}
          </button>
        </div>
        {topUpError && <p className="text-sm text-red-300">{topUpError}</p>}
        {topUpReceipt && <p className="text-sm text-accentSoft">Vault funded on-chain.</p>}
      </form>

      {/* Grant policy */}
      <form onSubmit={handleGrant} className="glass space-y-4 rounded-2xl p-5">
        <h2 className="font-display font-semibold text-white">Grant a spend policy</h2>
        <p className="text-sm text-white/50">
          Authorize a terminal/redemption-agent wallet to spend from the
          vault — capped, categorized, and restricted to an allowlist of
          merchant addresses, without ever sharing a private key.
        </p>

        <div>
          <label className="text-sm text-white/70">Agent (terminal) wallet address</label>
          <input
            required
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            placeholder="0x..."
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-white/70">Budget cap (MON)</label>
            <input
              required
              type="number"
              step="0.0001"
              min="0.0001"
              value={amountLimit}
              onChange={(e) => setAmountLimit(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-sm text-white/70">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
            >
              {SPEND_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-white/70">Allowed merchants (comma-separated addresses)</label>
          <input
            required
            value={merchantsText}
            onChange={(e) => setMerchantsText(e.target.value)}
            placeholder="0xabc..., 0xdef..."
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-white/70">Expiry (optional)</label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-ink px-3 py-2 text-white"
            />
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={singleUse}
              onChange={(e) => setSingleUse(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-ink"
            />
            Single-use (policy dies after one spend)
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={geofenced}
            onChange={(e) => setGeofenced(e.target.checked)}
            className="h-4 w-4 rounded border-white/30 bg-ink"
          />
          Require the terminal to be near a specific merchant location
        </label>

        {geofenced && (
          <div>
            <label className="text-sm text-white/70">
              Merchant location — click the map to drop the pin · radius {radiusMeters}m
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
            <div className="mt-2 h-56 overflow-hidden rounded-xl border border-white/10">
              <MapContainer center={merchantPosition} zoom={13} className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationPicker position={merchantPosition} onPick={setMerchantPosition} />
              </MapContainer>
            </div>
            <p className="mt-1 text-xs text-white/40">
              Pin: {merchantPosition[0].toFixed(5)}, {merchantPosition[1].toFixed(5)}
            </p>
          </div>
        )}

        {grantError && <p className="text-sm text-red-300">{grantError}</p>}
        {grantReceipt && <p className="text-sm text-accentSoft">Policy granted on-chain.</p>}

        <button
          type="submit"
          disabled={grantBusy}
          className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accentSoft disabled:translate-y-0 disabled:opacity-50"
        >
          {grantBusy ? "Confirming on-chain..." : "Grant policy"}
        </button>
      </form>
    </div>
  );
}
