// The fuzzy column mapper: proposes which column of an EHR export holds each
// roster field. Each header is scored against the field's synonyms (exact
// match, whole-phrase containment, then Jaro-Winkler similarity), and the
// best pairs are assigned one-to-one. Ops confirms or changes the proposal.

export type FieldKey =
  | 'patient_id'
  | 'first_name'
  | 'last_name'
  | 'dob'
  | 'insurance_name'
  | 'insurance_id'
  | 'diagnosis_codes'
  | 'phone'
  | 'sex'
  | 'last_visit_date'
  | 'is_qmb'
  | 'state'
  | 'caregiver_name'
  | 'caregiver_phone'
  | 'preferred_language'
  | 'consent_date'
  | 'consent_method'
  | 'automated_calls_ok'
  | 'texts_ok';

export interface FieldDef {
  key: FieldKey;
  label: string;
  required: boolean;
  synonyms: string[];
}

export const FIELDS: FieldDef[] = [
  { key: 'patient_id', label: 'Patient_ID', required: true, synonyms: ['patient id', 'mrn', 'medical record number', 'chart number', 'account number', 'acct', 'pt id', 'person id', 'patient number'] },
  { key: 'first_name', label: 'First_Name', required: true, synonyms: ['first name', 'first', 'given name', 'fname', 'patient first name', 'pt first'] },
  { key: 'last_name', label: 'Last_Name', required: true, synonyms: ['last name', 'last', 'surname', 'family name', 'lname', 'patient last name', 'pt last'] },
  { key: 'dob', label: 'DOB', required: true, synonyms: ['dob', 'date of birth', 'birth date', 'birthdate', 'birthday', 'patient dob'] },
  { key: 'insurance_name', label: 'Primary_Insurance_Name', required: true, synonyms: ['primary insurance', 'primary insurance name', 'insurance', 'insurance name', 'payer', 'primary payer', 'payor', 'plan', 'plan name', 'coverage', 'carrier'] },
  { key: 'insurance_id', label: 'Insurance_ID', required: true, synonyms: ['insurance id', 'member id', 'subscriber id', 'policy number', 'policy id', 'mbi', 'medicare id', 'medicare number', 'insured id', 'ins id'] },
  { key: 'diagnosis_codes', label: 'Diagnosis_Codes_List', required: true, synonyms: ['diagnosis codes', 'diagnosis codes list', 'dx codes', 'dx', 'icd10', 'icd 10 codes', 'icd10 codes', 'icd codes', 'diagnoses', 'problem list', 'active problems'] },
  { key: 'phone', label: 'Phone', required: true, synonyms: ['phone', 'phone number', 'home phone', 'mobile', 'cell phone', 'contact number', 'telephone', 'primary phone'] },
  { key: 'sex', label: 'Sex', required: false, synonyms: ['sex', 'gender', 'birth sex', 'sex at birth'] },
  { key: 'last_visit_date', label: 'Last_Visit_Date', required: false, synonyms: ['last visit', 'last visit date', 'last seen', 'last appointment', 'last office visit', 'last encounter', 'date last seen'] },
  { key: 'is_qmb', label: 'QMB', required: false, synonyms: ['qmb', 'is qmb', 'qmb status', 'qualified medicare beneficiary'] },
  { key: 'state', label: 'State', required: false, synonyms: ['state', 'st', 'state code'] },
  { key: 'caregiver_name', label: 'Caregiver_Name', required: false, synonyms: ['caregiver', 'caregiver name', 'emergency contact', 'family contact'] },
  { key: 'caregiver_phone', label: 'Caregiver_Phone', required: false, synonyms: ['caregiver phone', 'emergency contact phone', 'family contact phone'] },
  { key: 'preferred_language', label: 'Preferred_Language', required: false, synonyms: ['preferred language', 'language', 'primary language'] },
  { key: 'consent_date', label: 'Consent_Date', required: false, synonyms: ['consent date', 'ccm consent date', 'consented on'] },
  { key: 'consent_method', label: 'Consent_Method', required: false, synonyms: ['consent method', 'consent type', 'how consented'] },
  { key: 'automated_calls_ok', label: 'Automated_Calls_OK', required: false, synonyms: ['automated calls ok', 'automated calls', 'robocall ok', 'ivr ok'] },
  { key: 'texts_ok', label: 'Texts_OK', required: false, synonyms: ['texts ok', 'text ok', 'sms ok', 'texts', 'sms consent'] },
];

