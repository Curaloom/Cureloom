import { ICD10_PATTERN, qualifyingCodes } from '../shared/codes';
import { fmtDate, isWithinMonths } from '../shared/time';
import type { Coverage } from '../shared/types';

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

export const ROSTER_COLUMNS = [
  'mrn',
  'first_name',
  'last_name',
  'dob',
  'phone',
  'state',
  'coverage',
  'is_qmb',
  'icd10_codes',
  'last_visit_date',
  'caregiver_name',
  'caregiver_phone',
  'preferred_language',
  'consent_date',
  'consent_method',
  'automated_calls_ok',
  'texts_ok',
] as const;

export interface RosterRow {
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  phone: string;
  state: string;
  coverage: Coverage;
  is_qmb: boolean;
  codes: string[];
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

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
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

function coverageOf(s: string): Coverage | null {
  const v = s.trim().toLowerCase();
  if (['traditional', 'traditional medicare', 'original medicare', 'medicare', 'ffs'].includes(v)) return 'traditional';
  if (['advantage', 'medicare advantage', 'ma', 'part c'].includes(v)) return 'advantage';
  return null;
}

export function parseRoster(csv: string, today: string): { rows: ParsedRow[]; headerErrors: string[] } {
  const table = parseCsv(csv);
  if (!table.length) return { rows: [], headerErrors: ['The file is empty.'] };
  const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const required = ['mrn', 'first_name', 'last_name', 'dob', 'phone', 'coverage', 'icd10_codes', 'last_visit_date'];
  const missing = required.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], headerErrors: [`Missing column(s): ${missing.join(', ')}`] };

  const seen = new Set<string>();
  const rows: ParsedRow[] = table.slice(1).map((cells, i) => {
    const raw: Record<string, string> = {};
    header.forEach((h, j) => (raw[h] = (cells[j] ?? '').trim()));
    const errors: string[] = [];
    const mrn = raw.mrn;
    if (!mrn) errors.push('MRN is missing');
    else if (seen.has(mrn)) errors.push(`MRN ${mrn} appears more than once in the file`);
    if (mrn) seen.add(mrn);
    if (!raw.first_name || !raw.last_name) errors.push('first or last name is missing');
    if (!validDate(raw.dob)) errors.push(`date of birth "${raw.dob}" is not a valid YYYY-MM-DD date`);
    else if (raw.dob > today) errors.push('date of birth is in the future');
    const phone = normalizePhone(raw.phone ?? '');
    if (!phone) errors.push(`phone "${raw.phone}" is not a fictional 555-01XX number`);
    const coverage = coverageOf(raw.coverage ?? '');
    if (!coverage) errors.push(`coverage "${raw.coverage}" is not traditional or advantage`);
    const qmb = yesNo(raw.is_qmb);
    if (qmb === null) errors.push(`is_qmb "${raw.is_qmb}" is not yes or no`);
    const codes = (raw.icd10_codes ?? '')
      .split(/[;|]/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const badCodes = codes.filter((c) => !ICD10_PATTERN.test(c));
    if (badCodes.length) errors.push(`"${badCodes.join('", "')}" is not an ICD-10 code`);
    const lastVisit = raw.last_visit_date || null;
    if (lastVisit && !validDate(lastVisit)) errors.push(`last visit "${lastVisit}" is not a valid YYYY-MM-DD date`);
    let cgPhone: string | null = null;
    if (raw.caregiver_phone) {
      cgPhone = normalizePhone(raw.caregiver_phone);
      if (!cgPhone) errors.push(`caregiver phone "${raw.caregiver_phone}" is not a fictional 555-01XX number`);
    }
    let consent: RosterRow['consent'] = null;
    if (raw.consent_date) {
      if (!validDate(raw.consent_date)) errors.push(`consent date "${raw.consent_date}" is not a valid YYYY-MM-DD date`);
      const method = (raw.consent_method || 'at_visit').toLowerCase();
      if (method !== 'at_visit' && method !== 'nurse_phone') errors.push(`consent method "${raw.consent_method}" is not at_visit or nurse_phone`);
      const auto = yesNo(raw.automated_calls_ok);
      const texts = yesNo(raw.texts_ok);
      if (auto === null || texts === null) errors.push('automated_calls_ok and texts_ok must be yes or no');
      consent = {
        date: raw.consent_date,
        method: method as 'at_visit' | 'nurse_phone',
        automated_calls_ok: !!auto,
        texts_ok: !!texts,
      };
    }
    const value: RosterRow | null = errors.length
      ? null
      : {
          mrn,
          first_name: raw.first_name,
          last_name: raw.last_name,
          dob: raw.dob,
          phone: phone!,
          state: (raw.state || 'TX').toUpperCase(),
          coverage: coverage!,
          is_qmb: !!qmb,
          codes,
          last_visit_date: lastVisit,
          caregiver_name: raw.caregiver_name || null,
          caregiver_phone: cgPhone,
          preferred_language: raw.preferred_language || 'English',
          consent,
        };
    return { row: i + 2, raw, value, errors };
  });
  return { rows, headerErrors: [] };
}

export type Eligibility =
  | { status: 'eligible_unconfirmed'; reason: null; label: string }
  | { status: 'ineligible' | 'needs_visit'; reason: string; label: string };

/** The system flags eligibility; the practice confirms it with a click. */
export function eligibility(
  r: { codes: string[]; coverage: Coverage; last_visit_date: string | null },
  today: string,
): Eligibility {
  if (r.coverage === 'advantage')
    return { status: 'ineligible', reason: 'Medicare Advantage', label: 'not eligible: Medicare Advantage' };
  const n = qualifyingCodes(r.codes).length;
  if (n < 2) {
    const reason = n === 1 ? 'one qualifying condition' : 'no qualifying conditions';
    return { status: 'ineligible', reason, label: `not eligible: ${reason}` };
  }
  if (!r.last_visit_date || !isWithinMonths(r.last_visit_date, today, 12)) {
    const reason = r.last_visit_date ? `needs a visit, last seen ${fmtDate(r.last_visit_date)}` : 'needs a visit, no visit on record';
    return { status: 'needs_visit', reason, label: reason };
  }
  return { status: 'eligible_unconfirmed', reason: null, label: 'eligible, awaiting practice confirmation' };
}
