"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { PharmacyMapProps } from "./pharmacy-map";

/** Leaflet touches `window`, so the map only ever renders in the browser. */
export const LazyPharmacyMap = dynamic<PharmacyMapProps>(() => import("./pharmacy-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
});

export type { MapMarker } from "./pharmacy-map";
