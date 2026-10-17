import { chronicMatches, distinctConditions, icdName, DEFAULT_MATRIX, type Condition, type MatrixRow } from './icd10';
import type { ReadingType, RuleCode } from './types';

export type { Condition } from './icd10';
export { ICD10_PATTERN } from './icd10';

/**
 * What each condition adds to the call setup: readings to ask for and the
 * matching red-flag rules. Hypertension adds blood pressure, diabetes adds
 * glucose, heart failure adds weight, COPD adds oxygen.
 */
export const CONDITION_SETUP: Record<Condition, { readings: ReadingType[]; rules: RuleCode[] }> = {
  hypertension: { readings: ['bp'], rules: ['chest_pain', 'stroke_signs'] },
  heart_failure: {
    readings: ['weight'],
    rules: ['chest_pain', 'breathing_severe', 'fainting', 'weight_gain', 'leg_swelling'],
  },
  diabetes: { readings: ['glucose'], rules: ['low_glucose_spells'] },
  copd: { readings: ['oxygen'], rules: ['breathing_severe', 'rescue_inhaler'] },
  afib: { readings: [], rules: ['stroke_signs', 'fainting', 'palpitations'] },
  ckd: { readings: [], rules: ['leg_swelling'] },
  depression: { readings: [], rules: ['self_harm', 'low_mood'] },
  dementia: { readings: [], rules: ['falls', 'confusion'] },
  osteoporosis: { readings: [], rules: ['falls'] },
  osteoarthritis: { readings: [], rules: ['falls'] },
  hyperlipidemia: { readings: [], rules: ['chest_pain'] },
  hypothyroidism: { readings: [], rules: [] },
  cad: { readings: [], rules: ['chest_pain'] },
  asthma: { readings: [], rules: ['breathing_severe', 'rescue_inhaler'] },
  anxiety: { readings: [], rules: ['self_harm'] },
  rheumatoid_arthritis: { readings: [], rules: ['falls'] },
  stroke: { readings: ['bp'], rules: ['stroke_signs', 'falls'] },
  parkinsons: { readings: [], rules: ['falls', 'confusion'] },
  pad: { readings: [], rules: ['chest_pain'] },
  obesity: { readings: [], rules: [] },
  glaucoma: { readings: [], rules: ['falls'] },
};

export const READING_ORDER: ReadingType[] = ['bp', 'glucose', 'weight', 'oxygen'];

/** Urgent rules are asked first so a call reaches them early. */
export const RULE_ORDER: RuleCode[] = [
  'chest_pain',
  'breathing_severe',
  'stroke_signs',
  'fainting',
  'self_harm',
  'rescue_inhaler',
  'weight_gain',
  'leg_swelling',
  'palpitations',
  'low_glucose_spells',
  'low_mood',
  'confusion',
  'falls',
];

/** The chronic codes among `codes`, in order (every code that matches the matrix). */
export function qualifyingCodes(codes: string[], matrix: MatrixRow[] = DEFAULT_MATRIX): string[] {
  return chronicMatches(codes, matrix).map((m) => m.code);
}

/** How many distinct chronic conditions the codes cover. */
export function conditionCount(codes: string[], matrix: MatrixRow[] = DEFAULT_MATRIX): number {
  return distinctConditions(codes, matrix).length;
}

export function codeName(code: string): string {
  return icdName(code);
}

export function defaultSetupFor(codes: string[]): { readings: ReadingType[]; rules: RuleCode[] } {
  const readings = new Set<ReadingType>();
  const rules = new Set<RuleCode>();
  for (const m of chronicMatches(codes)) {
    const s = CONDITION_SETUP[m.condition];
    s.readings.forEach((r) => readings.add(r));
    s.rules.forEach((r) => rules.add(r));
  }
  return {
    readings: READING_ORDER.filter((r) => readings.has(r)),
    rules: RULE_ORDER.filter((r) => rules.has(r)),
  };
}
