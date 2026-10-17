// Ops, physician and nurse workflows end to end through the service.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDb } from '../server/db';
import { verifyChain } from '../server/carePlan';
import { parseCsv, toCsv } from '../server/roster';
import { Service } from '../server/service';
import { buildState } from '../server/views';
import { readXlsxTable, writeXlsxTable } from '../server/xlsx';

function setup() {
  let real = 1_000_000;
  const svc = new Service({ db: openDb(':memory:'), realNow: () => real });
  svc.reset();
  const tick = (ms: number) => (real += ms);
  const pid = (mrn: string) => svc.patientByMrn(mrn)!.id;
  return { svc, tick, pid };
}

const MESSY = [
  ['Acct #', 'Pt First', 'Pt Last', 'Birth Date', 'Gender', 'Payer', 'Subscriber ID', 'Problem List', 'Home Phone', 'Last Seen'],
  ['X01', 'Ada', 'Lovel', '3/4/1950', 'Female', 'Medicare Part B', '1AA1-BB2-CC33', 'I10; E119', '555-0131', '09/10/2026'],
  ['X02', 'Bo', 'Rhee', '1949-05-06', 'M', 'Humana Gold Plus HMO', 'H1234', 'I10 E78.5', '555-0132', '2026-09-11'],
  ['X03', 'Cy', 'Ng', '07/08/1952', 'M', 'Medicare / Medicaid (QMB)', '2DD2-EE3-FF44', 'I50.9|N18.30', '555-0133', '09/12/2026'],
];

test('a messy export maps automatically, imports, and the confirmed layout is reused', () => {
  const { svc } = setup();
  const preview = svc.previewRoster('manager', 'ehr-export.csv', MESSY);
  assert.equal(preview.rowCount, 3);
  assert.equal(preview.savedLayout, false);
  assert.equal(MESSY[0][preview.mapping.patient_id.column!], 'Acct #');
  assert.equal(MESSY[0][preview.mapping.diagnosis_codes.column!], 'Problem List');
  const up = svc.importRoster('manager');
  assert.equal(up.accepted, 3);
  assert.equal(svc.patientByMrn('X01')!.proposed_program, 'ccm');
  assert.equal(svc.patientByMrn('X02')!.coverage, 'advantage');
  assert.equal(svc.patientByMrn('X03')!.is_qmb, true, 'QMB read from the payer name');
  assert.equal(svc.patientByMrn('X01')!.sex, 'F');
  // Same layout next month: the mapping comes back as saved.
  assert.equal(svc.previewRoster('manager', 'ehr-export.csv', MESSY).savedLayout, true);
});

test('Ops can override the mapping, and a missing required field blocks the import', () => {
  const { svc } = setup();
  const noIds = MESSY.map((r) => r.filter((_, i) => i !== 6));
  svc.previewRoster('manager', 'no-ids.csv', noIds);
  assert.throws(() => svc.importRoster('manager'), /No column mapped for: Insurance_ID/);
  // Two fields may not share a column.
  assert.throws(() => svc.importRoster('manager', { insurance_id: 0 }), /same column/);
});

test('XLSX round trip: a written workbook reads back as the same table', async () => {
  const { svc } = setup();
  const table = parseCsv(svc.rosterCsv());
  const back = await readXlsxTable(await writeXlsxTable(table));
  assert.deepEqual(back, table);
  const up = svc.importRoster.bind(svc);
  svc.previewRoster('manager', 'october-roster.xlsx', back);
  assert.equal(up('manager').accepted, 15);
});

