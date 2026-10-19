import ExcelJS from 'exceljs';
import { canonicalHeader, detectFileKind, ImportFileError, parseCsv, parseInventoryFile, parseXlsx } from './import-parser';
import {
  buildCatalogLookup,
  CatalogEntry,
  ExistingInventory,
  mapColumns,
  parseDosageForm,
  parseQuantity,
  parseStatus,
  validateImportRows,
} from './import-validator';

const catalog: CatalogEntry[] = [
  { id: 'm1', catalogCode: 'DEMO-0001', name: 'Paracetamol', normalizedName: 'paracetamol', strength: '500 mg', dosageForm: 'TABLET', isActive: true },
  { id: 'm2', catalogCode: 'DEMO-0002', name: 'Paracetamol', normalizedName: 'paracetamol', strength: '120 mg/5 ml', dosageForm: 'SYRUP', isActive: true },
  { id: 'm3', catalogCode: 'DEMO-0004', name: 'Ibuprofen', normalizedName: 'ibuprofen', strength: '400 mg', dosageForm: 'TABLET', isActive: true },
  { id: 'm4', catalogCode: 'OLD-1', name: 'Retired', normalizedName: 'retired', strength: null, dosageForm: null, isActive: false },
];
const lookup = buildCatalogLookup(catalog);

function validate(csv: string, existing = new Map<string, ExistingInventory>()) {
  const sheet = parseCsv(Buffer.from(csv), 100);
  const { mapping } = mapColumns(sheet.headers);
  return validateImportRows(sheet.rows, mapping, lookup, existing);
}

describe('file detection', () => {
  it('accepts csv and xlsx, rejects other types', () => {
    expect(detectFileKind('a.csv', 'text/csv', Buffer.from('a,b'))).toBe('csv');
    expect(detectFileKind('a.xlsx', 'application/octet-stream', Buffer.from('PK\u0003\u0004xxxx'))).toBe('xlsx');
    expect(() => detectFileKind('a.pdf', 'application/pdf', Buffer.from('%PDF'))).toThrow(ImportFileError);
  });

  it('rejects files whose content does not match the extension', () => {
    expect(() => detectFileKind('a.xlsx', 'application/octet-stream', Buffer.from('not a zip'))).toThrow(/xlsx/);
    expect(() => detectFileKind('a.csv', 'text/csv', Buffer.from([0x50, 0x00, 0x01]))).toThrow(/CSV/);
  });
});

describe('CSV parsing', () => {
  it('handles BOM, semicolon delimiters, Albanian headers and blank lines', () => {
    const sheet = parseCsv(Buffer.from(String.fromCharCode(0xfeff) + 'Kodi;Sasia (copë)\nDEMO-0001;10\n\n;\nDEMO-0004;0\n'), 100);
    expect(sheet.headers).toEqual(['kodi', 'sasia']);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[1]).toEqual({ rowNumber: 5, values: { kodi: 'DEMO-0004', sasia: '0' } });
  });

  it('enforces the row limit', () => {
    expect(() => parseCsv(Buffer.from('code,quantity\nA,1\nB,2\nC,3\n'), 2)).toThrow(/maximum/);
  });

  it('rejects files without data rows', () => {
    expect(() => parseCsv(Buffer.from('code,quantity\n'), 10)).toThrow(ImportFileError);
  });

  it('canonicalizes headers', () => {
    expect(canonicalHeader(' Disponueshmëria ')).toBe('disponueshmeria');
    expect(canonicalHeader('Medicine Code')).toBe('medicine_code');
  });
});

describe('Excel parsing', () => {
  it('reads the first worksheet of an .xlsx workbook', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Inventari');
    ws.addRow(['medicine_code', 'quantity', 'availability_status']);
    ws.addRow(['DEMO-0001', 25, '']);
    ws.addRow(['DEMO-0004', 0, 'OUT_OF_STOCK']);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const sheet = await parseInventoryFile(
      { originalname: 'inventari.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer },
      100,
    );
    expect(sheet.rows).toEqual([
      { rowNumber: 2, values: { medicine_code: 'DEMO-0001', quantity: '25', availability_status: '' } },
      { rowNumber: 3, values: { medicine_code: 'DEMO-0004', quantity: '0', availability_status: 'OUT_OF_STOCK' } },
    ]);
  });

  it('reports corrupt workbooks as unreadable', async () => {
    await expect(parseXlsx(Buffer.from('PK\u0003\u0004garbage'), 10)).rejects.toThrow(ImportFileError);
  });
});

