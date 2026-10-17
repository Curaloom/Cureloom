// Classifies the free-text payer name from the EHR export. Known names match
// with high confidence; keyword rules with medium; anything unrecognised is
// "other" (not eligible) with low confidence, so Ops looks at it.

import type { Coverage } from '../shared/types';

export interface PayerClass {
  coverage: Coverage;
  /** Medicare plus Medicaid. */
  dual: boolean;
  qmb: boolean;
  confidence: 'high' | 'medium' | 'low';
  label: string;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const TRADITIONAL = new Set([
  'traditional',
  'traditional medicare',
  'original medicare',
  'medicare',
  'medicare ffs',
  'medicare fee for service',
  'medicare part b',
  'medicare part a b',
  'medicare a b',
  'ffs',
]);
const ADVANTAGE = new Set(['advantage', 'medicare advantage', 'ma', 'part c', 'medicare part c']);
const NOT_MEDICARE = new Set(['medicaid', 'commercial', 'self pay', 'self-pay', 'none', 'uninsured']);

export function classifyPayer(name: string, valueBasedPayers: string[] = []): PayerClass {
  const n = norm(name);
  const qmb = /\bqmb\b/.test(n);
  if (!n) return { coverage: 'other', dual: false, qmb: false, confidence: 'low', label: 'No payer given' };
  if (valueBasedPayers.some((v) => norm(v) === n))
    return { coverage: 'vbc', dual: false, qmb, confidence: 'high', label: `Value-based: ${name.trim()}` };
  if (valueBasedPayers.some((v) => norm(v) && n.includes(norm(v))))
    return { coverage: 'vbc', dual: false, qmb, confidence: 'medium', label: `Value-based: ${name.trim()}` };
  if (TRADITIONAL.has(n)) return { coverage: 'traditional', dual: false, qmb: false, confidence: 'high', label: 'Traditional Medicare' };
  if (ADVANTAGE.has(n)) return { coverage: 'advantage', dual: false, qmb: false, confidence: 'high', label: 'Medicare Advantage' };
  if (NOT_MEDICARE.has(n)) return { coverage: 'other', dual: false, qmb: false, confidence: 'high', label: 'Not Medicare' };

  const medicare = /\bmedicare\b/.test(n);
  const medicaid = /\b(medicaid|medi cal|qmb|dual|slmb)\b/.test(n);
  if (/\b(d ?snp|dual special needs|mmp|medicare medicaid plan)\b/.test(n))
    return { coverage: 'advantage', dual: true, qmb, confidence: 'medium', label: 'Medicare Advantage (dual special needs plan)' };
  if (/\badvantage\b|gold plus|medicare complete|\bpart c\b/.test(n) || (medicare && /\b(hmo|ppo|pffs|snp)\b/.test(n)))
    return { coverage: 'advantage', dual: false, qmb: false, confidence: 'medium', label: 'Medicare Advantage' };
  if (medicare && medicaid)
    return { coverage: 'traditional', dual: true, qmb, confidence: 'medium', label: `Traditional Medicare + Medicaid${qmb ? ' (QMB)' : ''}` };
  if (medicare || /\bpart b\b|original medicare/.test(n))
    return { coverage: 'traditional', dual: false, qmb: false, confidence: 'medium', label: 'Traditional Medicare' };
  if (medicaid) return { coverage: 'other', dual: false, qmb: false, confidence: 'medium', label: 'Medicaid only' };
  return { coverage: 'other', dual: false, qmb: false, confidence: 'low', label: 'Not Medicare (unrecognised payer)' };
}
