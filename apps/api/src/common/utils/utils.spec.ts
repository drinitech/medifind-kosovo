import { searchTokens } from '../../medicines/medicines.service';
import { boundingBox, haversineKm } from './geo';
import { normalizeSearchText, normalizeStrength, slugify } from './normalize';

describe('normalizeSearchText', () => {
  it('is case- and accent-insensitive (Albanian ë/ç)', () => {
    expect(normalizeSearchText('  PARACETAMOLË ')).toBe('paracetamole');
    expect(normalizeSearchText('Çaj')).toBe('caj');
  });

  it('keeps characters meaningful in strengths', () => {
    expect(normalizeSearchText('875 mg/125 mg')).toBe('875 mg/125 mg');
    expect(normalizeSearchText('Diclofenac 1%')).toBe('diclofenac 1%');
  });
});

describe('normalizeStrength', () => {
  it('normalizes spacing between number and unit without changing case', () => {
    expect(normalizeStrength('500mg')).toBe('500 mg');
    expect(normalizeStrength('100IU/ml')).toBe('100 IU/ml');
    expect(normalizeStrength(' 20   mg ')).toBe('20 mg');
  });
});

describe('searchTokens', () => {
  it('splits glued strengths so "ibuprofen400mg" style queries still match', () => {
    expect(searchTokens('Ibuprofen 400mg')).toEqual(['ibuprofen', '400', 'mg']);
  });

  it('caps the number of tokens', () => {
    expect(searchTokens('a b c d e f g h')).toHaveLength(6);
  });
});

describe('slugify', () => {
  it('builds URL-safe slugs', () => {
    expect(slugify('Farmacia Demo Qendra Prishtinë')).toBe('farmacia-demo-qendra-prishtine');
  });
});

describe('geo', () => {
  it('computes Haversine distance (Prishtinë → Prizren ≈ 67 km)', () => {
    const km = haversineKm(42.6629, 21.1655, 42.2139, 20.7397);
    expect(km).toBeGreaterThan(60);
    expect(km).toBeLessThan(70);
  });

  it('returns 0 for identical points', () => {
    expect(haversineKm(42.66, 21.16, 42.66, 21.16)).toBe(0);
  });

  it('bounding box contains every point within the radius', () => {
    const box = boundingBox(42.66, 21.16, 10);
    const east = 21.16 + 10 / (111.32 * Math.cos((42.66 * Math.PI) / 180)) - 0.001;
    expect(haversineKm(42.66, 21.16, 42.66, east)).toBeLessThanOrEqual(10);
    expect(east).toBeLessThanOrEqual(box.maxLon);
    expect(box.minLat).toBeLessThan(42.66 - 0.08);
  });
});
