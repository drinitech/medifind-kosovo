import { AvailabilityStatus, DosageForm } from '@prisma/client';
import { normalizeSearchText, normalizeStrength } from '../../common/utils/normalize';
import { resolveStatus } from '../availability';
import { MAX_QUANTITY } from '../dto/inventory.dto';
import { ParsedRow } from './import-parser';

/** Accepted header spellings (after canonicalHeader) for each logical column. */
export const HEADER_ALIASES: Record<string, string[]> = {
  medicineCode: ['medicine_code', 'code', 'catalog_code', 'kodi', 'kodi_i_barit'],
  medicineId: ['medicine_id', 'id_barit'],
  medicineName: ['medicine_name', 'name', 'medicine', 'emri', 'barna', 'bari', 'emri_i_barit'],
  strength: ['strength', 'doza', 'forca', 'fuqia'],
  dosageForm: ['dosage_form', 'form', 'forma', 'forma_farmaceutike'],
  quantity: ['quantity', 'qty', 'sasia'],
  availabilityStatus: ['availability_status', 'availability', 'status', 'statusi', 'disponueshmeria'],
  showQuantityPublicly: ['show_quantity_publicly', 'show_quantity', 'shfaq_sasine', 'sasia_publike'],
};

const STATUS_ALIASES: Record<string, AvailabilityStatus> = {
  in_stock: 'IN_STOCK',
  'in stock': 'IN_STOCK',
  available: 'IN_STOCK',
  'ne stok': 'IN_STOCK',
  'ne dispozicion': 'IN_STOCK',
  po: 'IN_STOCK',
  ka: 'IN_STOCK',
  low_stock: 'LOW_STOCK',
  'low stock': 'LOW_STOCK',
  low: 'LOW_STOCK',
  pak: 'LOW_STOCK',
  'sasi e ulet': 'LOW_STOCK',
  'stok i ulet': 'LOW_STOCK',
  out_of_stock: 'OUT_OF_STOCK',
  'out of stock': 'OUT_OF_STOCK',
  unavailable: 'OUT_OF_STOCK',
  'nuk ka': 'OUT_OF_STOCK',
  'jo ne stok': 'OUT_OF_STOCK',
  mungon: 'OUT_OF_STOCK',
  jo: 'OUT_OF_STOCK',
  unknown: 'UNKNOWN',
  panjohur: 'UNKNOWN',
  'e panjohur': 'UNKNOWN',
};

const DOSAGE_FORM_ALIASES: Record<string, DosageForm> = {
  tablet: 'TABLET', tablets: 'TABLET', tableta: 'TABLET', tablete: 'TABLET',
  capsule: 'CAPSULE', capsules: 'CAPSULE', kapsula: 'CAPSULE', kapsule: 'CAPSULE',
  syrup: 'SYRUP', shurup: 'SYRUP',
  suspension: 'SUSPENSION', suspension_oral: 'SUSPENSION', suspensioni: 'SUSPENSION',
  solution: 'SOLUTION', tretesire: 'SOLUTION', solucion: 'SOLUTION',
  injection: 'INJECTION', injeksion: 'INJECTION', injeksione: 'INJECTION', ampula: 'INJECTION',
  cream: 'CREAM', krem: 'CREAM', kreme: 'CREAM',
  ointment: 'OINTMENT', pomade: 'OINTMENT', pomada: 'OINTMENT',
  gel: 'GEL', xhel: 'GEL',
  drops: 'DROPS', pika: 'DROPS',
  spray: 'SPRAY', sprej: 'SPRAY',
  inhaler: 'INHALER', inhalator: 'INHALER',
  suppository: 'SUPPOSITORY', supozitor: 'SUPPOSITORY', supozitore: 'SUPPOSITORY',
  powder: 'POWDER', pluhur: 'POWDER',
  patch: 'PATCH', flaster: 'PATCH',
  other: 'OTHER', tjeter: 'OTHER',
};

const BOOLEAN_ALIASES: Record<string, boolean> = {
  true: true, false: false, '1': true, '0': false, yes: true, no: false, po: true, jo: false, y: true, n: false,
};

export type ImportErrorCode =
  | 'MISSING_MEDICINE_IDENTIFIER'
  | 'MEDICINE_NOT_FOUND'
  | 'MEDICINE_AMBIGUOUS'
  | 'MEDICINE_INACTIVE'
  | 'INVALID_QUANTITY'
  | 'INVALID_STATUS'
  | 'INVALID_DOSAGE_FORM'
  | 'INVALID_BOOLEAN'
  | 'MISSING_AVAILABILITY'
  | 'STATUS_QUANTITY_MISMATCH'
  | 'DUPLICATE_ROW';

export interface ImportRowError {
  field: string;
  code: ImportErrorCode;
  message: string;
  params?: Record<string, string | number>;
}

