// Billing is one pure function over a patient's month, plus the pre-flight
// checks an operator's billing team would run before claims go out. It is
// re-run after every change (in bulk, from one snapshot of the tables) so the
// billing list updates live, writes month_close rows, and logs a
// billing.status event whenever a patient's status or reason changes.

import type { BillingView, PreflightCheck } from '../shared/api';
import { conditionList, riskReviewNeeded } from '../shared/codes';
import { CCM_MINUTES, FEES, HUMAN_TOUCH_DAYS, type BillingCode } from '../shared/constants';
import type { Call, Consent, MonthClose, Patient } from '../shared/model';
import { addDays, dateOf, fmtDate, fmtShort, floorMinutes, inMonth, lastDayOfMonth, monthLabel } from '../shared/time';
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

export interface DuplicateRef {
  mrn: string;
  practice: string;
}

/** Everything billing needs for one patient-month. */
export interface BillingInput {
  p: Patient;
  month: string;
  countedSeconds: number;
  /** Calls that reached the patient or caregiver this month. */
  contacts: Pick<Call, 'kind' | 'started_at'>[];
  consent: Consent | null;
  monthClose: MonthClose | null;
  duplicateOf: DuplicateRef | null;
  /** Date of the last human contact: a completed nurse call, or the consent conversation. */
  lastHumanTouch: string | null;
  physician: string;
}

export function touchCutoff(month: string): string {
  return addDays(lastDayOfMonth(month), -HUMAN_TOUCH_DAYS);
}

