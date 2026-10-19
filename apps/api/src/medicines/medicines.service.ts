import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AvailabilityStatus, DosageForm, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { paginate, skipTake } from '../common/dto/pagination.dto';
import { boundingBox, haversineKm, roundKm } from '../common/utils/geo';
import { normalizeSearchText, normalizeStrength } from '../common/utils/normalize';
import { AvailabilityPresenter } from '../inventory/availability-presenter.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminMedicinesQueryDto,
  AvailabilityQueryDto,
  CreateMedicineDto,
  SearchMedicinesQueryDto,
  UpdateMedicineDto,
} from './dto/medicine.dto';

export const PUBLIC_PHARMACY_WHERE = { isVerified: true, isActive: true } satisfies Prisma.PharmacyWhereInput;

const STATUS_RANK: Record<AvailabilityStatus, number> = {
  IN_STOCK: 0,
  LOW_STOCK: 1,
  UNKNOWN: 2,
  OUT_OF_STOCK: 3,
};

export const medicinePublicSelect = {
  id: true,
  catalogCode: true,
  name: true,
  activeIngredient: true,
  strength: true,
  dosageForm: true,
  packageSize: true,
  manufacturer: true,
} as const satisfies Prisma.MedicineSelect;

/** Escapes LIKE wildcards so user input is matched literally. */
function likeEscape(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function searchTokens(q: string): string[] {
  return normalizeSearchText(normalizeStrength(q))
    .split(' ')
    .filter((t) => t.length > 0)
    .slice(0, 6);
}

interface SearchRow {
  id: string;
  available_count: number;
  latest_report: Date | null;
  total: bigint;
}

@Injectable()
export class MedicinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: AvailabilityPresenter,
    private readonly audit: AuditService,
  ) {}

  /**
   * Public search. Every query word must match the name, active ingredient or
   * strength. Results are ranked exact → prefix → trigram similarity.
   */
  async search(query: SearchMedicinesQueryDto) {
    const tokens = query.q ? searchTokens(query.q) : [];
    const normalizedQ = tokens.join(' ');
    const conditions: Prisma.Sql[] = [Prisma.sql`m."isActive" = true`];

    for (const token of tokens) {
      const like = `%${likeEscape(token)}%`;
      conditions.push(Prisma.sql`(
        m."normalizedName" ILIKE ${like}
        OR m."normalizedIngredient" ILIKE ${like}
        OR lower(coalesce(m."strength", '')) ILIKE ${like}
      )`);
    }
    if (query.dosageForm) conditions.push(Prisma.sql`m."dosageForm" = ${query.dosageForm}::"DosageForm"`);
    if (query.strength) {
      const s = `%${likeEscape(normalizeStrength(query.strength))}%`;
      conditions.push(Prisma.sql`lower(coalesce(m."strength", '')) ILIKE ${s}`);
    }
    if (query.packageSize) {
      const p = `%${likeEscape(query.packageSize.toLowerCase())}%`;
      conditions.push(Prisma.sql`lower(coalesce(m."packageSize", '')) ILIKE ${p}`);
    }
    if (query.availableOnly) conditions.push(Prisma.sql`a.available_count > 0`);

    let orderBy: Prisma.Sql;
    if (query.sort === 'availability') {
      orderBy = Prisma.sql`a.available_count DESC, m."normalizedName" ASC`;
    } else if (query.sort === 'name' || tokens.length === 0) {
      orderBy = Prisma.sql`m."normalizedName" ASC, m."strength" ASC NULLS LAST`;
    } else {
      const prefix = `${likeEscape(tokens[0])}%`;
      orderBy = Prisma.sql`
        CASE
          WHEN m."normalizedName" = ${normalizedQ} THEN 0
          WHEN m."normalizedName" ILIKE ${prefix} THEN 1
          WHEN m."normalizedIngredient" ILIKE ${prefix} THEN 2
          ELSE 3
        END,
        similarity(m."normalizedName", ${normalizedQ}) DESC,
        m."normalizedName" ASC,
        m."strength" ASC NULLS LAST`;
    }

    const { skip, take } = skipTake(query);
    const rows = await this.prisma.$queryRaw<SearchRow[]>`
      SELECT m.id, a.available_count, a.latest_report, COUNT(*) OVER() AS total
      FROM "Medicine" m
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS available_count, MAX(pi."lastReportedAt") AS latest_report
        FROM "PharmacyInventory" pi
        JOIN "Pharmacy" p ON p.id = pi."pharmacyId"
        WHERE pi."medicineId" = m.id
          AND pi."isActive" = true
          AND pi."availabilityStatus" IN ('IN_STOCK', 'LOW_STOCK')
          AND p."isVerified" = true AND p."isActive" = true
      ) a ON true
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY ${orderBy}
      LIMIT ${take} OFFSET ${skip}`;

    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    if (rows.length === 0) return paginate([], total, query.page, query.pageSize);

    const medicines = await this.prisma.medicine.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: medicinePublicSelect,
    });
    const byId = new Map(medicines.map((m) => [m.id, m]));
    const items = rows
      .filter((r) => byId.has(r.id))
      .map((r) => ({
        ...byId.get(r.id)!,
        availablePharmacyCount: r.available_count,
        latestReportAt: r.latest_report,
      }));
    return paginate(items, total, query.page, query.pageSize);
  }

  async suggest(q: string) {
    const tokens = searchTokens(q);
    if (tokens.length === 0) return [];
    const like = `${likeEscape(tokens[0])}%`;
    const rows = await this.prisma.$queryRaw<{ label: string }[]>`
      SELECT DISTINCT ON (lower(label)) label FROM (
        SELECT m."name" AS label, m."normalizedName" AS n FROM "Medicine" m
          WHERE m."isActive" = true AND m."normalizedName" ILIKE ${like}
        UNION ALL
        SELECT m."activeIngredient" AS label, m."normalizedIngredient" AS n FROM "Medicine" m
          WHERE m."isActive" = true AND m."normalizedIngredient" ILIKE ${like}
      ) s
      WHERE label IS NOT NULL
      ORDER BY lower(label)
      LIMIT 8`;
    return rows.map((r) => r.label);
  }

  async findPublic(id: string) {
    const medicine = await this.prisma.medicine.findFirst({
      where: { id, isActive: true },
      select: medicinePublicSelect,
    });
    if (!medicine) throw new NotFoundException('Medicine not found');

    // Other variants (different strengths/forms) of the same name or active ingredient.
    const variants = await this.prisma.medicine.findMany({
      where: {
        isActive: true,
        id: { not: id },
        OR: [
          { normalizedName: normalizeSearchText(medicine.name) },
          ...(medicine.activeIngredient
            ? [{ normalizedIngredient: normalizeSearchText(medicine.activeIngredient) }]
            : []),
        ],
      },
      select: medicinePublicSelect,
      orderBy: [{ name: 'asc' }, { strength: 'asc' }],
      take: 10,
    });
    return { ...medicine, variants };
  }

  /**
   * Reported availability for one medicine across verified pharmacies.
   * Inventory per medicine is bounded by the number of pharmacies, so rows are
   * filtered in SQL (status, city, bounding box) and distance-sorted in memory.
   */
  async availability(id: string, query: AvailabilityQueryDto) {
    const exists = await this.prisma.medicine.findFirst({ where: { id, isActive: true }, select: { id: true } });
    if (!exists) throw new NotFoundException('Medicine not found');

    const hasLocation = query.lat !== undefined && query.lng !== undefined;
    const pharmacyWhere: Prisma.PharmacyWhereInput = { ...PUBLIC_PHARMACY_WHERE };
    if (query.city) pharmacyWhere.city = { equals: query.city, mode: 'insensitive' };
    if (hasLocation && query.radiusKm) {
      const box = boundingBox(query.lat!, query.lng!, query.radiusKm);
      pharmacyWhere.latitude = { gte: box.minLat, lte: box.maxLat };
      pharmacyWhere.longitude = { gte: box.minLon, lte: box.maxLon };
    }

    const now = new Date();
    const rows = await this.prisma.pharmacyInventory.findMany({
      where: {
        medicineId: id,
        isActive: true,
        ...(query.status?.length ? { availabilityStatus: { in: query.status } } : {}),
        ...(query.hideStale ? { lastReportedAt: { gte: this.presenter.staleCutoff(now) } } : {}),
        pharmacy: pharmacyWhere,
      },
      select: {
        id: true,
        availabilityStatus: true,
        quantity: true,
        showQuantityPublicly: true,
        lastReportedAt: true,
        source: true,
        pharmacy: {
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
            city: true,
            latitude: true,
            longitude: true,
            phone: true,
            isDemo: true,
          },
        },
      },
    });

    let results = rows.map((row) => {
      const distanceKm = hasLocation
        ? roundKm(haversineKm(query.lat!, query.lng!, row.pharmacy.latitude, row.pharmacy.longitude))
        : null;
      return { ...this.presenter.present(row, now), distanceKm, pharmacy: row.pharmacy };
    });

    if (hasLocation && query.radiusKm) results = results.filter((r) => r.distanceKm! <= query.radiusKm!);

    results.sort((a, b) => {
      if (query.sort === 'distance' && hasLocation) return a.distanceKm! - b.distanceKm!;
      if (query.sort === 'updated') return b.lastReportedAt.getTime() - a.lastReportedAt.getTime();
      const rank = STATUS_RANK[a.availabilityStatus] - STATUS_RANK[b.availabilityStatus];
      if (rank !== 0) return rank;
      if (hasLocation) return a.distanceKm! - b.distanceKm!;
      return b.lastReportedAt.getTime() - a.lastReportedAt.getTime();
    });

    const summary = {
      total: results.length,
      inStock: results.filter((r) => r.availabilityStatus === 'IN_STOCK').length,
      lowStock: results.filter((r) => r.availabilityStatus === 'LOW_STOCK').length,
      outOfStock: results.filter((r) => r.availabilityStatus === 'OUT_OF_STOCK').length,
      stale: results.filter((r) => r.freshness === 'STALE').length,
    };
    const { skip, take } = skipTake(query);
    return {
      ...paginate(results.slice(skip, skip + take), results.length, query.page, query.pageSize),
      summary,
      thresholds: this.presenter.thresholds,
    };
  }

  // ---------- Administration ----------

  async adminList(query: AdminMedicinesQueryDto) {
    const where: Prisma.MedicineWhereInput = {};
    if (query.status !== 'all') where.isActive = query.status === 'active';
    if (query.q) {
      const n = normalizeSearchText(query.q);
      where.OR = [
        { normalizedName: { contains: n } },
        { normalizedIngredient: { contains: n } },
        { catalogCode: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.medicine.findMany({
        where,
        orderBy: [{ name: 'asc' }, { strength: 'asc' }],
        ...skipTake(query),
        include: { _count: { select: { inventory: true, alerts: { where: { isActive: true } } } } },
      }),
      this.prisma.medicine.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  async create(dto: CreateMedicineDto, actorId: string) {
    await this.assertNoDuplicateVariant(dto);
    const medicine = await this.prisma.medicine.create({ data: this.toData(dto) as Prisma.MedicineCreateInput });
    await this.audit.log({
      userId: actorId,
      action: 'medicine.create',
      entityType: 'Medicine',
      entityId: medicine.id,
      metadata: { name: medicine.name, strength: medicine.strength, dosageForm: medicine.dosageForm },
    });
    return medicine;
  }

  async update(id: string, dto: UpdateMedicineDto, actorId: string) {
    const current = await this.prisma.medicine.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Medicine not found');
    const merged = {
      name: dto.name ?? current.name,
      strength: dto.strength !== undefined ? dto.strength : current.strength ?? undefined,
      dosageForm: dto.dosageForm !== undefined ? dto.dosageForm : current.dosageForm ?? undefined,
      packageSize: dto.packageSize !== undefined ? dto.packageSize : current.packageSize ?? undefined,
    };
    await this.assertNoDuplicateVariant(merged, id);
    const medicine = await this.prisma.medicine.update({ where: { id }, data: this.toData(dto) });
    await this.audit.log({
      userId: actorId,
      action: dto.isActive === false ? 'medicine.deactivate' : 'medicine.update',
      entityType: 'Medicine',
      entityId: id,
      metadata: { changes: JSON.parse(JSON.stringify(dto)) },
    });
    return medicine;
  }

  /** Same name + strength + form + package is the same product; reject duplicates. */
  private async assertNoDuplicateVariant(
    v: { name: string; strength?: string | null; dosageForm?: DosageForm | null; packageSize?: string | null },
    excludeId?: string,
  ) {
    const dup = await this.prisma.medicine.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        normalizedName: normalizeSearchText(v.name),
        strength: v.strength ? { equals: normalizeStrength(v.strength), mode: 'insensitive' } : null,
        dosageForm: v.dosageForm ?? null,
        packageSize: v.packageSize ? { equals: v.packageSize, mode: 'insensitive' } : null,
      },
      select: { id: true },
    });
    if (dup) throw new ConflictException('A medicine with the same name, strength, form and package already exists');
  }

  private toData(dto: UpdateMedicineDto): Prisma.MedicineUpdateInput {
    const data: Prisma.MedicineUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.normalizedName = normalizeSearchText(dto.name);
    }
    if (dto.activeIngredient !== undefined) {
      data.activeIngredient = dto.activeIngredient || null;
      data.normalizedIngredient = dto.activeIngredient ? normalizeSearchText(dto.activeIngredient) : null;
    }
    if (dto.strength !== undefined) data.strength = dto.strength ? normalizeStrength(dto.strength) : null;
    if (dto.dosageForm !== undefined) data.dosageForm = dto.dosageForm ?? null;
    if (dto.packageSize !== undefined) data.packageSize = dto.packageSize || null;
    if (dto.manufacturer !== undefined) data.manufacturer = dto.manufacturer || null;
    if (dto.catalogCode !== undefined) data.catalogCode = dto.catalogCode || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return data;
  }
}
