// The CMS-1500 (02/12) flat-file export: one row per claim line, columns in
// the exact order the Ops team's billing module expects. Every claim passes
// the pre-flight checks first; a claim with any failing line is excluded
// whole (an add-on code never ships without its base code) and listed in the
// exceptions report.

import { ADD_ON_CODES, BILLING_CODES, type BillingCode, type BillingSettings } from '../shared/constants';
import { distinctConditions, stripDecimal } from '../shared/icd10';
import type { ClaimLine, Patient } from '../shared/model';
import { npiValid } from '../shared/npi';
import { dateOf, fmtDay, lastDayOfMonth } from '../shared/time';

export const CMS1500_COLUMNS = [
  'PATIENT_ID',
  'PATIENT_INS_ID',
  'PATIENT_LAST',
  'PATIENT_FIRST',
  'PATIENT_DOB',
  'PATIENT_GENDER',
  'RENDERING_PROV_NPI',
  'BILLING_PROV_NPI',
  'PLACE_OF_SERVICE',
  'DATE_OF_SERVICE',
  'PROCEDURE_CODE',
  'MODIFIER_1',
  'DIAG_POINTER_1',
  'DIAG_POINTER_2',
  'CHARGE_AMOUNT',
  'UNITS',
  'DIAG_CODE_A',
  'DIAG_CODE_B',
] as const;

export type ClaimRow = Record<(typeof CMS1500_COLUMNS)[number], string>;

/** Export profiles. Clearinghouse-specific layouts are added here. */
export const EXPORT_PROFILES = [
  { id: 'cms1500-csv', label: 'CMS-1500 CSV (standard)', format: 'csv' },
  { id: 'cms1500-xlsx', label: 'CMS-1500 XLSX', format: 'xlsx' },
] as const;

/** Codes that need two distinct chronic conditions on the claim. */
const MULTI_MORBID: BillingCode[] = ['99490', '99439', '99487', '99489', 'G0557', 'G0558'];
export const MULTI_MORBID_ERROR = 'Invalid CCM Layout: Minimum of 2 chronic conditions required.';