function checksFor(i: BillingInput, minutes: number, code: BillingCode | null): PreflightCheck[] {
  const { p, month } = i;
  const out: PreflightCheck[] = [];
  const c = i.consent;
  out.push(
    c && !c.revoked_at
      ? { key: 'consent', label: 'Consent on file', status: 'pass', blocking: true, detail: `${c.method === 'at_visit' ? 'At the office visit' : 'By nurse phone call'}, ${fmtDate(c.consent_date)}; cost-sharing and the other three items explained; automated calls ${c.automated_calls_ok ? 'OK' : 'not OK'}` }
      : c?.revoked_at
        ? { key: 'consent', label: 'Consent on file', status: 'warn', blocking: false, detail: `Revoked ${fmtDate(c.revoked_at)}; only service before that date can be billed` }
        : { key: 'consent', label: 'Consent on file', status: 'fail', blocking: true, detail: 'No consent recorded' },
  );
  out.push(
    inMonth(p.coverage_verified_on, month)
      ? { key: 'coverage', label: 'Traditional Medicare verified this month', status: 'pass', blocking: true, detail: `Eligibility response ${fmtDate(p.coverage_verified_on)}` }
      : { key: 'coverage', label: 'Traditional Medicare verified this month', status: 'fail', blocking: true, detail: p.coverage_verified_on ? `Last verified ${fmtDate(p.coverage_verified_on)}: run the eligibility check` : 'Never verified: run the eligibility check' },
  );
  const lower = riskReviewNeeded(p.qualifying_codes);
  out.push(
    !lower
      ? { key: 'eligibility', label: '2+ chronic conditions at significant risk', status: 'pass', blocking: true, detail: `Qualifying: ${conditionList(p.qualifying_codes)}` }
      : p.risk_note
        ? { key: 'eligibility', label: '2+ chronic conditions at significant risk', status: 'pass', blocking: true, detail: `Risk basis documented by ${p.risk_note_by} on ${fmtShort(p.risk_note_at)}: ${p.risk_note}` }
        : { key: 'eligibility', label: '2+ chronic conditions at significant risk', status: 'fail', blocking: true, detail: `Only ${conditionList(p.qualifying_codes)}: the codes alone don't show significant risk. A clinician documents the basis, or the patient is unenrolled.` },
  );
  out.push(
    i.duplicateOf
      ? { key: 'duplicate', label: 'Not enrolled at another practice', status: 'fail', blocking: true, detail: `Same name and date of birth enrolled at ${i.duplicateOf.practice} (${i.duplicateOf.mrn}). Only one practitioner may bill care management per month.` }
      : { key: 'duplicate', label: 'Not enrolled at another practice', status: 'pass', blocking: true, detail: 'No other enrollment found' },
  );
  if (p.program === 'ccm') {
    out.push({ key: 'program', label: `CCM: ${CCM_MINUTES} minutes of clinical staff time`, status: minutes >= CCM_MINUTES ? 'pass' : 'fail', blocking: true, detail: `${minutes} counted minutes${minutes >= CCM_MINUTES ? '' : `; ${CCM_MINUTES} needed`}` });
  } else if (p.program === 'apcm') {
    const last = i.contacts[i.contacts.length - 1];
    out.push({ key: 'program', label: 'APCM: care management furnished this month', status: last ? 'pass' : 'fail', blocking: true, detail: last ? `Completed contact: ${last.kind === 'ai' ? 'AI check-in' : 'nurse call'} ${fmtShort(last.started_at)}` : 'No completed contact this month' });
    const ok = !!i.lastHumanTouch && i.lastHumanTouch >= touchCutoff(month);
    out.push({
      key: 'human_touch',
      label: `Nurse contact in the last ${HUMAN_TOUCH_DAYS} days (operator policy)`,
      status: ok ? 'pass' : 'warn',
      blocking: false,
      detail: i.lastHumanTouch ? `Last human contact ${fmtDate(i.lastHumanTouch)}` : 'No human contact on record',
    });
  }
  if (code === 'G0558') {
    out.push(
      inMonth(p.qmb_verified_on, month)
        ? { key: 'qmb', label: 'QMB status verified this month (G0558)', status: 'pass', blocking: true, detail: `Verified ${fmtDate(p.qmb_verified_on)}` }
        : { key: 'qmb', label: 'QMB status verified this month (G0558)', status: 'fail', blocking: true, detail: `G0558 pays $${FEES.G0558.toFixed(2)} against $${FEES.G0557.toFixed(2)} for G0557: verify QMB first` },
    );
  }
  const mc = i.monthClose;
  out.push(
    mc?.filed_at
      ? { key: 'note', label: 'Monthly note filed in the EHR', status: 'pass', blocking: true, detail: `Filed ${fmtShort(mc.filed_at)}` }
      : { key: 'note', label: 'Monthly note filed in the EHR', status: 'fail', blocking: true, detail: 'Not filed yet' },
  );
  out.push(
    mc?.attested_at
      ? { key: 'attestation', label: 'Billing practitioner attested', status: 'pass', blocking: true, detail: `Signed ${fmtShort(mc.attested_at)} by ${i.physician}` }
      : { key: 'attestation', label: 'Billing practitioner attested', status: 'fail', blocking: true, detail: `Waiting for ${i.physician}` },
  );
  return out;
}

