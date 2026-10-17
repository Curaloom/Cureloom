// The chronic-condition ICD-10 matrix. Codes match by category prefix
// (longest prefix wins), so E11.22 qualifies through E11 even though only a
// few full codes carry display names. The server loads this matrix into the
// icd10_chronic table on reset; lookups take the matrix as a parameter so
// the server can use its loaded copy and the client this one.

export type Condition =
  | 'hypertension'
  | 'heart_failure'
  | 'cad'
  | 'afib'
  | 'hyperlipidemia'
  | 'diabetes'
  | 'ckd'
  | 'copd'
  | 'asthma'
  | 'depression'
  | 'anxiety'
  | 'dementia'
  | 'osteoporosis'
  | 'osteoarthritis'
  | 'rheumatoid_arthritis'
  | 'hypothyroidism'
  | 'stroke'
  | 'parkinsons'
  | 'pad'
  | 'obesity'
  | 'glaucoma';

export interface ConditionGroup {
  condition: Condition;
  label: string;
  /** ICD-10 category prefixes, with the decimal point where it belongs. */
  prefixes: string[];
}

export const CHRONIC_GROUPS: ConditionGroup[] = [
  { condition: 'hypertension', label: 'Hypertension', prefixes: ['I10', 'I11', 'I12', 'I13', 'I15'] },
  { condition: 'heart_failure', label: 'Heart failure', prefixes: ['I50'] },
  { condition: 'cad', label: 'Coronary artery disease', prefixes: ['I20', 'I25'] },
  { condition: 'afib', label: 'Atrial fibrillation or flutter', prefixes: ['I48'] },
  { condition: 'hyperlipidemia', label: 'Hyperlipidemia', prefixes: ['E78'] },
  { condition: 'diabetes', label: 'Diabetes mellitus', prefixes: ['E08', 'E09', 'E10', 'E11', 'E13'] },
  { condition: 'ckd', label: 'Chronic kidney disease', prefixes: ['N18'] },
  { condition: 'copd', label: 'COPD and chronic bronchitis', prefixes: ['J41', 'J42', 'J43', 'J44'] },
  { condition: 'asthma', label: 'Asthma', prefixes: ['J45'] },
  { condition: 'depression', label: 'Depression', prefixes: ['F32', 'F33'] },
  { condition: 'anxiety', label: 'Generalized anxiety disorder', prefixes: ['F41.1'] },
  { condition: 'dementia', label: "Dementia and Alzheimer's disease", prefixes: ['F01', 'F02', 'F03', 'G30'] },
  { condition: 'osteoporosis', label: 'Osteoporosis', prefixes: ['M80', 'M81'] },
  { condition: 'osteoarthritis', label: 'Osteoarthritis', prefixes: ['M15', 'M16', 'M17', 'M18', 'M19'] },
  { condition: 'rheumatoid_arthritis', label: 'Rheumatoid arthritis', prefixes: ['M05', 'M06'] },
  { condition: 'hypothyroidism', label: 'Hypothyroidism', prefixes: ['E03'] },
  { condition: 'stroke', label: 'Stroke, late effects', prefixes: ['I69'] },
  { condition: 'parkinsons', label: "Parkinson's disease", prefixes: ['G20'] },
  { condition: 'pad', label: 'Peripheral artery disease', prefixes: ['I70.2', 'I73.9'] },
  { condition: 'obesity', label: 'Obesity', prefixes: ['E66'] },
  { condition: 'glaucoma', label: 'Glaucoma', prefixes: ['H40'] },
];

/** Display names for full codes the practice sees most. Other codes show their group label. */
export const CODE_NAMES: Record<string, string> = {
  I10: 'Essential (primary) hypertension',
  'I50.9': 'Heart failure, unspecified',
  'N18.30': 'Chronic kidney disease, stage 3 unspecified',
  'N18.31': 'Chronic kidney disease, stage 3a',
  'N18.32': 'Chronic kidney disease, stage 3b',
  'N18.4': 'Chronic kidney disease, stage 4',
  'E11.9': 'Type 2 diabetes mellitus without complications',
  'E11.65': 'Type 2 diabetes mellitus with hyperglycemia',
  'J44.9': 'Chronic obstructive pulmonary disease, unspecified',
  'I48.91': 'Unspecified atrial fibrillation',
  'M19.90': 'Unspecified osteoarthritis, unspecified site',
  'F32.A': 'Depression, unspecified',
  'E78.5': 'Hyperlipidemia, unspecified',
  'E03.9': 'Hypothyroidism, unspecified',
  'F03.90': 'Unspecified dementia without behavioral disturbance',
  'M81.0': 'Age-related osteoporosis without current pathological fracture',
  'I25.10': 'Atherosclerotic heart disease of native coronary artery',
  'J45.909': 'Unspecified asthma, uncomplicated',
};

export const ICD10_PATTERN = /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/;

export interface MatrixRow {
  prefix: string;
  condition: Condition;
  label: string;
}

export function matrixRows(groups: ConditionGroup[] = CHRONIC_GROUPS): MatrixRow[] {
  return groups.flatMap((g) => g.prefixes.map((prefix) => ({ prefix, condition: g.condition, label: g.label })));
}

export const DEFAULT_MATRIX: MatrixRow[] = matrixRows();

export interface NormalizedCode {
  code: string;
  /** True when the input had to be repaired, e.g. "E119" to "E11.9". */
  repaired: boolean;
}

/** Uppercases, trims and puts the decimal point back after the third character. */
export function normalizeIcd(raw: string): NormalizedCode | null {
  const trimmed = raw.trim().toUpperCase();
  const bare = trimmed.replace(/[\s.]/g, '');
  if (!bare) return null;
  const code = bare.length > 3 ? `${bare.slice(0, 3)}.${bare.slice(3)}` : bare;
  if (!ICD10_PATTERN.test(code)) return null;
  return { code, repaired: code !== trimmed };
}

/** The code without its decimal point, as claim forms want it. */
export function stripDecimal(code: string): string {
  return code.replace(/\./g, '');
}

export interface ChronicMatch {
  code: string;
  condition: Condition;
  label: string;
  /** exact: a full code with a known name; category: matched by its category prefix only. */
  match: 'exact' | 'category';
}

export function lookupChronic(code: string, matrix: MatrixRow[] = DEFAULT_MATRIX): ChronicMatch | null {
  const bare = stripDecimal(code);
  let best: MatrixRow | null = null;
  for (const row of matrix) {
    const p = stripDecimal(row.prefix);
    if (bare.startsWith(p) && (!best || p.length > stripDecimal(best.prefix).length)) best = row;
  }
  if (!best) return null;
  return { code, condition: best.condition, label: best.label, match: code in CODE_NAMES ? 'exact' : 'category' };
}

/** Chronic codes in the order given, one entry per code. */
export function chronicMatches(codes: string[], matrix: MatrixRow[] = DEFAULT_MATRIX): ChronicMatch[] {
  return codes.map((c) => lookupChronic(c, matrix)).filter((m): m is ChronicMatch => !!m);
}

/** Distinct chronic conditions: E11.9 and E11.65 are one condition. */
export function distinctConditions(codes: string[], matrix: MatrixRow[] = DEFAULT_MATRIX): ChronicMatch[] {
  const seen = new Set<Condition>();
  return chronicMatches(codes, matrix).filter((m) => (seen.has(m.condition) ? false : (seen.add(m.condition), true)));
}

export function icdName(code: string, matrix: MatrixRow[] = DEFAULT_MATRIX): string {
  return CODE_NAMES[code] ?? lookupChronic(code, matrix)?.label ?? code;
}
