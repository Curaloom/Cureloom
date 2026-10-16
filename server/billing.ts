// Billing is one function over the tables, re-run after every change so the
// billing list updates live. It writes month_close rows and logs a
// billing.status event whenever a patient's status or reason changes.

import type { BillingView } from '../shared/api';
import { CCM_MINUTES, FEES, type BillingCode } from '../shared/constants';
import type { Patient } from '../shared/model';
import { floorMinutes } from '../shared/time';
import type { Service } from './service';
import { isEnrolled } from './service';

export function billingCode(p: Patient): BillingCode | null {
  if (p.program === 'ccm') return '99490';
  if (p.program === 'apcm') return p.is_qmb ? 'G0558' : 'G0557';
  return null;
}

function notEnrolledReason(p: Patient): string {
  switch (p.status) {
    case 'eligible_unconfirmed':
      return 'awaiting practice confirmation';
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
  const code = billingCode(p);
  const held = (reason: string, awaitingAttestation = false): BillingView => ({
    status: 'held',
    reason,
    code,
    amount: null,
    minutes,
    awaitingAttestation,
  });
  if (!isEnrolled(p)) return { status: 'not_enrolled', reason: notEnrolledReason(p), code: null, amount: null, minutes, awaitingAttestation: false };
  if (p.status === 'paused') {
    const r = p.ineligible_reason ?? 'paused';
    return held(/Medicare Advantage/i.test(r) ? 'paused, now Medicare Advantage' : `paused, ${r}`);
  }
  if (p.status === 'consented' || !p.program) return held('call setup not finished');

  const contacts = svc.completedContacts(p.id, month);
  const revoked = svc.consentOf(p.id)?.revoked_at ?? null;
  const contactBeforeStop = contacts.some((c) => !revoked || (c.started_at ?? '') <= revoked);
  const service = p.program === 'ccm' ? minutes >= CCM_MINUTES : contactBeforeStop;
  if (p.status === 'opted_out' && !service) return held('opted out, no service');
  if (p.program === 'ccm' && minutes < CCM_MINUTES) return held(`under ${CCM_MINUTES} minutes (${minutes})`);
  if (p.program === 'apcm' && !contacts.length) return held('no completed contact');

  const mc = svc.monthCloseOf(p.id, month);
  if (!mc?.filed_at) return held('note not filed in EHR');
  if (!mc.attested_at) return held('awaiting physician attestation', true);
  return { status: 'ready', reason: null, code, amount: code ? FEES[code] : null, minutes, awaitingAttestation: false };
}

export function evaluateBilling(svc: Service, silent = false): void {
  const month = svc.month();
  for (const p of svc.patients()) {
    const b = billingFor(svc, p, month);
    if (b.status === 'not_enrolled') continue;
    const status = b.status as 'ready' | 'held';
    const existing = svc.monthCloseOf(p.id, month);
    if (!existing) {
      svc.db
        .prepare(
          'INSERT INTO month_close (patient_id, month, billing_status, held_reason, code, amount) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(p.id, month, status, b.reason, b.code, b.amount);
    } else if (
      existing.billing_status !== status ||
      existing.held_reason !== b.reason ||
      existing.code !== b.code ||
      existing.amount !== b.amount
    ) {
      svc.db
        .prepare('UPDATE month_close SET billing_status = ?, held_reason = ?, code = ?, amount = ? WHERE patient_id = ? AND month = ?')
        .run(status, b.reason, b.code, b.amount, p.id, month);
    } else continue;
    if (silent) continue;
    if (existing && existing.billing_status === status && existing.held_reason === b.reason) continue;
    svc.log(
      'billing.status',
      status === 'ready' ? `Billing: ready — ${b.code} ($${b.amount!.toFixed(2)}).` : `Billing: held — ${b.reason}.`,
      p.id,
      'System',
    );
  }
}
