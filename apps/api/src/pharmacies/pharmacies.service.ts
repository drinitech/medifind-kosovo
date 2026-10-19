import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/auth.decorators';
import { paginate, skipTake } from '../common/dto/pagination.dto';
import { boundingBox, roundKm } from '../common/utils/geo';
import { normalizeSearchText, slugify } from '../common/utils/normalize';
import { AVAILABLE_STATUSES } from '../inventory/availability';
import { AvailabilityPresenter } from '../inventory/availability-presenter.service';
import { medicinePublicSelect, PUBLIC_PHARMACY_WHERE } from '../medicines/medicines.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListPharmaciesQueryDto,
  NearbyQueryDto,
  PharmacyInventoryPublicQueryDto,
  PharmacyProfileDto,
  UpdatePharmacyProfileDto,
} from './dto/pharmacy.dto';
import { PharmacyAccessService } from './pharmacy-access.service';

export const pharmacyPublicSelect = {
  id: true,
  name: true,
  slug: true,
  address: true,
  city: true,
  latitude: true,
  longitude: true,
  phone: true,
  email: true,
  isDemo: true,
  isVerified: true,
} as const satisfies Prisma.PharmacySelect;

interface NearbyRow {
  id: string;
  distance_km: number;
}

@Injectable()
export class PharmaciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PharmacyAccessService,
    private readonly presenter: AvailabilityPresenter,
    private readonly audit: AuditService,
  ) {}

  // ---------- Public ----------

  async list(query: ListPharmaciesQueryDto) {
    const where: Prisma.PharmacyWhereInput = { ...PUBLIC_PHARMACY_WHERE };
    if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { address: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.pharmacy.findMany({ where, select: pharmacyPublicSelect, orderBy: { name: 'asc' }, ...skipTake(query) }),
      this.prisma.pharmacy.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  async cities() {
    const rows = await this.prisma.pharmacy.groupBy({
      by: ['city'],
      where: PUBLIC_PHARMACY_WHERE,
      _count: { _all: true },
      orderBy: { city: 'asc' },
    });
    return rows.map((r) => ({ city: r.city, pharmacyCount: r._count._all }));
  }

  /** Verified pharmacies within `radiusKm`, nearest first (bounding box + Haversine in SQL). */
  async nearby(query: NearbyQueryDto) {
    const box = boundingBox(query.lat, query.lng, query.radiusKm);
    const rows = await this.prisma.$queryRaw<NearbyRow[]>`
      SELECT id, distance_km FROM (
        SELECT p.id,
          2 * 6371 * asin(least(1, sqrt(
            power(sin(radians(p."latitude" - ${query.lat}) / 2), 2) +
            cos(radians(${query.lat})) * cos(radians(p."latitude")) *
            power(sin(radians(p."longitude" - ${query.lng}) / 2), 2)
          ))) AS distance_km
        FROM "Pharmacy" p
        WHERE p."isVerified" = true AND p."isActive" = true
          AND p."latitude" BETWEEN ${box.minLat} AND ${box.maxLat}
          AND p."longitude" BETWEEN ${box.minLon} AND ${box.maxLon}
      ) d
      WHERE distance_km <= ${query.radiusKm}
      ORDER BY distance_km ASC
      LIMIT ${query.limit}`;
    if (rows.length === 0) return [];
    const pharmacies = await this.prisma.pharmacy.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: pharmacyPublicSelect,
    });
    const byId = new Map(pharmacies.map((p) => [p.id, p]));
    return rows.map((r) => ({ ...byId.get(r.id)!, distanceKm: roundKm(Number(r.distance_km)) }));
  }

  async findPublic(idOrSlug: string) {
    const pharmacy = await this.prisma.pharmacy.findFirst({
      where: { ...PUBLIC_PHARMACY_WHERE, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { ...pharmacyPublicSelect, verifiedAt: true },
    });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    const [inventoryCount, availableCount, latest] = await Promise.all([
      this.prisma.pharmacyInventory.count({ where: { pharmacyId: pharmacy.id, isActive: true } }),
      this.prisma.pharmacyInventory.count({
        where: { pharmacyId: pharmacy.id, isActive: true, availabilityStatus: { in: AVAILABLE_STATUSES } },
      }),
      this.prisma.pharmacyInventory.aggregate({
        where: { pharmacyId: pharmacy.id, isActive: true },
        _max: { lastReportedAt: true },
      }),
    ]);
    return { ...pharmacy, stats: { inventoryCount, availableCount, lastInventoryUpdate: latest._max.lastReportedAt } };
  }

  async publicInventory(idOrSlug: string, query: PharmacyInventoryPublicQueryDto) {
    const pharmacy = await this.prisma.pharmacy.findFirst({
      where: { ...PUBLIC_PHARMACY_WHERE, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true },
    });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    const where: Prisma.PharmacyInventoryWhereInput = {
      pharmacyId: pharmacy.id,
      isActive: true,
      medicine: { isActive: true },
    };
    if (query.filter === 'available') where.availabilityStatus = { in: AVAILABLE_STATUSES };
    if (query.q) {
      const n = normalizeSearchText(query.q);
      where.medicine = { isActive: true, OR: [{ normalizedName: { contains: n } }, { normalizedIngredient: { contains: n } }] };
    }
    const now = new Date();
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.pharmacyInventory.findMany({
        where,
        select: {
          id: true,
          availabilityStatus: true,
          quantity: true,
          showQuantityPublicly: true,
          lastReportedAt: true,
          source: true,
          medicine: { select: medicinePublicSelect },
        },
        orderBy: { medicine: { name: 'asc' } },
        ...skipTake(query),
      }),
      this.prisma.pharmacyInventory.count({ where }),
    ]);
    const items = rows.map((r) => ({ ...this.presenter.present(r, now), medicine: r.medicine }));
    return paginate(items, total, query.page, query.pageSize);
  }

  // ---------- Pharmacy manager ----------

  async getOwnProfile(user: AuthUser, pharmacyId?: string) {
    const id = await this.access.resolvePharmacyId(user, pharmacyId);
    return this.prisma.pharmacy.findUniqueOrThrow({
      where: { id },
      select: { ...pharmacyPublicSelect, isActive: true, verifiedAt: true, createdAt: true, updatedAt: true },
    });
  }

  /** A pharmacy manager registers their pharmacy. It stays hidden from the public until an admin verifies it. */
  async createProfile(user: AuthUser, dto: PharmacyProfileDto) {
    if (user.role !== Role.PHARMACY_MANAGER) {
      throw new ForbiddenException('Only pharmacy-manager accounts can register a pharmacy');
    }
    const existing = await this.prisma.pharmacyMembership.count({ where: { userId: user.id } });
    if (existing > 0) {
      throw new ConflictException('This account already manages a pharmacy. Contact an administrator to add another.');
    }
    const slug = await this.uniqueSlug(`${dto.name} ${dto.city}`);
    const pharmacy = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pharmacy.create({
        data: { ...dto, slug, isVerified: false, isDemo: false },
        select: { ...pharmacyPublicSelect, isActive: true },
      });
      await tx.pharmacyMembership.create({
        data: { userId: user.id, pharmacyId: created.id, role: MembershipRole.OWNER },
      });
      await this.audit.log(
        { userId: user.id, action: 'pharmacy.create', entityType: 'Pharmacy', entityId: created.id, metadata: { name: dto.name } },
        tx,
      );
      return created;
    });
    return pharmacy;
  }

  async updateProfile(user: AuthUser, dto: UpdatePharmacyProfileDto, pharmacyId?: string) {
    const id = await this.access.resolvePharmacyId(user, pharmacyId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pharmacy.update({
        where: { id },
        data: dto,
        select: { ...pharmacyPublicSelect, isActive: true, verifiedAt: true },
      });
      await this.audit.log(
        {
          userId: user.id,
          action: 'pharmacy.update',
          entityType: 'Pharmacy',
          entityId: id,
          metadata: { changes: JSON.parse(JSON.stringify(dto)) },
        },
        tx,
      );
      return updated;
    });
  }

  async uniqueSlug(base: string): Promise<string> {
    const root = slugify(base) || 'farmaci';
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? root : `${root}-${i + 1}`;
      const taken = await this.prisma.pharmacy.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${root}-${Date.now().toString(36)}`;
  }
}
