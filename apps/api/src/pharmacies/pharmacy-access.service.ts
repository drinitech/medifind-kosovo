import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/decorators/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The single authority on "may this account act on this pharmacy?".
 * Every pharmacy-scoped endpoint resolves its pharmacy through here, so
 * cross-pharmacy access is impossible regardless of what the client sends.
 */
@Injectable()
export class PharmacyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePharmacyId(user: AuthUser, requestedId?: string): Promise<string> {
    if (user.role === Role.ADMIN) {
      if (!requestedId) throw new BadRequestException('pharmacyId is required for administrators');
      const exists = await this.prisma.pharmacy.findUnique({ where: { id: requestedId }, select: { id: true } });
      if (!exists) throw new NotFoundException('Pharmacy not found');
      return requestedId;
    }

    if (user.role !== Role.PHARMACY_MANAGER) {
      throw new ForbiddenException('Only pharmacy managers can manage pharmacy data');
    }

    const memberships = await this.prisma.pharmacyMembership.findMany({
      where: { userId: user.id },
      select: { pharmacyId: true },
      orderBy: { createdAt: 'asc' },
    });

    if (requestedId) {
      if (!memberships.some((m) => m.pharmacyId === requestedId)) {
        // Same response whether the pharmacy exists or not — no enumeration.
        throw new ForbiddenException('You do not have access to this pharmacy');
      }
      return requestedId;
    }
    if (memberships.length === 0) {
      throw new NotFoundException({ code: 'NO_PHARMACY', message: 'No pharmacy profile is linked to this account yet' });
    }
    if (memberships.length > 1) {
      throw new BadRequestException('pharmacyId is required when you manage more than one pharmacy');
    }
    return memberships[0].pharmacyId;
  }
}
