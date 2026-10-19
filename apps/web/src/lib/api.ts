/**
 * Browser-side API client. Requests go to the same-origin `/api/v1/*` rewrite
 * (see next.config.ts), so the HttpOnly session cookie is sent automatically.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type QueryValue = string | number | boolean | null | undefined | string[];

export function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(","));
    } else search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}${buildQuery(query)}`, {
      method,
      credentials: "same-origin",
      headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Nuk u arrit lidhja me serverin. Kontrollo internetin dhe provo përsëri.");
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? res.statusText, err?.details);
  }
  return (payload as { data: T }).data;
}

/** Albanian, user-facing message for an API error. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Ndodhi një gabim i papritur. Provo përsëri.";
  const byCode: Record<string, string> = {
    NETWORK_ERROR: err.message,
    TOO_MANY_REQUESTS: "Shumë kërkesa në pak kohë. Prit pak dhe provo përsëri.",
    DUPLICATE_INVENTORY: "Ky bar ekziston tashmë në inventarin tuaj.",
    STATUS_QUANTITY_MISMATCH: "Statusi nuk përputhet me sasinë (p.sh. “Nuk ka” me sasi më të madhe se 0).",
    ALERT_EXISTS: "Keni tashmë një alarm aktiv për këtë bar.",
    IMPORT_ALREADY_COMMITTED: "Ky import është konfirmuar tashmë.",
    IMPORT_EXPIRED: "Parapamja ka skaduar — ngarkoni skedarin përsëri.",
    UNSUPPORTED_FILE_TYPE: "Lloji i skedarit nuk mbështetet. Përdorni .csv ose .xlsx.",
    MISSING_COLUMNS: "Skedarit i mungojnë kolonat e detyrueshme (kodi/emri i barit dhe sasia ose statusi).",
    EMPTY_FILE: "Skedari nuk ka rreshta me të dhëna.",
    TOO_MANY_ROWS: "Skedari ka shumë rreshta. Ndajeni në disa skedarë.",
    UNREADABLE_FILE: "Skedari nuk mund të lexohet.",
    NO_PHARMACY: "Llogaria juaj nuk ka ende një farmaci të lidhur.",
    INTERNAL_ERROR: "Ndodhi një gabim në server. Provo përsëri më vonë.",
  };
  if (byCode[err.code]) return byCode[err.code];
  const byStatus: Record<number, string> = {
    401: "Duhet të kyçeni për të vazhduar.",
    403: "Nuk keni leje për këtë veprim.",
    404: "Nuk u gjet.",
    409: "Ky regjistrim ekziston tashmë.",
    413: "Skedari është shumë i madh.",
  };
  if (err.status === 400 && Array.isArray(err.details)) return `Të dhëna të pavlefshme: ${err.details.join("; ")}`;
  if (err.status === 401 && err.message === "Invalid email or password") return "Email-i ose fjalëkalimi është i pasaktë.";
  if (err.status === 409 && err.message.includes("email")) return "Ekziston tashmë një llogari me këtë email.";
  return byStatus[err.status] ?? err.message;
}
