"use client";

// CheckInButton wraps useUserLocation() + checkGeofence() as a UX gate
// before a worker can submit proof for a quest. Per
// BOUNTYDROP_BUILD_PROMPT.md's second locked decision: this is a UX gate,
// not a security boundary. QuestEscrow.sol never re-verifies GPS on-chain,
// and device location is trivially spoofable — the copy below says so
// explicitly rather than implying "GPS verified" is any kind of guarantee.

import { useUserLocation } from "../hooks/useUserLocation";
import { checkGeofence, type GeoCoordinates } from "../lib/geo/haversine";

interface CheckInButtonProps {
  targetCoordinates: GeoCoordinates;
  radiusMeters: number;
  onCheckedIn: () => void;
}

export function CheckInButton({
  targetCoordinates,
  radiusMeters,
  onCheckedIn,
}: CheckInButtonProps) {
  const { coordinates, accuracyMeters, permissionState, error } = useUserLocation();

  if (permissionState === "denied") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        Location permission denied. Enable location access in your browser to
        check in — BountyDrop uses your device's GPS only to show distance to
        the quest and gate the proof-submission form; it's a convenience
        check, not a security guarantee.
      </div>
    );
  }

  if (!coordinates) {
    return (
      <div className="rounded-xl border border-white/10 bg-panel p-4 text-sm text-white/60">
        {error ?? "Getting your location..."}
      </div>
    );
  }

  const geofence = checkGeofence(coordinates, targetCoordinates, radiusMeters);

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-panel p-4">
      <p className="text-sm text-white/60">
        {geofence.withinRadius
          ? "You're within range of this quest."
          : `${Math.round(geofence.distanceMeters)}m away — get within ${radiusMeters}m to check in.`}
        {accuracyMeters !== null && (
          <span className="text-white/30"> (device accuracy ~{Math.round(accuracyMeters)}m)</span>
        )}
      </p>
      <button
        onClick={onCheckedIn}
        disabled={!geofence.withinRadius}
        className="w-full rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accentMuted disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
      >
        Check in
      </button>
      <p className="text-[11px] leading-snug text-white/30">
        GPS check-in is a convenience gate only — it isn't re-verified
        on-chain and doesn't guarantee you're physically present. It just
        unlocks the proof-submission form below.
      </p>
    </div>
  );
}
