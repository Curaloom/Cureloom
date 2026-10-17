// Billing is one function over the tables, re-run after every change so the
// billing list updates live. It writes month_close rows (with every claim
// line) and logs a billing.status event whenever a patient's status or reason
// changes, and billing.upgraded when a month moves to complex CCM.

import type { BillingView } from '../shared/api';
import {
  CCM_ADDON_MAX,
  CCM_ADDON_MINUTES,
  CCM_MINUTES,
  COMPLEX_ADDON_MINUTES,
  COMPLEX_MINUTES,
  type BillingCode,
} from '../shared/constants';
import type { ClaimLine, Patient } from '../shared/model';
import { baseCode } from '../shared/program';
import { floorMinutes } from '../shared/time';
import type { Complexity, Program } from '../shared/types';
import type { Service } from './service';
import { isEnrolled } from './service';

export function billingCode(svc: Service, p: Patient): BillingCode | null {
  return p.program ? baseCode(p.program, svc.conditionCount(p), p.is_qmb) : null;
}

/**
 * The claim lines a month earns. CCM: 99490 at 20 minutes plus one 99439 per
 * further full 20 (two at most). Complex CCM, only when the physician marked
 * the month moderate/high complexity: 99487 at 60 minutes plus one 99489 per
 * further full 30. APCM: one G-code by tier, no time rule.
 */
export function billingLines(
  input: { program: Program; minutes: number; complexity: Complexity; conditions: number; qmb: boolean },
  fees: Record<BillingCode, number>,
): ClaimLine[] {
  const line = (code: BillingCode, units: number): ClaimLine => ({ code, units, amount: Math.round(fees[code] * units * 100) / 100 });
  const m = input.minutes;
  if (input.program === 'apcm') return [line(baseCode('apcm', input.conditions, input.qmb), 1)];
  if (input.complexity === 'complex' && m >= COMPLEX_MINUTES) {
    const add = Math.floor((m - COMPLEX_MINUTES) / COMPLEX_ADDON_MINUTES);
    return add > 0 ? [line('99487', 1), line('99489', add)] : [line('99487', 1)];
  }
  if (m < CCM_MINUTES) return [];
  const add = Math.min(CCM_ADDON_MAX, Math.floor((m - CCM_MINUTES) / CCM_ADDON_MINUTES));
  return add > 0 ? [line('99490', 1), line('99439', add)] : [line('99490', 1)];
}

export function linesTotal(lines: ClaimLine[]): number {
  return Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
}

function notEnrolledReason(p: Patient): string {
  switch (p.status) {
    case 'eligible_unconfirmed':
      return p.ops_decision === 'held' ? 'held in Ops review' : 'awaiting Ops review';
    case 'confirmed':
      return 'no consent yet';
    case 'ineligible':
      return `not eligible: ${p.ineligible_reason ?? 'see roster'}`;
    case 'needs_visit':
      return p.ineligible_reason ?? 'needs a visit';
    default:
      return 'not enrolled';
  }
}

export function billingFor(svc: Service, p: Patient, month: string): BillingView {
  const minutes = floorMinutes(svc.countedSeconds(p.id, month));
  const code = billingCode(svc, p);
  const mc = svc.monthCloseOf(p.id, month);
  const complexity: Complexity = mc?.complexity ?? 'standard';
  const lines = p.program
    ? billingLines({ program: p.program, minutes, complexity, conditions: svc.conditionCount(p), qmb: p.is_qmb }, svc.settings().fees)
    : [];
  const primary = lines[0]?.code ?? code;
  /** `ruleMet`: the program rule is met and only paperwork is left, so the lines are shown. */
  const held = (reason: string, awaitingAttestation = false, ruleMet = awaitingAttestation): BillingView => ({
    status: 'held',
    reason,
    code: primary,
    amount: null,
    minutes,
    lines: ruleMet ? lines : [],
    awaitingAttestation,
    complexity,
  });
  if (!isEnrolled(p))
    return { status: 'not_enrolled', reason: notEnrolledReason(p), code: null, amount: null, minutes, lines: [], awaitingAttestation: false, complexity };
  if (p.status === 'paused') {
    const r = p.ineligible_reason ?? 'paused';
    return held(/^Medicare Advantage/i.test(r) ? `paused, now ${r}` : `paused, ${r}`);
  }
  if (p.status === 'consented' || !p.program) return held('call setup not finished');
  if (p.status === 'plan_review' || !svc.approvedPlan(p.id)) return held('care plan not approved');

  const contacts = svc.completedContacts(p.id, month);
  const revoked = svc.consentOf(p.id)?.revoked_at ?? null;
  const contactBeforeStop = contacts.some((c) => !revoked || (c.started_at ?? '') <= revoked);
  const service = p.program === 'ccm' ? minutes >= CCM_MINUTES : contactBeforeStop;
  if (p.status === 'opted_out' && !service) return held('opted out, no service');
  if (p.program === 'ccm' && minutes < CCM_MINUTES) return held(`under ${CCM_MINUTES} minutes (${minutes})`);
  if (p.program === 'apcm' && !contacts.length) return held('no completed contact');

  if (!mc?.filed_at) return held('note not filed in EHR', false, true);
  if (!mc.attested_at) return held('awaiting physician attestation', true);
  return { status: 'ready', reason: null, code: primary, amount: linesTotal(lines), minutes, lines, awaitingAttestation: false, complexity };
}

export function evaluateBilling(svc: Service, silent = false): void {
  const month = svc.month();
  for (const p of svc.patients()) {
    const b = billingFor(svc, p, month);
    if (b.status === 'not_enrolled') continue;
    const status = b.status as 'ready' | 'held';
    const lines = JSON.stringify(b.lines);
    const existing = svc.monthCloseOf(p.id, month);
    if (!existing) {
      svc.db
        .prepare(
          'INSERT INTO month_close (patient_id, month, billing_status, held_reason, code, amount, lines) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(p.id, month, status, b.reason, b.code, b.amount, lines);
    } else if (
      existing.billing_status !== status ||
      existing.held_reason !== b.reason ||
      existing.code !== b.code ||
      existing.amount !== b.amount ||
      JSON.stringify(existing.lines) !== lines
    ) {
      svc.db
        .prepare(
          'UPDATE month_close SET billing_status = ?, held_reason = ?, code = ?, amount = ?, lines = ? WHERE patient_id = ? AND month = ?',
        )
        .run(status, b.reason, b.code, b.amount, lines, p.id, month);
    } else continue;
    if (silent) continue;
    if (existing && existing.code !== '99487' && b.code === '99487') {
      svc.log('billing.upgraded', `Billing code upgraded to complex CCM: ${b.lines.map((l) => `${l.code} ×${l.units}`).join(', ')} (${b.minutes} min, complexity marked by the physician).`, p.id, 'System');
    }
    if (existing && existing.billing_status === status && existing.held_reason === b.reason) continue;
    svc.log(
      'billing.status',
      status === 'ready'
        ? `Billing: ready — ${b.lines.map((l) => (l.units > 1 ? `${l.code} ×${l.units}` : l.code)).join(' + ')} ($${b.amount!.toFixed(2)}).`
        : `Billing: held — ${b.reason}.`,
      p.id,
      'System',
    );
  }
}
