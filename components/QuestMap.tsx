// components/QuestMap.tsx
"use client";

import { Fragment, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
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
            <Fragment key={quest.id}>
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
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
