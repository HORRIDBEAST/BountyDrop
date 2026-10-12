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