test('opportunity matrix: approve, hold, reject, reopen, override, bulk approve and eMRR', () => {
  const { svc, pid } = setup();
  svc.uploadRoster('manager', 'october-roster.csv', svc.rosterCsv());
  const fees = svc.settings().fees;
  const before = buildState(svc).ops.emrr;
  assert.equal(before.pendingCount, 4, 'W08, W09, W11 and W13 await review');
  assert.throws(() => svc.opsDecide('manager', pid('W13'), 'approved', 'apcm'), /APCM is not covered under Medicare Advantage/);
  svc.opsDecide('manager', pid('W13'), 'approved');
  assert.equal(svc.patientByMrn('W13')!.status, 'confirmed');
  svc.opsDecide('manager', pid('W11'), 'held', null, 'check the problem list');
  assert.equal(buildState(svc).ops.matrix.find((r) => r.mrn === 'W11')!.bucket, 'held');
  svc.opsDecide('manager', pid('W09'), 'rejected', null, 'moving away');
  assert.equal(svc.patientByMrn('W09')!.status, 'ineligible');
  svc.opsDecide('manager', pid('W09'), 'reopen');
  assert.equal(svc.patientByMrn('W09')!.status, 'eligible_unconfirmed');
  svc.opsDecide('manager', pid('W09'), 'approved', 'apcm');
  assert.equal(svc.patientByMrn('W09')!.proposed_program, 'apcm');
  const n = svc.opsApproveAll('manager', 80);
  assert.ok(n >= 1, 'W08 has a known payer and exact codes');
  assert.equal(svc.patientByMrn('W08')!.status, 'consented', 'consent from the roster carries over');
  const after = buildState(svc).ops.emrr;
  assert.ok(after.approved > before.approved);
  assert.equal(Math.round((after.approved - before.approved) * 100) / 100, Math.round((fees['99490'] * 2 + fees.G0557) * 100) / 100);
  assert.throws(() => svc.opsDecide('nurse', pid('W11'), 'approved'), /Practice manager/);
});

test('care plan gate: setup waits for the physician, approval initiates the program, the hash chain detects tampering', () => {
  const { svc, pid } = setup();
  svc.uploadRoster('manager', 'october-roster.csv', svc.rosterCsv());
  svc.confirmEligibility('manager', pid('W08'));
  svc.saveCallSetup('nurse', pid('W08'), { program: 'apcm', readings: ['bp', 'glucose'], symptoms: ['chest_pain'] });
  const w08 = () => svc.patientByMrn('W08')!;
  assert.equal(w08().status, 'plan_review');
  assert.equal(svc.callsOf(pid('W08')).filter((c) => c.status === 'scheduled').length, 0, 'no calls before approval');
  assert.equal(buildState(svc).patients.find((p) => p.mrn === 'W08')!.billing.reason, 'care plan not approved');
  const draft = svc.draftPlan(pid('W08'))!;
  assert.equal(draft.version, 1);
  assert.deepEqual(draft.content.problems.map((x) => x.condition), ['diabetes', 'hypertension', 'hypothyroidism']);
  assert.throws(() => svc.approveCarePlan('nurse', draft.id), /Physician/);
  const approved = svc.approveCarePlan('physician', draft.id);
  assert.equal(approved.approver_npi, svc.settings().renderingNpi);
  assert.equal(w08().status, 'active');
  assert.ok(svc.callsOf(pid('W08')).some((c) => c.kind === 'ai' && c.status === 'scheduled'));

  // A changed setup drafts v2; v1 stays in effect until approved, and the chain links them.
  svc.saveCallSetup('nurse', pid('W08'), { program: 'apcm', readings: ['bp', 'glucose', 'weight'], symptoms: ['chest_pain'] });
  assert.equal(svc.approvedPlan(pid('W08'))!.version, 1);
  const v2 = svc.approveCarePlan('physician', svc.draftPlan(pid('W08'))!.id);
  assert.equal(v2.prev_hash, approved.hash);
  assert.equal(verifyChain(svc.carePlansOf(pid('W08'))).ok, true);
  assert.equal(buildState(svc).physician.chain.ok, true);
  // Edit an approved plan behind the system's back: the chain breaks at that version.
  svc.db.prepare("UPDATE care_plan SET content = replace(content, 'Monthly', 'Weekly') WHERE patient_id = ? AND version = 1").run(pid('W08'));
  assert.deepEqual(verifyChain(svc.carePlansOf(pid('W08'))).brokenAt, 1);
  assert.equal(buildState(svc).physician.chain.ok, false);
});

