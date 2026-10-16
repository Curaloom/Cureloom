// The operator demo: a synthetic portfolio of client practices, AI check-ins
// in each practice's name, the billing pre-flight and its integrity checks,
// the month fast-forward, the ROI model and the audit packet. These are the
// numbers a prospect sees, so the tests pin them down.
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { createApi } from '../server/app';
import { auditPacket } from '../server/audit';
import { openDb } from '../server/db';
import { Service } from '../server/service';
import { buildState, patientDetail } from '../server/views';
import { MONTH_END } from '../shared/constants';
import { computeRoi, pilotDefaults, ROI_DEFAULTS } from '../shared/roi';
import { toMs } from '../shared/time';

function setup() {
  const svc = new Service({ db: openDb(':memory:'), realNow: () => 1_000_000 });
  svc.reset();
  return svc;
}

const fingerprint = (svc: Service) =>
  svc.patients().map((p) => [p.mrn, p.first_name, p.last_name, p.dob, p.phone, p.status, p.program, p.qualifying_codes.join('+'), p.is_qmb, p.care_manager].join('|'));

test('the synthetic portfolio is identical on every reset and every phone number is fictional', () => {
  const a = setup();
  const b = setup();
  assert.deepEqual(fingerprint(a), fingerprint(b));
  const s = buildState(a);
  assert.equal(s.practices.length, 5);
  assert.equal(s.patients.length, 286);
  assert.deepEqual(
    s.practices.filter((p) => !p.simulated).map((p) => p.code),
    ['WFM'],
  );
  for (const p of a.patients()) {
    assert.match(p.phone, /555 01\d\d$/, `${p.mrn} ${p.phone}`);
    if (p.caregiver_phone) assert.match(p.caregiver_phone, /555 01\d\d$/);
  }
  for (const pr of s.practices) assert.match(pr.phone, /555 01\d\d$/);
});