export interface CatalogEntry {
  id: string;
  catalogCode: string | null;
  name: string;
  normalizedName: string;
  strength: string | null;
  dosageForm: DosageForm | null;
  isActive: boolean;
}

export interface CatalogLookup {
  byId: Map<string, CatalogEntry>;
  byCode: Map<string, CatalogEntry>;
  byName: Map<string, CatalogEntry[]>;
}

export interface ExistingInventory {
  availabilityStatus: AvailabilityStatus;
  quantity: number | null;
  isActive: boolean;
}

export type ImportAction = 'CREATE' | 'UPDATE' | 'UNCHANGED';

export interface ValidatedRow {
  rowNumber: number;
  input: { medicine: string; quantity: string; availabilityStatus: string };
  medicine?: { id: string; name: string; strength: string | null; dosageForm: DosageForm | null };
  availabilityStatus?: AvailabilityStatus;
  quantity?: number | null;
  showQuantityPublicly?: boolean;
  action?: ImportAction;
  errors: ImportRowError[];
}

export function buildCatalogLookup(entries: CatalogEntry[]): CatalogLookup {
  const byId = new Map<string, CatalogEntry>();
  const byCode = new Map<string, CatalogEntry>();
  const byName = new Map<string, CatalogEntry[]>();
  for (const e of entries) {
    byId.set(e.id, e);
    if (e.catalogCode) byCode.set(e.catalogCode.toLowerCase(), e);
    const list = byName.get(e.normalizedName) ?? [];
    list.push(e);
    byName.set(e.normalizedName, list);
  }
  return { byId, byCode, byName };
}

/** Maps canonical headers to logical columns; reports which identifier columns exist. */
export function mapColumns(headers: string[]) {
  const mapping: Record<string, string | undefined> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    mapping[field] = headers.find((h) => aliases.includes(h));
  }
  const known = new Set(Object.values(mapping).filter(Boolean));
  const unknownColumns = headers.filter((h) => !known.has(h));
  const missing: string[] = [];
  if (!mapping.medicineCode && !mapping.medicineId && !mapping.medicineName) missing.push('medicine_code | medicine_name');
  if (!mapping.quantity && !mapping.availabilityStatus) missing.push('quantity | availability_status');
  return { mapping, unknownColumns, missing };
}

export function parseStatus(raw: string): AvailabilityStatus | null {
  const key = normalizeSearchText(raw).replace(/-/g, ' ');
  const upper = raw.trim().toUpperCase();
  if ((Object.values(AvailabilityStatus) as string[]).includes(upper)) return upper as AvailabilityStatus;
  return STATUS_ALIASES[key] ?? STATUS_ALIASES[key.replace(/ /g, '_')] ?? null;
}

export function parseDosageForm(raw: string): DosageForm | null {
  const upper = raw.trim().toUpperCase();
  if ((Object.values(DosageForm) as string[]).includes(upper)) return upper as DosageForm;
  return DOSAGE_FORM_ALIASES[normalizeSearchText(raw).replace(/\s+/g, '_')] ?? null;
}

export function parseQuantity(raw: string): number | null | 'invalid' {
  const v = raw.trim().replace(/\s/g, '');
  if (v === '') return null;
  if (!/^\d+([.,]0+)?$/.test(v)) return 'invalid';
  const n = Number.parseInt(v, 10);
  return n > MAX_QUANTITY ? 'invalid' : n;
}

function resolveMedicine(
  values: Record<string, string>,
  mapping: Record<string, string | undefined>,
  catalog: CatalogLookup,
  errors: ImportRowError[],
): CatalogEntry | undefined {
  const code = mapping.medicineCode ? values[mapping.medicineCode] : '';
  const id = mapping.medicineId ? values[mapping.medicineId] : '';
  const name = mapping.medicineName ? values[mapping.medicineName] : '';

  let entry: CatalogEntry | undefined;
  if (code) {
    entry = catalog.byCode.get(code.toLowerCase());
    if (!entry) errors.push({ field: 'medicine_code', code: 'MEDICINE_NOT_FOUND', message: `No medicine with code "${code}"`, params: { value: code } });
  } else if (id) {
    entry = catalog.byId.get(id);
    if (!entry) errors.push({ field: 'medicine_id', code: 'MEDICINE_NOT_FOUND', message: `No medicine with id "${id}"`, params: { value: id } });
  } else if (name) {
    let candidates = catalog.byName.get(normalizeSearchText(name)) ?? [];
    const strengthRaw = mapping.strength ? values[mapping.strength] : '';
    const formRaw = mapping.dosageForm ? values[mapping.dosageForm] : '';
    if (strengthRaw) {
      const s = normalizeStrength(strengthRaw).toLowerCase();
      candidates = candidates.filter((c) => normalizeStrength(c.strength ?? '').toLowerCase() === s);
    }
    if (formRaw) {
      const form = parseDosageForm(formRaw);
      if (!form) {
        errors.push({ field: 'dosage_form', code: 'INVALID_DOSAGE_FORM', message: `Unknown dosage form "${formRaw}"`, params: { value: formRaw } });
        return undefined;
      }
      candidates = candidates.filter((c) => c.dosageForm === form);
    }
    if (candidates.length === 1) entry = candidates[0];
    else if (candidates.length === 0) {
      errors.push({ field: 'medicine_name', code: 'MEDICINE_NOT_FOUND', message: `No catalog medicine matches "${name}"`, params: { value: name } });
    } else {
      errors.push({
        field: 'medicine_name',
        code: 'MEDICINE_AMBIGUOUS',
        message: `"${name}" matches ${candidates.length} products — add strength and dosage form, or use medicine_code`,
        params: { value: name, count: candidates.length },
      });
    }
  } else {
    errors.push({ field: 'medicine', code: 'MISSING_MEDICINE_IDENTIFIER', message: 'Row has no medicine code, id or name' });
  }

  if (entry && !entry.isActive) {
    errors.push({ field: 'medicine', code: 'MEDICINE_INACTIVE', message: `"${entry.name}" is no longer active in the catalog` });
    return undefined;
  }
  return entry;
}

