// Basic checks for the prototype's core rules. The full walkthrough
// acceptance suite is deferred; these cover the logic the brief says must
// behave exactly: eligibility, the AI call run, time capture, the CCM/APCM
// split and the billing list.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDb } from '../server/db';
import { Service } from '../server/service';
import { buildState } from '../server/views';

function setup() {
  let real = 1_000_000;
  const svc = new Service({ db: openDb(':memory:'), realNow: () => real });
  svc.reset();
  const tick = (ms: number) => (real += ms);
  const pid = (mrn: string) => svc.patientByMrn(mrn)!.id;
  /** Time a piece of work for `minutes` demo minutes (demo speed: 1 s = 1 min). */
  const work = (mrn: string, activity: any, minutes: number, outcome: string) => {
    svc.startActivity('nurse', pid(mrn), activity);
    tick(minutes * 1000);
    svc.stopActivity('nurse', outcome);
  };
  const nurseCall = (mrn: string, minutes: number, outcome: 'completed' | 'no_answer' = 'completed') => {
    const c = svc.startNurseCall('nurse', pid(mrn));
    tick(minutes * 1000);
    return svc.endNurseCall('nurse', c.id, { outcome });
  };
  return { svc, tick, pid, work, nurseCall };
}

test('roster upload flags eligibility and pauses the patient who moved to Medicare Advantage', () => {
  const { svc } = setup();
  svc.uploadRoster('manager', 'october-roster.csv', svc.rosterCsv());
  const s = (m: string) => svc.patientByMrn(m)!;
  assert.equal(s('W11').status, 'ineligible');
  assert.equal(s('W11').ineligible_reason, 'one qualifying condition');
  assert.equal(s('W12').status, 'needs_visit');
  assert.equal(s('W12').ineligible_reason, 'needs a visit, last seen 14 Aug 2025');
  assert.equal(s('W13').ineligible_reason, 'Medicare Advantage');
  assert.equal(s('W15').status, 'paused');
  assert.equal(s('W15').ineligible_reason, 'coverage changed to Medicare Advantage');
  assert.equal(s('W08').status, 'eligible_unconfirmed');
  assert.equal(s('W09').status, 'eligible_unconfirmed');
});

test('roster rows with bad data are rejected with a reason', () => {
  const { svc } = setup();
  const up = svc.uploadRoster('manager', 'bad.csv', svc.rosterCsv('roster-with-errors.csv'));
  assert.equal(up.accepted, 1);
  assert.equal(up.rejected, 5);
  assert.ok(up.rows.some((r) => r.errors.some((e) => e.includes('555-01XX'))));
});

test('only the practice manager confirms eligibility', () => {
  const { svc, pid } = setup();
  svc.uploadRoster('manager', 'r.csv', svc.rosterCsv());
  assert.throws(() => svc.confirmEligibility('nurse', pid('W08')), /Practice manager/);
});

test('October AI run produces the scripted outcomes', () => {
  const { svc, pid } = setup();
  svc.uploadRoster('manager', 'r.csv', svc.rosterCsv());
  svc.confirmEligibility('manager', pid('W08'));
  svc.saveCallSetup('nurse', pid('W08'), { program: 'apcm', readings: ['bp', 'glucose'], symptoms: ['chest_pain', 'stroke_signs', 'low_glucose_spells'] });
  svc.runAiCalls();
  const flags = (m: string) => svc.flagsOf(pid(m));
  assert.equal(flags('W01')[0].level, 'urgent');
  assert.equal(flags('W02')[0].level, 'concern');
  assert.match(flags('W02')[0].summary, /ran out of metformin 3 days ago; fasting glucose 240 mg\/dL against a 90–130 target/i);
  assert.equal(flags('W04').length, 0);
  assert.equal(flags('W08').length, 0);
  const w10 = svc.callsOf(pid('W10')).find((c) => c.kind === 'ai' && c.status === 'done' && c.started_at!.startsWith('2026-10'))!;
  assert.equal(w10.answered_by, 'caregiver');
  const w07 = svc.callsOf(pid('W07')).filter((c) => c.status === 'done' && c.started_at!.startsWith('2026-10'));
  assert.deepEqual(w07.map((c) => c.started_at!.slice(0, 10)), ['2026-10-07', '2026-10-09', '2026-10-13']);
  assert.ok(svc.tasksOf(pid('W07')).some((t) => t.title.startsWith('Not reached')));
  assert.equal(svc.patientByMrn('W14')!.status, 'opted_out');
  assert.equal(svc.consentOf(pid('W14'))!.revoked_at!.slice(0, 10), '2026-10-07');
  assert.ok(svc.tasksOf(pid('W14')).some((t) => t.title === 'Confirm opt-out by phone'));
  for (const c of svc.callsOf(pid('W02')).filter((c) => c.kind === 'ai' && c.answered_by && c.started_at!.startsWith('2026-10'))) {
    assert.match(c.transcript.find((l) => l.who === 'ai')!.text, /automated call .* recorded/);
  }
  // The urgent alert's 30-minute window starts when the compressed run finishes.
  const urgent = buildState(svc).alerts[0];
  assert.ok(urgent.ackDueAt! > svc.now());
});