export function computeBilling(i: BillingInput): BillingView {
  const { p, month } = i;
  const minutes = floorMinutes(i.countedSeconds);
  const code = billingCode(p);
  if (!isEnrolled(p)) {
    return { status: 'not_enrolled', reason: notEnrolledReason(p), code: null, amount: null, minutes, awaitingAttestation: false, checks: [], warnings: 0 };
  }
  const checks = p.program ? checksFor(i, minutes, code) : [];
  const warnings = checks.filter((c) => c.status === 'warn').length;
  const held = (reason: string, awaitingAttestation = false): BillingView => ({ status: 'held', reason, code, amount: null, minutes, awaitingAttestation, checks, warnings });
  if (p.status === 'paused') {
    const r = p.ineligible_reason ?? 'paused';
    return held(/Medicare Advantage/i.test(r) ? 'paused, now Medicare Advantage' : /risk standard/.test(r) ? 'paused, risk standard not met' : `paused, ${r}`);
  }
  if (p.status === 'consented' || !p.program) return held('call setup not finished');

  const revoked = i.consent?.revoked_at ?? null;
  const contactBeforeStop = i.contacts.some((c) => !revoked || (c.started_at ?? '') <= revoked);
  const service = p.program === 'ccm' ? minutes >= CCM_MINUTES : contactBeforeStop;
  if (p.status === 'opted_out' && !service) return held('opted out, no service');
  // The program's own requirement first: without it nothing else matters this month.
  if (p.program === 'ccm' && minutes < CCM_MINUTES) return held(`under ${CCM_MINUTES} minutes (${minutes})`);
  if (p.program === 'apcm' && !i.contacts.length) return held('no completed contact');
  // Then the program-integrity checks, in the order a billing team would chase them.
  if (!inMonth(p.coverage_verified_on, month)) return held(`coverage not verified for ${monthLabel(month)}`);
  if (i.duplicateOf) return held(`possible duplicate: also enrolled at ${i.duplicateOf.practice} (${i.duplicateOf.mrn})`);
  if (riskReviewNeeded(p.qualifying_codes) && !p.risk_note) return held('risk basis not documented');
  if (code === 'G0558' && !inMonth(p.qmb_verified_on, month)) return held('QMB not verified this month');
  if (!i.monthClose?.filed_at) return held('note not filed in EHR');
  if (!i.monthClose.attested_at) return held('awaiting physician attestation', true);
  return { status: 'ready', reason: null, code, amount: code ? FEES[code] : null, minutes, awaitingAttestation: false, checks, warnings };
}

// ───────────────────────────── loading the inputs

/** Patients sharing a name and date of birth: every enrolled record after the first is a duplicate. */
export function duplicateMap(svc: Service): Map<number, DuplicateRef> {
  const rows = svc.db
    .prepare(
      `SELECT p.id, p.mrn, p.first_name, p.last_name, p.dob, pr.name AS practice,
              (SELECT MIN(consent_date) FROM consent c WHERE c.patient_id = p.id) AS consented
       FROM patient p JOIN practice pr ON pr.id = p.practice_id
       WHERE p.status IN ('active', 'consented', 'opted_out')`,
    )
    .all() as { id: number; mrn: string; first_name: string; last_name: string; dob: string; practice: string; consented: string | null }[];
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.first_name.toLowerCase()}|${r.last_name.toLowerCase()}|${r.dob}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out = new Map<number, DuplicateRef>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => (a.consented ?? '9999').localeCompare(b.consented ?? '9999') || a.mrn.localeCompare(b.mrn));
    for (const r of sorted.slice(1)) out.set(r.id, { mrn: sorted[0].mrn, practice: sorted[0].practice });
  }
  return out;
}

export function lastHumanTouchOf(calls: Pick<Call, 'kind' | 'status' | 'outcome' | 'answered_by' | 'started_at'>[], consent: Consent | null): string | null {
  let best: string | null = consent?.consent_date ?? null;
  for (const c of calls) {
    if (c.kind !== 'nurse' || c.status !== 'done' || !c.answered_by) continue;
    if (c.outcome !== 'completed' && c.outcome !== 'escalated') continue;
    const d = dateOf(c.started_at!);
    if (!best || d > best) best = d;
  }
  return best;
}

/** One patient, straight from the service (the detail view and single commands). */
export function billingFor(svc: Service, p: Patient, month: string, dups?: Map<number, DuplicateRef>): BillingView {
  const consent = svc.consentOf(p.id);
  return computeBilling({
    p,
    month,
    countedSeconds: svc.countedSeconds(p.id, month),
    contacts: svc.completedContacts(p.id, month),
    consent,
    monthClose: svc.monthCloseOf(p.id, month),
    duplicateOf: (dups ?? duplicateMap(svc)).get(p.id) ?? null,
    lastHumanTouch: lastHumanTouchOf(svc.callsOf(p.id), consent),
    physician: svc.practiceOf(p).physician,
  });
}

