import { randomUUID } from 'node:crypto';
import { AvailabilityStatus, InventorySource, Prisma } from '@prisma/client';
import { isAvailabilityEvent } from './availability';

export interface InventoryRowChange {
  medicineId: string;
  availabilityStatus: AvailabilityStatus;
  quantity: number | null;
  /** `undefined` keeps the current value (or `false` for new entries). */
  showQuantityPublicly?: boolean;
  /** `undefined` keeps the current value (or `true` for new entries). */
  isActive?: boolean;
}

export interface ApplyContext {
  pharmacyId: string;
  actorId: string | null;
  source: InventorySource;
  importBatchId?: string | null;
  now?: Date;
}

export interface ApplyResult {
  created: number;
  updated: number;
  unchanged: number;
  /** History ids that represent "became available" events (for alerts). */
  availabilityEventIds: string[];
  historyIds: string[];
}

const UPDATE_CHUNK = 1000;

/**
 * Applies a set of inventory reports for one pharmacy inside an existing
 * transaction using set-based SQL (a handful of statements regardless of row
 * count). Every report refreshes `lastReportedAt`; history is written only for
 * entries whose status, quantity or active flag actually changed.
 */
export async function applyInventoryChanges(
  tx: Prisma.TransactionClient,
  rows: InventoryRowChange[],
  ctx: ApplyContext,
): Promise<ApplyResult> {
  const now = ctx.now ?? new Date();
  const result: ApplyResult = { created: 0, updated: 0, unchanged: 0, availabilityEventIds: [], historyIds: [] };
  if (rows.length === 0) return result;

  const medicineIds = [...new Set(rows.map((r) => r.medicineId))];
  if (medicineIds.length !== rows.length) throw new Error('applyInventoryChanges: duplicate medicineId in rows');

  const existing = await tx.pharmacyInventory.findMany({
    where: { pharmacyId: ctx.pharmacyId, medicineId: { in: medicineIds } },
  });
  const existingByMedicine = new Map(existing.map((e) => [e.medicineId, e]));

  const toCreate = rows.filter((r) => !existingByMedicine.has(r.medicineId));
  const toUpdate = rows.filter((r) => existingByMedicine.has(r.medicineId));

  // History ids are generated here so availability events are known without relying on RETURNING order.
  const history: (Prisma.InventoryHistoryCreateManyInput & { id: string })[] = [];

  if (toCreate.length > 0) {
    const created = await tx.pharmacyInventory.createManyAndReturn({
      data: toCreate.map((r) => ({
        pharmacyId: ctx.pharmacyId,
        medicineId: r.medicineId,
        availabilityStatus: r.availabilityStatus,
        quantity: r.quantity,
        showQuantityPublicly: r.showQuantityPublicly ?? false,
        isActive: r.isActive ?? true,
        lastReportedAt: now,
        source: ctx.source,
      })),
      select: { id: true, availabilityStatus: true, quantity: true, isActive: true },
    });
    result.created = created.length;
    for (const c of created) {
      const id = randomUUID();
      if (isAvailabilityEvent(null, { status: c.availabilityStatus, isActive: c.isActive })) {
        result.availabilityEventIds.push(id);
      }
      history.push({
        id,
        pharmacyInventoryId: c.id,
        pharmacyId: ctx.pharmacyId,
        previousStatus: null,
        newStatus: c.availabilityStatus,
        previousQuantity: null,
        newQuantity: c.quantity,
        previousIsActive: null,
        newIsActive: c.isActive,
        changedByUserId: ctx.actorId,
        source: ctx.source,
        importBatchId: ctx.importBatchId ?? null,
        createdAt: now,
      });
    }
  }

  const updateValues: Prisma.Sql[] = [];
  for (const r of toUpdate) {
    const prev = existingByMedicine.get(r.medicineId)!;
    const next = {
      status: r.availabilityStatus,
      quantity: r.quantity,
      show: r.showQuantityPublicly ?? prev.showQuantityPublicly,
      active: r.isActive ?? prev.isActive,
    };
    updateValues.push(
      Prisma.sql`(${prev.id}, ${next.status}, ${next.quantity}::int, ${next.show}::boolean, ${next.active}::boolean)`,
    );
    const changed =
      prev.availabilityStatus !== next.status || prev.quantity !== next.quantity || prev.isActive !== next.active;
    if (!changed) {
      result.unchanged++;
      continue;
    }
    result.updated++;
    const id = randomUUID();
    if (
      isAvailabilityEvent(
        { status: prev.availabilityStatus, isActive: prev.isActive },
        { status: next.status, isActive: next.active },
      )
    ) {
      result.availabilityEventIds.push(id);
    }
    history.push({
      id,
      pharmacyInventoryId: prev.id,
      pharmacyId: ctx.pharmacyId,
      previousStatus: prev.availabilityStatus,
      newStatus: next.status,
      previousQuantity: prev.quantity,
      newQuantity: next.quantity,
      previousIsActive: prev.isActive,
      newIsActive: next.active,
      changedByUserId: ctx.actorId,
      source: ctx.source,
      importBatchId: ctx.importBatchId ?? null,
      createdAt: now,
    });
  }

  for (let i = 0; i < updateValues.length; i += UPDATE_CHUNK) {
    const chunk = updateValues.slice(i, i + UPDATE_CHUNK);
    await tx.$executeRaw`
      UPDATE "PharmacyInventory" AS pi SET
        "availabilityStatus" = v.status::"AvailabilityStatus",
        "quantity" = v.quantity,
        "showQuantityPublicly" = v.show,
        "isActive" = v.active,
        "source" = ${ctx.source}::"InventorySource",
        "lastReportedAt" = ${now},
        "updatedAt" = ${now}
      FROM (VALUES ${Prisma.join(chunk)}) AS v(id, status, quantity, show, active)
      WHERE pi.id = v.id AND pi."pharmacyId" = ${ctx.pharmacyId}`;
  }

  if (history.length > 0) {
    await tx.inventoryHistory.createMany({ data: history });
    result.historyIds = history.map((h) => h.id);
  }
  return result;
}
