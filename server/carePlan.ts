// The comprehensive care plan: compiled from what is stored for the patient
// (conditions, call setup, consent, program), never written by the system on
// its own judgement. The physician approves each version; every approval
// stores a SHA-256 hash chained to the patient's previous approval, so any
// later edit to an approved plan or its signature record is detectable.
// This is a tamper-evident record, not encryption.

import { createHash } from 'node:crypto';
import { CONDITION_SETUP } from '../shared/codes';
import { STAFF } from '../shared/constants';
import { icdName, type Condition } from '../shared/icd10';
import type { CarePlan, CarePlanContent, Patient } from '../shared/model';
import { baseCode, tierLabel } from '../shared/program';
import { READINGS, RULES } from '../shared/rules';
import { fmtDate } from '../shared/time';
import type { Service } from './service';

/** Plain goals per condition. Targets come from the call setup where one applies. */
const GOALS: Partial<Record<Condition, string[]>> = {
  hypertension: ['Blood pressure below target at home readings', 'Take blood pressure medicines as prescribed'],
  heart_failure: ['Stable dry weight; report a gain of 3 lb in a day or 5 lb in a week', 'Limit salt and fluids as advised'],
  diabetes: ['Fasting glucose within target', 'Recognise and treat low blood sugar'],
  copd: ['Oxygen saturation at or above target', 'Know the action plan for flare-ups'],
  asthma: ['Fewer rescue inhaler uses', 'Know the action plan for flare-ups'],
  ckd: ['Avoid kidney-harming medicines; keep labs on schedule', 'Watch for swelling'],
  afib: ['Take anticoagulation as prescribed', 'Report palpitations, fainting or stroke signs'],
  depression: ['Mood check each month; safety plan on file', 'Keep behavioral health follow-up'],
  dementia: ['Caregiver support and home safety', 'Fall prevention'],
  osteoporosis: ['Fall prevention', 'Bone-health medicines as prescribed'],
  osteoarthritis: ['Pain and mobility managed', 'Fall prevention'],
  hyperlipidemia: ['Lipid-lowering medicine as prescribed'],
  hypothyroidism: ['Thyroid medicine taken daily; labs on schedule'],
  cad: ['Report chest pain at once', 'Cardiac medicines as prescribed'],
};

export function compileCarePlan(svc: Service, p: Patient): CarePlanContent {
  const setup = svc.setupOf(p.id);
  const consent = svc.consentOf(p.id);
  const program = p.program ?? p.proposed_program ?? 'ccm';
  const conditions = svc.conditionCount(p);
  const code = baseCode(program, conditions, p.is_qmb);
  const seen = new Set<string>();
  const problems: CarePlanContent['problems'] = [];
  for (const c of p.qualifying_codes) {
    const condition = svc.conditionOf(c);
    if (!condition || seen.has(condition)) continue;
    seen.add(condition);
    problems.push({ code: c, name: icdName(c), condition, goals: GOALS[condition] ?? ['Condition reviewed each month'] });
  }
  const t = setup?.targets;
  const targets: string[] = [];
  for (const r of setup?.readings ?? []) {
    if (r === 'bp' && t) targets.push(`Blood pressure below ${t.bp.sysMax}/${t.bp.diaMax}`);
    if (r === 'glucose' && t) targets.push(`Fasting glucose ${t.glucose.min}–${t.glucose.max} mg/dL`);
    if (r === 'weight' && t) targets.push(`Weight within ${t.weight.maxGain} lb of ${t.weight.baseline ?? 'baseline'}`);
    if (r === 'oxygen' && t) targets.push(`Oxygen at least ${t.oxygen.min}%`);
  }
  const symptoms = (setup?.symptoms_to_watch ?? []).map((r) => `${RULES[r].label} (${RULES[r].level === 'urgent' ? `urgent, ${RULES[r].escalation}` : 'concern'})`);
  const ai = program === 'apcm' && !!consent?.automated_calls_ok && !p.prefers_human;
  return {
    program,
    code,
    tier: tierLabel(code),
    problems,
    monitoring: {
      readings: (setup?.readings ?? []).map((r) => READINGS[r].label),
      targets,
      symptoms,
    },
    contact: ai ? 'Monthly AI check-in call, nurse follow-up on any concern' : 'Monthly nurse call',
    caregiver: p.caregiver_name ? `${p.caregiver_name}, ${p.caregiver_phone ?? 'no phone on file'}` : null,
    consent: consent
      ? `${consent.method === 'at_visit' ? 'At visit' : consent.method === 'digital_link' ? 'Signed consent link' : 'Nurse phone call'}, ${fmtDate(consent.consent_date)}`
      : 'No consent on file',
    team: [`${STAFF.physician.name} (billing practitioner)`, `${STAFF.nurse.name} (care manager)`],
  };
}

/** Readings and rules the conditions call for but the setup leaves out, for the physician to see. */
export function setupGaps(svc: Service, p: Patient): string[] {
  const setup = svc.setupOf(p.id);
  if (!setup) return [];
  const gaps: string[] = [];
  for (const c of p.qualifying_codes) {
    const condition = svc.conditionOf(c);
    if (!condition) continue;
    for (const r of CONDITION_SETUP[condition].readings) {
      if (!setup.readings.includes(r)) gaps.push(`${READINGS[r].label} not asked (${icdName(c)})`);
    }
  }
  return [...new Set(gaps)];
}

/** JSON with sorted keys, so the same content always hashes the same. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export interface ApprovalRecord {
  patientId: number;
  version: number;
  npi: string;
  approvedBy: string;
  approvedAt: string;
  content: CarePlanContent;
}

export function approvalHash(prevHash: string | null, r: ApprovalRecord): string {
  return sha256([prevHash ?? 'GENESIS', r.patientId, r.version, r.npi, r.approvedBy, r.approvedAt, canonicalJson(r.content)].join('|'));
}

/** Recomputes every approval hash in version order; reports the first version that does not match. */
export function verifyChain(plans: CarePlan[]): { ok: boolean; brokenAt: number | null; approvals: number } {
  let prev: string | null = null;
  let approvals = 0;
  for (const p of [...plans].sort((a, b) => a.version - b.version)) {
    if (!p.hash) continue;
    approvals++;
    const expected = approvalHash(prev, {
      patientId: p.patient_id,
      version: p.version,
      npi: p.approver_npi ?? '',
      approvedBy: p.approved_by ?? '',
      approvedAt: p.approved_at ?? '',
      content: p.content,
    });
    if (p.prev_hash !== prev || p.hash !== expected) return { ok: false, brokenAt: p.version, approvals };
    prev = p.hash;
  }
  return { ok: true, brokenAt: null, approvals };
}
