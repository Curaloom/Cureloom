// Ops billing reconciliation: the micro-ledger behind each billable month
// (time by role, counted and excluded entries, claim lines), a plain-text
// audit summary compiled from the event trail, and the CMS-1500 claims with
// their pre-flight result.

import type { PreflightView, ReconciliationView } from '../shared/api';
import { ACTIVITIES } from '../shared/constants';
import { distinctConditions } from '../shared/icd10';
import type { Patient } from '../shared/model';
import { dateOf, fmtDateTime, floorMinutes, inMonth } from '../shared/time';
import { billingFor } from './billing';
import { buildClaim, preflight, type PreflightResult } from './cms1500';
import { callSeconds } from './describe';
import { fullName, type Service } from './service';

const AUDIT_TYPES = /^(call\.(ai|nurse|reviewed)|time\.logged|flag\.|task\.closed|escalat|care_plan\.approved|billing\.(complexity|upgraded)|note\.filed|attestation\.signed|consent\.)/;

/** The month's audit trail for one patient, as lines a billing reviewer can read. */
export function auditSummary(svc: Service, p: Patient, month: string): string {
  const events = svc.events({ patientId: p.id }).filter((e) => inMonth(e.at, month) && AUDIT_TYPES.test(e.type));
  const head = `${fullName(p)} · ${p.mrn} · ${p.program?.toUpperCase() ?? '—'} · ${month}`;
  if (!events.length) return `${head}\nNo activity recorded this month.`;
  return [head, ...events.map((e) => `${fmtDateTime(e.at)} · ${e.actor} · ${e.detail}`)].join('\n');
}

export function reconciliation(svc: Service, p: Patient, month: string): ReconciliationView {
  const time = svc.timeOf(p.id, month);
  const counted = time.filter((t) => t.counts);
  const by = (role: 'nurse' | 'physician') => counted.filter((t) => t.role === role).reduce((s, t) => s + t.seconds, 0);
  const nurse = by('nurse');
  const physician = by('physician');
  const aiCalls = svc
    .callsOf(p.id)
    .filter((c) => c.kind === 'ai' && c.status === 'done' && inMonth(c.started_at, month));
  const b = billingFor(svc, p, month);
  const mc = svc.monthCloseOf(p.id, month);
  return {
    patientId: p.id,
    nurseSeconds: nurse,
    physicianSeconds: physician,
    totalSeconds: nurse + physician,
    countedMinutes: floorMinutes(nurse + physician),
    entries: counted.map((t) => ({
      at: t.started_at,
      activity: ACTIVITIES[t.activity].label,
      by: t.user,
      role: t.role,
      seconds: t.seconds,
      outcome: t.outcome,
    })),
    excluded: [
      ...time
        .filter((t) => !t.counts)
        .map((t) => ({
          at: t.started_at,
          what: `${ACTIVITIES[t.activity].label} (${t.user})`,
          seconds: t.seconds,
          why: t.activity === 'consent_call' ? 'consent calls are not care management time' : `not reached: ${(t.outcome ?? '').toLowerCase()}`,
        })),
      ...aiCalls.map((c) => ({ at: c.started_at!, what: 'AI check-in call', seconds: callSeconds(c), why: 'automated time never counts' })),
    ].sort((x, y) => x.at.localeCompare(y.at)),
    lines: b.lines,
    total: b.lines.reduce((s, l) => s + l.amount, 0),
    complexity: b.complexity,
    complexityBy: mc?.complexity_by ?? null,
    audit: auditSummary(svc, p, month),
  };
}

export function claimsPreflight(svc: Service, month: string, today: string): PreflightResult {
  const settings = svc.settings();
  const matrix = svc.icdMatrix();
  const claims = svc
    .patients()
    .map((p) => ({ p, b: billingFor(svc, p, month) }))
    .filter(({ b }) => b.status === 'ready')
    .map(({ p, b }) => buildClaim({ patient: p, lines: b.lines, diagnosis: p.qualifying_codes }, month, settings, (codes) => distinctConditions(codes, matrix)));
  return preflight(claims, month, today);
}

export function preflightView(svc: Service): PreflightView {
  const month = svc.month();
  const r = claimsPreflight(svc, month, dateOf(svc.now()));
  return {
    month,
    dos: r.dos,
    open: r.open,
    renderingNpi: svc.settings().renderingNpi,
    claims: r.claims.map((c) => ({
      patientId: c.patientId,
      mrn: c.mrn,
      name: c.name,
      codes: c.rows.map((x) => (x.UNITS !== '1' ? `${x.PROCEDURE_CODE} ×${x.UNITS}` : x.PROCEDURE_CODE)),
      total: c.rows.reduce((s, x) => s + Number(x.CHARGE_AMOUNT), 0),
      errors: c.errors,
      sanitized: c.sanitized,
    })),
    clean: r.clean.length,
    excluded: r.excluded.length,
    lines: r.clean.reduce((s, c) => s + c.rows.length, 0),
  };
}