describe('value parsers', () => {
  it('parses statuses in English and Albanian', () => {
    expect(parseStatus('IN_STOCK')).toBe('IN_STOCK');
    expect(parseStatus('në stok')).toBe('IN_STOCK');
    expect(parseStatus('Pak')).toBe('LOW_STOCK');
    expect(parseStatus('nuk ka')).toBe('OUT_OF_STOCK');
    expect(parseStatus('out-of-stock')).toBe('OUT_OF_STOCK');
    expect(parseStatus('maybe')).toBeNull();
  });

  it('parses quantities strictly', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('12')).toBe(12);
    expect(parseQuantity('12.0')).toBe(12);
    expect(parseQuantity('-1')).toBe('invalid');
    expect(parseQuantity('1.5')).toBe('invalid');
    expect(parseQuantity('abc')).toBe('invalid');
    expect(parseQuantity('99999999')).toBe('invalid');
  });

  it('parses dosage forms', () => {
    expect(parseDosageForm('tableta')).toBe('TABLET');
    expect(parseDosageForm('SYRUP')).toBe('SYRUP');
    expect(parseDosageForm('foo')).toBeNull();
  });
});

describe('mapColumns', () => {
  it('reports missing identifier/quantity columns', () => {
    expect(mapColumns(['foo', 'bar']).missing).toHaveLength(2);
    expect(mapColumns(['medicine_code', 'quantity']).missing).toHaveLength(0);
    expect(mapColumns(['emri', 'statusi', 'koment']).unknownColumns).toEqual(['koment']);
  });
});

describe('validateImportRows', () => {
  it('accepts valid rows and derives status from quantity', () => {
    const [row] = validate('medicine_code,quantity\nDEMO-0001,3\n');
    expect(row.errors).toEqual([]);
    expect(row).toMatchObject({ availabilityStatus: 'LOW_STOCK', quantity: 3, action: 'CREATE', medicine: { id: 'm1' } });
  });

  it('resolves medicines by name + strength + form, and reports ambiguity', () => {
    const rows = validate(
      'medicine_name,strength,dosage_form,quantity\nParacetamol,500mg,tableta,10\nParacetamol,,,10\nIbuprofen,,,10\n',
    );
    expect(rows[0].medicine?.id).toBe('m1');
    expect(rows[1].errors[0].code).toBe('MEDICINE_AMBIGUOUS');
    expect(rows[2].medicine?.id).toBe('m3');
  });

  it('reports row-level errors without dropping rows', () => {
    const rows = validate(
      [
        'medicine_code,quantity,availability_status,show_quantity',
        'NOPE,1,,',
        ',5,,',
        'DEMO-0001,-4,,',
        'DEMO-0002,,sometimes,',
        'DEMO-0004,7,OUT_OF_STOCK,',
        'OLD-1,4,,',
        'DEMO-0001,,,',
      ].join('\n'),
    );
    expect(rows.map((r) => r.errors[0]?.code)).toEqual([
      'MEDICINE_NOT_FOUND',
      'MISSING_MEDICINE_IDENTIFIER',
      'INVALID_QUANTITY',
      'INVALID_STATUS',
      'STATUS_QUANTITY_MISMATCH',
      'MEDICINE_INACTIVE',
      'MISSING_AVAILABILITY',
    ]);
    expect(rows.every((r) => r.action === undefined)).toBe(true);
  });

  it('flags duplicate rows for the same medicine', () => {
    const rows = validate('medicine_code,quantity\nDEMO-0001,10\nDEMO-0004,2\ndemo-0001,12\n');
    expect(rows[0].errors).toEqual([]);
    expect(rows[2].errors[0]).toMatchObject({ code: 'DUPLICATE_ROW', params: { firstRow: 2 } });
  });

  it('classifies rows as CREATE / UPDATE / UNCHANGED against existing inventory', () => {
    const existing = new Map<string, ExistingInventory>([
      ['m1', { availabilityStatus: 'IN_STOCK', quantity: 10, isActive: true }],
      ['m3', { availabilityStatus: 'IN_STOCK', quantity: 10, isActive: true }],
    ]);
    const rows = validate('medicine_code,quantity\nDEMO-0001,10\nDEMO-0004,0\nDEMO-0002,9\n', existing);
    expect(rows.map((r) => r.action)).toEqual(['UNCHANGED', 'UPDATE', 'CREATE']);
  });

  it('validates the show-quantity flag', () => {
    const rows = validate('medicine_code,quantity,shfaq_sasine\nDEMO-0001,10,po\nDEMO-0004,3,maybe\n');
    expect(rows[0].showQuantityPublicly).toBe(true);
    expect(rows[1].errors[0].code).toBe('INVALID_BOOLEAN');
  });
});
