import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AvailabilityStatus, ImportBatchStatus, InventorySource, Prisma } from '@prisma/client';
import { AvailabilityEventsQueue } from '../alerts/availability-events.queue';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/auth.decorators';
import { paginate, skipTake } from '../common/dto/pagination.dto';
import { normalizeSearchText } from '../common/utils/normalize';
import { medicinePublicSelect } from '../medicines/medicines.service';
import { PharmacyAccessService } from '../pharmacies/pharmacy-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveStatus } from './availability';
import { AvailabilityPresenter } from './availability-presenter.service';
import {
  BulkUpdateInventoryDto,
  CreateInventoryDto,
  HistoryQueryDto,
  InventoryListQueryDto,
  UpdateInventoryDto,
} from './dto/inventory.dto';
import { ImportFileError, parseInventoryFile } from './import/import-parser';
import { buildCatalogLookup, mapColumns, validateImportRows, ValidatedRow } from './import/import-validator';
import { applyInventoryChanges, ApplyResult, InventoryRowChange } from './inventory-writer';

const IMPORT_PREVIEW_TTL_MINUTES = 30;
const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

const inventorySelect = {
  id: true,
  pharmacyId: true,
  availabilityStatus: true,
  quantity: true,
  showQuantityPublicly: true,
  isActive: true,
  lastReportedAt: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  medicine: { select: { ...medicinePublicSelect, isActive: true } },
} as const satisfies Prisma.PharmacyInventorySelect;

