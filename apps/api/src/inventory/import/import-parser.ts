import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export class ImportFileError extends Error {
  constructor(
    readonly code: 'UNSUPPORTED_FILE_TYPE' | 'EMPTY_FILE' | 'TOO_MANY_ROWS' | 'UNREADABLE_FILE' | 'MISSING_HEADER',
    message: string,
  ) {
    super(message);
  }
}

export interface ParsedRow {
  /** 1-based spreadsheet row number (header is row 1). */
  rowNumber: number;
  values: Record<string, string>;
}

export interface ParsedSheet {
  headers: string[];
  rows: ParsedRow[];
}

export type ImportFileKind = 'csv' | 'xlsx';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_MIMES = ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream'];

/** Decides the file kind from extension + MIME + magic bytes; rejects anything else. */
export function detectFileKind(fileName: string, mimeType: string, buffer: Buffer): ImportFileKind {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'xlsx') {
    const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"
    if (!isZip || ![XLSX_MIME, 'application/octet-stream', 'application/zip'].includes(mimeType)) {
      throw new ImportFileError('UNSUPPORTED_FILE_TYPE', 'File is not a valid .xlsx workbook');
    }
    return 'xlsx';
  }
  if (ext === 'csv') {
    if (!CSV_MIMES.includes(mimeType) || buffer.subarray(0, 8192).includes(0)) {
      throw new ImportFileError('UNSUPPORTED_FILE_TYPE', 'File is not a valid CSV text file');
    }
    return 'csv';
  }
  throw new ImportFileError('UNSUPPORTED_FILE_TYPE', 'Only .csv and .xlsx files are supported');
}

/** Lower-cases, strips accents and turns separators into underscores: "Sasia (copë)" → "sasia_cope". */
export function canonicalHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function finalize(headers: string[], rawRows: string[][], maxRows: number): ParsedSheet {
  const cleanHeaders = headers.map((h) => canonicalHeader(String(h ?? '')));
  if (cleanHeaders.filter(Boolean).length === 0) {
    throw new ImportFileError('MISSING_HEADER', 'The first row must contain column headers');
  }
  const rows: ParsedRow[] = [];
  rawRows.forEach((cells, idx) => {
    if (cells.every((c) => String(c ?? '').trim() === '')) return; // skip blank lines
    const values: Record<string, string> = {};
    cleanHeaders.forEach((h, i) => {
      if (h) values[h] = String(cells[i] ?? '').trim();
    });
    rows.push({ rowNumber: idx + 2, values });
  });
  if (rows.length === 0) throw new ImportFileError('EMPTY_FILE', 'The file has no data rows');
  if (rows.length > maxRows) {
    throw new ImportFileError('TOO_MANY_ROWS', `The file has ${rows.length} rows; the maximum is ${maxRows}`);
  }
  return { headers: cleanHeaders.filter(Boolean), rows };
}

export function parseCsv(buffer: Buffer, maxRows: number): ParsedSheet {
  const raw = buffer.toString('utf8');
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw; // strip byte-order mark
  // Excel in many European locales exports ";"-separated CSV; pick whichever separator the header uses most.
  const headerLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [',', ';', '\t'].reduce((best, d) =>
    headerLine.split(d).length > headerLine.split(best).length ? d : best,
  );
  // Blank lines are kept here (and skipped in finalize) so reported row numbers match the file.
  const result = Papa.parse<string[]>(text, { skipEmptyLines: false, delimiter });
  if (result.errors.some((e) => e.type === 'Delimiter') && result.data.length === 0) {
    throw new ImportFileError('UNREADABLE_FILE', 'Could not read the CSV file');
  }
  const [header, ...data] = result.data;
  if (!header) throw new ImportFileError('EMPTY_FILE', 'The file is empty');
  return finalize(header, data, maxRows);
}

export async function parseXlsx(buffer: Buffer, maxRows: number): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ImportFileError('UNREADABLE_FILE', 'Could not read the Excel workbook');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) throw new ImportFileError('EMPTY_FILE', 'The workbook has no data');
  if (sheet.rowCount > maxRows + 1) {
    throw new ImportFileError('TOO_MANY_ROWS', `The sheet has more than ${maxRows} rows`);
  }
  const columnCount = sheet.columnCount;
  const readRow = (n: number) => {
    const row = sheet.getRow(n);
    return Array.from({ length: columnCount }, (_, i) => row.getCell(i + 1).text ?? '');
  };
  const header = readRow(1);
  const data: string[][] = [];
  for (let r = 2; r <= sheet.rowCount; r++) data.push(readRow(r));
  return finalize(header, data, maxRows);
}

export async function parseInventoryFile(
  file: { originalname: string; mimetype: string; buffer: Buffer },
  maxRows: number,
): Promise<ParsedSheet> {
  const kind = detectFileKind(file.originalname, file.mimetype, file.buffer);
  return kind === 'csv' ? parseCsv(file.buffer, maxRows) : parseXlsx(file.buffer, maxRows);
}
