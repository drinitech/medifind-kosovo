/**
 * Development seed — FICTIONAL DEMONSTRATION DATA ONLY.
 *
 * Every pharmacy created here is flagged `isDemo = true`, uses a "Demo" name, a
 * placeholder address and a non-dialable placeholder phone number. None of it
 * describes a real Kosovo pharmacy, and stock levels are invented for demos.
 *
 * Demo accounts come from SEED_* environment variables. When a password is not
 * provided a random one is generated and printed once. The script refuses to
 * run with NODE_ENV=production.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AvailabilityStatus,
  DosageForm,
  InventorySource,
  MembershipRole,
  NotificationStatus,
  NotificationType,
  PharmacySource,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as argon2 from 'argon2';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data with NODE_ENV=production.');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%/.,+\-\s]/g, ' ').replace(/\s+/g, ' ').trim();

const MEDICINES: Array<{
  code: string;
  name: string;
  ingredient: string;
  strength: string;
  form: DosageForm;
  pack: string;
}> = [
  { code: 'DEMO-0001', name: 'Paracetamol', ingredient: 'Paracetamol', strength: '500 mg', form: 'TABLET', pack: '20 tableta' },
  { code: 'DEMO-0002', name: 'Paracetamol', ingredient: 'Paracetamol', strength: '120 mg/5 ml', form: 'SYRUP', pack: '100 ml' },
  { code: 'DEMO-0003', name: 'Paracetamol', ingredient: 'Paracetamol', strength: '125 mg', form: 'SUPPOSITORY', pack: '10 supozitorë' },
  { code: 'DEMO-0004', name: 'Ibuprofen', ingredient: 'Ibuprofen', strength: '400 mg', form: 'TABLET', pack: '30 tableta' },
  { code: 'DEMO-0005', name: 'Ibuprofen', ingredient: 'Ibuprofen', strength: '100 mg/5 ml', form: 'SUSPENSION', pack: '100 ml' },
  { code: 'DEMO-0006', name: 'Amoxicillin', ingredient: 'Amoxicillin', strength: '500 mg', form: 'CAPSULE', pack: '16 kapsula' },
  { code: 'DEMO-0007', name: 'Amoxicillin + Acid klavulanik', ingredient: 'Amoxicillin, Acid klavulanik', strength: '875 mg/125 mg', form: 'TABLET', pack: '14 tableta' },
  { code: 'DEMO-0008', name: 'Azithromycin', ingredient: 'Azithromycin', strength: '500 mg', form: 'TABLET', pack: '3 tableta' },
  { code: 'DEMO-0009', name: 'Metformin', ingredient: 'Metformin hydrochloride', strength: '850 mg', form: 'TABLET', pack: '60 tableta' },
  { code: 'DEMO-0010', name: 'Amlodipine', ingredient: 'Amlodipine', strength: '5 mg', form: 'TABLET', pack: '30 tableta' },
  { code: 'DEMO-0011', name: 'Atorvastatin', ingredient: 'Atorvastatin', strength: '20 mg', form: 'TABLET', pack: '30 tableta' },
  { code: 'DEMO-0012', name: 'Bisoprolol', ingredient: 'Bisoprolol fumarate', strength: '5 mg', form: 'TABLET', pack: '30 tableta' },
  { code: 'DEMO-0013', name: 'Omeprazole', ingredient: 'Omeprazole', strength: '20 mg', form: 'CAPSULE', pack: '28 kapsula' },
  { code: 'DEMO-0014', name: 'Pantoprazole', ingredient: 'Pantoprazole', strength: '40 mg', form: 'TABLET', pack: '28 tableta' },
  { code: 'DEMO-0015', name: 'Cetirizine', ingredient: 'Cetirizine', strength: '10 mg', form: 'TABLET', pack: '10 tableta' },
  { code: 'DEMO-0016', name: 'Loratadine', ingredient: 'Loratadine', strength: '10 mg', form: 'TABLET', pack: '10 tableta' },
  { code: 'DEMO-0017', name: 'Diclofenac', ingredient: 'Diclofenac sodium', strength: '50 mg', form: 'TABLET', pack: '20 tableta' },
  { code: 'DEMO-0018', name: 'Diclofenac', ingredient: 'Diclofenac diethylamine', strength: '1%', form: 'GEL', pack: '50 g' },
  { code: 'DEMO-0019', name: 'Salbutamol', ingredient: 'Salbutamol', strength: '100 mcg/dozë', form: 'INHALER', pack: '200 doza' },
  { code: 'DEMO-0020', name: 'Levothyroxine', ingredient: 'Levothyroxine sodium', strength: '50 mcg', form: 'TABLET', pack: '50 tableta' },
  { code: 'DEMO-0021', name: 'Insulin glargine', ingredient: 'Insulin glargine', strength: '100 IU/ml', form: 'INJECTION', pack: '5 stilolapsa x 3 ml' },
  { code: 'DEMO-0022', name: 'Ondansetron', ingredient: 'Ondansetron', strength: '4 mg', form: 'TABLET', pack: '10 tableta' },
];

const PHARMACIES: Array<{ name: string; city: string; lat: number; lng: number; verified: boolean; phone: boolean }> = [
  { name: 'Farmacia Demo Qendra', city: 'Prishtinë', lat: 42.6629, lng: 21.1655, verified: true, phone: true },
  { name: 'Farmacia Demo Agimi', city: 'Prishtinë', lat: 42.6512, lng: 21.1499, verified: true, phone: true },
  { name: 'Farmacia Demo Dardania', city: 'Prishtinë', lat: 42.6484, lng: 21.1735, verified: true, phone: false },
  { name: 'Farmacia Demo Lumbardhi', city: 'Prizren', lat: 42.2139, lng: 20.7397, verified: true, phone: true },
  { name: 'Farmacia Demo Rugova', city: 'Pejë', lat: 42.6593, lng: 20.2883, verified: true, phone: true },
  { name: 'Farmacia Demo Erenik', city: 'Gjakovë', lat: 42.3803, lng: 20.4308, verified: true, phone: false },
  { name: 'Farmacia Demo Nerodime', city: 'Ferizaj', lat: 42.3702, lng: 21.1553, verified: true, phone: true },
  { name: 'Farmacia Demo Morava', city: 'Gjilan', lat: 42.4635, lng: 21.4694, verified: true, phone: true },
  { name: 'Farmacia Demo Ibri', city: 'Mitrovicë', lat: 42.8914, lng: 20.866, verified: false, phone: true },
];

/** Small deterministic PRNG so repeated seeds produce the same demo data. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function slugify(s: string) {
  return fold(s).replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

async function upsertAccount(label: string, emailVar: string, passwordVar: string, fallbackEmail: string, fullName: string, role: Role) {
  const email = (process.env[emailVar] ?? fallbackEmail).toLowerCase();
  const provided = process.env[passwordVar];
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !provided) {
    console.log(`  ${label.padEnd(16)} ${email}  (exists — password unchanged)`);
    return existing;
  }
  const password = provided ?? randomBytes(9).toString('base64url');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, isActive: true },
    create: { email, fullName, passwordHash, role },
  });
  console.log(`  ${label.padEnd(16)} ${email}  password: ${provided ? `(from ${passwordVar})` : password}`);
  return user;
}

async function main() {
  console.log('Seeding FICTIONAL demo data…\n\nDemo accounts:');
  const admin = await upsertAccount('Administrator', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD', 'admin@medifind.test', 'Administrator Demo', Role.ADMIN);
  const manager = await upsertAccount('Pharmacy manager', 'SEED_MANAGER_EMAIL', 'SEED_MANAGER_PASSWORD', 'farmacia@medifind.test', 'Menaxher Demo', Role.PHARMACY_MANAGER);
  const user = await upsertAccount('Public user', 'SEED_USER_EMAIL', 'SEED_USER_PASSWORD', 'perdoruesi@medifind.test', 'Përdorues Demo', Role.USER);

  const medicines = [];
  for (const m of MEDICINES) {
    const data = {
      name: m.name,
      normalizedName: fold(m.name),
      activeIngredient: m.ingredient,
      normalizedIngredient: fold(m.ingredient),
      strength: m.strength,
      dosageForm: m.form,
      packageSize: m.pack,
      manufacturer: null,
      isActive: true,
    };
    medicines.push(await prisma.medicine.upsert({ where: { catalogCode: m.code }, update: data, create: { catalogCode: m.code, ...data } }));
  }
  console.log(`\nMedicines: ${medicines.length} catalog entries (codes DEMO-0001…)`);

  const pharmacies = [];
  for (const [i, p] of PHARMACIES.entries()) {
    const slug = slugify(`${p.name} ${p.city}`);
    const data = {
      name: p.name,
      address: `Adresë demonstruese ${i + 1}`,
      city: p.city,
      latitude: p.lat,
      longitude: p.lng,
      phone: p.phone ? `+383 00 000 ${String(101 + i).padStart(3, '0')}` : null,
      email: null,
      isDemo: true,
      dataSource: PharmacySource.SEED,
      isActive: true,
      isVerified: p.verified,
      verifiedAt: p.verified ? new Date() : null,
      verifiedById: p.verified ? admin.id : null,
    };
    pharmacies.push(await prisma.pharmacy.upsert({ where: { slug }, update: data, create: { slug, ...data } }));
  }
  console.log(`Pharmacies: ${pharmacies.length} (all flagged isDemo, ${PHARMACIES.filter((p) => !p.verified).length} pending verification)`);

  await prisma.pharmacyMembership.upsert({
    where: { userId_pharmacyId: { userId: manager.id, pharmacyId: pharmacies[0].id } },
    update: {},
    create: { userId: manager.id, pharmacyId: pharmacies[0].id, role: MembershipRole.OWNER },
  });

  const random = rng(42);
  const now = Date.now();
  const ages = [1, 3, 6, 12, 20, 30, 50, 80, 130]; // hours — mixes fresh, aging and stale reports
  let created = 0;
  for (const [pi, pharmacy] of pharmacies.entries()) {
    for (const [mi, medicine] of medicines.entries()) {
      if (random() < 0.3) continue; // not every pharmacy stocks everything
      const roll = random();
      const quantity = roll < 0.15 ? 0 : roll < 0.3 ? 1 + Math.floor(random() * 5) : roll < 0.4 ? null : 6 + Math.floor(random() * 80);
      const status: AvailabilityStatus =
        quantity === null ? 'UNKNOWN' : quantity === 0 ? 'OUT_OF_STOCK' : quantity <= 5 ? 'LOW_STOCK' : 'IN_STOCK';
      const lastReportedAt = new Date(now - ages[(pi + mi) % ages.length] * 3_600_000);
      const existing = await prisma.pharmacyInventory.findUnique({
        where: { pharmacyId_medicineId: { pharmacyId: pharmacy.id, medicineId: medicine.id } },
      });
      if (existing) continue;
      const inv = await prisma.pharmacyInventory.create({
        data: {
          pharmacyId: pharmacy.id,
          medicineId: medicine.id,
          availabilityStatus: status,
          quantity,
          showQuantityPublicly: pi % 2 === 0,
          lastReportedAt,
          source: InventorySource.SEED,
        },
      });
      await prisma.inventoryHistory.create({
        data: {
          pharmacyInventoryId: inv.id,
          pharmacyId: pharmacy.id,
          newStatus: status,
          newQuantity: quantity,
          newIsActive: true,
          source: InventorySource.SEED,
          changedByUserId: pi === 0 ? manager.id : null,
          createdAt: lastReportedAt,
        },
      });
      created++;
    }
  }
  console.log(`Inventory: ${created} new demo entries`);

  // A demo alert + example notification for the public user.
  const insulin = medicines.find((m) => m.catalogCode === 'DEMO-0021')!;
  const existingAlert = await prisma.availabilityAlert.findFirst({ where: { userId: user.id, medicineId: insulin.id } });
  if (!existingAlert) {
    const alert = await prisma.availabilityAlert.create({
      data: { userId: user.id, medicineId: insulin.id, preferredCity: 'Prishtinë' },
    });
    await prisma.notification.create({
      data: {
        userId: user.id,
        alertId: alert.id,
        type: NotificationType.SYSTEM,
        title: 'Mirë se vini në MediFind Kosovo (demo)',
        message: 'Ky është një njoftim demonstrues. Do të njoftoheni kur një farmaci raporton se Insulin glargine është në dispozicion në Prishtinë.',
        link: `/medicines/${insulin.id}`,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });
  }

  await prisma.auditLog.create({
    data: { userId: admin.id, action: 'system.seed', entityType: 'System', metadata: { demo: true } },
  });
  console.log('\nDone. Remember: this is fictional demo data, not real pharmacy information.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