/**
 * Validates parsed rows against the catalog and the pharmacy's current
 * inventory. Pure function — no database access — so it is fully unit-tested.
 */
export function validateImportRows(
  rows: ParsedRow[],
  mapping: Record<string, string | undefined>,
  catalog: CatalogLookup,
  existing: Map<string, ExistingInventory>,
): ValidatedRow[] {
  const firstRowByMedicine = new Map<string, number>();

  return rows.map(({ rowNumber, values }) => {
    const errors: ImportRowError[] = [];
    const get = (field: string) => (mapping[field] ? values[mapping[field]!] ?? '' : '');
    const input = {
      medicine: get('medicineCode') || get('medicineId') || [get('medicineName'), get('strength'), get('dosageForm')].filter(Boolean).join(' '),
      quantity: get('quantity'),
      availabilityStatus: get('availabilityStatus'),
    };

    const medicine = resolveMedicine(values, mapping, catalog, errors);

    const quantity = parseQuantity(input.quantity);
    if (quantity === 'invalid') {
      errors.push({ field: 'quantity', code: 'INVALID_QUANTITY', message: `Quantity must be a whole number between 0 and ${MAX_QUANTITY}`, params: { value: input.quantity } });
    }

    let explicitStatus: AvailabilityStatus | null = null;
    if (input.availabilityStatus) {
      explicitStatus = parseStatus(input.availabilityStatus);
      if (!explicitStatus) {
        errors.push({ field: 'availability_status', code: 'INVALID_STATUS', message: `Unknown availability "${input.availabilityStatus}"`, params: { value: input.availabilityStatus } });
      }
    }
    if (!input.availabilityStatus && quantity === null) {
      errors.push({ field: 'availability_status', code: 'MISSING_AVAILABILITY', message: 'Provide a quantity or an availability status' });
    }

    let showQuantityPublicly: boolean | undefined;
    const showRaw = get('showQuantityPublicly');
    if (showRaw) {
      const b = BOOLEAN_ALIASES[normalizeSearchText(showRaw)];
      if (b === undefined) {
        errors.push({ field: 'show_quantity_publicly', code: 'INVALID_BOOLEAN', message: `Expected yes/no, got "${showRaw}"`, params: { value: showRaw } });
      } else showQuantityPublicly = b;
    }

    let status: AvailabilityStatus | undefined;
    const qty = quantity === 'invalid' ? undefined : quantity;
    if (errors.every((e) => e.field !== 'availability_status' && e.field !== 'quantity')) {
      const resolved = resolveStatus(explicitStatus, qty);
      if (resolved.ok) status = resolved.status;
      else errors.push({ field: 'availability_status', code: resolved.code, message: resolved.message });
    }

    if (medicine) {
      const first = firstRowByMedicine.get(medicine.id);
      if (first !== undefined) {
        errors.push({
          field: 'medicine',
          code: 'DUPLICATE_ROW',
          message: `Same medicine already appears on row ${first}`,
          params: { firstRow: first },
        });
      } else {
        firstRowByMedicine.set(medicine.id, rowNumber);
      }
    }

    const result: ValidatedRow = { rowNumber, input, errors };
    if (medicine) {
      result.medicine = { id: medicine.id, name: medicine.name, strength: medicine.strength, dosageForm: medicine.dosageForm };
    }
    if (errors.length === 0 && medicine && status) {
      result.availabilityStatus = status;
      result.quantity = qty ?? null;
      result.showQuantityPublicly = showQuantityPublicly;
      const current = existing.get(medicine.id);
      if (!current) result.action = 'CREATE';
      else if (current.availabilityStatus === status && current.quantity === (qty ?? null) && current.isActive) {
        result.action = 'UNCHANGED';
      } else result.action = 'UPDATE';
    }
    return result;
  });
}
