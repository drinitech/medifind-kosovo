import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pharmacy, Role } from '@prisma/client';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { AlertMatcherService } from '../src/alerts/alert-matcher.service';
import { AvailabilityEventsQueue } from '../src/alerts/availability-events.queue';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Sakte-Fjalekalim1';
const API = '/api/v1';

describe('MediFind Kosovo API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let queue: AvailabilityEventsQueue;
  let http: ReturnType<INestApplication['getHttpServer']>;

  // Fixtures
  let pharmacyA: Pharmacy; // managed by managerA, verified, Prishtinë
  let pharmacyB: Pharmacy; // managed by managerB, verified, Prizren
  let pharmacyPending: Pharmacy; // unverified
  const med: Record<string, string> = {};
  let admin: ReturnType<typeof request.agent>;
  let managerA: ReturnType<typeof request.agent>;
  let managerB: ReturnType<typeof request.agent>;
  let userAgent: ReturnType<typeof request.agent>;

  async function createUser(email: string, role: Role) {
    return prisma.user.create({
      data: { email, fullName: email.split('@')[0], role, passwordHash: await AuthService.hashPassword(PASSWORD) },
    });
  }

  async function loginAgent(email: string) {
    const agent = request.agent(http);
    await agent.post(`${API}/auth/login`).send({ email, password: PASSWORD }).expect(200);
    return agent;
  }

  async function createMedicine(code: string, name: string, strength: string, dosageForm: 'TABLET' | 'SYRUP' | 'CAPSULE') {
    const m = await prisma.medicine.create({
      data: {
        catalogCode: code,
        name,
        normalizedName: name.toLowerCase(),
        activeIngredient: name,
        normalizedIngredient: name.toLowerCase(),
        strength,
        dosageForm,
      },
    });
    return m.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    queue = app.get(AvailabilityEventsQueue);

    const adminUser = await createUser('admin@e2e.test', Role.ADMIN);
    const mA = await createUser('manager-a@e2e.test', Role.PHARMACY_MANAGER);
    const mB = await createUser('manager-b@e2e.test', Role.PHARMACY_MANAGER);
    await createUser('user@e2e.test', Role.USER);

    const mkPharmacy = (name: string, slug: string, city: string, lat: number, lng: number, isVerified: boolean) =>
      prisma.pharmacy.create({
        data: { name, slug, address: 'Test 1', city, latitude: lat, longitude: lng, isVerified, phone: '+383 00 000 000', verifiedById: isVerified ? adminUser.id : null },
      });
    pharmacyA = await mkPharmacy('Farmacia A', 'farmacia-a', 'Prishtinë', 42.6629, 21.1655, true);
    pharmacyB = await mkPharmacy('Farmacia B', 'farmacia-b', 'Prizren', 42.2139, 20.7397, true);
    pharmacyPending = await mkPharmacy('Farmacia Pending', 'farmacia-pending', 'Pejë', 42.6593, 20.2883, false);
    await prisma.pharmacyMembership.createMany({
      data: [
        { userId: mA.id, pharmacyId: pharmacyA.id },
        { userId: mB.id, pharmacyId: pharmacyB.id },
      ],
    });

    med.para500 = await createMedicine('T-PARA-500', 'Paracetamol', '500 mg', 'TABLET');
    med.paraSyrup = await createMedicine('T-PARA-SYR', 'Paracetamol', '120 mg/5 ml', 'SYRUP');
    med.ibu = await createMedicine('T-IBU-400', 'Ibuprofen', '400 mg', 'TABLET');
    med.amox = await createMedicine('T-AMOX-500', 'Amoxicillin', '500 mg', 'CAPSULE');
    med.rare = await createMedicine('T-RARE-1', 'Rarecillin', '10 mg', 'TABLET');

    admin = await loginAgent('admin@e2e.test');
    managerA = await loginAgent('manager-a@e2e.test');
    managerB = await loginAgent('manager-b@e2e.test');
    userAgent = await loginAgent('user@e2e.test');
  });

  afterAll(async () => {
    await queue?.drain();
    await app?.close();
  });

  // ---------------------------------------------------------------- auth
  describe('authentication', () => {
    it('registers a user, sets an HttpOnly session cookie and never returns the password hash', async () => {
      const res = await request(http)
        .post(`${API}/auth/register`)
        .send({ fullName: 'Arta Test', email: 'Arta@E2E.test', password: 'abcdefg1' })
        .expect(201);
      expect(res.body.data.user).toMatchObject({ email: 'arta@e2e.test', role: 'USER' });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/mf_session=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
    });

    it('rejects duplicate emails, weak passwords and role escalation', async () => {
      await request(http).post(`${API}/auth/register`).send({ fullName: 'Dup', email: 'arta@e2e.test', password: 'abcdefg1' }).expect(409);
      await request(http).post(`${API}/auth/register`).send({ fullName: 'Weak', email: 'weak@e2e.test', password: 'short' }).expect(400);
      const res = await request(http)
        .post(`${API}/auth/register`)
        .send({ fullName: 'Sneaky', email: 'sneaky@e2e.test', password: 'abcdefg1', role: 'ADMIN' })
        .expect(400);
      expect(res.body.error.details).toContain('property role should not exist');
    });

    it('registers pharmacy-manager accounts but never administrators', async () => {
      const res = await request(http)
        .post(`${API}/auth/register`)
        .send({ fullName: 'Farmacist', email: 'pharm@e2e.test', password: 'abcdefg1', accountType: 'PHARMACY' })
        .expect(201);
      expect(res.body.data.user.role).toBe('PHARMACY_MANAGER');
      await request(http)
        .post(`${API}/auth/register`)
        .send({ fullName: 'X', email: 'x@e2e.test', password: 'abcdefg1', accountType: 'ADMIN' })
        .expect(400);
    });

    it('rejects bad credentials with a generic message', async () => {
      const wrong = await request(http).post(`${API}/auth/login`).send({ email: 'user@e2e.test', password: 'nope-nope1' }).expect(401);
      const missing = await request(http).post(`${API}/auth/login`).send({ email: 'ghost@e2e.test', password: 'nope-nope1' }).expect(401);
      expect(wrong.body.error.message).toBe(missing.body.error.message);
    });

    it('returns the current account and clears the session on logout', async () => {
      const agent = await loginAgent('user@e2e.test');
      const me = await agent.get(`${API}/auth/me`).expect(200);
      expect(me.body.data).toMatchObject({ email: 'user@e2e.test', role: 'USER' });
      expect(me.body.data.passwordHash).toBeUndefined();
      await agent.post(`${API}/auth/logout`).expect(200);
      await agent.get(`${API}/auth/me`).expect(401);
    });

    it('rejects tampered tokens and deactivated accounts', async () => {
      await request(http).get(`${API}/auth/me`).set('Authorization', 'Bearer not.a.jwt').expect(401);
      const temp = await createUser('temp@e2e.test', Role.USER);
      const agent = await loginAgent('temp@e2e.test');
      await prisma.user.update({ where: { id: temp.id }, data: { isActive: false } });
      await agent.get(`${API}/auth/me`).expect(401);
      await request(http).post(`${API}/auth/login`).send({ email: 'temp@e2e.test', password: PASSWORD }).expect(401);
    });
  });

  // ---------------------------------------------------------------- access control
  describe('role-based access control', () => {
    it('requires authentication for protected routes', async () => {
      await request(http).get(`${API}/pharmacy/inventory`).expect(401);
      await request(http).get(`${API}/alerts`).expect(401);
      await request(http).get(`${API}/admin/dashboard`).expect(401);
    });

    it('keeps public users and managers out of admin endpoints', async () => {
      await userAgent.get(`${API}/admin/dashboard`).expect(403);
      await managerA.get(`${API}/admin/users`).expect(403);
      await userAgent.get(`${API}/pharmacy/inventory`).expect(403);
      await admin.get(`${API}/admin/dashboard`).expect(200);
    });
  });

  // ---------------------------------------------------------------- inventory + ownership
  describe('inventory management', () => {
    let invA: string;
    let invB: string;

    it('creates entries, deriving status from quantity and recording who changed it', async () => {
      const res = await managerA.post(`${API}/pharmacy/inventory`).send({ medicineId: med.para500, quantity: 3 }).expect(201);
      expect(res.body.data).toMatchObject({ availabilityStatus: 'LOW_STOCK', quantity: 3, isActive: true, source: 'MANUAL' });
      invA = res.body.data.id;
      const resB = await managerB
        .post(`${API}/pharmacy/inventory`)
        .send({ medicineId: med.para500, availabilityStatus: 'IN_STOCK', quantity: 40, showQuantityPublicly: true })
        .expect(201);
      invB = resB.body.data.id;

      const history = await managerA.get(`${API}/pharmacy/inventory/history`).expect(200);
      expect(history.body.data.items[0]).toMatchObject({ newStatus: 'LOW_STOCK', changedBy: { fullName: 'manager-a' } });
    });

    it('prevents duplicate entries for the same pharmacy + medicine', async () => {
      const res = await managerA.post(`${API}/pharmacy/inventory`).send({ medicineId: med.para500, quantity: 9 }).expect(409);
      expect(res.body.error.code).toBe('DUPLICATE_INVENTORY');
      expect(await prisma.pharmacyInventory.count({ where: { pharmacyId: pharmacyA.id, medicineId: med.para500 } })).toBe(1);
    });

    it('validates input and rejects contradictory reports', async () => {
      await managerA.post(`${API}/pharmacy/inventory`).send({ medicineId: med.ibu, quantity: -1 }).expect(400);
      const res = await managerA
        .post(`${API}/pharmacy/inventory`)
        .send({ medicineId: med.ibu, availabilityStatus: 'OUT_OF_STOCK', quantity: 10 })
        .expect(400);
      expect(res.body.error.code).toBe('STATUS_QUANTITY_MISMATCH');
      await managerA.post(`${API}/pharmacy/inventory`).send({ medicineId: med.ibu, availabilityStatus: 'MAYBE' }).expect(400);
      await managerA.post(`${API}/pharmacy/inventory`).send({ medicineId: 'does-not-exist', quantity: 1 }).expect(404);
    });

    it('updates entries and writes history', async () => {
      const res = await managerA.patch(`${API}/pharmacy/inventory/${invA}`).send({ quantity: 0 }).expect(200);
      expect(res.body.data).toMatchObject({ availabilityStatus: 'OUT_OF_STOCK', quantity: 0 });
      const history = await prisma.inventoryHistory.findMany({ where: { pharmacyInventoryId: invA }, orderBy: { createdAt: 'asc' } });
      expect(history.map((h) => [h.previousStatus, h.newStatus])).toEqual([
        [null, 'LOW_STOCK'],
        ['LOW_STOCK', 'OUT_OF_STOCK'],
      ]);
    });

    it("blocks every form of access to another pharmacy's inventory", async () => {
      await managerA.patch(`${API}/pharmacy/inventory/${invB}`).send({ quantity: 1 }).expect(403);
      await managerA.delete(`${API}/pharmacy/inventory/${invB}`).expect(403);
      await managerA.get(`${API}/pharmacy/inventory`).query({ pharmacyId: pharmacyB.id }).expect(403);
      await managerA.get(`${API}/pharmacy/inventory/history`).query({ pharmacyId: pharmacyB.id }).expect(403);
      await managerA.post(`${API}/pharmacy/inventory`).query({ pharmacyId: pharmacyB.id }).send({ medicineId: med.ibu, quantity: 1 }).expect(403);
      await managerA.post(`${API}/pharmacy/inventory/bulk-update`).send({ ids: [invA, invB], availabilityStatus: 'UNKNOWN' }).expect(404);
      await managerA.patch(`${API}/pharmacy/profile`).query({ pharmacyId: pharmacyB.id }).send({ name: 'Hijacked' }).expect(403);

      const untouched = await prisma.pharmacyInventory.findUniqueOrThrow({ where: { id: invB } });
      expect(untouched).toMatchObject({ availabilityStatus: 'IN_STOCK', quantity: 40 });
      expect((await prisma.pharmacy.findUniqueOrThrow({ where: { id: pharmacyB.id } })).name).toBe('Farmacia B');

      const list = await managerA.get(`${API}/pharmacy/inventory`).expect(200);
      expect(list.body.data.items.every((i: { pharmacyId: string }) => i.pharmacyId === pharmacyA.id)).toBe(true);
    });

    it('lets administrators act on any pharmacy explicitly', async () => {
      await admin.get(`${API}/pharmacy/inventory`).query({ pharmacyId: pharmacyB.id }).expect(200);
      await admin.get(`${API}/pharmacy/inventory`).expect(400);
    });

    it('deactivates (soft-deletes) entries and keeps history', async () => {
      const ibu = await managerA.post(`${API}/pharmacy/inventory`).send({ medicineId: med.ibu, quantity: 50 }).expect(201);
      const res = await managerA.delete(`${API}/pharmacy/inventory/${ibu.body.data.id}`).expect(200);
      expect(res.body.data.isActive).toBe(false);
      expect(await prisma.pharmacyInventory.count({ where: { id: ibu.body.data.id } })).toBe(1);
      expect(await prisma.inventoryHistory.count({ where: { pharmacyInventoryId: ibu.body.data.id } })).toBe(2);
      const dup = await managerA.post(`${API}/pharmacy/inventory`).send({ medicineId: med.ibu, quantity: 5 }).expect(409);
      expect(dup.body.error.details.isActive).toBe(false);
      await managerA.patch(`${API}/pharmacy/inventory/${ibu.body.data.id}`).send({ isActive: true }).expect(200);
    });

    it('applies bulk updates atomically and only within the pharmacy', async () => {
      const list = await managerA.get(`${API}/pharmacy/inventory`).expect(200);
      const ids = list.body.data.items.map((i: { id: string }) => i.id);
      const res = await managerA.post(`${API}/pharmacy/inventory/bulk-update`).send({ ids, availabilityStatus: 'UNKNOWN' }).expect(201);
      expect(res.body.data.updated).toBe(ids.length);
      const rows = await prisma.pharmacyInventory.findMany({ where: { id: { in: ids } } });
      expect(rows.every((r) => r.availabilityStatus === 'UNKNOWN')).toBe(true);
    });

    it('reports dashboard stats for the own pharmacy only', async () => {
      const res = await managerA.get(`${API}/pharmacy/inventory/stats`).expect(200);
      expect(res.body.data.pharmacy.id).toBe(pharmacyA.id);
      expect(res.body.data.activeEntries).toBe(2);
    });
  });

  // ---------------------------------------------------------------- import
  describe('CSV / Excel import', () => {
    const csv = [
      'medicine_code,quantity,availability_status',
      'T-PARA-500,25,',
      'T-AMOX-500,0,',
      'UNKNOWN-CODE,4,',
      'T-IBU-400,abc,',
      'T-AMOX-500,3,',
      'T-PARA-SYR,,në stok',
    ].join('\n');

    it('previews with row-level errors and saves nothing', async () => {
      const before = await prisma.pharmacyInventory.count({ where: { pharmacyId: pharmacyA.id } });
      const res = await managerA
        .post(`${API}/pharmacy/inventory/import/preview`)
        .attach('file', Buffer.from(csv), { filename: 'inventari.csv', contentType: 'text/csv' })
        .expect(201);
      const { summary, rows } = res.body.data;
      expect(summary).toMatchObject({ totalRows: 6, validRows: 3, errorRows: 3, creates: 2, updates: 1, duplicates: 1 });
      expect(rows.find((r: { rowNumber: number }) => r.rowNumber === 4).errors[0].code).toBe('MEDICINE_NOT_FOUND');
      expect(rows.find((r: { rowNumber: number }) => r.rowNumber === 5).errors[0].code).toBe('INVALID_QUANTITY');
      expect(rows.find((r: { rowNumber: number }) => r.rowNumber === 6).errors[0].code).toBe('DUPLICATE_ROW');
      expect(await prisma.pharmacyInventory.count({ where: { pharmacyId: pharmacyA.id } })).toBe(before);
    });

    it('commits valid rows transactionally, exactly once, with a report', async () => {
      const preview = await managerA
        .post(`${API}/pharmacy/inventory/import/preview`)
        .attach('file', Buffer.from(csv), { filename: 'inventari.csv', contentType: 'text/csv' })
        .expect(201);
      const batchId = preview.body.data.batchId;

      await managerB.post(`${API}/pharmacy/inventory/import/confirm`).send({ batchId }).expect(404);

      const res = await managerA.post(`${API}/pharmacy/inventory/import/confirm`).send({ batchId }).expect(201);
      expect(res.body.data).toMatchObject({ created: 2, updated: 1, errorRows: 3 });
      const para = await prisma.pharmacyInventory.findFirstOrThrow({ where: { pharmacyId: pharmacyA.id, medicineId: med.para500 } });
      expect(para).toMatchObject({ availabilityStatus: 'IN_STOCK', quantity: 25, source: 'IMPORT' });
      const amox = await prisma.pharmacyInventory.findFirstOrThrow({ where: { pharmacyId: pharmacyA.id, medicineId: med.amox } });
      expect(amox.availabilityStatus).toBe('OUT_OF_STOCK');
      expect(await prisma.inventoryHistory.count({ where: { importBatchId: batchId } })).toBe(3);

      const again = await managerA.post(`${API}/pharmacy/inventory/import/confirm`).send({ batchId }).expect(409);
      expect(again.body.error.code).toBe('IMPORT_ALREADY_COMMITTED');
    });

    it('imports Excel workbooks', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['Emri', 'Doza', 'Forma', 'Sasia']);
      ws.addRow(['Paracetamol', '120 mg/5 ml', 'shurup', 8]);
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const preview = await managerA
        .post(`${API}/pharmacy/inventory/import/preview`)
        .attach('file', buffer, {
          filename: 'inventari.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .expect(201);
      expect(preview.body.data.summary).toMatchObject({ validRows: 1, errorRows: 0 });
      expect(preview.body.data.rows[0].medicine.id).toBe(med.paraSyrup);
    });

    it('rejects unsupported, disguised and malformed files', async () => {
      const pdf = await managerA
        .post(`${API}/pharmacy/inventory/import/preview`)
        .attach('file', Buffer.from('%PDF-1.4'), { filename: 'x.pdf', contentType: 'application/pdf' })
        .expect(422);
      expect(pdf.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
      await managerA
        .post(`${API}/pharmacy/inventory/import/preview`)
        .attach('file', Buffer.from('not a zip'), { filename: 'x.xlsx', contentType: 'application/octet-stream' })
        .expect(422);
      const cols = await managerA
        .post(`${API}/pharmacy/inventory/import/preview`)
        .attach('file', Buffer.from('foo,bar\n1,2\n'), { filename: 'x.csv', contentType: 'text/csv' })
        .expect(422);
      expect(cols.body.error.code).toBe('MISSING_COLUMNS');
      await managerA.post(`${API}/pharmacy/inventory/import/preview`).expect(400);
      await userAgent
        .post(`${API}/pharmacy/inventory/import/preview`)
        .attach('file', Buffer.from(csv), { filename: 'inventari.csv', contentType: 'text/csv' })
        .expect(403);
    });

    it('rejects files above the size limit', async () => {
      const big = Buffer.alloc(6 * 1024 * 1024, 'a');
      await managerA
        .post(`${API}/pharmacy/inventory/import/preview`)
        .attach('file', big, { filename: 'big.csv', contentType: 'text/csv' })
        .expect(413);
    });
  });

  // ---------------------------------------------------------------- search + availability
  describe('medicine search and availability', () => {
    it('finds medicines case- and accent-insensitively and keeps strengths/forms separate', async () => {
      const res = await request(http).get(`${API}/medicines`).query({ q: 'PARACETAMOL' }).expect(200);
      const items = res.body.data.items as { id: string; strength: string }[];
      expect(items.map((i) => i.id).sort()).toEqual([med.para500, med.paraSyrup].sort());
      const strength = await request(http).get(`${API}/medicines`).query({ q: 'paracetamol 500mg' }).expect(200);
      expect(strength.body.data.items.map((i: { id: string }) => i.id)).toEqual([med.para500]);
    });

    it('filters by dosage form and strength, and paginates', async () => {
      const form = await request(http).get(`${API}/medicines`).query({ q: 'paracetamol', dosageForm: 'SYRUP' }).expect(200);
      expect(form.body.data.items.map((i: { id: string }) => i.id)).toEqual([med.paraSyrup]);
      const str = await request(http).get(`${API}/medicines`).query({ strength: '500 mg' }).expect(200);
      expect(str.body.data.items.map((i: { id: string }) => i.id).sort()).toEqual([med.amox, med.para500].sort());
      const page = await request(http).get(`${API}/medicines`).query({ pageSize: 2, page: 2, sort: 'name' }).expect(200);
      expect(page.body.data.meta).toMatchObject({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
      await request(http).get(`${API}/medicines`).query({ dosageForm: 'POTION' }).expect(400);
      await request(http).get(`${API}/medicines`).query({ pageSize: 1000 }).expect(400);
    });

    it('treats LIKE wildcards in queries literally', async () => {
      const res = await request(http).get(`${API}/medicines`).query({ q: '%' }).expect(200);
      expect(res.body.data.meta.total).toBe(0);
    });

    it('returns reported availability with freshness, source and quantity privacy', async () => {
      const res = await request(http).get(`${API}/medicines/${med.para500}/availability`).expect(200);
      const rows = res.body.data.items as Array<Record<string, unknown> & { pharmacy: { id: string }; quantity: number | null }>;
      const a = rows.find((r) => r.pharmacy.id === pharmacyA.id)!;
      const b = rows.find((r) => r.pharmacy.id === pharmacyB.id)!;
      expect(a).toMatchObject({ availabilityStatus: 'IN_STOCK', quantity: null, freshness: 'FRESH', isReported: true, source: 'IMPORT' });
      expect(a.lastReportedAt).toBeDefined();
      expect(b.quantity).toBe(40); // pharmacy B opted in to public quantities
      expect(res.body.data.summary.total).toBe(2);
    });

    it('labels old reports as stale and can hide them', async () => {
      await prisma.pharmacyInventory.updateMany({
        where: { pharmacyId: pharmacyB.id, medicineId: med.para500 },
        data: { lastReportedAt: new Date(Date.now() - 10 * 86_400_000) },
      });
      const res = await request(http).get(`${API}/medicines/${med.para500}/availability`).expect(200);
      const b = res.body.data.items.find((r: { pharmacy: { id: string } }) => r.pharmacy.id === pharmacyB.id);
      expect(b.freshness).toBe('STALE');
      const hidden = await request(http).get(`${API}/medicines/${med.para500}/availability`).query({ hideStale: 'true' }).expect(200);
      expect(hidden.body.data.items).toHaveLength(1);
    });

    it('sorts by distance and filters by radius', async () => {
      const res = await request(http)
        .get(`${API}/medicines/${med.para500}/availability`)
        .query({ lat: 42.21, lng: 20.74, sort: 'distance' })
        .expect(200);
      expect(res.body.data.items[0].pharmacy.id).toBe(pharmacyB.id);
      expect(res.body.data.items[0].distanceKm).toBeLessThan(1);
      const near = await request(http)
        .get(`${API}/medicines/${med.para500}/availability`)
        .query({ lat: 42.21, lng: 20.74, radiusKm: 10 })
        .expect(200);
      expect(near.body.data.items.map((r: { pharmacy: { id: string } }) => r.pharmacy.id)).toEqual([pharmacyB.id]);
    });

    it('never exposes inventory of unverified pharmacies', async () => {
      await prisma.pharmacyInventory.create({
        data: { pharmacyId: pharmacyPending.id, medicineId: med.rare, availabilityStatus: 'IN_STOCK', quantity: 9 },
      });
      const res = await request(http).get(`${API}/medicines/${med.rare}/availability`).expect(200);
      expect(res.body.data.items).toHaveLength(0);
      await request(http).get(`${API}/pharmacies/${pharmacyPending.id}`).expect(404);
      const nearby = await request(http).get(`${API}/pharmacies/nearby`).query({ lat: 42.6593, lng: 20.2883, radiusKm: 5 }).expect(200);
      expect(nearby.body.data).toHaveLength(0);
    });

    it('lists nearby verified pharmacies nearest first', async () => {
      const res = await request(http).get(`${API}/pharmacies/nearby`).query({ lat: 42.66, lng: 21.16, radiusKm: 200 }).expect(200);
      expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([pharmacyA.id, pharmacyB.id]);
      expect(res.body.data[0].distanceKm).toBeLessThan(res.body.data[1].distanceKm);
    });
  });

  // ---------------------------------------------------------------- alerts
  describe('availability alerts', () => {
    let alertId: string;
    let invEntryId: string;

    it('creates alerts, prevents duplicates and isolates them per user', async () => {
      const res = await userAgent.post(`${API}/alerts`).send({ medicineId: med.ibu, preferredCity: 'Prishtinë' }).expect(201);
      alertId = res.body.data.id;
      const dup = await userAgent.post(`${API}/alerts`).send({ medicineId: med.ibu }).expect(409);
      expect(dup.body.error.code).toBe('ALERT_EXISTS');
      await managerB.patch(`${API}/alerts/${alertId}`).send({ isActive: false }).expect(404);
      const mine = await managerB.get(`${API}/alerts`).expect(200);
      expect(mine.body.data).toHaveLength(0);
      await userAgent.post(`${API}/alerts`).send({ medicineId: med.ibu, latitude: 42.6 }).expect(400);
    });

    it('notifies when a matching pharmacy reports the medicine available — once per event', async () => {
      const list = await managerA.get(`${API}/pharmacy/inventory`).query({ q: 'ibuprofen' }).expect(200);
      invEntryId = list.body.data.items[0].id;
      await managerA.patch(`${API}/pharmacy/inventory/${invEntryId}`).send({ availabilityStatus: 'OUT_OF_STOCK', quantity: 0 }).expect(200);
      await managerA.patch(`${API}/pharmacy/inventory/${invEntryId}`).send({ quantity: 30 }).expect(200);
      await queue.drain();

      const notes = await userAgent.get(`${API}/notifications`).expect(200);
      const alertNotes = notes.body.data.items.filter((n: { alertId: string }) => n.alertId === alertId);
      expect(alertNotes).toHaveLength(1);
      expect(alertNotes[0]).toMatchObject({ type: 'AVAILABILITY_ALERT', status: 'SENT', readAt: null });
      expect(alertNotes[0].message).toMatch(/kontakto farmacinë për konfirmim/);

      // Re-processing the same event (e.g. a retried job) must not duplicate the notification.
      const event = await prisma.inventoryHistory.findFirstOrThrow({
        where: { pharmacyInventoryId: invEntryId, newStatus: 'IN_STOCK' },
        orderBy: { createdAt: 'desc' },
      });
      const again = await app.get(AlertMatcherService).processAvailabilityEvent(event.id);
      expect(again.notified).toBe(0);
      expect(await prisma.notification.count({ where: { alertId } })).toBe(1);
    });

    it('does not re-notify for flapping stock inside the cooldown, or for staying available', async () => {
      await managerA.patch(`${API}/pharmacy/inventory/${invEntryId}`).send({ quantity: 0 }).expect(200);
      await managerA.patch(`${API}/pharmacy/inventory/${invEntryId}`).send({ quantity: 12 }).expect(200);
      await managerA.patch(`${API}/pharmacy/inventory/${invEntryId}`).send({ quantity: 11 }).expect(200);
      await queue.drain();
      expect(await prisma.notification.count({ where: { alertId } })).toBe(1);
    });

    it('ignores pharmacies outside the preferred city', async () => {
      const res = await userAgent.post(`${API}/alerts`).send({ medicineId: med.amox, preferredCity: 'Prishtinë' }).expect(201);
      await managerB.post(`${API}/pharmacy/inventory`).send({ medicineId: med.amox, quantity: 20 }).expect(201);
      await queue.drain();
      expect(await prisma.notification.count({ where: { alertId: res.body.data.id } })).toBe(0);
    });

    it('marks notifications read only for their owner', async () => {
      const note = await prisma.notification.findFirstOrThrow({ where: { alertId } });
      await managerA.patch(`${API}/notifications/${note.id}/read`).expect(404);
      const res = await userAgent.patch(`${API}/notifications/${note.id}/read`).expect(200);
      expect(res.body.data.readAt).not.toBeNull();
    });

    it('deactivates alerts', async () => {
      const res = await userAgent.patch(`${API}/alerts/${alertId}`).send({ isActive: false }).expect(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  // ---------------------------------------------------------------- admin
  describe('administration', () => {
    it('verifies pharmacies, publishes them and audits the change', async () => {
      await admin.patch(`${API}/admin/pharmacies/${pharmacyPending.id}/verify`).send({ isVerified: true }).expect(200);
      const res = await request(http).get(`${API}/medicines/${med.rare}/availability`).expect(200);
      expect(res.body.data.items).toHaveLength(1);
      const logs = await admin.get(`${API}/admin/audit-logs`).query({ action: 'pharmacy.verify' }).expect(200);
      expect(logs.body.data.items[0]).toMatchObject({ entityId: pharmacyPending.id, user: { email: 'admin@e2e.test' } });
    });

    it('manages the medicine catalog and rejects duplicate variants', async () => {
      const res = await admin
        .post(`${API}/admin/medicines`)
        .send({ name: 'Cetirizine', strength: '10mg', dosageForm: 'TABLET', activeIngredient: 'Cetirizine' })
        .expect(201);
      expect(res.body.data).toMatchObject({ strength: '10 mg', normalizedName: 'cetirizine' });
      await admin.post(`${API}/admin/medicines`).send({ name: 'cetirizine', strength: '10 mg', dosageForm: 'TABLET' }).expect(409);
      await admin.post(`${API}/admin/medicines`).send({ name: 'Cetirizine', strength: '10 mg', dosageForm: 'SYRUP' }).expect(201);
      await admin.patch(`${API}/admin/medicines/${res.body.data.id}`).send({ isActive: false }).expect(200);
      await request(http).get(`${API}/medicines/${res.body.data.id}`).expect(404);
      await managerA.post(`${API}/admin/medicines`).send({ name: 'X' }).expect(403);
    });

    it('returns aggregated dashboard statistics', async () => {
      const res = await admin.get(`${API}/admin/dashboard`).expect(200);
      expect(res.body.data.pharmacies).toMatchObject({ total: 3, verified: 3, unverified: 0 });
      expect(res.body.data.inventory.freshness.stale).toBeGreaterThanOrEqual(1);
      expect(res.body.data.recentUpdates.length).toBeGreaterThan(0);
    });

    it('manages users without leaking secrets and protects the last admin', async () => {
      const res = await admin.get(`${API}/admin/users`).query({ q: 'e2e.test' }).expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
      const me = await admin.get(`${API}/auth/me`).expect(200);
      await admin.patch(`${API}/admin/users/${me.body.data.id}`).send({ isActive: false }).expect(400);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'arta@e2e.test' } });
      const upd = await admin.patch(`${API}/admin/users/${user.id}`).send({ role: 'PHARMACY_MANAGER' }).expect(200);
      expect(upd.body.data.role).toBe('PHARMACY_MANAGER');
      await admin.patch(`${API}/admin/users/${user.id}`).send({ passwordHash: 'x' }).expect(400);
    });

    it('deactivates suspicious pharmacies, hiding them from the public', async () => {
      await admin.patch(`${API}/admin/pharmacies/${pharmacyPending.id}`).send({ isActive: false }).expect(200);
      await request(http).get(`${API}/pharmacies/${pharmacyPending.id}`).expect(404);
      const res = await request(http).get(`${API}/medicines/${med.rare}/availability`).expect(200);
      expect(res.body.data.items).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------- directory listings
  describe('OpenStreetMap directory listings', () => {
    it('are listed in the directory and map but never show availability', async () => {
      const listing = await prisma.pharmacy.create({
        data: {
          name: 'Farmacia OSM',
          slug: 'farmacia-osm',
          address: null,
          city: 'Prishtinë',
          latitude: 42.66,
          longitude: 21.17,
          dataSource: 'OSM',
          externalId: 'osm:node/1',
          isVerified: false,
        },
      });
      // Even if inventory rows existed for a listing, they must not surface publicly.
      await prisma.pharmacyInventory.create({
        data: { pharmacyId: listing.id, medicineId: med.para500, availabilityStatus: 'IN_STOCK', quantity: 5 },
      });

      const list = await request(http).get(`${API}/pharmacies`).query({ q: 'OSM' }).expect(200);
      expect(list.body.data.items).toEqual([expect.objectContaining({ id: listing.id, isVerified: false, dataSource: 'OSM', address: null })]);
      const participating = await request(http).get(`${API}/pharmacies`).query({ q: 'OSM', participating: 'true' }).expect(200);
      expect(participating.body.data.items).toHaveLength(0);

      const nearby = await request(http).get(`${API}/pharmacies/nearby`).query({ lat: 42.66, lng: 21.17, radiusKm: 1 }).expect(200);
      expect(nearby.body.data.map((p: { id: string }) => p.id)).toContain(listing.id);

      const profile = await request(http).get(`${API}/pharmacies/farmacia-osm`).expect(200);
      expect(profile.body.data).toMatchObject({ isVerified: false, stats: null });
      await request(http).get(`${API}/pharmacies/farmacia-osm/inventory`).expect(404);

      const availability = await request(http).get(`${API}/medicines/${med.para500}/availability`).expect(200);
      expect(availability.body.data.items.map((r: { pharmacy: { id: string } }) => r.pharmacy.id)).not.toContain(listing.id);
    });

    it('are kept apart from pending registrations in the admin views', async () => {
      const dash = await admin.get(`${API}/admin/dashboard`).expect(200);
      expect(dash.body.data.pharmacies).toMatchObject({ directoryListings: 1, unverified: 0 });
      const directory = await admin.get(`${API}/admin/pharmacies`).query({ status: 'directory' }).expect(200);
      expect(directory.body.data.items.map((p: { slug: string }) => p.slug)).toEqual(['farmacia-osm']);
      const pending = await admin.get(`${API}/admin/pharmacies`).query({ status: 'unverified' }).expect(200);
      expect(pending.body.data.items).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------- errors
  describe('error handling', () => {
    it('uses a consistent error envelope and does not leak internals', async () => {
      const res = await request(http).get(`${API}/medicines/nonexistent-id`).expect(404);
      expect(res.body).toEqual({ error: { statusCode: 404, code: 'NOT_FOUND', message: 'Medicine not found' } });
      await request(http).get(`${API}/does-not-exist`).expect(404);
      const bad = await request(http).post(`${API}/auth/login`).set('content-type', 'application/json').send('{"broken').expect(400);
      expect(JSON.stringify(bad.body)).not.toMatch(/at \w+ \(/);
    });
  });
});
