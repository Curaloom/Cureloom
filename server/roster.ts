import { normalizeIcd } from '../shared/icd10';
import { fieldLabel, missingRequired, suggestMapping, type FieldKey, type Mapping } from '../shared/mapper';
import type { Sex } from '../shared/types';

/** RFC 4180-ish CSV: quoted fields, doubled quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return (
    rows
      .map((r) =>
        r
          .map((v) => {
            const s = v == null ? '' : String(v);
            return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      )
      .join('\r\n') + '\r\n'
  );
}

export interface RosterRow {
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  phone: string;
  state: string;
  sex: Sex;
  insurance_name: string;
  insurance_id: string;
  /** Every diagnosis code, normalised (decimal point restored). */
  codes: string[];
  /** How many codes needed repair, e.g. "E119" read as "E11.9". */
  repaired: number;
  /** From a QMB column when the export has one; otherwise the payer name decides. */
  is_qmb: boolean | null;
  last_visit_date: string | null;
  caregiver_name: string | null;
  caregiver_phone: string | null;
  preferred_language: string;
  consent: { date: string; method: 'at_visit' | 'nurse_phone'; automated_calls_ok: boolean; texts_ok: boolean } | null;
}

export interface ParsedRow {
  row: number;
  raw: Record<string, string>;
  value: RosterRow | null;
  errors: string[];
}