/** Strips the characters that shift columns in downstream imports. */
export function sanitize(s: string): string {
  return s.replace(/[,;\t"\r\n]/g, '').trim();
}

/** Names on the claim: letters, digits and spaces only. */
function claimName(s: string): string {
  return sanitize(s).replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function yyyymmdd(iso: string): string {
  return dateOf(iso).replace(/-/g, '');
}

export interface ClaimInput {
  patient: Patient;
  lines: ClaimLine[];
  /** Chronic condition codes from the matrix, in roster order. */
  diagnosis: string[];
}

export interface Claim {
  patientId: number;
  mrn: string;
  name: string;
  rows: ClaimRow[];
  errors: string[];
  /** Characters removed from patient strings. Not an error: the row is fixed. */
  sanitized: string[];
}

export function buildClaim(input: ClaimInput, month: string, settings: BillingSettings, matrixDistinct: typeof distinctConditions): Claim {
  const p = input.patient;
  const [a, b] = matrixDistinct(input.diagnosis);
  const sanitized: string[] = [];
  const clean = (field: string, raw: string, fn: (s: string) => string) => {
    const v = fn(raw);
    if (v !== raw.trim()) sanitized.push(`${field}: "${raw}" written as "${v}"`);
    return v;
  };
  const last = clean('PATIENT_LAST', p.last_name, claimName);
  const first = clean('PATIENT_FIRST', p.first_name, claimName);
  const patientId = clean('PATIENT_ID', p.mrn, sanitize);
  const insId = sanitize(p.insurance_id).replace(/[\s-]/g, '').toUpperCase();
  const rows: ClaimRow[] = input.lines.map((l) => ({
    PATIENT_ID: patientId,
    PATIENT_INS_ID: insId,
    PATIENT_LAST: last,
    PATIENT_FIRST: first,
    PATIENT_DOB: yyyymmdd(p.dob),
    PATIENT_GENDER: p.sex,
    RENDERING_PROV_NPI: settings.renderingNpi,
    BILLING_PROV_NPI: settings.billingNpi,
    PLACE_OF_SERVICE: settings.placeOfService,
    DATE_OF_SERVICE: yyyymmdd(lastDayOfMonth(month)),
    PROCEDURE_CODE: l.code,
    MODIFIER_1: settings.modifier,
    DIAG_POINTER_1: a ? 'A' : '',
    DIAG_POINTER_2: b ? 'B' : '',
    CHARGE_AMOUNT: l.amount.toFixed(2),
    UNITS: String(l.units),
    DIAG_CODE_A: a ? stripDecimal(a.code) : '',
    DIAG_CODE_B: b ? stripDecimal(b.code) : '',
  }));
  return { patientId: p.id, mrn: p.mrn, name: `${p.first_name} ${p.last_name}`, rows, errors: [], sanitized };
}

/** The pre-flight checks. Returns the errors for one claim (empty when it is clean). */
export function preflightClaim(c: Claim, month: string, today: string): string[] {
  const errors = new Set<string>();
  const dos = lastDayOfMonth(month);
  const codes = c.rows.map((r) => r.PROCEDURE_CODE as BillingCode);
  if (!c.rows.length) errors.add('No claim lines.');
  for (const r of c.rows) {
    if (!r.PATIENT_ID) errors.add('PATIENT_ID is empty.');
    else if (r.PATIENT_ID.length > 20) errors.add(`PATIENT_ID "${r.PATIENT_ID}" is longer than 20 characters.`);
    if (!/^[A-Z0-9]+$/.test(r.PATIENT_INS_ID)) errors.add(`PATIENT_INS_ID "${r.PATIENT_INS_ID}" must be letters and digits only.`);
    if (!r.PATIENT_LAST || !r.PATIENT_FIRST) errors.add('Patient first or last name is empty.');
    if (!/^\d{8}$/.test(r.PATIENT_DOB)) errors.add(`PATIENT_DOB "${r.PATIENT_DOB}" is not YYYYMMDD.`);
    if (!['M', 'F', 'U'].includes(r.PATIENT_GENDER)) errors.add(`PATIENT_GENDER "${r.PATIENT_GENDER}" is not M, F or U.`);
    if (!npiValid(r.RENDERING_PROV_NPI)) errors.add(`RENDERING_PROV_NPI ${r.RENDERING_PROV_NPI} fails the NPI check digit.`);
    if (!npiValid(r.BILLING_PROV_NPI)) errors.add(`BILLING_PROV_NPI ${r.BILLING_PROV_NPI} fails the NPI check digit.`);
    if (!/^(11|12)$/.test(r.PLACE_OF_SERVICE)) errors.add(`PLACE_OF_SERVICE "${r.PLACE_OF_SERVICE}" is not 11 or 12.`);
    if (!BILLING_CODES.includes(r.PROCEDURE_CODE as BillingCode) || r.PROCEDURE_CODE.length !== 5)
      errors.add(`PROCEDURE_CODE "${r.PROCEDURE_CODE}" is not a CCM or APCM code.`);
    if (r.MODIFIER_1 && !/^[A-Z0-9]{2}$/.test(r.MODIFIER_1)) errors.add(`MODIFIER_1 "${r.MODIFIER_1}" is not two characters.`);
    if (!/^[A-L]$/.test(r.DIAG_POINTER_1)) errors.add('DIAG_POINTER_1 must point to a diagnosis (A–L).');
    if (r.DIAG_POINTER_2 && !/^[A-L]$/.test(r.DIAG_POINTER_2)) errors.add('DIAG_POINTER_2 must be a letter A–L.');
    if (!/^[A-TV-Z][0-9][0-9A-Z][0-9A-Z]{0,4}$/.test(r.DIAG_CODE_A)) errors.add(`DIAG_CODE_A "${r.DIAG_CODE_A}" is not an ICD-10 code.`);
    if (MULTI_MORBID.includes(r.PROCEDURE_CODE as BillingCode) && (!r.DIAG_CODE_B || r.DIAG_CODE_B === r.DIAG_CODE_A)) errors.add(MULTI_MORBID_ERROR);
    if (!(Number(r.CHARGE_AMOUNT) > 0) || !/^\d+\.\d{2}$/.test(r.CHARGE_AMOUNT)) errors.add(`CHARGE_AMOUNT "${r.CHARGE_AMOUNT}" is not a positive amount.`);
    if (!/^[1-9]\d*$/.test(r.UNITS)) errors.add(`UNITS "${r.UNITS}" is not a whole number.`);
  }
  if (dos > today) errors.add(`DATE_OF_SERVICE ${dos.replace(/-/g, '')} is after today; the export opens on ${fmtDay(dos)}.`);
  if (!dos.startsWith(month)) errors.add('DATE_OF_SERVICE is outside the billing month.');
  for (const add of ADD_ON_CODES) {
    const base = add === '99439' ? '99490' : '99487';
    if (codes.includes(add) && !codes.includes(base)) errors.add(`${add} is an add-on code and needs ${base} on the same claim.`);
  }
  return [...errors];
}

export interface PreflightResult {
  month: string;
  dos: string;
  /** True once the demo date has reached the date of service. */
  open: boolean;
  claims: Claim[];
  clean: Claim[];
  excluded: Claim[];
}

export function preflight(claims: Claim[], month: string, today: string): PreflightResult {
  const checked = claims.map((c) => ({ ...c, errors: preflightClaim(c, month, today) }));
  const dos = lastDayOfMonth(month);
  return {
    month,
    dos,
    open: today >= dos,
    claims: checked,
    clean: checked.filter((c) => !c.errors.length),
    excluded: checked.filter((c) => c.errors.length),
  };
}

export function claimTable(claims: Claim[]): string[][] {
  return [[...CMS1500_COLUMNS], ...claims.flatMap((c) => c.rows.map((r) => CMS1500_COLUMNS.map((k) => r[k])))];
}

export function exceptionsTable(claims: Claim[]): string[][] {
  return [['PATIENT_ID', 'PATIENT', 'PROCEDURE_CODES', 'ERRORS'], ...claims.map((c) => [c.mrn, c.name, c.rows.map((r) => r.PROCEDURE_CODE).join(' '), c.errors.join(' | ')])];
}

export type { Patient };
