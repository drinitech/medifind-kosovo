"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PharmacyMapProps } from "./pharmacy-map";

/** Leaflet touches `window`, so the map only ever renders in the browser. */
const DynamicPharmacyMap = dynamic<PharmacyMapProps>(() => import("./pharmacy-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
});

/**
 * With Cache Components, Next.js hides visited routes with React <Activity>
 * instead of unmounting them: effects are cleaned up on hide and re-run on show,
 * but the DOM is kept. Leaflet cannot be re-initialised on a container it already
 * used, so navigating back to a page with a map crashed it. Bumping the key in a
 * layout-effect cleanup gives the map a fresh container every time the route is
 * hidden, so it mounts cleanly when the route becomes visible again.
 */
export function LazyPharmacyMap(props: PharmacyMapProps) {
  const [generation, setGeneration] = useState(0);
  useLayoutEffect(() => () => setGeneration((g) => g + 1), []);
  return <DynamicPharmacyMap key={generation} {...props} />;
}

export type { MapMarker } from "./pharmacy-map";
