"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, buildQuery } from "@/lib/api";

type Query = Parameters<typeof buildQuery>[0];

interface Result<T> {
  /** Request key (path + query + reload counter) this result belongs to. */
  key: string | null;
  data: T | undefined;
  error: ApiError | Error | undefined;
}

/**
 * Minimal data-fetching hook: refetches when the path or query changes,
 * cancels stale requests and exposes `reload` for after mutations. Previous
 * data stays visible while a new request is in flight. Pass `null` to skip.
 */
export function useApi<T>(path: string | null, query?: Query) {
  const [nonce, setNonce] = useState(0);
  const url = path === null ? null : `${path}${buildQuery(query)}`;
  const key = url === null ? null : `${url}#${nonce}`;
  const [result, setResult] = useState<Result<T>>({ key: null, data: undefined, error: undefined });

  useEffect(() => {
    if (url === null || key === null) return;
    const controller = new AbortController();
    api<T>(url, { signal: controller.signal })
      .then((data) => setResult({ key, data, error: undefined }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setResult((prev) => ({ key, data: prev.data, error }));
      });
    return () => controller.abort();
  }, [url, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const mutate = useCallback((updater: (prev: T | undefined) => T | undefined) => {
    setResult((prev) => ({ ...prev, data: updater(prev.data) }));
  }, []);

  return {
    data: key === null ? undefined : result.data,
    error: key === null || result.key !== key ? undefined : result.error,
    loading: key !== null && result.key !== key,
    reload,
    mutate,
  };
}