interface StoredImportRow {
  rowNumber: number;
  medicineId: string;
  availabilityStatus: AvailabilityStatus;
  quantity: number | null;
  showQuantityPublicly?: boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PharmacyAccessService,
    private readonly presenter: AvailabilityPresenter,
    private readonly audit: AuditService,
    private readonly events: AvailabilityEventsQueue,
    private readonly config: ConfigService,
  ) {}

  // ---------- Read ----------

  async list(user: AuthUser, query: InventoryListQueryDto) {
    const pharmacyId = await this.access.resolvePharmacyId(user, query.pharmacyId);
    const where: Prisma.PharmacyInventoryWhereInput = { pharmacyId };
    if (query.active !== 'all') where.isActive = query.active === 'active';
    if (query.status?.length) where.availabilityStatus = { in: query.status };
    if (query.q) {
      const n = normalizeSearchText(query.q);
      where.medicine = {
        OR: [
          { normalizedName: { contains: n } },
          { normalizedIngredient: { contains: n } },
          { catalogCode: { contains: query.q, mode: 'insensitive' } },
        ],
      };
    }
    const now = new Date();
    if (query.freshness === 'fresh') where.lastReportedAt = { gte: this.presenter.agingCutoff(now) };
    if (query.freshness === 'aging') {
      where.lastReportedAt = { gte: this.presenter.staleCutoff(now), lt: this.presenter.agingCutoff(now) };
    }
    if (query.freshness === 'stale') where.lastReportedAt = { lt: this.presenter.staleCutoff(now) };

    const orderBy: Prisma.PharmacyInventoryOrderByWithRelationInput[] =
      query.sort === 'name'
        ? [{ medicine: { name: query.order } }, { medicine: { strength: query.order } }]
        : query.sort === 'quantity'
          ? [{ quantity: { sort: query.order, nulls: 'last' } }]
          : [{ [query.sort === 'status' ? 'availabilityStatus' : 'lastReportedAt']: query.order }];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.pharmacyInventory.findMany({ where, select: inventorySelect, orderBy, ...skipTake(query) }),
      this.prisma.pharmacyInventory.count({ where }),
    ]);
    const items = rows.map((r) => ({ ...r, freshness: this.presenter.present(r, now).freshness }));
    return paginate(items, total, query.page, query.pageSize);
  }

  async stats(user: AuthUser, requestedPharmacyId?: string) {
    const pharmacyId = await this.access.resolvePharmacyId(user, requestedPharmacyId);
    const now = new Date();
    const [byStatus, inactive, stale, latest, pharmacy] = await Promise.all([
      this.prisma.pharmacyInventory.groupBy({
        by: ['availabilityStatus'],
        where: { pharmacyId, isActive: true },
        _count: { _all: true },
      }),
      this.prisma.pharmacyInventory.count({ where: { pharmacyId, isActive: false } }),
      this.prisma.pharmacyInventory.count({
        where: { pharmacyId, isActive: true, lastReportedAt: { lt: this.presenter.staleCutoff(now) } },
      }),
      this.prisma.pharmacyInventory.aggregate({ where: { pharmacyId }, _max: { lastReportedAt: true } }),
      this.prisma.pharmacy.findUniqueOrThrow({
        where: { id: pharmacyId },
        select: { id: true, name: true, isVerified: true, isActive: true },
      }),
    ]);
    const count = (s: AvailabilityStatus) => byStatus.find((b) => b.availabilityStatus === s)?._count._all ?? 0;
    const active = byStatus.reduce((sum, b) => sum + b._count._all, 0);
    return {
      pharmacy,
      activeEntries: active,
      inactiveEntries: inactive,
      inStock: count('IN_STOCK'),
      lowStock: count('LOW_STOCK'),
      outOfStock: count('OUT_OF_STOCK'),
      unknown: count('UNKNOWN'),
      staleEntries: stale,
      lastUpdate: latest._max.lastReportedAt,
      thresholds: this.presenter.thresholds,
    };
  }

  async history(user: AuthUser, query: HistoryQueryDto) {
    const pharmacyId = await this.access.resolvePharmacyId(user, query.pharmacyId);
    const where: Prisma.InventoryHistoryWhereInput = { pharmacyId };
    if (query.inventoryId) where.pharmacyInventoryId = query.inventoryId;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(query),
        select: {
          id: true,
          previousStatus: true,
          newStatus: true,
          previousQuantity: true,
          newQuantity: true,
          previousIsActive: true,
          newIsActive: true,
          source: true,
          importBatchId: true,
          createdAt: true,
          changedBy: { select: { id: true, fullName: true } },
          inventory: { select: { id: true, medicine: { select: { id: true, name: true, strength: true, dosageForm: true } } } },
        },
      }),
      this.prisma.inventoryHistory.count({ where }),
    ]);
    return paginate(items, total, query.page, query.pageSize);
  }

  // ---------- Write ----------

  async create(user: AuthUser, dto: CreateInventoryDto, requestedPharmacyId?: string) {
    const pharmacyId = await this.access.resolvePharmacyId(user, requestedPharmacyId);
    const medicine = await this.prisma.medicine.findFirst({ where: { id: dto.medicineId, isActive: true }, select: { id: true } });
    if (!medicine) throw new NotFoundException('Medicine not found or inactive');

    const existing = await this.prisma.pharmacyInventory.findUnique({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId: dto.medicineId } },
      select: { id: true, isActive: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_INVENTORY',
        message: existing.isActive
          ? 'This medicine is already in your inventory — edit the existing entry'
          : 'This medicine has a deactivated entry — reactivate it instead',
        details: { inventoryId: existing.id, isActive: existing.isActive },
      });
    }

    const status = this.statusOrThrow(dto.availabilityStatus, dto.quantity);
    const result = await this.applyAndAudit(user, pharmacyId, [
      { medicineId: dto.medicineId, availabilityStatus: status, quantity: dto.quantity ?? null, showQuantityPublicly: dto.showQuantityPublicly ?? false, isActive: true },
    ], InventorySource.MANUAL, 'inventory.create');
    const created = await this.prisma.pharmacyInventory.findUniqueOrThrow({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId: dto.medicineId } },
      select: inventorySelect,
    });
    return { ...created, availabilityEvents: result.availabilityEventIds.length };
  }

  async update(user: AuthUser, id: string, dto: UpdateInventoryDto) {
    const entry = await this.findOwnedEntry(user, id);
    const quantity = dto.quantity !== undefined ? dto.quantity : entry.quantity;
    let status: AvailabilityStatus;
    if (dto.availabilityStatus) status = this.statusOrThrow(dto.availabilityStatus, quantity);
    else if (dto.quantity !== undefined) status = this.statusOrThrow(undefined, dto.quantity);
    else status = this.statusOrThrow(entry.availabilityStatus, quantity);

    await this.applyAndAudit(user, entry.pharmacyId, [
      {
        medicineId: entry.medicineId,
        availabilityStatus: status,
        quantity,
        showQuantityPublicly: dto.showQuantityPublicly,
        isActive: dto.isActive,
      },
    ], InventorySource.MANUAL, dto.isActive === false ? 'inventory.deactivate' : 'inventory.update');
    return this.prisma.pharmacyInventory.findUniqueOrThrow({ where: { id }, select: inventorySelect });
  }

  /** Soft delete: history and audit trails must survive, so entries are deactivated, never removed. */
  async deactivate(user: AuthUser, id: string) {
    const entry = await this.findOwnedEntry(user, id);
    if (!entry.isActive) return this.prisma.pharmacyInventory.findUniqueOrThrow({ where: { id }, select: inventorySelect });
    return this.update(user, id, { isActive: false });
  }

  async bulkUpdate(user: AuthUser, dto: BulkUpdateInventoryDto, requestedPharmacyId?: string) {
    const pharmacyId = await this.access.resolvePharmacyId(user, requestedPharmacyId);
    const changesRequested =
      dto.availabilityStatus !== undefined || dto.isActive !== undefined || dto.showQuantityPublicly !== undefined;
    if (!changesRequested && !dto.confirmCurrent) throw new BadRequestException('No changes requested');

    const ids = [...new Set(dto.ids)];
    const entries = await this.prisma.pharmacyInventory.findMany({ where: { id: { in: ids }, pharmacyId } });
    if (entries.length !== ids.length) {
      // Never partially apply — and never reveal whether foreign ids exist.
      throw new NotFoundException('One or more inventory entries were not found in this pharmacy');
    }
    const rows: InventoryRowChange[] = entries.map((e) => {
      const status = dto.availabilityStatus ?? e.availabilityStatus;
      // A status set in bulk replaces a quantity that would contradict it.
      const quantity = dto.availabilityStatus && !resolveStatus(status, e.quantity).ok ? null : e.quantity;
      return {
        medicineId: e.medicineId,
        availabilityStatus: status,
        quantity,
        showQuantityPublicly: dto.showQuantityPublicly,
        isActive: dto.isActive,
      };
    });
    const result = await this.applyAndAudit(user, pharmacyId, rows, InventorySource.MANUAL, 'inventory.bulk_update', {
      count: rows.length,
      availabilityStatus: dto.availabilityStatus ?? null,
      isActive: dto.isActive ?? null,
      confirmCurrent: dto.confirmCurrent ?? false,
    });
    return { updated: result.updated, unchanged: result.unchanged };
  }

  // ---------- Import ----------

  async importPreview(
    user: AuthUser,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number } | undefined,
    requestedPharmacyId?: string,
  ) {
    if (!file) throw new BadRequestException('A file is required (field name "file")');
    const pharmacyId = await this.access.resolvePharmacyId(user, requestedPharmacyId);

    let sheet;
    try {
      sheet = await parseInventoryFile(file, this.config.get<number>('IMPORT_MAX_ROWS') ?? 5000);
    } catch (err) {
      if (err instanceof ImportFileError) {
        throw new UnprocessableEntityException({ code: err.code, message: err.message });
      }
      throw err;
    }

    const { mapping, unknownColumns, missing } = mapColumns(sheet.headers);
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'MISSING_COLUMNS',
        message: `Missing required column(s): ${missing.join(', ')}`,
        details: { missing, found: sheet.headers },
      });
    }

    // Load only the catalog entries the file can refer to.
    const codes = new Set<string>();
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const { values } of sheet.rows) {
      if (mapping.medicineCode && values[mapping.medicineCode]) codes.add(values[mapping.medicineCode]);
      if (mapping.medicineId && values[mapping.medicineId]) ids.add(values[mapping.medicineId]);
      if (mapping.medicineName && values[mapping.medicineName]) names.add(normalizeSearchText(values[mapping.medicineName]));
    }
    const catalogRows = await this.prisma.medicine.findMany({
      where: {
        OR: [
          ...(codes.size ? [{ catalogCode: { in: [...codes], mode: 'insensitive' as const } }] : []),
          ...(ids.size ? [{ id: { in: [...ids] } }] : []),
          ...(names.size ? [{ normalizedName: { in: [...names] } }] : []),
        ],
      },
      select: { id: true, catalogCode: true, name: true, normalizedName: true, strength: true, dosageForm: true, isActive: true },
    });
    const catalog = buildCatalogLookup(catalogRows);
    const existingRows = await this.prisma.pharmacyInventory.findMany({
      where: { pharmacyId, medicineId: { in: catalogRows.map((c) => c.id) } },
      select: { medicineId: true, availabilityStatus: true, quantity: true, isActive: true },
    });
    const existing = new Map(existingRows.map((e) => [e.medicineId, e]));

    const rows = validateImportRows(sheet.rows, mapping, catalog, existing);
    const valid = rows.filter((r) => r.errors.length === 0);
    const summary = {
      totalRows: rows.length,
      validRows: valid.length,
      errorRows: rows.length - valid.length,
      creates: valid.filter((r) => r.action === 'CREATE').length,
      updates: valid.filter((r) => r.action === 'UPDATE').length,
      unchanged: valid.filter((r) => r.action === 'UNCHANGED').length,
      duplicates: rows.filter((r) => r.errors.some((e) => e.code === 'DUPLICATE_ROW')).length,
    };

    const payload: StoredImportRow[] = valid.map((r) => ({
      rowNumber: r.rowNumber,
      medicineId: r.medicine!.id,
      availabilityStatus: r.availabilityStatus!,
      quantity: r.quantity ?? null,
      showQuantityPublicly: r.showQuantityPublicly,
    }));
    const expiresAt = new Date(Date.now() + IMPORT_PREVIEW_TTL_MINUTES * 60_000);
    const batch = await this.prisma.importBatch.create({
      data: {
        pharmacyId,
        userId: user.id,
        fileName: file.originalname.slice(0, 200),
        totalRows: summary.totalRows,
        validRows: summary.validRows,
        errorRows: summary.errorRows,
        payload: payload as unknown as Prisma.InputJsonValue,
        report: { summary, errors: this.errorReport(rows) } as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
      select: { id: true },
    });

    return {
      batchId: batch.id,
      fileName: file.originalname,
      expiresAt,
      columns: { mapping, unknownColumns },
      summary,
      rows,
    };
  }

  async importConfirm(user: AuthUser, batchId: string, requestedPharmacyId?: string) {
    const pharmacyId = await this.access.resolvePharmacyId(user, requestedPharmacyId);
    const batch = await this.prisma.importBatch.findFirst({ where: { id: batchId, pharmacyId } });
    if (!batch) throw new NotFoundException('Import preview not found');
    if (batch.status === ImportBatchStatus.COMMITTED) {
      throw new ConflictException({ code: 'IMPORT_ALREADY_COMMITTED', message: 'This import was already confirmed' });
    }
    if (batch.status === ImportBatchStatus.EXPIRED || batch.expiresAt < new Date()) {
      throw new GoneException({ code: 'IMPORT_EXPIRED', message: 'The preview expired — upload the file again' });
    }
    const payload = batch.payload as unknown as StoredImportRow[];
    if (payload.length === 0) throw new BadRequestException('The preview contains no valid rows to import');

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Claim the batch atomically so a double-click / concurrent confirm cannot apply it twice.
      const claimed = await tx.importBatch.updateMany({
        where: { id: batch.id, status: ImportBatchStatus.PREVIEWED },
        data: { status: ImportBatchStatus.COMMITTED, committedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new ConflictException({ code: 'IMPORT_ALREADY_COMMITTED', message: 'This import was already confirmed' });
      }
      // Medicines may have been deactivated since the preview — re-check inside the transaction.
      const active = await tx.medicine.findMany({
        where: { id: { in: payload.map((p) => p.medicineId) }, isActive: true },
        select: { id: true },
      });
      const activeIds = new Set(active.map((a) => a.id));
      const skipped = payload.filter((p) => !activeIds.has(p.medicineId)).map((p) => p.rowNumber);
      const rows = payload
        .filter((p) => activeIds.has(p.medicineId))
        .map((p) => ({
          medicineId: p.medicineId,
          availabilityStatus: p.availabilityStatus,
          quantity: p.quantity,
          showQuantityPublicly: p.showQuantityPublicly,
          isActive: true,
        }));
      const result = await applyInventoryChanges(tx, rows, {
        pharmacyId,
        actorId: user.id,
        source: InventorySource.IMPORT,
        importBatchId: batch.id,
      });
      const report = {
        ...(batch.report as Record<string, unknown>),
        committed: { created: result.created, updated: result.updated, unchanged: result.unchanged, skippedRows: skipped },
      };
      await tx.importBatch.update({ where: { id: batch.id }, data: { report: report as Prisma.InputJsonValue } });
      await this.audit.log(
        {
          userId: user.id,
          action: 'inventory.import',
          entityType: 'Pharmacy',
          entityId: pharmacyId,
          metadata: { batchId: batch.id, fileName: batch.fileName, created: result.created, updated: result.updated, skipped: skipped.length },
        },
        tx,
      );
      return { result, report };
    }, TX_OPTIONS);

    await this.events.enqueue(outcome.result.availabilityEventIds);
    return {
      batchId: batch.id,
      fileName: batch.fileName,
      created: outcome.result.created,
      updated: outcome.result.updated,
      unchanged: outcome.result.unchanged,
      skippedRows: outcome.report.committed.skippedRows,
      errorRows: batch.errorRows,
      report: outcome.report,
    };
  }

  async importBatches(user: AuthUser, requestedPharmacyId?: string) {
    const pharmacyId = await this.access.resolvePharmacyId(user, requestedPharmacyId);
    const now = new Date();
    const batches = await this.prisma.importBatch.findMany({
      where: { pharmacyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        fileName: true,
        status: true,
        totalRows: true,
        validRows: true,
        errorRows: true,
        createdAt: true,
        committedAt: true,
        expiresAt: true,
        user: { select: { fullName: true } },
      },
    });
    // Previews past their expiry can no longer be confirmed; report them as such.
    return batches.map((b) =>
      b.status === ImportBatchStatus.PREVIEWED && b.expiresAt < now ? { ...b, status: ImportBatchStatus.EXPIRED } : b,
    );
  }

  // ---------- Helpers ----------

  private async findOwnedEntry(user: AuthUser, id: string) {
    const entry = await this.prisma.pharmacyInventory.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Inventory entry not found');
    // Throws 403 unless the user manages entry.pharmacyId (or is admin).
    await this.access.resolvePharmacyId(user, entry.pharmacyId);
    return entry;
  }

  private statusOrThrow(status: AvailabilityStatus | undefined | null, quantity: number | null | undefined) {
    const resolved = resolveStatus(status, quantity);
    if (!resolved.ok) throw new BadRequestException({ code: resolved.code, message: resolved.message });
    return resolved.status;
  }

  private async applyAndAudit(
    user: AuthUser,
    pharmacyId: string,
    rows: InventoryRowChange[],
    source: InventorySource,
    action: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<ApplyResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await applyInventoryChanges(tx, rows, { pharmacyId, actorId: user.id, source });
      await this.audit.log(
        {
          userId: user.id,
          action,
          entityType: 'Pharmacy',
          entityId: pharmacyId,
          metadata: metadata ?? {
            medicineId: rows[0]?.medicineId,
            availabilityStatus: rows[0]?.availabilityStatus,
            quantity: rows[0]?.quantity ?? null,
            isActive: rows[0]?.isActive ?? null,
          },
        },
        tx,
      );
      return r;
    }, TX_OPTIONS);
    await this.events.enqueue(result.availabilityEventIds);
    return result;
  }

  private errorReport(rows: ValidatedRow[]) {
    return rows
      .filter((r) => r.errors.length > 0)
      .slice(0, 500)
      .map((r) => ({ rowNumber: r.rowNumber, errors: r.errors.map((e) => ({ field: e.field, code: e.code })) }));
  }
}
