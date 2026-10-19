/**
 * Imports Kosovo pharmacies from OpenStreetMap (© OpenStreetMap contributors, ODbL)
 * as public directory listings.
 *
 *   pnpm --filter api import:osm            # apply
 *   pnpm --filter api import:osm --dry-run  # report only
 *
 * - Every pharmacy is tied to the OSM municipality boundary it lies in, which also
 *   gives it a city name (most OSM entries have no addr:city).
 * - Listings are upserted by OSM id (`externalId`), so re-running is safe.
 * - Listings claimed by a pharmacy (verified or with a manager) are never overwritten.
 * - Unclaimed listings that disappeared from OSM are deactivated, not deleted.
 * - Nothing here creates inventory: listings never show availability until the
 *   pharmacy joins MediFind and is verified.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PharmacySource, PrismaClient } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const USER_AGENT = 'MediFindKosovo/0.1 (github.com/drinitech/medifind-kosovo)';

/** OSM municipality names ("Komuna e Prishtinës") → the city name shown in the app. */
const MUNICIPALITIES: Record<string, string> = {
  'Komuna e Prishtinës': 'Prishtinë', 'Komuna e Prizrenit': 'Prizren', 'Komuna e Pejës': 'Pejë',
  'Komuna e Gjakovës': 'Gjakovë', 'Komuna e Ferizajit': 'Ferizaj', 'Komuna e Gjilanit': 'Gjilan',
  'Komuna e Mitrovicës': 'Mitrovicë', 'Komuna e Mitrovicës Veriore': 'Mitrovicë e Veriut',
  'Komuna e Podujevës': 'Podujevë', 'Komuna e Vushtrrisë': 'Vushtrri', 'Komuna e Suharekës': 'Suharekë',
  'Komuna e Rahovecit': 'Rahovec', 'Komuna e Drenasit': 'Drenas', 'Komuna e Lipjanit': 'Lipjan',
  'Komuna e Malishevës': 'Malishevë', 'Komuna e Kamenicës': 'Kamenicë', 'Komuna e Vitisë': 'Viti',
  'Komuna e Deçanit': 'Deçan', 'Komuna e Istogut': 'Istog', 'Komuna e Klinës': 'Klinë',
  'Komuna e Skënderajt': 'Skënderaj', 'Komuna e Dragashit': 'Dragash', 'Komuna e Fushë Kosovës': 'Fushë Kosovë',
  'Komuna e Kaçanikut': 'Kaçanik', 'Komuna e Shtimes': 'Shtime', 'Komuna e Obiliqit': 'Obiliq',
  'Komuna e Novobërdës': 'Novobërdë', 'Komuna e Graçanicës': 'Graçanicë', 'Komuna e Shtërpcës': 'Shtërpcë',
  'Komuna e Leposaviqit': 'Leposaviq', 'Komuna e Zveçanit': 'Zveçan', 'Komuna e Zubin Potokut': 'Zubin Potok',
  'Komuna e Junikut': 'Junik', 'Komuna e Mamushës': 'Mamushë', 'Komuna e Han i Elezit': 'Han i Elezit',
  'Komuna e Kllokotit': 'Kllokot', 'Komuna e Parteshit': 'Partesh', 'Komuna e Ranillugut': 'Ranillug',
};

const QUERY = `[out:json][timeout:240];
rel["boundary"="administrative"]["admin_level"="2"]["ISO3166-1:alpha2"="XK"];
map_to_area->.kosovo;
rel(area.kosovo)["boundary"="administrative"]["admin_level"="6"]["name:sq"~"^Komuna e "];
map_to_area->.municipalities;
foreach.municipalities->.m(
  .m out tags;
  nwr(area.m)["amenity"="pharmacy"];
  out tags center;
);`;

interface OsmElement {
  type: 'node' | 'way' | 'relation' | 'area';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function overpass(): Promise<OsmElement[]> {
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.timeout(300_000),
      });
      const text = await res.text();
      if (res.ok && text.trimStart().startsWith('{')) return (JSON.parse(text) as { elements: OsmElement[] }).elements;
      console.warn(`Overpass ${url} answered ${res.status}; trying next mirror`);
    } catch (err) {
      console.warn(`Overpass ${url} failed: ${(err as Error).message}; trying next mirror`);
    }
  }
  throw new Error('All Overpass mirrors failed — nothing was changed.');
}

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const slugify = (s: string) => fold(s).replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'farmaci';