test('a returned care plan becomes a nurse task; seeded patients start with approved plans', () => {
  const { svc, pid } = setup();
  for (const m of ['W01', 'W03', 'W15']) assert.equal(svc.approvedPlan(pid(m))!.version, 1);
  svc.uploadRoster('manager', 'october-roster.csv', svc.rosterCsv());
  svc.confirmEligibility('manager', pid('W08'));
  svc.saveCallSetup('nurse', pid('W08'), { program: 'apcm', readings: ['bp'], symptoms: [] });
  svc.returnCarePlan('physician', svc.draftPlan(pid('W08'))!.id, 'Add glucose readings');
  assert.ok(svc.tasksOf(pid('W08')).some((t) => t.title === 'Care plan changes requested' && t.status === 'open'));
  svc.saveCallSetup('nurse', pid('W08'), { program: 'apcm', readings: ['bp', 'glucose'], symptoms: [] });
  assert.equal(svc.draftPlan(pid('W08'))!.version, 2);
});

test('an APCM patient who moves to Medicare Advantage is paused and switched to CCM', () => {
  const { svc, pid } = setup();
  const rows = parseCsv(svc.rosterCsv());
  const w01 = rows.find((r) => r[0] === 'W01')!;
  w01[7] = 'Aetna Medicare Advantage PPO';
  svc.uploadRoster('manager', 'moved.csv', toCsv(rows));
  const p = svc.patientByMrn('W01')!;
  assert.equal(p.status, 'paused');
  assert.match(p.ineligible_reason!, /APCM not covered — switch to CCM/);
  assert.ok(svc.tasksOf(p.id).some((t) => t.title === 'Switch program to CCM'));
  assert.throws(() => svc.saveCallSetup('nurse', p.id, { program: 'apcm', readings: [], symptoms: [] }), /not covered under Medicare Advantage/);
  svc.saveCallSetup('nurse', p.id, { program: 'ccm', readings: ['bp', 'weight'], symptoms: ['chest_pain'] });
  assert.equal(svc.patientByMrn('W01')!.status, 'plan_review');
  assert.ok(!svc.tasksOf(p.id).some((t) => t.title === 'Switch program to CCM' && t.status === 'open'));
  svc.approveCarePlan('physician', svc.draftPlan(pid('W01'))!.id);
  assert.equal(svc.patientByMrn('W01')!.status, 'active');
  assert.equal(svc.patientByMrn('W01')!.program, 'ccm');
});

test('physician escalation time counts, runs alongside a nurse timer, and complex CCM upgrades the code', () => {
  const { svc, pid, tick } = setup();
  const w03 = pid('W03');
  // 50 minutes of nurse work.
  const c = svc.startNurseCall('nurse', w03);
  tick(30_000);
  svc.endNurseCall('nurse', c.id, { outcome: 'completed' });
  svc.startActivity('nurse', w03, 'ehr_med_review');
  tick(20_000);
  svc.stopActivity('nurse', 'No discrepancies');
  svc.escalateToPhysician('nurse', w03, 'Oxygen trending down');
  const task = svc.tasksOf(w03).find((t) => t.kind === 'physician' && t.status === 'open')!;
  // The nurse starts other work; the physician opens the escalation at the same time.
  svc.startActivity('nurse', pid('W06'), 'coordination');
  svc.openEscalation('physician', task.id);
  tick(12_000);
  svc.closeEscalation('physician', task.id, { outcome: 'Directive issued', directive: 'Start home oxygen assessment', complexity: 'complex' });
  svc.stopActivity('nurse', 'Pharmacy contacted');
  const v = buildState(svc).patients.find((p) => p.id === w03)!;
  assert.equal(v.minutes, 62);
  assert.equal(v.reconciliation!.physicianSeconds, 12 * 60);
  assert.equal(v.reconciliation!.nurseSeconds, 50 * 60);
  assert.ok(svc.tasksOf(w03).some((t) => t.title === 'Physician directive: Start home oxygen assessment'));
  assert.equal(v.monthClose!.complexity, 'complex');
  // File and attest: complex CCM, 99487.
  svc.jumpToMonthEnd();
  const s = buildState(svc);
  svc.fileNote('nurse', w03, s.patients.find((p) => p.id === w03)!.note!.text);
  svc.signAttestation('physician', s.attestation.text);
  const b = buildState(svc).patients.find((p) => p.id === w03)!.billing;
  assert.equal(b.status, 'ready');
  assert.deepEqual(b.lines.map((l) => l.code), ['99487']);
  assert.ok(svc.events({ patientId: w03, prefix: 'billing.upgraded' }).length || svc.events({ patientId: w03, prefix: 'billing.status' }).some((e) => e.detail.includes('99487')));
  // Marked standard again, the month bills 99490 + 99439 ×2.
  svc.setComplexity('physician', w03, 'standard');
  assert.deepEqual(
    buildState(svc).patients.find((p) => p.id === w03)!.billing.lines.map((l) => `${l.code}x${l.units}`),
    ['99490x1', '99439x2'],
  );
  assert.throws(() => svc.setComplexity('physician', pid('W01'), 'complex'), /CCM patients only/);
});

