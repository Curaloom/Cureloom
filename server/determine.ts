// Program determination for a roster row: which program and tier the patient
// qualifies for, how sure the system is, and what the month would bring in.
// The system proposes; Ops approves, overrides or rejects in the matrix.

import type { BillingSettings, BillingCode } from '../shared/constants';
import { distinctConditions, chronicMatches, type MatrixRow } from '../shared/icd10';
import { baseCode, COVERAGE_LABEL, programBlock, tierLabel } from '../shared/program';
import { fmtDate, isWithinMonths } from '../shared/time';
import type { Coverage, Program } from '../shared/types';
import type { PayerClass } from './payer';

export interface DeterminationInput {
  codes: string[];
  /** How many codes had to be repaired, e.g. "E119" read as "E11.9". */
  repaired: number;
  payer: PayerClass;
  isQmb: boolean;
  lastVisit: string | null;
}

export interface Determination {
  status: 'eligible_unconfirmed' | 'ineligible' | 'needs_visit';
  /** The proposed program, also kept for patients who need a visit first. */
  program: Program | null;
  code: BillingCode | null;
  tier: string;
  reason: string | null;
  label: string;
  conditions: number;
  confidence: number;
  reasons: string[];
  /** Projected gross revenue per month at the practice's fee schedule. */
  monthly: number;
}

const PAYER_FACTOR = { high: 1, medium: 0.75, low: 0.4 } as const;

export function proposeProgram(coverage: Coverage, conditions: number, qmb: boolean, settings: BillingSettings): Program | null {
  if (coverage === 'other') return null;
  if (coverage === 'advantage') return conditions >= 2 ? 'ccm' : null;
  if (coverage === 'vbc') return 'apcm';
  if (conditions >= 2 && !qmb) return settings.twoPlusDefault;
  return 'apcm';
}

export function determine(input: DeterminationInput, today: string, settings: BillingSettings, matrix: MatrixRow[]): Determination {
  const { payer } = input;
  const matches = chronicMatches(input.codes, matrix);
  const conditions = distinctConditions(input.codes, matrix).length;
  const reasons: string[] = [];

  reasons.push(`Payer read as ${payer.label} (${payer.confidence} match).`);
  let icd = 0.5;
  if (matches.length) {
    icd = matches.reduce((s, m) => s + (m.match === 'exact' ? 1 : 0.9), 0) / matches.length;
    const cats = matches.filter((m) => m.match === 'category').map((m) => m.code);
    reasons.push(
      `${conditions} chronic condition${conditions === 1 ? '' : 's'} from ${matches.length} code${matches.length === 1 ? '' : 's'}${cats.length ? `; ${cats.join(', ')} matched by category` : ''}.`,
    );
  } else reasons.push('No recognised chronic condition code.');
  if (input.repaired) {
    icd -= 0.05;
    reasons.push(`${input.repaired} code${input.repaired === 1 ? '' : 's'} repaired (decimal point added).`);
  }
  const confidence = Math.max(0, Math.min(100, Math.round(100 * PAYER_FACTOR[payer.confidence] * icd)));

  const program = proposeProgram(payer.coverage, conditions, input.isQmb, settings);
  const code = program ? baseCode(program, conditions, input.isQmb) : null;
  const base = { program, code, tier: tierLabel(code), conditions, confidence, reasons, monthly: code ? settings.fees[code] : 0 };

  if (!program) {
    const why =
      payer.coverage === 'advantage'
        ? `${COVERAGE_LABEL.advantage}: CCM needs 2+ chronic conditions and APCM is not covered`
        : programBlock('apcm', payer.coverage, conditions) ?? 'not eligible';
    return { ...base, status: 'ineligible', reason: why, label: `not eligible: ${why}` };
  }
  if (!input.lastVisit || !isWithinMonths(input.lastVisit, today, 12)) {
    const reason = input.lastVisit ? `needs a visit, last seen ${fmtDate(input.lastVisit)}` : 'needs a visit, no visit on record';
    return { ...base, status: 'needs_visit', reason, label: reason };
  }
  return { ...base, status: 'eligible_unconfirmed', reason: null, label: `eligible for ${base.tier} (${code}), awaiting Ops review` };
}
