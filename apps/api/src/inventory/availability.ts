import { AvailabilityStatus } from '@prisma/client';

export type Freshness = 'FRESH' | 'AGING' | 'STALE';

export interface FreshnessThresholds {
  agingHours: number;
  staleHours: number;
}

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/**
 * How trustworthy a pharmacy's last report is, purely based on its age.
 * Reported availability is never "confirmed real-time stock" — even FRESH
 * entries are shown as reported by the pharmacy.
 */
export function computeFreshness(lastReportedAt: Date, now: Date, t: FreshnessThresholds): Freshness {
  const ageHours = (now.getTime() - lastReportedAt.getTime()) / 3_600_000;
  if (ageHours >= t.staleHours) return 'STALE';
  if (ageHours >= t.agingHours) return 'AGING';
  return 'FRESH';
}

/** Derives a status from a quantity when the pharmacy did not state one explicitly. */
export function deriveStatusFromQuantity(
  quantity: number | null | undefined,
  lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD,
): AvailabilityStatus {
  if (quantity === null || quantity === undefined) return AvailabilityStatus.UNKNOWN;
  if (quantity <= 0) return AvailabilityStatus.OUT_OF_STOCK;
  if (quantity <= lowStockThreshold) return AvailabilityStatus.LOW_STOCK;
  return AvailabilityStatus.IN_STOCK;
}

/** Statuses that mean "a customer may be able to get it here". */
export const AVAILABLE_STATUSES: AvailabilityStatus[] = [
  AvailabilityStatus.IN_STOCK,
  AvailabilityStatus.LOW_STOCK,
];

export function isAvailable(status: AvailabilityStatus, isActive = true): boolean {
  return isActive && AVAILABLE_STATUSES.includes(status);
}

/**
 * An "availability event" is a transition from not-available (or inactive) to
 * available. Only these trigger alert notifications.
 */
export function isAvailabilityEvent(
  prev: { status: AvailabilityStatus | null; isActive: boolean | null } | null,
  next: { status: AvailabilityStatus; isActive: boolean },
): boolean {
  if (!isAvailable(next.status, next.isActive)) return false;
  if (!prev || prev.status === null) return true;
  return !isAvailable(prev.status, prev.isActive ?? true);
}

export type StatusResolution =
  | { ok: true; status: AvailabilityStatus }
  | { ok: false; code: 'STATUS_QUANTITY_MISMATCH'; message: string };

/**
 * Combines an explicit status and/or quantity into the status to store,
 * rejecting contradictory reports (e.g. "out of stock" with 12 units).
 */
export function resolveStatus(
  explicit: AvailabilityStatus | null | undefined,
  quantity: number | null | undefined,
  lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD,
): StatusResolution {
  if (!explicit) return { ok: true, status: deriveStatusFromQuantity(quantity, lowStockThreshold) };
  if (quantity !== null && quantity !== undefined) {
    if (explicit === AvailabilityStatus.OUT_OF_STOCK && quantity > 0) {
      return { ok: false, code: 'STATUS_QUANTITY_MISMATCH', message: 'OUT_OF_STOCK cannot have a quantity above 0' };
    }
    if ((explicit === AvailabilityStatus.IN_STOCK || explicit === AvailabilityStatus.LOW_STOCK) && quantity === 0) {
      return { ok: false, code: 'STATUS_QUANTITY_MISMATCH', message: `${explicit} cannot have a quantity of 0` };
    }
  }
  return { ok: true, status: explicit };
}

/** Quantity is only ever exposed publicly when the pharmacy opted in. */
export function publicQuantity(entry: { quantity: number | null; showQuantityPublicly: boolean }): number | null {
  return entry.showQuantityPublicly ? entry.quantity : null;
}
