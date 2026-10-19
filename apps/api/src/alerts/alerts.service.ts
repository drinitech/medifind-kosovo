import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AVAILABLE_STATUSES } from '../inventory/availability';
import { medicinePublicSelect, PUBLIC_PHARMACY_WHERE } from '../medicines/medicines.service';
import { PrismaService } from '../prisma/prisma.service';
import { alertMatchesPharmacy } from './alert-matcher.service';
import { CreateAlertDto, UpdateAlertDto } from './dto/alert.dto';

const MAX_ACTIVE_ALERTS = 25;

const alertSelect = {
  id: true,
  preferredCity: true,
  latitude: true,
  longitude: true,
  radiusKm: true,
  isActive: true,
  lastNotifiedAt: true,
  createdAt: true,
  updatedAt: true,
  medicine: { select: medicinePublicSelect },
} as const satisfies Prisma.AvailabilityAlertSelect;

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAlertDto) {
    const medicine = await this.prisma.medicine.findFirst({
      where: { id: dto.medicineId, isActive: true },
      select: { id: true },
    });
    if (!medicine) throw new NotFoundException('Medicine not found');

    const [duplicate, activeCount] = await Promise.all([
      this.prisma.availabilityAlert.findFirst({
        where: { userId, medicineId: dto.medicineId, isActive: true },
        select: { id: true },
      }),
      this.prisma.availabilityAlert.count({ where: { userId, isActive: true } }),
    ]);
    if (duplicate) {
      throw new ConflictException({ code: 'ALERT_EXISTS', message: 'You already have an active alert for this medicine' });
    }
    if (activeCount >= MAX_ACTIVE_ALERTS) {
      throw new BadRequestException(`You can have at most ${MAX_ACTIVE_ALERTS} active alerts`);
    }

    const alert = await this.prisma.availabilityAlert.create({
      data: {
        userId,
        medicineId: dto.medicineId,
        preferredCity: dto.preferredCity ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        radiusKm: dto.radiusKm ?? null,
      },
      select: alertSelect,
    });
    return { ...alert, currentlyAvailableCount: await this.currentlyAvailable(alert) };
  }

  async list(userId: string) {
    const alerts = await this.prisma.availabilityAlert.findMany({
      where: { userId },
      select: alertSelect,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return Promise.all(alerts.map(async (a) => ({ ...a, currentlyAvailableCount: await this.currentlyAvailable(a) })));
  }

  async update(userId: string, id: string, dto: UpdateAlertDto) {
    // Ownership is part of the lookup — another user's alert is simply "not found".
    const alert = await this.prisma.availabilityAlert.findFirst({ where: { id, userId }, select: { id: true, medicineId: true } });
    if (!alert) throw new NotFoundException('Alert not found');
    if (dto.isActive === true) {
      const duplicate = await this.prisma.availabilityAlert.findFirst({
        where: { userId, medicineId: alert.medicineId, isActive: true, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException({ code: 'ALERT_EXISTS', message: 'Another active alert exists for this medicine' });
    }
    return this.prisma.availabilityAlert.update({
      where: { id },
      data: {
        isActive: dto.isActive,
        preferredCity: dto.preferredCity,
        radiusKm: dto.radiusKm,
      },
      select: alertSelect,
    });
  }

  private async currentlyAvailable(alert: {
    medicine: { id: string };
    preferredCity: string | null;
    latitude: number | null;
    longitude: number | null;
    radiusKm: number | null;
  }) {
    const rows = await this.prisma.pharmacyInventory.findMany({
      where: {
        medicineId: alert.medicine.id,
        isActive: true,
        availabilityStatus: { in: AVAILABLE_STATUSES },
        pharmacy: PUBLIC_PHARMACY_WHERE,
      },
      select: { pharmacy: { select: { city: true, latitude: true, longitude: true } } },
    });
    return rows.filter((r) => alertMatchesPharmacy(alert, r.pharmacy)).length;
  }
}
