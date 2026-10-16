import type { ReadingType, RuleCode } from './types';

export type Condition =
  | 'hypertension'
  | 'heart_failure'
  | 'diabetes'
  | 'copd'
  | 'afib'
  | 'ckd'
  | 'depression'
  | 'dementia'
  | 'osteoporosis'
  | 'osteoarthritis'
  | 'hyperlipidemia'
  | 'hypothyroidism'
  | 'cad'
  | 'asthma';

/** ICD-10 codes this prototype treats as qualifying chronic conditions. */
export const QUALIFYING_CODES: Record<string, { name: string; condition: Condition }> = {
  I10: { name: 'Essential (primary) hypertension', condition: 'hypertension' },
  'I50.9': { name: 'Heart failure, unspecified', condition: 'heart_failure' },
  'N18.3': { name: 'Chronic kidney disease, stage 3', condition: 'ckd' },
  'E11.9': { name: 'Type 2 diabetes mellitus without complications', condition: 'diabetes' },
  'J44.9': { name: 'Chronic obstructive pulmonary disease, unspecified', condition: 'copd' },
  'I48.91': { name: 'Unspecified atrial fibrillation', condition: 'afib' },
  'M19.90': { name: 'Unspecified osteoarthritis, unspecified site', condition: 'osteoarthritis' },
  'F32.A': { name: 'Depression, unspecified', condition: 'depression' },
  'E78.5': { name: 'Hyperlipidemia, unspecified', condition: 'hyperlipidemia' },
  'E03.9': { name: 'Hypothyroidism, unspecified', condition: 'hypothyroidism' },
  'F03.90': { name: 'Unspecified dementia without behavioral disturbance', condition: 'dementia' },
  'M81.0': { name: 'Age-related osteoporosis without current pathological fracture', condition: 'osteoporosis' },
  'I25.10': { name: 'Atherosclerotic heart disease of native coronary artery', condition: 'cad' },
  'J45.909': { name: 'Unspecified asthma, uncomplicated', condition: 'asthma' },
  'E11.65': { name: 'Type 2 diabetes mellitus with hyperglycemia', condition: 'diabetes' },
  'N18.4': { name: 'Chronic kidney disease, stage 4', condition: 'ckd' },
};

export const ICD10_PATTERN = /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/;

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

export function qualifyingCodes(codes: string[]): string[] {
  return codes.filter((c) => c in QUALIFYING_CODES);
}

export function codeName(code: string): string {
  return QUALIFYING_CODES[code]?.name ?? code;
}

export function defaultSetupFor(codes: string[]): { readings: ReadingType[]; rules: RuleCode[] } {
  const readings = new Set<ReadingType>();
  const rules = new Set<RuleCode>();
  for (const code of codes) {
    const q = QUALIFYING_CODES[code];
    if (!q) continue;
    const s = CONDITION_SETUP[q.condition];
    s.readings.forEach((r) => readings.add(r));
    s.rules.forEach((r) => rules.add(r));
  }
  return {
    readings: READING_ORDER.filter((r) => readings.has(r)),
    rules: RULE_ORDER.filter((r) => rules.has(r)),
  };
}
