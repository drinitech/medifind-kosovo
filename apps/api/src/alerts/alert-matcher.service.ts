import { Injectable, Logger } from '@nestjs/common';
import { NotificationStatus, NotificationType } from '@prisma/client';
import { haversineKm } from '../common/utils/geo';
import { normalizeSearchText } from '../common/utils/normalize';
import { isAvailable } from '../inventory/availability';
import { PrismaService } from '../prisma/prisma.service';

/** Same alert + same pharmacy will not notify again within this window (protects against flapping stock). */
export const ALERT_PHARMACY_COOLDOWN_HOURS = 12;

export interface AlertLocationFilter {
  preferredCity: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
}

/** Whether a pharmacy satisfies an alert's optional location preferences. */
export function alertMatchesPharmacy(
  alert: AlertLocationFilter,
  pharmacy: { city: string; latitude: number; longitude: number },
): boolean {
  if (alert.preferredCity && normalizeSearchText(alert.preferredCity) !== normalizeSearchText(pharmacy.city)) {
    return false;
  }
  if (alert.latitude !== null && alert.longitude !== null && alert.radiusKm !== null) {
    return haversineKm(alert.latitude, alert.longitude, pharmacy.latitude, pharmacy.longitude) <= alert.radiusKm;
  }
  return true;
}

export function alertDedupeKey(alertId: string, historyId: string) {
  return `alert:${alertId}:event:${historyId}`;
}

/**
 * Turns an "available again" inventory event into in-app notifications for
 * matching alerts. Idempotent: re-processing the same event never creates a
 * second notification (unique dedupeKey per alert + event).
 */
@Injectable()
export class AlertMatcherService {
  private readonly logger = new Logger(AlertMatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processAvailabilityEvent(historyId: string): Promise<{ notified: number }> {
    const event = await this.prisma.inventoryHistory.findUnique({
      where: { id: historyId },
      select: {
        id: true,
        newStatus: true,
        newIsActive: true,
        inventory: {
          select: {
            medicineId: true,
            medicine: { select: { name: true, strength: true, isActive: true } },
            pharmacy: {
              select: { id: true, name: true, city: true, latitude: true, longitude: true, isVerified: true, isActive: true },
            },
          },
        },
      },
    });
    if (!event) return { notified: 0 };
    const { pharmacy, medicine, medicineId } = event.inventory;

    // Only verified, active pharmacies are visible to the public — never alert about others.
    if (!pharmacy.isVerified || !pharmacy.isActive || !medicine.isActive) return { notified: 0 };
    if (!isAvailable(event.newStatus, event.newIsActive)) return { notified: 0 };

    const alerts = await this.prisma.availabilityAlert.findMany({
      where: { medicineId, isActive: true, user: { isActive: true } },
      select: { id: true, userId: true, preferredCity: true, latitude: true, longitude: true, radiusKm: true },
    });
    const matching = alerts.filter((a) => alertMatchesPharmacy(a, pharmacy));
    if (matching.length === 0) return { notified: 0 };

    const cooldownStart = new Date(Date.now() - ALERT_PHARMACY_COOLDOWN_HOURS * 3_600_000);
    const recent = await this.prisma.notification.findMany({
      where: {
        alertId: { in: matching.map((a) => a.id) },
        createdAt: { gte: cooldownStart },
        inventoryHistory: { pharmacyId: pharmacy.id },
      },
      select: { alertId: true },
    });
    const cooling = new Set(recent.map((n) => n.alertId));
    const toNotify = matching.filter((a) => !cooling.has(a.id));
    if (toNotify.length === 0) return { notified: 0 };

    const now = new Date();
    const label = [medicine.name, medicine.strength].filter(Boolean).join(' ');
    const { count } = await this.prisma.notification.createMany({
      data: toNotify.map((a) => ({
        userId: a.userId,
        alertId: a.id,
        inventoryHistoryId: event.id,
        type: NotificationType.AVAILABILITY_ALERT,
        title: `${label} raportohet në dispozicion`,
        message: `${pharmacy.name} (${pharmacy.city}) raportoi se ${label} është në dispozicion. Disponueshmëria e raportuar — kontakto farmacinë për konfirmim.`,
        link: `/medicines/${medicineId}`,
        // In-app notifications are delivered by being stored.
        status: NotificationStatus.SENT,
        sentAt: now,
        dedupeKey: alertDedupeKey(a.id, event.id),
      })),
      skipDuplicates: true,
    });
    if (count > 0) {
      await this.prisma.availabilityAlert.updateMany({
        where: { id: { in: toNotify.map((a) => a.id) } },
        data: { lastNotifiedAt: now },
      });
    }
    this.logger.log(`Availability event ${historyId}: ${count} notification(s) created`);
    return { notified: count };
  }
}
