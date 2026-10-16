// The month-end note: built from stored rows with a template, never typed
// from scratch. Plain text so the nurse can paste it into the EHR.

import { codeName } from '../shared/codes';
import { ACTIVITIES, CCM_MINUTES, CODE_LABEL, PRACTICE, STAFF } from '../shared/constants';
import type { Patient } from '../shared/model';
import {
  ageOn,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtShort,
  fmtTime,
  floorMinutes,
  inMonth,
  monthLabel,
  toMs,
} from '../shared/time';
import { billingCode } from './billing';
import { answerLines, callSeconds, reached } from './describe';
import { fullName, type Service } from './service';

/** Patients who get a note this month: everyone active, plus anyone who opted out or paused after activity this month. */
export function monthEndPatients(svc: Service, month: string): Patient[] {
  return svc.patients().filter((p) => {
    if (p.status === 'active') return true;
    if (p.status !== 'opted_out' && p.status !== 'paused') return false;
    return (
      svc.callsOf(p.id).some((c) => c.status === 'done' && inMonth(c.started_at, month)) ||
      svc.timeOf(p.id, month).length > 0 ||
      svc.tasksOf(p.id).some((t) => inMonth(t.created_at, month))
    );
  });
}

function pad(s: string, n: number): string {
  return s.length >= n ? `${s} ` : s.padEnd(n);
}

