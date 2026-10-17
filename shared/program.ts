// Which program and code a patient qualifies for. Used by the roster
// determination, the billing engine and the call setup screen.
//
// CCM (99490, complex 99487) covers traditional Medicare and Medicare
// Advantage, with 2+ chronic conditions. APCM covers traditional Medicare and
// participating value-based payers: Level 1 G0556 for one condition or fewer,
// Level 2 G0557 for 2+, Level 3 G0558 for QMB patients with 2+.

import type { BillingCode } from './constants';
import type { Coverage, Program } from './types';

export function apcmCode(conditions: number, qmb: boolean): BillingCode {
  if (conditions <= 1) return 'G0556';
  return qmb ? 'G0558' : 'G0557';
}

export function baseCode(program: Program, conditions: number, qmb: boolean): BillingCode {
  return program === 'ccm' ? '99490' : apcmCode(conditions, qmb);
}

export function tierLabel(code: BillingCode | null): string {
  switch (code) {
    case '99490':
    case '99439':
      return 'CCM';
    case '99487':
    case '99489':
      return 'Complex CCM';
    case 'G0556':
      return 'APCM Level 1';
    case 'G0557':
      return 'APCM Level 2';
    case 'G0558':
      return 'APCM Level 3';
    default:
      return '—';
  }
}

export const COVERAGE_LABEL: Record<Coverage, string> = {
  traditional: 'Traditional Medicare',
  advantage: 'Medicare Advantage',
  vbc: 'Value-based payer',
  other: 'Not Medicare',
};

/** Why `program` is not allowed for this patient, or null when it is. */
export function programBlock(program: Program, coverage: Coverage, conditions: number): string | null {
  if (coverage === 'other') return 'payer is not Medicare or a participating value-based payer';
  if (program === 'ccm') {
    if (coverage === 'vbc') return 'CCM is billed to Medicare; this value-based payer covers APCM';
    if (conditions < 2) return 'CCM needs 2 or more chronic conditions';
    return null;
  }
  if (coverage === 'advantage') return 'APCM is not covered under Medicare Advantage';
  return null;
}