test('consent link: sent from the Consent Pending queue, signed by the patient, sorted by last attempt', () => {
  const { svc, pid } = setup();
  svc.uploadRoster('manager', 'october-roster.csv', svc.rosterCsv());
  svc.confirmEligibility('manager', pid('W09'));
  svc.confirmEligibility('manager', pid('W13'));
  let q = buildState(svc).queues.consent;
  assert.deepEqual(q.map((x) => x.mrn), ['W09', 'W13']);
  assert.throws(() => svc.simulateConsentSigned(pid('W09'), {}), /Send the consent link first/);
  svc.sendConsentLink('nurse', pid('W09'));
  q = buildState(svc).queues.consent;
  assert.deepEqual(q.map((x) => x.mrn), ['W13', 'W09'], 'never-contacted first');
  assert.match(q[1].items[0], /consent link sent/);
  svc.simulateConsentSigned(pid('W09'), { automatedCallsOk: true, textsOk: true });
  assert.equal(svc.patientByMrn('W09')!.status, 'consented');
  assert.equal(svc.consentOf(pid('W09'))!.method, 'digital_link');
  assert.ok(buildState(svc).queues.pending.some((x) => x.mrn === 'W09' && x.items.includes('Call setup not finished')));
});

test('nurse queues: urgency after the AI run; care-not-delivered opens on the 20th and never shows minutes to go', () => {
  const { svc } = setup();
  svc.runAiCalls();
  let s = buildState(svc);
  assert.equal(s.queues.urgency[0].mrn, 'W01');
  assert.equal(s.queues.urgency[0].level, 'urgent');
  assert.ok(s.queues.urgency.some((x) => x.mrn === 'W02' && x.level === 'concern'));
  assert.equal(s.queues.care.length, 0, 'not open before the 20th');
  svc.setDate('2026-10-21');
  s = buildState(svc);
  const care = s.queues.care.find((x) => x.mrn === 'W05')!;
  assert.ok(care.items.includes('No completed nurse contact this month'));
  for (const x of s.queues.care) for (const line of x.items) assert.doesNotMatch(line, /to go|left to|more minutes/i);
});

test('CMS-1500 export opens on the date of service and excludes the claim with a bad member ID', () => {
  const { svc, pid, tick } = setup();
  for (const [m, mins] of [['W03', 22], ['W06', 26]] as const) {
    const c = svc.startNurseCall('nurse', pid(m));
    tick(mins * 1000);
    svc.endNurseCall('nurse', c.id, { outcome: 'completed' });
  }
  svc.jumpToMonthEnd();
  const s = buildState(svc);
  for (const m of ['W03', 'W06']) svc.fileNote('nurse', pid(m), s.patients.find((p) => p.mrn === m)!.note!.text);
  svc.signAttestation('physician', s.attestation.text);
  let pf = buildState(svc).preflight;
  assert.equal(pf.open, false);
  assert.equal(pf.excluded, 2, 'closed before 31 Oct');
  svc.setDate('2026-10-31');
  pf = buildState(svc).preflight;
  assert.equal(pf.open, true);
  assert.deepEqual(pf.claims.filter((c) => !c.errors.length).map((c) => c.mrn), ['W03']);
  const w06 = pf.claims.find((c) => c.mrn === 'W06')!;
  assert.match(w06.errors.join(' '), /PATIENT_INS_ID "8EM1\/WX2\/CV74"/);
});
