import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipRole, NotificationType, PharmacySource, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/auth.decorators';
import { paginate, skipTake } from '../common/dto/pagination.dto';
import { normalizeSearchText } from '../common/utils/normalize';
import { AvailabilityPresenter } from '../inventory/availability-presenter.service';
import { InventoryService } from '../inventory/inventory.service';
import { medicinePublicSelect } from '../medicines/medicines.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminHistoryQueryDto,
  AdminInventoryQueryDto,
  AdminPharmaciesQueryDto,
  AdminUpdatePharmacyDto,
  AdminUpdateUserDto,
  AdminUsersQueryDto,
  AuditLogQueryDto,
} from './dto/admin.dto';

const historySelect = {
  id: true,
  previousStatus: true,
  newStatus: true,
  previousQuantity: true,
  newQuantity: true,
  newIsActive: true,
  source: true,
  createdAt: true,
  changedBy: { select: { id: true, fullName: true } },
  pharmacy: { select: { id: true, name: true, city: true } },
  inventory: { select: { medicine: { select: { id: true, name: true, strength: true, dosageForm: true } } } },
} as const satisfies Prisma.InventoryHistorySelect;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly presenter: AvailabilityPresenter,
    private readonly notifications: NotificationsService,
    private readonly inventory: InventoryService,
  ) {}

  /** All figures come from aggregate queries — nothing is loaded wholesale. */
  async dashboard() {
    const now = new Date();
    const staleCutoff = this.presenter.staleCutoff(now);
    const agingCutoff = this.presenter.agingCutoff(now);
    const activeInv = { isActive: true, pharmacy: { isActive: true } } satisfies Prisma.PharmacyInventoryWhereInput;

    const pendingWhere = {
      isVerified: false,
      isActive: true,
      dataSource: { not: PharmacySource.OSM },
    } satisfies Prisma.PharmacyWhereInput;
    const [
      pharmaciesTotal,
      pharmaciesVerified,
      pharmaciesInactive,
      pharmaciesPending,
      directoryListings,
      medicinesTotal,
      medicinesActive,
      usersByRole,
      inventoryByStatus,
      fresh,
      aging,
      stale,
      activeAlerts,
      notifications7d,
      updates24h,
      recentUpdates,
      pendingPharmacies,
      lastReportPerPharmacy,
    ] = await Promise.all([
      this.prisma.pharmacy.count(),
      this.prisma.pharmacy.count({ where: { isVerified: true, isActive: true } }),
      this.prisma.pharmacy.count({ where: { isActive: false } }),
      this.prisma.pharmacy.count({ where: pendingWhere }),
      this.prisma.pharmacy.count({ where: { isVerified: false, isActive: true, dataSource: PharmacySource.OSM } }),
      this.prisma.medicine.count(),
      this.prisma.medicine.count({ where: { isActive: true } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.pharmacyInventory.groupBy({ by: ['availabilityStatus'], where: activeInv, _count: { _all: true } }),
      this.prisma.pharmacyInventory.count({ where: { ...activeInv, lastReportedAt: { gte: agingCutoff } } }),
      this.prisma.pharmacyInventory.count({ where: { ...activeInv, lastReportedAt: { gte: staleCutoff, lt: agingCutoff } } }),
      this.prisma.pharmacyInventory.count({ where: { ...activeInv, lastReportedAt: { lt: staleCutoff } } }),
      this.prisma.availabilityAlert.count({ where: { isActive: true } }),
      this.prisma.notification.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
      this.prisma.inventoryHistory.count({ where: { createdAt: { gte: new Date(now.getTime() - 86_400_000) } } }),
      this.prisma.inventoryHistory.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: historySelect }),
      this.prisma.pharmacy.findMany({
        where: pendingWhere,
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { id: true, name: true, city: true, createdAt: true },
      }),
      this.prisma.pharmacyInventory.groupBy({
        by: ['pharmacyId'],
        where: { isActive: true, pharmacy: { isActive: true, isVerified: true } },
        _max: { lastReportedAt: true },
      }),
    ]);

    const stalePharmacies = lastReportPerPharmacy.filter(
      (p) => p._max.lastReportedAt && p._max.lastReportedAt < staleCutoff,
    ).length;

    return {
      pharmacies: {
        total: pharmaciesTotal,
        verified: pharmaciesVerified,
        unverified: pharmaciesPending,
        directoryListings,
        inactive: pharmaciesInactive,
        withStaleInventory: stalePharmacies,
      },
      medicines: { total: medicinesTotal, active: medicinesActive },
      users: Object.fromEntries(usersByRole.map((u) => [u.role, u._count._all])) as Partial<Record<Role, number>>,
      inventory: {
        byStatus: Object.fromEntries(inventoryByStatus.map((s) => [s.availabilityStatus, s._count._all])),
        freshness: { fresh, aging, stale },
        updatesLast24h: updates24h,
      },
      alerts: { active: activeAlerts, notificationsLast7d: notifications7d },
      thresholds: this.presenter.thresholds,
      recentUpdates,
      pendingPharmacies,
    };
  }

  // ---------- Pharmacies ----------

  async pharmacies(query: AdminPharmaciesQueryDto) {
    const where: Prisma.PharmacyWhereInput = {};
    if (query.status === 'verified') Object.assign(where, { isVerified: true, isActive: true });
    if (query.status === 'unverified') {
      Object.assign(where, { isVerified: false, isActive: true, dataSource: { not: PharmacySource.OSM } });
    }
    if (query.status === 'directory') Object.assign(where, { isVerified: false, isActive: true, dataSource: PharmacySource.OSM });
    if (query.status === 'inactive') where.isActive = false;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
        { address: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.pharmacy.findMany({
        where,
        // Pending registrations first, then OSM listings, then verified pharmacies.
        orderBy: [{ isVerified: 'asc' }, { dataSource: 'asc' }, { createdAt: 'desc' }],
        ...skipTake(query),
        include: {
          memberships: { select: { role: true, user: { select: { id: true, fullName: true, email: true } } } },
          verifiedBy: { select: { fullName: true } },
          _count: { select: { inventory: { where: { isActive: true } } } },
        },
      }),
      this.prisma.pharmacy.count({ where }),
    ]);
    const latest = await this.prisma.pharmacyInventory.groupBy({
      by: ['pharmacyId'],
      where: { pharmacyId: { in: items.map((i) => i.id) }, isActive: true },
      _max: { lastReportedAt: true },
    });
    const latestBy = new Map(latest.map((l) => [l.pharmacyId, l._max.lastReportedAt]));
    return paginate(
      items.map((i) => ({ ...i, lastInventoryUpdate: latestBy.get(i.id) ?? null })),
      total,
      query.page,
      query.pageSize,
    );
  }

  async verifyPharmacy(admin: AuthUser, id: string, isVerified: boolean) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id },
      select: { id: true, name: true, isVerified: true, memberships: { select: { userId: true } } },
    });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pharmacy.update({
        where: { id },
        data: isVerified
          ? { isVerified: true, verifiedAt: new Date(), verifiedById: admin.id }
          : { isVerified: false, verifiedAt: null, verifiedById: null },
      });
      await this.audit.log(
        { userId: admin.id, action: isVerified ? 'pharmacy.verify' : 'pharmacy.unverify', entityType: 'Pharmacy', entityId: id },
        tx,
      );
      if (isVerified && !pharmacy.isVerified) {
        for (const m of pharmacy.memberships) {
          await this.notifications.notify(
            {
              userId: m.userId,
              type: NotificationType.PHARMACY_VERIFIED,
              title: 'Farmacia u verifikua',
              message: `${pharmacy.name} u verifikua dhe tani shfaqet në kërkimet publike.`,
              link: '/dashboard',
            },
            tx,
          );
        }
      }
      return updated;
    });
  }

  async updatePharmacy(admin: AuthUser, id: string, dto: AdminUpdatePharmacyDto) {
    const exists = await this.prisma.pharmacy.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Pharmacy not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pharmacy.update({ where: { id }, data: { isActive: dto.isActive } });
      await this.audit.log(
        {
          userId: admin.id,
          action: dto.isActive === false ? 'pharmacy.deactivate' : 'pharmacy.update',
          entityType: 'Pharmacy',
          entityId: id,
          metadata: { isActive: dto.isActive ?? null },
        },
        tx,
      );
      return updated;
    });
  }

  async addMember(admin: AuthUser, pharmacyId: string, email: string) {
    const [pharmacy, user] = await Promise.all([
      this.prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { email }, select: { id: true, role: true, isActive: true } }),
    ]);
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    if (!user || !user.isActive) throw new NotFoundException('No active user with this email');
    if (user.role === Role.ADMIN) throw new BadRequestException('Administrators already have access to every pharmacy');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pharmacyMembership.findUnique({
        where: { userId_pharmacyId: { userId: user.id, pharmacyId } },
      });
      if (existing) throw new ConflictException('This user already manages this pharmacy');
      if (user.role === Role.USER) await tx.user.update({ where: { id: user.id }, data: { role: Role.PHARMACY_MANAGER } });
      const membership = await tx.pharmacyMembership.create({
        data: { userId: user.id, pharmacyId, role: MembershipRole.STAFF },
      });
      await this.audit.log(
        { userId: admin.id, action: 'pharmacy.member_add', entityType: 'Pharmacy', entityId: pharmacyId, metadata: { memberUserId: user.id } },
        tx,
      );
      return membership;
    });
  }

  async removeMember(admin: AuthUser, pharmacyId: string, userId: string) {
    const membership = await this.prisma.pharmacyMembership.findUnique({
      where: { userId_pharmacyId: { userId, pharmacyId } },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.pharmacyMembership.delete({ where: { id: membership.id } });
      await this.audit.log(
        { userId: admin.id, action: 'pharmacy.member_remove', entityType: 'Pharmacy', entityId: pharmacyId, metadata: { memberUserId: userId } },
        tx,
      );
    });
    return { success: true };
  }

  // ---------- Users ----------

  async users(query: AdminUsersQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.status !== 'all') where.isActive = query.status === 'active';
    if (query.q) {
      where.OR = [
        { fullName: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          memberships: { select: { pharmacy: { select: { id: true, name: true } } } },
          _count: { select: { alerts: { where: { isActive: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  async updateUser(admin: AuthUser, id: string, dto: AdminUpdateUserDto) {
    if (id === admin.id && (dto.isActive === false || (dto.role && dto.role !== Role.ADMIN))) {
      throw new BadRequestException('You cannot deactivate or demote your own account');
    }
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === Role.ADMIN && (dto.role && dto.role !== Role.ADMIN || dto.isActive === false)) {
      const otherAdmins = await this.prisma.user.count({ where: { role: Role.ADMIN, isActive: true, id: { not: id } } });
      if (otherAdmins === 0) throw new BadRequestException('At least one active administrator must remain');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { role: dto.role, isActive: dto.isActive },
        select: { id: true, fullName: true, email: true, role: true, isActive: true, createdAt: true },
      });
      await this.audit.log(
        {
          userId: admin.id,
          action: 'user.update',
          entityType: 'User',
          entityId: id,
          metadata: { from: { role: user.role, isActive: user.isActive }, to: { role: updated.role, isActive: updated.isActive } },
        },
        tx,
      );
      return updated;
    });
  }

  // ---------- Inventory review ----------

  async inventoryList(query: AdminInventoryQueryDto) {
    const now = new Date();
    const where: Prisma.PharmacyInventoryWhereInput = {};
    if (query.pharmacyId) where.pharmacyId = query.pharmacyId;
    if (query.status) where.availabilityStatus = query.status;
    if (query.active !== 'all') where.isActive = query.active === 'active';
    if (query.freshness === 'fresh') where.lastReportedAt = { gte: this.presenter.agingCutoff(now) };
    if (query.freshness === 'aging') {
      where.lastReportedAt = { gte: this.presenter.staleCutoff(now), lt: this.presenter.agingCutoff(now) };
    }
    if (query.freshness === 'stale') where.lastReportedAt = { lt: this.presenter.staleCutoff(now) };
    if (query.q) {
      const n = normalizeSearchText(query.q);
      where.medicine = { OR: [{ normalizedName: { contains: n } }, { normalizedIngredient: { contains: n } }] };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.pharmacyInventory.findMany({
        where,
        orderBy: { lastReportedAt: 'asc' },
        ...skipTake(query),
        select: {
          id: true,
          availabilityStatus: true,
          quantity: true,
          isActive: true,
          lastReportedAt: true,
          source: true,
          medicine: { select: medicinePublicSelect },
          pharmacy: { select: { id: true, name: true, city: true, isVerified: true } },
        },
      }),
      this.prisma.pharmacyInventory.count({ where }),
    ]);
    const items = rows.map((r) => ({
      ...r,
      freshness: this.presenter.present({ ...r, showQuantityPublicly: false }, now).freshness,
    }));
    return paginate(items, total, query.page, query.pageSize);
  }

  updateInventory(admin: AuthUser, id: string, isActive: boolean) {
    // Reuses the manager write path (history + audit + alert events); admins pass the access check.
    return this.inventory.update(admin, id, { isActive });
  }

  async inventoryHistory(query: AdminHistoryQueryDto) {
    const where: Prisma.InventoryHistoryWhereInput = query.pharmacyId ? { pharmacyId: query.pharmacyId } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryHistory.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(query), select: historySelect }),
      this.prisma.inventoryHistory.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  // ---------- Audit ----------

  async auditLogs(query: AuditLogQueryDto) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.entityType) where.entityType = query.entityType;
    if (query.userId) where.userId = query.userId;
    if (query.from || query.to) where.createdAt = { gte: query.from, lte: query.to };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actions = await this.prisma.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } });
    return { ...paginate(items, total, query.page, query.pageSize), actions: actions.map((a) => a.action) };
  }
}
