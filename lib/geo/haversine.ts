// lib/geo/haversine.ts
//
// Pure functions, no external dependencies. The Haversine formula computes
// great-circle distance between two lat/lng points on a sphere approximating
// Earth; this is what verifies a worker's live GPS position is within a
// quest's geofence radius before allowing check-in / proof submission.
//
// IMPORTANT: this is a UX gate, not a security boundary. Browser/device GPS
// coordinates are trivially spoofable by the client. Do not present
// "GPS verified" as a security guarantee anywhere in product copy — see
// CheckInButton.tsx and the quest detail page for how this is worded.

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
 * d = 2 * R * asin( sqrt( sin^2(dphi/2) + cos(phi1) * cos(phi2) * sin^2(dlambda/2) ) )
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
 * authoritative record of a payout is the on-chain escrow release,
 * which never itself re-verifies GPS (see contracts/src/QuestEscrow.sol).
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

/**
 * Encode a signed decimal degree as an int-string "E7" fixed-point value
 * (degrees * 1e7), matching the on-chain representation used by
 * QuestEscrow.sol and SpendVault.sol (Solidity has no floating point).
 */
export function toE7(degrees: number): bigint {
  return BigInt(Math.round(degrees * 1e7));
}

export function fromE7(value: bigint): number {
  return Number(value) / 1e7;
}

/**
 * Off-chain helper mirroring the on-chain flat-earth approximation in
 * SpendVault.sol's geofenced merchant check: meters-per-degree-longitude
 * at a given latitude, precomputed by whoever grants the spend policy
 * (see BusinessQuestCreatorForm.tsx / the vault "grant policy" flow).
 * Not adversarial input — the policy grantor sets this once, trusted the
 * same way they trust their own merchant location.
 */
export function metersPerDegreeLongitudeAt(latitudeDegrees: number): number {
  const METERS_PER_DEGREE_LAT = 111_320;
  return METERS_PER_DEGREE_LAT * Math.cos(toRadians(latitudeDegrees));
}