export function buildNote(svc: Service, p: Patient, month: string): string {
  const setup = svc.setupOf(p.id);
  const consent = svc.consentOf(p.id);
  const calls = svc.callsOf(p.id).filter((c) => c.status === 'done' && inMonth(c.started_at, month));
  const flags = svc.flagsOf(p.id).filter((f) => inMonth(f.raised_at, month));
  const time = svc.timeOf(p.id, month);
  const tasks = svc.tasksOf(p.id).filter((t) => inMonth(t.created_at, month) || t.status === 'open');
  const code = billingCode(p);
  const L: string[] = [];

  L.push(`CARE MANAGEMENT MONTHLY NOTE — ${monthLabel(month)}`);
  L.push(`${PRACTICE.name} · Billing practitioner: ${STAFF.physician.name}`);
  L.push('');
  L.push(`Patient: ${fullName(p)} · MRN ${p.mrn} · DOB ${fmtDate(p.dob)} (age ${ageOn(p.dob, `${month}-01`)})`);
  L.push(`Program: ${p.program ? `${p.program.toUpperCase()}${code ? `, ${code} — ${CODE_LABEL[code]}` : ''}` : 'not set'}`);
  if (p.status !== 'active') L.push(`Status: ${p.status.replace(/_/g, ' ')}${p.ineligible_reason ? ` (${p.ineligible_reason})` : ''}`);
  L.push(`Qualifying conditions: ${p.qualifying_codes.map((c) => `${c} ${codeName(c)}`).join('; ')}`);
  if (consent) {
    const how = consent.method === 'at_visit' ? 'at the office visit' : 'by nurse phone call';
    L.push(
      `Consent: ${how} on ${fmtDate(consent.consent_date)}; automated calls ${consent.automated_calls_ok ? 'OK' : 'not OK'}; texts ${consent.texts_ok ? 'OK' : 'not OK'}.${consent.revoked_at ? ` Revoked ${fmtDate(consent.revoked_at)}.` : ''}`,
    );
  }
  if (p.caregiver_name) L.push(`Caregiver: ${p.caregiver_name}, ${p.caregiver_phone ?? 'no phone on file'}`);
  if (setup?.ehr_plan_reviewed_on) L.push(`Care plan: last reviewed in the EHR on ${fmtDate(setup.ehr_plan_reviewed_on)}.`);

  L.push('');
  L.push('MONTHLY CONTACT');
  if (!calls.length) L.push('- No calls this month.');
  for (const c of calls) {
    const head =
      c.kind === 'ai'
        ? `- ${fmtDateTime(c.started_at)} · AI check-in call`
        : `- ${fmtDateTime(c.started_at)} · Nurse call · ${STAFF.nurse.name}`;
    const by = c.answered_by ? ` · answered by ${c.answered_by === 'caregiver' ? `caregiver (${p.caregiver_name ?? 'caregiver'})` : 'patient'}` : '';
    const outcome =
      c.outcome === 'no_answer'
        ? `no answer${c.kind === 'ai' ? ` (try ${c.attempt})` : ''}`
        : c.outcome === 'opted_out'
          ? 'patient said "stop calling me"; opted out'
          : c.outcome === 'declined'
            ? c.answers?.wantsHuman
              ? 'asked for a person'
              : 'declined, call back later'
            : (c.outcome ?? 'completed');
    L.push(`${head} · ${outcome}${by} · ${fmtDuration(callSeconds(c))}${c.kind === 'ai' ? ' (automated; not counted)' : ''}`);
    for (const line of answerLines(c, setup)) L.push(`    ${line}`);
    if (c.kind === 'ai' && reached(c)) {
      L.push(`    Result: ${c.flag === 'urgent' ? 'urgent — patient told to call 911; nurse and practice alerted' : c.flag === 'concern' ? 'concern routed to the nurse' : 'no concerns'}`);
    }
    if (c.nurse_note) L.push(`    Nurse note: ${c.nurse_note}`);
  }

  L.push('');
  L.push('FLAGS');
  if (!flags.length) L.push('- None this month.');
  for (const f of flags) {
    L.push(`- ${f.level === 'urgent' ? 'Urgent' : 'Concern'}: ${f.summary}`);
    L.push(
      `    Raised ${fmtDateTime(f.raised_at)} · acknowledged ${f.acknowledged_at ? fmtDateTime(f.acknowledged_at) : '—'} · resolved ${f.resolved_at ? fmtDateTime(f.resolved_at) : '—'}${f.note ? ` — ${f.note}` : ''}`,
    );
  }

  const work = time.filter((t) => t.activity !== 'nurse_call' && t.activity !== 'consent_call');
  L.push('');
  L.push('CARE MANAGEMENT WORK');
  if (!work.length) L.push('- None logged.');
  for (const t of work) {
    L.push(`- ${fmtDateTime(t.started_at)} · ${ACTIVITIES[t.activity].label} · ${t.outcome ?? 'done'} · ${fmtDuration(t.seconds)}`);
  }

  L.push('');
  L.push('TASKS');
  if (!tasks.length) L.push('- None.');
  for (const t of tasks) {
    L.push(
      t.status === 'done'
        ? `- Done ${fmtShort(t.closed_at)}: ${t.title}${t.close_note ? ` — ${t.close_note}` : ''}`
        : `- Open, due ${fmtShort(t.due)}: ${t.title}`,
    );
  }

  type Row = { at: string; what: string; by: string; secs: number; counted: string };
  const rows: Row[] = [
    ...time.map((t) => ({
      at: t.started_at,
      what: ACTIVITIES[t.activity].label,
      by: t.user,
      secs: t.seconds,
      counted: t.counts ? 'yes' : t.activity === 'consent_call' ? 'no (consent call, not counted)' : `no (${(t.outcome ?? 'not reached').toLowerCase()})`,
    })),
    ...calls
      .filter((c) => c.kind === 'ai')
      .map((c) => ({ at: c.started_at!, what: 'AI check-in call', by: 'AI (automated)', secs: callSeconds(c), counted: 'no (AI time never counts)' })),
  ].sort((a, b) => toMs(a.at) - toMs(b.at));
  const counted = time.filter((t) => t.counts).reduce((s, t) => s + t.seconds, 0);
  L.push('');
  L.push('TIME LOG (exact seconds; the month total is floored to whole minutes)');
  L.push(`  ${pad('Date', 8)}${pad('Start', 7)}${pad('Activity', 24)}${pad('By', 20)}${pad('Duration', 10)}Counted`);
  if (!rows.length) L.push('  No time logged.');
  for (const r of rows) {
    L.push(`  ${pad(fmtShort(r.at), 8)}${pad(fmtTime(r.at), 7)}${pad(r.what, 24)}${pad(r.by, 20)}${pad(fmtDuration(r.secs), 10)}${r.counted}`);
  }
  L.push(`  Counted total: ${floorMinutes(counted)} min (${counted} s)`);

  L.push('');
  L.push('PROGRAM REQUIREMENT');
  if (p.program === 'ccm') {
    const m = floorMinutes(counted);
    L.push(
      `  CCM: ${CCM_MINUTES} minutes of clinical staff time in the month. Counted: ${m} min — ${m >= CCM_MINUTES ? `meets ${CCM_MINUTES} minutes` : `under ${CCM_MINUTES} minutes, so not billed for CCM this month`}.`,
    );
  } else if (p.program === 'apcm') {
    const contact = calls.find((c) => reached(c));
    L.push(
      `  APCM: a completed contact and care management service in the month; no time requirement. Completed contact: ${contact ? `yes (${fmtShort(contact.started_at)}, ${contact.kind === 'ai' ? 'AI check-in' : 'nurse call'})` : 'no'}.`,
    );
  }
  L.push('');
  L.push(`Drafted by Cureloom from logged activity. Reviewed and filed by: ${STAFF.nurse.name}`);
  return L.join('\n');
}