test('a patient who prefers a human gets a nurse-call task, not an AI call', () => {
  const { svc, pid } = setup();
  svc.setPrefersHuman('nurse', pid('W04'), true);
  svc.runAiCalls();
  assert.ok(!svc.callsOf(pid('W04')).some((c) => c.kind === 'ai' && c.status === 'done' && c.started_at!.startsWith('2026-10')));
  assert.ok(svc.tasksOf(pid('W04')).some((t) => t.kind === 'call' && t.status === 'open'));
});

test('time is floored to minutes, AI and unanswered calls never count, and the month bills as in section 5', () => {
  const { svc, pid, work, nurseCall, tick } = setup();
  svc.uploadRoster('manager', 'r.csv', svc.rosterCsv());
  svc.confirmEligibility('manager', pid('W08'));
  svc.confirmEligibility('manager', pid('W09'));
  svc.saveCallSetup('nurse', pid('W08'), { program: 'apcm', readings: ['bp', 'glucose'], symptoms: ['chest_pain'] });
  svc.runAiCalls();

  // W01 urgent: acknowledge, nurse call, resolve.
  const f1 = svc.flagsOf(pid('W01'))[0];
  svc.acknowledgeFlag('nurse', f1.id);
  nurseCall('W01', 5);
  svc.resolveFlag('nurse', f1.id, 'Called 911, taken to ER');
  // W02 concern: med review, close refill task.
  work('W02', 'ehr_med_review', 4, 'Discrepancy found, change requested');
  svc.closeTask('nurse', svc.tasksOf(pid('W02')).find((t) => t.title === 'Refill metformin')!.id);
  // W03 22 minutes; W05 8 minutes (6 + 2.5 floors to 8); W06 26 minutes.
  nurseCall('W03', 9);
  work('W03', 'ehr_chart_review', 4, 'No changes needed');
  work('W03', 'ehr_med_review', 4, 'No discrepancies');
  work('W03', 'ehr_care_plan_review', 3, 'Care plan current');
  work('W03', 'coordination', 2, 'Pharmacy contacted');
  nurseCall('W05', 6);
  svc.startActivity('nurse', pid('W05'), 'documentation');
  tick(2500);
  svc.stopActivity('nurse', 'Documentation completed');
  nurseCall('W06', 12);
  work('W06', 'ehr_med_review', 5, 'Medication list updated');
  work('W06', 'ehr_care_plan_review', 4, 'Care plan updated');
  work('W06', 'coordination', 5, 'Appointment arranged');
  // W07 unanswered nurse call counts nothing.
  nurseCall('W07', 1, 'no_answer');
  // W09 consent call (not counted), setup, 10-minute nurse call.
  svc.setDate('2026-10-26');
  svc.startConsentCall('nurse', pid('W09'));
  tick(3000);
  svc.recordConsent('nurse', pid('W09'), {
    outcome: 'agreed', explainedAvailability: true, explainedCostSharing: true,
    explainedOnePractitioner: true, explainedRightToStop: true, automatedCallsOk: true, textsOk: false,
  });
  svc.saveCallSetup('nurse', pid('W09'), { program: 'ccm', readings: ['bp'], symptoms: ['chest_pain'] });
  svc.setDate('2026-10-27');
  nurseCall('W09', 10);

  const mins = (m: string) => buildState(svc).patients.find((p) => p.mrn === m)!.minutes;
  assert.equal(mins('W03'), 22);
  assert.equal(mins('W05'), 8);
  assert.equal(mins('W06'), 26);
  assert.equal(mins('W07'), 0);
  assert.equal(mins('W09'), 10);
  assert.ok(svc.timeOf(pid('W09')).some((t) => t.activity === 'consent_call' && !t.counts));

  svc.jumpToMonthEnd();
  let s = buildState(svc);
  for (const id of s.monthEnd.patientIds) {
    const p = s.patients.find((x) => x.id === id)!;
    assert.match(p.note!.text, /AI time never counts|No calls this month|TIME LOG/);
    svc.fileNote('nurse', id, p.note!.text);
  }
  svc.signAttestation('physician', s.attestation.text);
  s = buildState(svc);
  const status = (m: string) => s.billing.rows.find((r) => r.mrn === m)!.billing;
  for (const m of ['W02', 'W04', 'W10']) assert.deepEqual([status(m).status, status(m).code], ['ready', 'G0558']);
  for (const m of ['W01', 'W08']) assert.deepEqual([status(m).status, status(m).code], ['ready', 'G0557']);
  for (const m of ['W03', 'W06']) assert.deepEqual([status(m).status, status(m).code], ['ready', '99490']);
  assert.equal(status('W05').reason, 'under 20 minutes (8)');
  assert.equal(status('W09').reason, 'under 20 minutes (10)');
  assert.equal(status('W07').reason, 'no completed contact');
  assert.equal(status('W14').reason, 'opted out, no service');
  assert.equal(status('W15').reason, 'paused, now Medicare Advantage');
  for (const m of ['W11', 'W12', 'W13']) assert.equal(status(m).status, 'not_enrolled');
  assert.equal(s.billing.readyCount, 7);
  assert.equal(s.billing.readyTotal, 591.54);
});
