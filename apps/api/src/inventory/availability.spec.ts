import {
  computeFreshness,
  deriveStatusFromQuantity,
  isAvailabilityEvent,
  publicQuantity,
  resolveStatus,
} from './availability';

const thresholds = { agingHours: 24, staleHours: 72 };
const now = new Date('2026-10-19T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe('computeFreshness (stale inventory labelling)', () => {
  it('labels recent reports FRESH', () => {
    expect(computeFreshness(hoursAgo(0), now, thresholds)).toBe('FRESH');
    expect(computeFreshness(hoursAgo(23.9), now, thresholds)).toBe('FRESH');
  });

  it('labels reports past the aging threshold AGING', () => {
    expect(computeFreshness(hoursAgo(24), now, thresholds)).toBe('AGING');
    expect(computeFreshness(hoursAgo(71), now, thresholds)).toBe('AGING');
  });

  it('labels reports past the stale threshold STALE', () => {
    expect(computeFreshness(hoursAgo(72), now, thresholds)).toBe('STALE');
    expect(computeFreshness(hoursAgo(24 * 30), now, thresholds)).toBe('STALE');
  });

  it('respects custom thresholds', () => {
    expect(computeFreshness(hoursAgo(5), now, { agingHours: 2, staleHours: 4 })).toBe('STALE');
  });
});

describe('deriveStatusFromQuantity', () => {
  it.each([
    [null, 'UNKNOWN'],
    [undefined, 'UNKNOWN'],
    [0, 'OUT_OF_STOCK'],
    [1, 'LOW_STOCK'],
    [5, 'LOW_STOCK'],
    [6, 'IN_STOCK'],
    [500, 'IN_STOCK'],
  ])('quantity %p → %s', (qty, expected) => {
    expect(deriveStatusFromQuantity(qty as number | null | undefined)).toBe(expected);
  });
});

describe('resolveStatus', () => {
  it('derives from quantity when no explicit status is given', () => {
    expect(resolveStatus(undefined, 0)).toEqual({ ok: true, status: 'OUT_OF_STOCK' });
  });

  it('keeps an explicit status that agrees with the quantity', () => {
    expect(resolveStatus('LOW_STOCK', 40)).toEqual({ ok: true, status: 'LOW_STOCK' });
    expect(resolveStatus('UNKNOWN', 3)).toEqual({ ok: true, status: 'UNKNOWN' });
  });

  it('rejects contradictory reports', () => {
    expect(resolveStatus('OUT_OF_STOCK', 12).ok).toBe(false);
    expect(resolveStatus('IN_STOCK', 0).ok).toBe(false);
    expect(resolveStatus('LOW_STOCK', 0).ok).toBe(false);
  });
});

describe('isAvailabilityEvent', () => {
  it('is an event when an unavailable entry becomes available', () => {
    expect(isAvailabilityEvent({ status: 'OUT_OF_STOCK', isActive: true }, { status: 'IN_STOCK', isActive: true })).toBe(true);
    expect(isAvailabilityEvent({ status: 'UNKNOWN', isActive: true }, { status: 'LOW_STOCK', isActive: true })).toBe(true);
  });

  it('is an event when a new or reactivated entry is available', () => {
    expect(isAvailabilityEvent(null, { status: 'IN_STOCK', isActive: true })).toBe(true);
    expect(isAvailabilityEvent({ status: 'IN_STOCK', isActive: false }, { status: 'IN_STOCK', isActive: true })).toBe(true);
  });

  it('is not an event while availability continues or ends', () => {
    expect(isAvailabilityEvent({ status: 'IN_STOCK', isActive: true }, { status: 'LOW_STOCK', isActive: true })).toBe(false);
    expect(isAvailabilityEvent({ status: 'IN_STOCK', isActive: true }, { status: 'OUT_OF_STOCK', isActive: true })).toBe(false);
    expect(isAvailabilityEvent({ status: 'OUT_OF_STOCK', isActive: true }, { status: 'IN_STOCK', isActive: false })).toBe(false);
  });
});

describe('publicQuantity', () => {
  it('hides quantities unless the pharmacy opted in', () => {
    expect(publicQuantity({ quantity: 12, showQuantityPublicly: false })).toBeNull();
    expect(publicQuantity({ quantity: 12, showQuantityPublicly: true })).toBe(12);
  });
});