function validIso(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Dates as EHR exports write them: YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY,
 * M/D/YY, YYYYMMDD, or an Excel serial day number. Returns YYYY-MM-DD.
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let r: RegExpMatchArray | null;
  if ((r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    [m, d, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
    if (r[3].length === 2) y += y > 30 ? 1900 : 2000;
  } else if ((r = s.match(/^(\d{4})(\d{2})(\d{2})$/))) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if (/^\d{4,5}(\.0+)?$/.test(s) && Number(s) > 1000) {
    // Excel serial: days since 30 Dec 1899.
    const iso = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86_400_000).toISOString().slice(0, 10);
    return validIso(iso) ? iso : null;
  } else return null;
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return validIso(iso) ? iso : null;
}

/** Only fictional 555-01XX numbers are allowed anywhere in this prototype. */
export function normalizePhone(s: string): string | null {
  const digits = s.replace(/\D/g, '');
  const local = digits.length === 8 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (!/^55501\d\d$/.test(local)) return null;
  return `+1 555 ${local.slice(3)}`;
}

function yesNo(s: string | undefined): boolean | null {
  const v = (s ?? '').trim().toLowerCase();
  if (['', 'no', 'n', 'false', '0'].includes(v)) return false;
  if (['yes', 'y', 'true', '1'].includes(v)) return true;
  return null;
}

function sexOf(s: string): Sex {
  const v = s.trim().toLowerCase();
  if (v === 'm' || v === 'male') return 'M';
  if (v === 'f' || v === 'female') return 'F';
  return 'U';
}

/** Splits a diagnosis list on ; | , or whitespace. */
export function splitCodes(s: string): string[] {
  return s
    .split(/[;|,\s]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Validates every data row of `table` (first row is the header) using the confirmed column mapping. */
export function parseRoster(table: string[][], mapping: Mapping, today: string): { rows: ParsedRow[]; headerErrors: string[] } {
  if (!table.length) return { rows: [], headerErrors: ['The file is empty.'] };
  const missing = missingRequired(mapping);
  if (missing.length) return { rows: [], headerErrors: [`No column mapped for: ${missing.map(fieldLabel).join(', ')}`] };
  const header = table[0];
  const seen = new Set<string>();
  const rows: ParsedRow[] = table.slice(1).map((cells, i) => {
    const raw: Record<string, string> = {};
    header.forEach((h, j) => (raw[h] = String(cells[j] ?? '').trim()));
    const get = (k: FieldKey): string => {
      const col = mapping[k].column;
      return col == null ? '' : String(cells[col] ?? '').trim();
    };
    const errors: string[] = [];
    const mrn = get('patient_id');
    if (!mrn) errors.push('Patient ID is missing');
    else if (seen.has(mrn)) errors.push(`Patient ID ${mrn} appears more than once in the file`);
    if (mrn) seen.add(mrn);
    const first = get('first_name');
    const last = get('last_name');
    if (!first || !last) errors.push('first or last name is missing');
    const dobRaw = get('dob');
    const dob = parseDate(dobRaw);
    if (!dob) errors.push(`date of birth "${dobRaw}" is not a date`);
    else if (dob > today) errors.push('date of birth is in the future');
    const phone = normalizePhone(get('phone'));
    if (!phone) errors.push(`phone "${get('phone')}" is not a fictional 555-01XX number`);
    const insuranceName = get('insurance_name');
    if (!insuranceName) errors.push('primary insurance is missing');
    const insuranceId = get('insurance_id');
    if (!insuranceId) errors.push('insurance ID is missing');
    const qmbRaw = get('is_qmb');
    const qmb = mapping.is_qmb.column == null || qmbRaw === '' ? null : yesNo(qmbRaw);
    if (qmbRaw !== '' && mapping.is_qmb.column != null && qmb === null) errors.push(`QMB "${qmbRaw}" is not yes or no`);
    const codes: string[] = [];
    let repaired = 0;
    const bad: string[] = [];
    for (const c of splitCodes(get('diagnosis_codes'))) {
      const n = normalizeIcd(c);
      if (!n) bad.push(c);
      else if (!codes.includes(n.code)) {
        codes.push(n.code);
        if (n.repaired) repaired++;
      }
    }
    if (bad.length) errors.push(`"${bad.join('", "')}" is not an ICD-10 code`);
    const visitRaw = get('last_visit_date');
    const lastVisit = visitRaw ? parseDate(visitRaw) : null;
    if (visitRaw && !lastVisit) errors.push(`last visit "${visitRaw}" is not a date`);
    let cgPhone: string | null = null;
    if (get('caregiver_phone')) {
      cgPhone = normalizePhone(get('caregiver_phone'));
      if (!cgPhone) errors.push(`caregiver phone "${get('caregiver_phone')}" is not a fictional 555-01XX number`);
    }
    let consent: RosterRow['consent'] = null;
    const consentRaw = get('consent_date');
    if (consentRaw) {
      const date = parseDate(consentRaw);
      if (!date) errors.push(`consent date "${consentRaw}" is not a date`);
      const method = (get('consent_method') || 'at_visit').toLowerCase();
      if (method !== 'at_visit' && method !== 'nurse_phone') errors.push(`consent method "${get('consent_method')}" is not at_visit or nurse_phone`);
      const auto = yesNo(get('automated_calls_ok'));
      const texts = yesNo(get('texts_ok'));
      if (auto === null || texts === null) errors.push('automated_calls_ok and texts_ok must be yes or no');
      consent = { date: date ?? consentRaw, method: method as 'at_visit' | 'nurse_phone', automated_calls_ok: !!auto, texts_ok: !!texts };
    }
    const value: RosterRow | null = errors.length
      ? null
      : {
          mrn,
          first_name: first,
          last_name: last,
          dob: dob!,
          phone: phone!,
          state: (get('state') || 'TX').toUpperCase(),
          sex: sexOf(get('sex')),
          insurance_name: insuranceName,
          insurance_id: insuranceId,
          codes,
          repaired,
          is_qmb: qmb,
          last_visit_date: lastVisit,
          caregiver_name: get('caregiver_name') || null,
          caregiver_phone: cgPhone,
          preferred_language: get('preferred_language') || 'English',
          consent,
        };
    return { row: i + 2, raw, value, errors };
  });
  return { rows, headerErrors: [] };
}

/** CSV text to rows, with the header mapped automatically. Used for the seed and for tests. */
export function parseRosterCsv(csv: string, today: string): { rows: ParsedRow[]; headerErrors: string[] } {
  const table = parseCsv(csv);
  return parseRoster(table, suggestMapping(table[0] ?? []), today);
}
