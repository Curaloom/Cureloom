// The audit packet: everything that supports (or holds) one patient's
// billed month, in one place, as an auditor would ask for it. Built from the
// same rows the billing decision uses, plus the event trail.

import type { AuditPacket } from '../shared/api';
import { codeName, riskReviewNeeded } from '../shared/codes';
import { ACTIVITIES, CODE_LABEL, HUMAN_TOUCH_DAYS } from '../shared/constants';
import { ageOn, floorMinutes, inMonth, monthLabel } from '../shared/time';
import { billingFor, lastHumanTouchOf, touchCutoff } from './billing';
import { callSeconds, callSummary, reached } from './describe';
import { fullName, type Service } from './service';
import { practiceInfo } from './views';

export function auditPacket(svc: Service, patientId: number, operator: string): AuditPacket {
  const now = svc.now();
  const month = svc.month();
  const p = svc.patient(patientId);
  const pr = svc.practiceOf(p);
  const setup = svc.setupOf(p.id);
  const consent = svc.consentOf(p.id);
  const calls = svc.callsOf(p.id);
  const decision = billingFor(svc, p, month);
  const time = svc.timeOf(p.id, month);
  const mc = svc.monthCloseOf(p.id, month);
  const last = lastHumanTouchOf(calls, consent);
  return {
    generatedAt: now,
    month,
    monthLabel: monthLabel(month),
    operator,
    practice: practiceInfo(pr),
    patient: {
      id: p.id,
      name: fullName(p),
      mrn: p.mrn,
      dob: p.dob,
      age: ageOn(p.dob, now),
      coverage: p.coverage === 'traditional' ? 'Traditional Medicare' : 'Medicare Advantage',
      qmb: p.is_qmb,
      careManager: p.care_manager,
      program: p.program ? p.program.toUpperCase() : null,
      status: p.status.replace(/_/g, ' '),
    },
    decision: { ...decision, codeLabel: decision.code ? CODE_LABEL[decision.code] : null },
    eligibility: {
      codes: p.qualifying_codes.map((c) => ({ code: c, name: codeName(c) })),
      riskReviewNeeded: riskReviewNeeded(p.qualifying_codes),
      riskNote: p.risk_note,
      riskNoteBy: p.risk_note_by,
      riskNoteAt: p.risk_note_at,
      coverageVerifiedOn: p.coverage_verified_on,
      qmbVerifiedOn: p.qmb_verified_on,
      lastVisit: p.last_visit_date,
    },
    consent,
    contacts: calls
      .filter((c) => c.status === 'done' && inMonth(c.started_at, month))
      .map((c) => ({
        at: c.started_at!,
        kind: c.kind,
        purpose: c.purpose,
        outcome: c.outcome,
        answeredBy: c.answered_by,
        seconds: callSeconds(c),
        reached: reached(c),
        summary: callSummary(c, setup),
        nurseNote: c.nurse_note,
        reviewedAt: c.reviewed_at,
        transcript: c.transcript,
      })),
    flags: svc
      .flagsOf(p.id)
      .filter((f) => inMonth(f.raised_at, month))
      .map((f) => ({ level: f.level, summary: f.summary, escalation: f.escalation, raisedAt: f.raised_at, acknowledgedAt: f.acknowledged_at, resolvedAt: f.resolved_at, note: f.note })),
    tasks: svc
      .tasksOf(p.id)
      .filter((t) => inMonth(t.created_at, month) || t.status === 'open')
      .map((t) => ({ title: t.title, status: t.status, createdAt: t.created_at, closedAt: t.closed_at, note: t.close_note })),
    time: time.map((t) => ({ at: t.started_at, activity: ACTIVITIES[t.activity].label, by: t.user, seconds: t.seconds, counted: t.counts, outcome: t.outcome })),
    countedMinutes: floorMinutes(time.filter((t) => t.counts).reduce((a, t) => a + t.seconds, 0)),
    humanTouch: { last, policyDays: HUMAN_TOUCH_DAYS, met: !!last && last >= touchCutoff(month) },
    note: { text: mc?.note_text ?? null, filedAt: mc?.filed_at ?? null, attestedAt: mc?.attested_at ?? null, attestedBy: pr.physician },
    events: svc
      .events({ patientId: p.id })
      .filter((e) => inMonth(e.at, month))
      .map((e) => ({ at: e.at, actor: e.actor, type: e.type, detail: e.detail })),
  };
}