export const REQUIRED_FIELDS: FieldKey[] = FIELDS.filter((f) => f.required).map((f) => f.key);

export interface MappingCell {
  /** Index of the source column, or null when nothing maps. */
  column: number | null;
  score: number;
  source: 'saved' | 'auto' | 'manual' | 'none';
}

export type Mapping = Record<FieldKey, MappingCell>;

/** Lowercase words: "Pt_DOB (mm/dd)" becomes "pt dob mm dd". */
export function normalizeHeader(h: string): string {
  return h
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array<boolean>(a.length).fill(false);
  const bm = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bm[j] || a[i] !== b[j]) continue;
      am[i] = bm[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** How well a header fits a field, 0–1. */
export function headerScore(header: string, field: FieldDef): number {
  const h = normalizeHeader(header);
  if (!h) return 0;
  const compact = h.replace(/ /g, '');
  const names = [field.key.replace(/_/g, ' '), normalizeHeader(field.label), ...field.synonyms];
  let best = 0;
  for (const n of names) {
    const nc = n.replace(/ /g, '');
    if (compact === nc) return 1;
    // "Primary Insurance Name (Payer)" contains "primary insurance name".
    if (n.includes(' ') && ` ${h} `.includes(` ${n} `)) best = Math.max(best, 0.9);
    // Similarity only between strings of similar length, so "Last Visit" never fits "last" (a typo fits, a prefix does not).
    if (Math.min(compact.length, nc.length) / Math.max(compact.length, nc.length) >= 0.6) {
      best = Math.max(best, jaroWinkler(compact, nc) * 0.95);
    }
  }
  return Math.round(best * 100) / 100;
}

export const AUTO_THRESHOLD = 0.82;

/** Greedy one-to-one assignment of the best header to each field. */
export function suggestMapping(headers: string[], saved?: Partial<Record<FieldKey, number | null>>): Mapping {
  const mapping = Object.fromEntries(FIELDS.map((f) => [f.key, { column: null, score: 0, source: 'none' }])) as Mapping;
  const used = new Set<number>();
  if (saved) {
    for (const f of FIELDS) {
      const col = saved[f.key];
      if (col != null && col < headers.length && !used.has(col)) {
        mapping[f.key] = { column: col, score: 1, source: 'saved' };
        used.add(col);
      }
    }
    return mapping;
  }
  const pairs: { field: FieldDef; column: number; score: number }[] = [];
  for (const field of FIELDS) {
    headers.forEach((h, column) => {
      const score = headerScore(h, field);
      if (score >= AUTO_THRESHOLD) pairs.push({ field, column, score });
    });
  }
  pairs.sort((a, b) => b.score - a.score || Number(b.field.required) - Number(a.field.required));
  for (const p of pairs) {
    if (mapping[p.field.key].column != null || used.has(p.column)) continue;
    mapping[p.field.key] = { column: p.column, score: p.score, source: 'auto' };
    used.add(p.column);
  }
  return mapping;
}

export function missingRequired(mapping: Mapping): FieldKey[] {
  return REQUIRED_FIELDS.filter((k) => mapping[k].column == null);
}

/** A stable key for a file layout, so a confirmed mapping is reused next month. */
export function headerSignature(headers: string[]): string {
  return headers.map(normalizeHeader).join('|');
}

export function fieldLabel(key: FieldKey): string {
  return FIELDS.find((f) => f.key === key)!.label;
}
