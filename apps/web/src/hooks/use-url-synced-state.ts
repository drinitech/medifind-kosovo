"use client";

import { useState } from "react";

/**
 * Local state seeded from a URL search param that re-syncs whenever that param
 * changes. Needed because Cache Components keeps visited pages alive (React
 * <Activity>), so `useState(initialFromUrl)` alone would ignore new links to the
 * same page, e.g. a dashboard card linking to `?status=LOW_STOCK`.
 */
export function useUrlSyncedState(urlValue: string | null, fallback: string) {
  const [value, setValue] = useState(urlValue ?? fallback);
  const [seen, setSeen] = useState(urlValue);
  if (urlValue !== seen) {
    setSeen(urlValue);
    setValue(urlValue ?? fallback);
  }
  return [value, setValue] as const;
}