/** Every patient at once, from one pass over each table. */
export function billingAll(svc: Service, month: string): Map<number, BillingView> {
  const patients = svc.patients();
  const consent = new Map<number, Consent>();
  for (const r of svc.db.prepare('SELECT * FROM consent ORDER BY id').all() as any[]) {
    for (const k of ['explained_availability', 'explained_cost_sharing', 'explained_one_practitioner', 'explained_right_to_stop', 'automated_calls_ok', 'texts_ok']) r[k] = !!r[k];
    consent.set(r.patient_id, r as Consent);
  }
  const counted = new Map<number, number>();
  for (const r of svc.db
    .prepare('SELECT patient_id, SUM(seconds) AS s FROM time_entry WHERE counts = 1 AND started_at LIKE ? GROUP BY patient_id')
    .all(`${month}%`) as { patient_id: number; s: number }[])
    counted.set(r.patient_id, r.s);
  type CallLite = Pick<Call, 'kind' | 'status' | 'outcome' | 'answered_by' | 'started_at'> & { patient_id: number };
  const calls = new Map<number, CallLite[]>();
  for (const c of svc.db
    .prepare("SELECT patient_id, kind, status, outcome, answered_by, started_at FROM call WHERE status = 'done' ORDER BY started_at, id")
    .all() as CallLite[])
    calls.set(c.patient_id, [...(calls.get(c.patient_id) ?? []), c]);
  const closes = new Map<number, MonthClose>();
  for (const r of svc.db.prepare('SELECT * FROM month_close WHERE month = ?').all(month) as MonthClose[]) closes.set(r.patient_id, r);
  const dups = duplicateMap(svc);
  const out = new Map<number, BillingView>();
  for (const p of patients) {
    const pc = calls.get(p.id) ?? [];
    out.set(
      p.id,
      computeBilling({
        p,
        month,
        countedSeconds: counted.get(p.id) ?? 0,
        contacts: pc.filter((c) => inMonth(c.started_at, month) && (c.outcome === 'completed' || c.outcome === 'escalated') && c.answered_by != null),
        consent: consent.get(p.id) ?? null,
        monthClose: closes.get(p.id) ?? null,
        duplicateOf: dups.get(p.id) ?? null,
        lastHumanTouch: lastHumanTouchOf(pc, consent.get(p.id) ?? null),
        physician: svc.practiceOf(p).physician,
      }),
    );
  }
  return out;
}

export function evaluateBilling(svc: Service, silent = false): void {
  const month = svc.month();
  const all = billingAll(svc, month);
  const existing = new Map((svc.db.prepare('SELECT * FROM month_close WHERE month = ?').all(month) as MonthClose[]).map((r) => [r.patient_id, r]));
  const insert = svc.db.prepare('INSERT INTO month_close (patient_id, month, billing_status, held_reason, code, amount) VALUES (?, ?, ?, ?, ?, ?)');
  const update = svc.db.prepare('UPDATE month_close SET billing_status = ?, held_reason = ?, code = ?, amount = ? WHERE patient_id = ? AND month = ?');
  for (const p of svc.patients()) {
    const b = all.get(p.id)!;
    if (b.status === 'not_enrolled') continue;
    const status = b.status as 'ready' | 'held';
    const ex = existing.get(p.id);
    if (!ex) insert.run(p.id, month, status, b.reason, b.code, b.amount);
    else if (ex.billing_status !== status || ex.held_reason !== b.reason || ex.code !== b.code || ex.amount !== b.amount)
      update.run(status, b.reason, b.code, b.amount, p.id, month);
    else continue;
    if (silent) continue;
    if (ex && ex.billing_status === status && ex.held_reason === b.reason) continue;
    svc.log(
      'billing.status',
      status === 'ready' ? `Billing: ready — ${b.code} ($${b.amount!.toFixed(2)}).` : `Billing: held — ${b.reason}.`,
      p.id,
      'System',
    );
  }
}
