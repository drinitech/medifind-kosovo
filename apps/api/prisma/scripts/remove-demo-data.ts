/**
 * Removes the fictional demo data created by prisma/seed.ts:
 * demo pharmacies (isDemo) with their inventory, history and import batches, and
 * the seeded demo manager/user accounts. The administrator account and the
 * medicine catalog are kept. Audit logs are kept (their user link is nulled).
 *
 *   pnpm --filter api remove:demo            # apply
 *   pnpm --filter api remove:demo --dry-run  # report only
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');
const DEMO_ACCOUNTS = [
  process.env.SEED_MANAGER_EMAIL ?? 'farmacia@medifind.test',
  process.env.SEED_USER_EMAIL ?? 'perdoruesi@medifind.test',
].map((e) => e.toLowerCase());

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const pharmacies = await prisma.pharmacy.findMany({ where: { isDemo: true }, select: { id: true, name: true } });
    const ids = pharmacies.map((p) => p.id);
    const [inventory, history, users] = await Promise.all([
      prisma.pharmacyInventory.count({ where: { pharmacyId: { in: ids } } }),
      prisma.inventoryHistory.count({ where: { pharmacyId: { in: ids } } }),
      prisma.user.findMany({ where: { email: { in: DEMO_ACCOUNTS } }, select: { id: true, email: true } }),
    ]);
    console.log(`Demo pharmacies: ${pharmacies.length}, inventory entries: ${inventory}, history rows: ${history}, demo accounts: ${users.map((u) => u.email).join(', ') || 'none'}`);
    if (DRY_RUN) return;

    await prisma.$transaction(async (tx) => {
      // History and inventory are protected by Restrict FKs, so delete children first.
      await tx.inventoryHistory.deleteMany({ where: { pharmacyId: { in: ids } } });
      await tx.pharmacyInventory.deleteMany({ where: { pharmacyId: { in: ids } } });
      await tx.pharmacy.deleteMany({ where: { id: { in: ids } } }); // memberships + import batches cascade
      await tx.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } }); // alerts + notifications cascade
      await tx.auditLog.create({
        data: { action: 'system.remove_demo', entityType: 'System', metadata: { pharmacies: ids.length, inventory, history, accounts: users.length } },
      });
    }, { timeout: 60_000 });
    console.log('Demo data removed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