test('AI check-ins go out in each practice’s name, and an urgent answer gets a warm handoff', () => {
  const svc = setup();
  const run = svc.runAiCalls();
  assert.ok(run.items.length > 100);
  for (const i of run.items.filter((x) => x.firstLine)) {
    assert.ok(i.firstLine!.startsWith(`This is an automated call from ${i.practice}`), i.firstLine!);
    assert.match(i.firstLine!, /This call is recorded\./);
  }
  for (const mrn of ['W01', 'O080', 'H006']) {
    const p = svc.patientByMrn(mrn)!;
    const call = svc.callsOf(p.id).find((c) => c.kind === 'ai' && c.outcome === 'escalated')!;
    assert.ok(call, `${mrn} has an escalated AI call`);
    const ai = call.transcript.filter((l) => l.who === 'ai').map((l) => l.text).join(' ');
    assert.match(ai, /Please call 911 now/);
    assert.match(ai, /stay on this line: I'm connecting you to your nurse now/);
    assert.doesNotMatch(ai, /goodbye/i);
    assert.ok(call.transcript.some((l) => l.who === 'system' && l.text.startsWith('Live transfer to the on-duty nurse requested')));
    assert.ok(svc.events({ patientId: p.id, prefix: 'outbox.' }).some((e) => /live transfer to the on-duty nurse requested/.test(e.detail)));
  }
  const s = buildState(svc);
  const simulated = s.alerts.filter((x) => !x.live);
  assert.equal(simulated.length, 2);
  for (const x of simulated) assert.ok(x.acknowledgedAt && toMs(x.acknowledgedAt) - toMs(x.raisedAt) <= 30 * 60_000);
  // The live practice's alert waits for the presenter. The run compressed two weeks into one click, so
  // its 30-minute window starts when the alert is delivered, and acknowledging now meets the SLA.
  const live = s.alerts.find((x) => x.live)!;
  assert.equal(live.acknowledgedAt, null);
  assert.equal(s.ops.escalations.withinSla, 2);
  svc.acknowledgeFlag('nurse', live.flagId);
  assert.equal(buildState(svc).ops.escalations.withinSla, 3);
});

test('patients who prefer another language get a nurse call, not an English AI call', () => {
  const svc = setup();
  svc.runAiCalls();
  const s = buildState(svc);
  const spanish = s.patients.filter((p) => p.program === 'apcm' && p.status === 'active' && p.preferred_language !== 'English');
  assert.ok(spanish.length > 0);
  for (const p of spanish) {
    assert.equal(p.ai.ok, false);
    assert.ok(!svc.callsOf(p.id).some((c) => c.kind === 'ai' && c.status === 'done' && c.started_at!.startsWith('2026-10')));
    assert.ok(svc.tasksOf(p.id).some((t) => t.kind === 'call' && t.status === 'open'));
  }
});

test('the eligibility check catches a Medicare Advantage switch and a lost QMB status before claims go out', () => {
  const svc = setup();
  const before = buildState(svc);
  const unverified = before.patients.filter((p) => p.billing.checks.some((c) => c.key === 'coverage' && c.status === 'fail'));
  assert.ok(unverified.length > 0);
  assert.throws(() => svc.runEligibilityCheck('nurse'), /Ops lead/);
  const v = svc.runEligibilityCheck('manager');
  assert.deepEqual(
    v.maSwitches.map((x) => x.mrn),
    ['B026'],
  );
  assert.deepEqual(
    v.qmbEnded.map((x) => x.mrn),
    ['G016'],
  );
  const b026 = svc.patientByMrn('B026')!;
  assert.equal(b026.coverage, 'advantage');
  assert.equal(b026.status, 'paused');
  assert.equal(svc.patientByMrn('G016')!.is_qmb, false);
  const s = buildState(svc);
  assert.equal(s.patients.find((p) => p.mrn === 'G016')!.billing.code, 'G0557');
  assert.equal(s.ops.integrity.coverageUnverified, 0);
  assert.equal(s.ops.integrity.maSwitches, 1);
  assert.equal(s.ops.integrity.qmbEnded, 1);
  assert.equal(s.patients.find((p) => p.mrn === 'B026')!.billing.reason, 'paused, now Medicare Advantage');
});

test('a patient enrolled at two client practices is held at the later one', () => {
  const svc = setup();
  const s = buildState(svc);
  const later = s.patients.find((p) => p.mrn === 'H066')!;
  const first = s.patients.find((p) => p.mrn === 'B029')!;
  assert.equal(later.name, first.name);
  assert.equal(later.dob, first.dob);
  assert.ok(later.billing.checks.some((c) => c.key === 'duplicate' && c.status === 'fail' && c.detail.includes('Brazos Valley Family Clinic (B029)')));
  assert.ok(!first.billing.checks.some((c) => c.key === 'duplicate'));
  svc.runEligibilityCheck('manager');
  svc.fastForwardMonth();
  const after = buildState(svc).patients.find((p) => p.mrn === 'H066')!;
  assert.equal(after.billing.status, 'held');
  assert.match(after.billing.reason!, /possible duplicate/);
});

test('lower-acuity-only patients are held until a clinician documents the risk basis', () => {
  const svc = setup();
  const id = svc.patientByMrn('O001')!.id;
  const check = () => patientDetail(svc, id).billing.checks.find((c) => c.key === 'eligibility')!;
  assert.equal(check().status, 'fail');
  assert.ok(buildState(svc).patients.find((p) => p.id === id)!.riskReview);
  assert.throws(() => svc.documentRiskBasis('manager', id, 'Hypertension with two ER visits this year.'), /Nurse or Physician/);
  assert.throws(() => svc.documentRiskBasis('nurse', id, 'high risk'), /in a sentence/);
  svc.documentRiskBasis('nurse', id, 'Hypertension with two ER visits for hypertensive urgency this year.');
  assert.equal(check().status, 'pass');
  assert.equal(buildState(svc).patients.find((p) => p.id === id)!.riskReview, false);

  const other = svc.patientByMrn('O040')!.id;
  svc.markRiskNotMet('physician', other, 'Well controlled on one medicine; no complications.');
  assert.equal(svc.patient(other).status, 'paused');
  assert.match(svc.patient(other).ineligible_reason!, /risk standard/);
  assert.ok(!svc.callsOf(other).some((c) => c.status === 'scheduled'));
});

test('fast-forwarding October closes the month at the simulated practices and leaves Westfield alone', () => {
  const svc = setup();
  svc.runEligibilityCheck('manager');
  const ff = svc.fastForwardMonth();
  assert.throws(() => svc.fastForwardMonth(), /already fast-forwarded/);
  assert.ok(svc.now() >= MONTH_END);
  assert.equal(ff.aiRun, true);
  assert.equal(ff.unfiled, 3);
  assert.equal(ff.unattested, 6);
  const s = buildState(svc);
  const o = s.ops;
  assert.ok(o.ai.completionRate! >= 0.8 && o.ai.completionRate! <= 0.97, `AI completion ${o.ai.completionRate}`);
  assert.ok(o.exceptions.share! > 0.3 && o.exceptions.share! < 0.7, `exceptions ${o.exceptions.share}`);
  assert.ok(o.exceptions.fromCalls < o.exceptions.patients);
  assert.ok(o.nurse.apcmPerPatient! >= 6 && o.nurse.apcmPerPatient! <= 14, `APCM minutes ${o.nurse.apcmPerPatient}`);
  assert.ok(o.nurse.ccmMeets20Share! >= 0.7, `CCM at 20 minutes ${o.nurse.ccmMeets20Share}`);
  assert.equal(o.escalations.urgent, 3);
  assert.equal(o.escalations.withinSla, 2);
  assert.ok(o.billing.ready > 150);
  // Every held month says why; every ready month passes every blocking check.
  for (const p of s.patients.filter((x) => x.billing.status === 'held')) assert.ok(p.billing.reason, p.mrn);
  for (const p of s.patients.filter((x) => x.billing.status === 'ready')) {
    assert.ok(p.simulated, `${p.mrn} is at a simulated practice`);
    assert.ok(patientDetail(svc, p.id).billing.checks.every((c) => c.status !== 'fail' || !c.blocking), p.mrn);
  }
  // Westfield is the presenter's to drive: nothing filed or signed there.
  assert.ok(s.patients.filter((p) => p.practiceCode === 'WFM').every((p) => !p.note?.filedAt));
  assert.equal(s.attestation.records.length, 0);
});

test('the ROI model', () => {
  const r = computeRoi(ROI_DEFAULTS);
  // $90,000 × 1.27 = $114,300 a year; ÷ 12 ÷ (114.8 h × 60) = $1.38 a nurse minute.
  assert.equal(r.loadedNurseYear, 114300);
  assert.equal(r.costPerMinute, 1.38);
  assert.equal(r.apcm.minutesToday, 19.68);
  assert.equal(r.apcm.minutesWith, 10);
  assert.equal(r.apcm.caseloadToday, 350);
  assert.equal(r.apcm.caseloadWith, 689);
  assert.equal(r.breakEvenMinutesApcm, 2.9);
  assert.ok(r.monthly.savings > 0 && r.annualSavings === Math.round(r.monthly.savings * 12));
  // CCM is time-based: counted minutes never drop below 20.
  assert.equal(computeRoi({ ...ROI_DEFAULTS, ccmPerNurseToday: 340, ccmMinutesSaved: 10 }).ccm.minutesWith, 20);
  // The CY2027 proposed rates pay less.
  assert.ok(computeRoi({ ...ROI_DEFAULTS, rates: '2027p' }).revenueMonthly < r.revenueMonthly);
  // A price above the value of the minutes saved shows a loss, not a rounding to zero.
  assert.ok(computeRoi({ ...ROI_DEFAULTS, priceApcm: 20, apcmMinutesWithCureloom: 18 }).monthly.savings < 0);
  const pilot = pilotDefaults(ROI_DEFAULTS);
  assert.deepEqual([pilot.cohort, pilot.baselineMinutes, pilot.pilotPrice, pilot.conversionPrice, pilot.days], [500, 20, 2, 4, 90]);
});

test('the audit packet carries the evidence for a billed month', () => {
  const svc = setup();
  svc.runEligibilityCheck('manager');
  svc.fastForwardMonth();
  const s = buildState(svc);
  const apcm = s.patients.find((p) => p.billing.status === 'ready' && p.program === 'apcm' && p.completedContact)!;
  const a = auditPacket(svc, apcm.id, s.operator);
  assert.equal(a.decision.status, 'ready');
  assert.equal(a.decision.code, apcm.billing.code);
  assert.ok(a.decision.checks.every((c) => c.status !== 'fail'));
  assert.ok(a.consent?.explained_cost_sharing && a.consent.explained_right_to_stop);
  assert.ok(a.contacts.some((c) => c.reached));
  for (const c of a.contacts.filter((x) => x.kind === 'ai' && x.reached)) assert.ok(c.transcript.some((l) => l.text.startsWith('This is an automated call from')));
  assert.ok(a.note.filedAt && a.note.attestedAt && a.note.text);
  assert.equal(a.countedMinutes, apcm.billing.minutes);
  assert.ok(a.events.length > 0);
  const ccm = s.patients.find((p) => p.billing.status === 'ready' && p.program === 'ccm')!;
  const b = auditPacket(svc, ccm.id, s.operator);
  assert.ok(b.countedMinutes >= 20);
  assert.equal(b.countedMinutes, Math.floor(b.time.filter((t) => t.counted).reduce((x, t) => x + t.seconds, 0) / 60));
});

test('the polled state stays small with the whole portfolio, and the version moves only on change', () => {
  const svc = setup();
  svc.runAiCalls();
  const s = buildState(svc);
  const kb = JSON.stringify(s).length / 1024;
  assert.ok(kb < 700, `${Math.round(kb)} KB`);
  const v = svc.version();
  buildState(svc);
  assert.equal(svc.version(), v);
  svc.advanceDay();
  assert.notEqual(svc.version(), v);
});

test('the API: 304 when nothing changed, CSV exports, audit packets', async () => {
  const svc = setup();
  const app = express();
  app.use(express.json());
  app.use(createApi(svc));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const first = await fetch(`${base}/api/state`);
    assert.equal(first.status, 200);
    const etag = first.headers.get('etag')!;
    await first.json();
    assert.equal((await fetch(`${base}/api/state`, { headers: { 'If-None-Match': etag } })).status, 304);
    const act = await fetch(`${base}/api/action/advanceDay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-role': 'manager' }, body: '{}' });
    assert.equal(act.status, 200);
    await act.json();
    const changed = await fetch(`${base}/api/state`, { headers: { 'If-None-Match': etag } });
    assert.equal(changed.status, 200);
    await changed.json();
    const denied = await fetch(`${base}/api/action/runEligibilityCheck`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-role': 'nurse' }, body: '{}' });
    assert.equal(denied.status, 403);
    await denied.json();
    const claims = await (await fetch(`${base}/api/claims.csv`)).text();
    assert.match(claims.split('\n')[0], /^practice,billing_practitioner,mrn,patient,dob,service_from,service_to,code/);
    const held = await (await fetch(`${base}/api/held.csv`)).text();
    assert.match(held.split('\n')[0], /held_reason,failing_checks/);
    const packet = await fetch(`${base}/api/audit/${svc.patientByMrn('W02')!.id}`);
    assert.equal(packet.status, 200);
    assert.equal((await packet.json()).patient.mrn, 'W02');
    assert.equal((await fetch(`${base}/api/audit/99999`)).status, 404);
  } finally {
    server.close();
  }
});
