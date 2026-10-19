"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { KOSOVO_CENTER, STATUS_LABELS } from "@/lib/labels";
import type { AvailabilityStatus } from "@/lib/types";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  status?: AvailabilityStatus;
  href?: string;
  phone?: string | null;
  /** Directory listing that does not report inventory — drawn as a grey pin. */
  listing?: boolean;
}

export interface PharmacyMapProps {
  markers: MapMarker[];
  selectedId?: string | null;
  userLocation?: { lat: number; lng: number } | null;
  onSelect?: (id: string) => void;
  onPickLocation?: (lat: number, lng: number) => void;
  className?: string;
}

const STATUS_COLORS: Record<AvailabilityStatus | "DEFAULT", string> = {
  IN_STOCK: "#15803d",
  LOW_STOCK: "#b45309",
  OUT_OF_STOCK: "#b91c1c",
  UNKNOWN: "#64748b",
  DEFAULT: "#0f766e",
};
const LISTING_COLOR = "#94a3b8";

function pinIcon(color: string, selected: boolean) {
  const size = selected ? 38 : 30;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 4],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="filter: drop-shadow(0 1px 2px rgb(0 0 0 / .35))">
      <path d="M12 2C7.6 2 4 5.5 4 9.9 4 15.5 12 22 12 22s8-6.5 8-12.1C20 5.5 16.4 2 12 2z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <path d="M10.5 6.5h3v2.5H16v3h-2.5v2.5h-3V12H8V9h2.5z" fill="white"/>
    </svg>`,
  });
}

const iconCache = new Map<string, L.DivIcon>();
function iconFor(status: AvailabilityStatus | undefined, selected: boolean, listing = false) {
  const k = `${listing ? "LISTING" : (status ?? "DEFAULT")}-${selected}`;
  let icon = iconCache.get(k);
  if (!icon) {
    icon = pinIcon(listing ? LISTING_COLOR : STATUS_COLORS[status ?? "DEFAULT"], selected);
    iconCache.set(k, icon);
  }
  return icon;
}

function FitToMarkers({ markers, userLocation }: Pick<PharmacyMapProps, "markers" | "userLocation">) {
  const map = useMap();
  const key = markers.map((m) => m.id).join(",") + (userLocation ? `${userLocation.lat},${userLocation.lng}` : "");
  useEffect(() => {
    const points: L.LatLngExpression[] = markers.map((m) => [m.lat, m.lng]);
    if (userLocation) points.push([userLocation.lat, userLocation.lng]);
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
    // Only refit when the set of points changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function FocusSelected({ markers, selectedId }: Pick<PharmacyMapProps, "markers" | "selectedId">) {
  const map = useMap();
  useEffect(() => {
    const m = markers.find((x) => x.id === selectedId);
    if (m) map.flyTo([m.lat, m.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [selectedId, markers, map]);
  return null;
}

function ClickToPick({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function PharmacyMap({ markers, selectedId, userLocation, onSelect, onPickLocation, className }: PharmacyMapProps) {
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  useEffect(() => {
    if (selectedId) markerRefs.current[selectedId]?.openPopup();
  }, [selectedId]);

  return (
    <MapContainer
      center={KOSOVO_CENTER}
      zoom={8}
      scrollWheelZoom={false}
      className={className ?? "h-80 w-full rounded-xl border"}
      aria-label="Harta e farmacive"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToMarkers markers={markers} userLocation={userLocation} />
      <FocusSelected markers={markers} selectedId={selectedId} />
      <ClickToPick onPick={onPickLocation} />
      {userLocation ? (
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={8}
          pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 3 }}
        >
          <Popup>Vendndodhja juaj e zgjedhur</Popup>
        </CircleMarker>
      ) : null}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={iconFor(m.status, m.id === selectedId, m.listing)}
          title={m.title}
          alt={m.title}
          keyboard
          ref={(ref) => {
            markerRefs.current[m.id] = ref;
          }}
          eventHandlers={{ click: () => onSelect?.(m.id) }}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{m.title}</p>
              {m.subtitle ? <p className="text-muted-foreground">{m.subtitle}</p> : null}
              {m.status ? <p>{STATUS_LABELS[m.status]} (e raportuar)</p> : null}
              {m.listing ? <p>Nuk raporton inventar në MediFind</p> : null}
              {m.phone ? <a href={`tel:${m.phone.replace(/[^+\d]/g, "")}`}>{m.phone}</a> : null}
              {m.href ? (
                <p>
                  <Link href={m.href}>Shiko profilin →</Link>
                </p>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
