import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/decorators/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { PharmacyAccessService } from './pharmacy-access.service';

function setup(memberships: string[], existingPharmacies: string[] = []) {
  const prisma = {
    pharmacyMembership: { findMany: jest.fn().mockResolvedValue(memberships.map((pharmacyId) => ({ pharmacyId }))) },
    pharmacy: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(existingPharmacies.includes(where.id) ? { id: where.id } : null),
      ),
    },
  } as unknown as PrismaService;
  return new PharmacyAccessService(prisma);
}

const user = (role: Role): AuthUser => ({ id: 'u1', email: 'u@test', fullName: 'U', role });

describe('PharmacyAccessService (ownership boundaries)', () => {
  it('lets a manager act on their own pharmacy, implicitly or explicitly', async () => {
    const svc = setup(['p1']);
    await expect(svc.resolvePharmacyId(user(Role.PHARMACY_MANAGER))).resolves.toBe('p1');
    await expect(svc.resolvePharmacyId(user(Role.PHARMACY_MANAGER), 'p1')).resolves.toBe('p1');
  });

  it("forbids a manager from another pharmacy's data", async () => {
    const svc = setup(['p1']);
    await expect(svc.resolvePharmacyId(user(Role.PHARMACY_MANAGER), 'p2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an explicit pharmacy when a manager has several', async () => {
    const svc = setup(['p1', 'p2']);
    await expect(svc.resolvePharmacyId(user(Role.PHARMACY_MANAGER))).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.resolvePharmacyId(user(Role.PHARMACY_MANAGER), 'p2')).resolves.toBe('p2');
  });

  it('reports managers without a pharmacy', async () => {
    const svc = setup([]);
    await expect(svc.resolvePharmacyId(user(Role.PHARMACY_MANAGER))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never lets public users manage pharmacies', async () => {
    const svc = setup(['p1']);
    await expect(svc.resolvePharmacyId(user(Role.USER), 'p1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets administrators target any existing pharmacy explicitly', async () => {
    const svc = setup([], ['p9']);
    await expect(svc.resolvePharmacyId(user(Role.ADMIN), 'p9')).resolves.toBe('p9');
    await expect(svc.resolvePharmacyId(user(Role.ADMIN), 'nope')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.resolvePharmacyId(user(Role.ADMIN))).rejects.toBeInstanceOf(BadRequestException);
  });
});
