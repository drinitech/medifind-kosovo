/**
 * Normalizes free text for case- and accent-insensitive search.
 * Albanian letters (ë, ç) and other diacritics fold to their base letter, so
 * "Paracetamolë" and "PARACETAMOLE" both match "paracetamole".
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%/.,+\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turns a display name into a URL-safe slug. */
export function slugify(input: string): string {
  return normalizeSearchText(input)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/** Canonical strength spacing: "500mg" / "500  mg" → "500 mg". Case is preserved; compare case-insensitively. */
export function normalizeStrength(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s*(mg|mcg|µg|g|ml|iu|ie)\b/gi, '$1 $2');
}
