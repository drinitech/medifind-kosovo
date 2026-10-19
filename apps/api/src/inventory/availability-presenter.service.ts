import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AvailabilityStatus, InventorySource } from '@prisma/client';
import { computeFreshness, Freshness, FreshnessThresholds, publicQuantity } from './availability';

export interface PresentableInventory {
  id: string;
  availabilityStatus: AvailabilityStatus;
  quantity: number | null;
  showQuantityPublicly: boolean;
  lastReportedAt: Date;
  source: InventorySource;
}

export interface PublicAvailability {
  inventoryId: string;
  availabilityStatus: AvailabilityStatus;
  /** Present only when the pharmacy allows public display of quantities. */
  quantity: number | null;
  lastReportedAt: Date;
  source: InventorySource;
  freshness: Freshness;
  /** Always "reported" — MediFind never claims real-time confirmed stock. */
  isReported: true;
}

/** Shapes inventory rows for public consumption (quantity privacy + freshness labelling). */
@Injectable()
export class AvailabilityPresenter {
  readonly thresholds: FreshnessThresholds;

  constructor(config: ConfigService) {
    this.thresholds = {
      agingHours: config.get<number>('INVENTORY_AGING_HOURS') ?? 24,
      staleHours: config.get<number>('INVENTORY_STALE_HOURS') ?? 72,
    };
  }

  present(entry: PresentableInventory, now = new Date()): PublicAvailability {
    return {
      inventoryId: entry.id,
      availabilityStatus: entry.availabilityStatus,
      quantity: publicQuantity(entry),
      lastReportedAt: entry.lastReportedAt,
      source: entry.source,
      freshness: computeFreshness(entry.lastReportedAt, now, this.thresholds),
      isReported: true,
    };
  }

  staleCutoff(now = new Date()): Date {
    return new Date(now.getTime() - this.thresholds.staleHours * 3_600_000);
  }

  agingCutoff(now = new Date()): Date {
    return new Date(now.getTime() - this.thresholds.agingHours * 3_600_000);
  }
}