function cleanPhone(raw?: string): string | null {
  const first = raw?.split(/[;,]/)[0]?.trim();
  return first && /^\+?[0-9][0-9 ()/-]{5,19}$/.test(first) ? first.replace(/\//g, ' ') : null;
}
function cleanEmail(raw?: string): string | null {
  const first = raw?.split(';')[0]?.trim();
  return first && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(first) ? first.toLowerCase() : null;
}
function address(tags: Record<string, string>): string | null {
  const street = tags['addr:street']?.trim();
  if (!street) return null;
  return [street, tags['addr:housenumber']?.trim()].filter(Boolean).join(' ').slice(0, 200);
}

interface Listing {
  externalId: string;
  name: string;
  city: string;
  address: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
}

function toListings(elements: OsmElement[]): Listing[] {
  const seen = new Map<string, Listing>();
  let city: string | null = null;
  for (const el of elements) {
    if (el.type === 'area') {
      city = MUNICIPALITIES[el.tags?.['name:sq'] ?? ''] ?? null;
      if (!city && el.tags?.['name:sq']) console.warn(`Unmapped municipality skipped: ${el.tags['name:sq']}`);
      continue;
    }
    if (!city || !el.tags) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const externalId = `osm:${el.type}/${el.id}`;
    if (seen.has(externalId)) continue; // overlapping boundaries — first municipality wins
    const t = el.tags;
    const name = (t['name:sq'] ?? t.name ?? t.brand ?? t.operator ?? 'Farmaci').trim().slice(0, 120);
    seen.set(externalId, {
      externalId,
      name,
      city,
      address: address(t),
      latitude: lat,
      longitude: lon,
      phone: cleanPhone(t.phone ?? t['contact:phone'] ?? t['contact:mobile']),
      email: cleanEmail(t.email ?? t['contact:email']),
    });
  }
  return [...seen.values()];
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    console.log('Fetching pharmacies from OpenStreetMap (Overpass)…');
    const listings = toListings(await overpass());
    const byCity = listings.reduce<Record<string, number>>((acc, l) => ((acc[l.city] = (acc[l.city] ?? 0) + 1), acc), {});
    console.log(`Found ${listings.length} pharmacies in ${Object.keys(byCity).length} municipalities.`);
    if (listings.length < 100) throw new Error(`Only ${listings.length} results — refusing to import a suspiciously small set.`);

    const existing = await prisma.pharmacy.findMany({
      where: { externalId: { not: null } },
      select: { id: true, externalId: true, slug: true, isVerified: true, isActive: true, _count: { select: { memberships: true } } },
    });
    const byExternal = new Map(existing.map((p) => [p.externalId!, p]));
    const usedSlugs = new Set((await prisma.pharmacy.findMany({ select: { slug: true } })).map((p) => p.slug));
    const uniqueSlug = (base: string) => {
      const root = slugify(base);
      let slug = root;
      for (let i = 2; usedSlugs.has(slug); i++) slug = `${root}-${i}`;
      usedSlugs.add(slug);
      return slug;
    };

    let created = 0, updated = 0, claimedSkipped = 0;
    const now = new Date();
    for (const l of listings) {
      const current = byExternal.get(l.externalId);
      if (current && (current.isVerified || current._count.memberships > 0)) {
        claimedSkipped++; // the pharmacy maintains its own profile now
        continue;
      }
      const data = { name: l.name, city: l.city, address: l.address, latitude: l.latitude, longitude: l.longitude, phone: l.phone, email: l.email, sourceUpdatedAt: now };
      if (DRY_RUN) {
        current ? updated++ : created++;
        continue;
      }
      if (current) {
        await prisma.pharmacy.update({ where: { id: current.id }, data: { ...data, isActive: true } });
        updated++;
      } else {
        await prisma.pharmacy.create({
          data: { ...data, externalId: l.externalId, slug: uniqueSlug(`${l.name} ${l.city}`), dataSource: PharmacySource.OSM, isVerified: false, isActive: true, isDemo: false },
        });
        created++;
      }
    }

    const seenIds = new Set(listings.map((l) => l.externalId));
    const vanished = existing.filter((p) => !seenIds.has(p.externalId!) && p.isActive && !p.isVerified && p._count.memberships === 0);
    if (!DRY_RUN && vanished.length) {
      await prisma.pharmacy.updateMany({ where: { id: { in: vanished.map((p) => p.id) } }, data: { isActive: false } });
    }
    if (!DRY_RUN) {
      await prisma.auditLog.create({
        data: { action: 'pharmacy.osm_import', entityType: 'System', metadata: { created, updated, claimedSkipped, deactivated: vanished.length, total: listings.length } },
      });
    }
    console.log(`${DRY_RUN ? '[dry run] ' : ''}created ${created}, updated ${updated}, claimed (left untouched) ${claimedSkipped}, deactivated ${vanished.length}`);
    console.log('By municipality:', Object.entries(byCity).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', '));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
