// XLSX in and out. Reading and writing are async, so they run in the HTTP
// layer, outside the service's synchronous database transactions.

import { readSheet } from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';

function cellText(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v).trim();
}

/** The first sheet as rows of text. Date cells become YYYY-MM-DD. */
export async function readXlsxTable(buf: Buffer): Promise<string[][]> {
  const data = await readSheet(buf);
  return data.map((row) => row.map(cellText)).filter((r) => r.some((c) => c !== ''));
}

/** One sheet, first row bold. Numbers stay numbers so amounts sum in Excel. */
export async function writeXlsxTable(rows: (string | number | null)[][]): Promise<Buffer> {
  const data = rows.map((row, i) =>
    row.map((v) =>
      v == null || v === ''
        ? null
        : typeof v === 'number'
          ? { value: v, type: Number }
          : { value: String(v), type: String, fontWeight: i === 0 ? ('bold' as const) : undefined },
    ),
  );
  return writeXlsxFile(data).toBuffer();
}
