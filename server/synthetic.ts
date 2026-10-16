// The synthetic part of the operator demo: four fictional Texas practices whose
// patients, AI check-ins and nurse work are simulated, so the operator
// dashboard has a realistic month to show. Everything is deterministic: the
// same seed always produces the same patients, calls and nurse work. None of
// it is real data, and the screens say so.
//
// The live practice (Westfield) is not touched here: the presenter drives it
// by hand.

import type { AiScript } from '../shared/aiCall';
import { conditionList, defaultSetupFor, riskReviewNeeded } from '../shared/codes';
import { ACTIVITIES, HUMAN_TOUCH_DAYS, type ActivityKey } from '../shared/constants';
import type { CallSetup, Patient, Practice, Task } from '../shared/model';
import { DEFAULT_TARGETS, RULES } from '../shared/rules';
import {
  addBusinessDays,
  addDays,
  dateOf,
  fmtDateTime,
  fmtDuration,
  inMonth,
  isBusinessDay,
  lastDayOfMonth,
  MINUTE,
  toIso,
  toMs,
} from '../shared/time';
import type { PatientStatus, Program, ReadingType, RuleCode } from '../shared/types';
import { evaluateBilling } from './billing';
import { attestationText, buildNote, monthEndPatients } from './note';
import { eligibility, type RosterRow } from './roster';
import type { EligibilityPlan, Service } from './service';

// ───────────────────────────── deterministic randomness

export function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: small, fast and good enough for a demo. */
export class Rng {
  private s: number;
  constructor(seed: number | string) {
    this.s = (typeof seed === 'string' ? hash(seed) : seed) >>> 0 || 1;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

function bizDay(date: string): string {
  let d = date;
  while (!isBusinessDay(d)) d = addDays(d, 1);
  return d;
}

// ───────────────────────────── the portfolio

export const SIMULATED_PRACTICES = [
  { code: 'OIM', name: 'Oakridge Internal Medicine', city: 'Austin', area: '512', physician: 'Dr. Marcus Reyes', careManager: 'Rachel Okafor, RN', size: 80, spanish: 0.04 },
  { code: 'BVF', name: 'Brazos Valley Family Clinic', city: 'Bryan', area: '979', physician: 'Dr. Helen Okoro', careManager: 'Priya Shah, RN', size: 70, spanish: 0.08 },
  { code: 'HCP', name: 'Hill Country Primary Care', city: 'Kerrville', area: '830', physician: 'Dr. Samuel Whitaker', careManager: 'Marcus Bell, RN', size: 65, spanish: 0.05 },
  { code: 'GCS', name: 'Gulf Coast Senior Health', city: 'Corpus Christi', area: '361', physician: 'Dr. Lucia Fernandez', careManager: 'Elena Torres, RN', size: 60, spanish: 0.14 },
] as const;

type SimPractice = (typeof SIMULATED_PRACTICES)[number];

const FEMALE = ['Barbara', 'Patricia', 'Linda', 'Carol', 'Sandra', 'Donna', 'Sharon', 'Judith', 'Shirley', 'Joyce', 'Gloria', 'Beverly', 'Martha', 'Peggy', 'Dolores', 'Frances', 'Rosa', 'Maria', 'Guadalupe', 'Yolanda', 'Gwendolyn', 'Loretta', 'Bernice', 'Irene', 'June', 'Marilyn', 'Vivian', 'Jean', 'Phyllis', 'Elaine', 'Mae', 'Theresa'] as const;
const MALE = ['James', 'Robert', 'John', 'Michael', 'William', 'David', 'Richard', 'Charles', 'Thomas', 'Donald', 'Kenneth', 'Larry', 'Jerry', 'Dennis', 'Gary', 'Ronald', 'Raymond', 'Eugene', 'Jesus', 'Manuel', 'Jose', 'Roberto', 'Willie', 'Clarence', 'Leroy', 'Arthur', 'Roy', 'Earl', 'Vernon', 'Alvin'] as const;
const LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'] as const;
const CG_FEMALE = ['Karen', 'Susan', 'Lisa', 'Michelle', 'Angela', 'Teresa', 'Monica', 'Denise', 'Laura', 'Rebecca'] as const;
const CG_MALE = ['Mark', 'Steven', 'Brian', 'Kevin', 'Anthony', 'Daniel', 'Paul', 'Jason', 'Eric', 'Carlos'] as const;

/** Prevalence of each qualifying condition in a primary-care Medicare panel (rough, for the demo). */
const HIGHER: readonly { code: string; p: number }[] = [
  { code: 'I10', p: 0.74 },
  { code: 'E11.9', p: 0.24 },
  { code: 'E11.65', p: 0.09 },
  { code: 'N18.3', p: 0.16 },
  { code: 'N18.4', p: 0.03 },
  { code: 'I25.10', p: 0.18 },
  { code: 'I50.9', p: 0.13 },
  { code: 'I48.91', p: 0.12 },
  { code: 'J44.9', p: 0.14 },
  { code: 'F32.A', p: 0.14 },
  { code: 'F03.90', p: 0.06 },
  { code: 'J45.909', p: 0.05 },
];
const LOWER: readonly { code: string; p: number }[] = [
  { code: 'E78.5', p: 0.55 },
  { code: 'M19.90', p: 0.28 },
  { code: 'E03.9', p: 0.14 },
  { code: 'M81.0', p: 0.11 },
];
const EXCLUSIVE = [
  ['E11.9', 'E11.65'],
  ['N18.3', 'N18.4'],
];

function sampleCodes(r: Rng, kind: 'normal' | 'lower' | 'one'): string[] {
  if (kind === 'one') return [r.pick(['I10', 'E11.9', 'E78.5'])];
  if (kind === 'lower') {
    const out = [r.chance(0.7) ? 'I10' : 'E11.9', 'E78.5'];
    if (r.chance(0.4)) out.push(r.pick(['M19.90', 'E03.9', 'M81.0']));
    return out;
  }
  const out: string[] = [];
  const add = (c: string) => {
    if (out.includes(c)) return;
    if (EXCLUSIVE.some((g) => g.includes(c) && g.some((x) => out.includes(x)))) return;
    out.push(c);
  };
  for (const h of HIGHER) if (r.chance(h.p)) add(h.code);
  while (out.length < 2) add(r.pick(HIGHER).code);
  for (const l of LOWER) if (r.chance(l.p)) add(l.code);
  return out.slice(0, 5);
}

const MEDS: Record<string, readonly string[]> = {
  I10: ['lisinopril', 'amlodipine', 'losartan'],
  'E11.9': ['metformin', 'glipizide'],
  'E11.65': ['metformin', 'insulin'],
  'I50.9': ['furosemide', 'carvedilol'],
  'I48.91': ['apixaban', 'metoprolol'],
  'E78.5': ['atorvastatin'],
  'E03.9': ['levothyroxine'],
  'F32.A': ['sertraline'],
  'J44.9': ['tiotropium'],
  'N18.3': ['losartan'],
  'N18.4': ['losartan'],
  'I25.10': ['clopidogrel'],
  'M81.0': ['alendronate'],
  'F03.90': ['donepezil'],
  'J45.909': ['fluticasone'],
  'M19.90': ['meloxicam'],
};

function medFor(codes: string[], r: Rng): string {
  const pool = codes.flatMap((c) => MEDS[c] ?? []);
  return pool.length ? r.pick(pool) : 'lisinopril';
}

/** Days the simulated practices' AI check-ins are scheduled on. */
const AI_DAYS = ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];

export const SYNTH_PLAN = 'synthPlan';
export const ELIGIBILITY_PLAN = 'eligibilityPlan';

export interface SynthPlan {
  /** Patients whose October AI call surfaces an urgent symptom, and which one. */
  urgent: Record<string, RuleCode>;
  /** Two records of the same person at two practices. */
  duplicate: string[];
}

export const EMPTY_SYNTH_PLAN: SynthPlan = { urgent: {}, duplicate: [] };

function insertConsent(
  svc: Service,
  pid: number,
  c: { method: 'at_visit' | 'nurse_phone'; date: string; capturedBy: string; auto: boolean; texts: boolean; revokedAt?: string | null },
): void {
  svc.db
    .prepare(
      `INSERT INTO consent (patient_id, method, consent_date, captured_by, explained_availability, explained_cost_sharing,
         explained_one_practitioner, explained_right_to_stop, automated_calls_ok, texts_ok, revoked_at)
       VALUES (?, ?, ?, ?, 1, 1, 1, 1, ?, ?, ?)`,
    )
    .run(pid, c.method, c.date, c.capturedBy, c.auto ? 1 : 0, c.texts ? 1 : 0, c.revokedAt ?? null);
}

function insertSetup(svc: Service, pid: number, codes: string[], r: Rng): void {
  const s = defaultSetupFor(codes);
  const targets = JSON.parse(JSON.stringify(DEFAULT_TARGETS));
  if (codes.includes('I50.9')) targets.weight = { baseline: r.int(140, 230), maxGain: 5 };
  svc.db
    .prepare('INSERT INTO call_setup (patient_id, readings, symptoms_to_watch, targets, ehr_plan_reviewed_on) VALUES (?, ?, ?, ?, ?)')
    .run(pid, JSON.stringify(s.readings), JSON.stringify(s.rules), JSON.stringify(targets), addDays('2026-10-01', -r.int(10, 365)));
}

function insertHistoryCall(svc: Service, pid: number, kind: 'ai' | 'nurse', at: string, minutes: number, answeredBy: 'patient' | 'caregiver'): void {
  svc.db
    .prepare(
      `INSERT INTO call (patient_id, kind, status, attempt, purpose, started_at, ended_at, outcome, answered_by,
         transcript, answers, flag, reviewed_at)
       VALUES (?, ?, 'done', 1, ?, ?, ?, 'completed', ?, ?, ?, 'none', ?)`,
    )
    .run(
      pid,
      kind,
      kind === 'ai' ? 'Monthly AI check-in' : 'Monthly nurse call',
      at,
      toIso(toMs(at) + minutes * MINUTE),
      answeredBy,
      JSON.stringify([{ who: 'system', text: 'Earlier check-in (synthetic history; no transcript kept).' }]),
      JSON.stringify({ symptoms: {}, readings: {}, requests: [], meds: { status: 'ok' } }),
      kind === 'ai' ? toIso(toMs(at) + 60 * MINUTE) : null,
    );
}

function seedPatient(svc: Service, pr: Practice, sp: SimPractice, i: number, override?: Partial<RosterRow>): number {
  const r = new Rng(`${sp.code}-${i}`);
  const female = r.chance(0.57);
  const first = r.pick(female ? FEMALE : MALE);
  const last = r.pick(LAST);
  const dob = `${r.int(1936, 1959)}-${pad(r.int(1, 12))}-${pad(r.int(1, 28))}`;
  const phone = `+1 ${sp.area} 555 01${pad(r.int(0, 99))}`;
  const roll = r.next();
  const codes = sampleCodes(r, roll < 0.04 ? 'one' : roll < 0.11 ? 'lower' : 'normal');
  const coverage = r.chance(0.06) ? 'advantage' : 'traditional';
  const isQmb = coverage === 'traditional' && r.chance(0.15);
  const lastVisit = r.chance(0.05) ? addDays('2025-09-30', -r.int(0, 120)) : addDays('2026-10-02', -r.int(5, 320));
  let caregiver: string | null = null;
  let caregiverPhone: string | null = null;
  if (r.chance(0.22)) {
    const rel = r.chance(0.5) ? 'daughter' : r.chance(0.5) ? 'son' : female ? 'husband' : 'wife';
    const cgFemale = rel === 'daughter' || rel === 'wife';
    caregiver = `${r.pick(cgFemale ? CG_FEMALE : CG_MALE)} ${last} (${rel})`;
    caregiverPhone = `+1 ${sp.area} 555 01${pad(r.int(0, 99))}`;
  }
  const language = r.chance(sp.spanish) ? 'Spanish' : 'English';
  const row: RosterRow = {
    mrn: `${sp.code[0]}${String(i).padStart(3, '0')}`,
    first_name: first,
    last_name: last,
    dob,
    phone,
    state: 'TX',
    coverage,
    is_qmb: isQmb,
    codes,
    last_visit_date: lastVisit,
    caregiver_name: caregiver,
    caregiver_phone: caregiverPhone,
    preferred_language: language,
    consent: null,
    ...override,
  };
  // The operator's eligibility batch ran on 1 Oct; a few records were missed and still show September.
  const verified = {
    coverage_verified_on: r.chance(0.96) ? '2026-10-01' : '2026-09-01',
    qmb_verified_on: row.is_qmb ? (r.chance(0.96) ? '2026-10-01' : '2026-09-01') : null,
  };
  const e = eligibility(row, '2026-10-05');
  if (e.status !== 'eligible_unconfirmed') return svc.insertPatient(row, e.status, e.reason, null, pr, verified);

  const s = r.next();
  const status: PatientStatus = s < 0.8 ? 'active' : s < 0.85 ? 'eligible_unconfirmed' : s < 0.9 ? 'confirmed' : s < 0.92 ? 'consented' : s < 0.96 ? 'opted_out' : 'active';
  if (status === 'eligible_unconfirmed' || status === 'confirmed') return svc.insertPatient(row, status, null, null, pr, verified);

  const program: Program = r.chance(0.6) ? 'apcm' : 'ccm';
  const consentDate = override?.mrn ? '2026-09-21' : addDays('2026-09-25', -r.int(0, 420));
  const method = r.chance(0.7) ? 'at_visit' : 'nurse_phone';
  const auto = r.chance(program === 'apcm' ? 0.9 : 0.7);
  const texts = r.chance(0.5);
  const prefersHuman = program === 'apcm' && r.chance(0.05);
  const pid = svc.insertPatient(row, status, null, status === 'consented' ? null : program, pr, { ...verified, prefers_human: prefersHuman });
  insertConsent(svc, pid, {
    method,
    date: consentDate,
    capturedBy: method === 'at_visit' ? `${pr.physician} (office visit)` : pr.care_manager,
    auto,
    texts,
    revokedAt: status === 'opted_out' ? addDays('2026-09-28', -r.int(0, 20)) : null,
  });
  if (status === 'consented') return pid;
  insertSetup(svc, pid, codes, r);
  if (status === 'opted_out') return pid;

  // History: September's monthly contact, and the last nurse contact for AI-called patients.
  const aiOk = program === 'apcm' && auto && !prefersHuman && language === 'English';
  const sept = bizDay(`2026-09-${pad(r.int(8, 25))}`);
  const answeredBy = caregiver && r.chance(0.4) ? 'caregiver' : 'patient';
  if (aiOk) {
    insertHistoryCall(svc, pid, 'ai', `${sept}T10:00:00`, 3, answeredBy);
    const recent = r.chance(0.86);
    const nurseDay = recent ? bizDay(addDays('2026-09-30', -r.int(0, 75))) : bizDay(addDays('2026-07-01', -r.int(10, 100)));
    insertHistoryCall(svc, pid, 'nurse', `${nurseDay}T11:00:00`, r.int(10, 16), 'patient');
  } else {
    insertHistoryCall(svc, pid, 'nurse', `${sept}T${pad(r.int(9, 15))}:00:00`, r.int(14, 22), answeredBy);
  }

  // October.
  if (program === 'ccm') svc.scheduleMonthly(pid, 'nurse', `${bizDay(`2026-10-${pad(r.int(5, 16))}`)}T${pad(r.int(9, 15))}:00:00`);
  else if (aiOk) svc.scheduleMonthly(pid, 'ai', `${r.pick(AI_DAYS)}T10:00:00`);
  else {
    const p = svc.patient(pid);
    svc.ensureNurseCallTask(p, `No AI call: ${svc.aiAllowed(p).reason}.`, 'System');
  }
  return pid;
}

interface Picked {
  mrn: string;
  id: number;
}

/** The candidate with the smallest hash: a stable "random" choice. */
function pickOne(svc: Service, sql: string, args: unknown[], salt: string): Picked | null {
  const rows = svc.db.prepare(sql).all(...args) as Picked[];
  if (!rows.length) return null;
  return rows.reduce((a, b) => (hash(`${salt}-${b.mrn}`) < hash(`${salt}-${a.mrn}`) ? b : a));
}

export function seedPortfolio(svc: Service): { practices: number; patients: number } {
  const plan: SynthPlan = { urgent: {}, duplicate: [] };
  const elig: EligibilityPlan = { maSwitch: [], qmbEnded: [] };
  const made: Practice[] = [];
  let patients = 0;
  SIMULATED_PRACTICES.forEach((sp, idx) => {
    const pr = svc.insertPractice({
      code: sp.code,
      name: sp.name,
      city: sp.city,
      state: 'TX',
      phone: `+1 ${sp.area} 555 01${90 + idx}`,
      physician: sp.physician,
      care_manager: sp.careManager,
      simulated: true,
    });
    made.push(pr);
    for (let i = 1; i <= sp.size; i++) {
      seedPatient(svc, pr, sp, i);
      patients += 1;
    }
  });
  const byCode = (c: string) => made.find((m) => m.code === c)!;
  const activeAi = `SELECT p.id, p.mrn FROM patient p JOIN call c ON c.patient_id = p.id
     WHERE p.practice_id = ? AND p.status = 'active' AND p.program = 'apcm' AND c.kind = 'ai' AND c.status = 'scheduled'`;

  // Two urgent symptoms in October across the simulated practices (about 1.5% of AI calls).
  for (const [code, rule] of [
    ['OIM', 'chest_pain'],
    ['HCP', 'stroke_signs'],
  ] as const) {
    const rows = (svc.db.prepare(`${activeAi} GROUP BY p.id`).all(byCode(code).id) as Picked[]).filter((x) =>
      svc.setupOf(x.id)!.symptoms_to_watch.includes(rule),
    );
    if (rows.length) plan.urgent[rows.reduce((a, b) => (hash(`u-${b.mrn}`) < hash(`u-${a.mrn}`) ? b : a)).mrn] = rule;
  }

  // The eligibility check will find one patient now in Medicare Advantage and one whose QMB ended.
  const ma = pickOne(
    svc,
    `SELECT id, mrn FROM patient WHERE practice_id = ? AND status = 'active' AND coverage = 'traditional'`,
    [byCode('BVF').id],
    'ma',
  );
  if (ma) {
    svc.db.prepare("UPDATE patient SET coverage_verified_on = '2026-09-01' WHERE id = ?").run(ma.id);
    elig.maSwitch.push(ma.mrn);
  }
  const qmb = pickOne(
    svc,
    `SELECT p.id, p.mrn FROM patient p WHERE p.practice_id = ? AND p.status = 'active' AND p.program = 'apcm' AND p.is_qmb = 1`,
    [byCode('GCS').id],
    'qmb',
  );
  if (qmb) {
    svc.db.prepare("UPDATE patient SET qmb_verified_on = '2026-09-01' WHERE id = ?").run(qmb.id);
    elig.qmbEnded.push(qmb.mrn);
  }

  // The same person enrolled at two practices: only one of them may bill in a month.
  const dup = pickOne(
    svc,
    `${activeAi} AND p.is_qmb = 0 AND p.mrn != ? GROUP BY p.id`,
    [byCode('BVF').id, ma?.mrn ?? ''],
    'dup',
  );
  if (dup) {
    const src = svc.patient(dup.id);
    const hcp = SIMULATED_PRACTICES.find((x) => x.code === 'HCP')!;
    const mrn = `H${String(hcp.size + 1).padStart(3, '0')}`;
    const pid = svc.insertPatient(
      {
        mrn,
        first_name: src.first_name,
        last_name: src.last_name,
        dob: src.dob,
        phone: src.phone,
        state: 'TX',
        coverage: 'traditional',
        is_qmb: false,
        codes: src.qualifying_codes,
        last_visit_date: '2026-09-18',
        caregiver_name: null,
        caregiver_phone: null,
        preferred_language: 'English',
        consent: null,
      },
      'active',
      null,
      'apcm',
      byCode('HCP'),
      { coverage_verified_on: '2026-10-01' },
    );
    insertConsent(svc, pid, { method: 'at_visit', date: '2026-09-18', capturedBy: `${byCode('HCP').physician} (office visit)`, auto: true, texts: false });
    insertSetup(svc, pid, src.qualifying_codes, new Rng(`dup-${mrn}`));
    insertHistoryCall(svc, pid, 'nurse', '2026-09-18T15:00:00', 12, 'patient');
    svc.scheduleMonthly(pid, 'ai', '2026-10-14T10:00:00');
    plan.duplicate = [src.mrn, mrn];
    patients += 1;
  }

  svc.setKv(SYNTH_PLAN, plan);
  svc.setKv(ELIGIBILITY_PLAN, elig);
  return { practices: made.length, patients };
}

// ───────────────────────────── synthetic AI call answers

const CONCERN_LINES: Partial<Record<RuleCode, (who: string | null) => string>> = {
  leg_swelling: (w) => (w ? `Yes, ${w}'s ankles have been more swollen this week.` : 'Yes, my ankles have been more swollen this week.'),
  weight_gain: () => 'Yes, about four pounds since Monday.',
  rescue_inhaler: () => 'Yes, about 4 times a day now.',
  low_glucose_spells: (w) => (w ? `Yes, ${w} got shaky and sweaty a couple of times.` : 'Yes, I got shaky and sweaty a couple of times.'),
  palpitations: (w) => (w ? `Yes, ${w}'s heart was racing a few times this week.` : 'Yes, my heart was racing a few times this week.'),
  low_mood: (w) => (w ? `Yes, ${w} has been feeling down most days.` : "Yes, I've been feeling down most days."),
  confusion: (w) => (w ? `Yes, ${w} is a little more mixed up in the evenings.` : 'Yes, a little more mixed up in the evenings.'),
  falls: (w) => (w ? `Yes, ${w} fell in the bathroom last week but is okay.` : "Yes, I fell in the bathroom last week, but I'm okay."),
};

const URGENT_LINES: Partial<Record<RuleCode, (who: string | null) => string>> = {
  chest_pain: (w) => (w ? `Yes, ${w} has had chest pressure since this morning.` : "Yes, I've had chest pressure since this morning."),
  stroke_signs: (w) => (w ? `Yes, ${w}'s left arm has been weak and numb since last night.` : 'Yes, my left arm has been weak and numb since last night.'),
};

const ER_REASONS = ['dizziness', 'a urinary infection', 'a bad cut on my hand', 'stomach pain'] as const;

function readingLine(t: ReadingType, setup: CallSetup, c: Rng): string {
  switch (t) {
    case 'bp':
      return c.chance(0.05) ? `${c.int(162, 178)} over ${c.int(92, 104)}` : `${c.int(116, 138)} over ${c.int(68, 86)}`;
    case 'glucose': {
      const x = c.next();
      return x < 0.04 ? `${c.int(205, 265)} this morning` : x < 0.05 ? `${c.int(58, 66)} this morning` : `${c.int(96, 142)}`;
    }
    case 'weight': {
      const b = setup.targets.weight.baseline;
      if (b == null) return `${c.int(140, 230)}`;
      return c.chance(0.05) ? `${b + c.int(5, 8)}` : `${b + c.int(-2, 2)}`;
    }
    case 'oxygen':
      return c.chance(0.03) ? `${c.int(88, 90)}` : `${c.int(93, 98)}`;
  }
}

/**
 * One simulated patient's answers to one AI call attempt. Pickup depends on the attempt;
 * everything the patient says is fixed per patient, so retries tell the same story.
 */
export function synthAiScript(p: Patient, setup: CallSetup, attempt: number, plan: SynthPlan = EMPTY_SYNTH_PLAN): AiScript {
  const r = new Rng(`${p.mrn}-ai-${attempt}`);
  const c = new Rng(`${p.mrn}-content`);
  const pickup = attempt === 1 ? 0.72 : attempt === 2 ? 0.6 : 0.52;
  if (!r.chance(pickup) && !plan.urgent[p.mrn]) return { pickup: false };
  const cg = !!p.caregiver_name && c.chance(0.45);
  const who = cg ? p.first_name : null;
  const sc: AiScript = { identify: cg ? 'caregiver' : 'patient', symptoms: {}, readings: {} };
  const d = c.next();
  const urgent = plan.urgent[p.mrn];
  if (!urgent) {
    if (d < 0.012) return { ...sc, disclose: 'Stop calling me.' };
    if (d < 0.05) return { ...sc, disclose: "I'd rather talk to a nurse." };
    if (d < 0.08 && attempt === 1) return { ...sc, disclose: 'Not now, call me back later.' };
  }
  const med = medFor(p.qualifying_codes, c);
  if (c.chance(0.06)) sc.meds = cg ? `${who} ran out of ${med} ${c.int(2, 6)} days ago.` : `I ran out of my ${med} ${c.int(2, 6)} days ago.`;
  if (urgent && URGENT_LINES[urgent]) sc.symptoms![urgent] = URGENT_LINES[urgent]!(who);
  else {
    for (const rule of setup.symptoms_to_watch.filter((x) => RULES[x].level === 'concern')) {
      if (c.chance(0.03) && CONCERN_LINES[rule]) {
        sc.symptoms![rule] = CONCERN_LINES[rule]!(who);
        break;
      }
    }
  }
  if (c.chance(0.04)) {
    const day = c.int(1, 4);
    sc.er = cg
      ? `Yes, ${who} went to the ER on Oct ${day} for ${c.pick(ER_REASONS).replace('my', 'their')} and came home the same day.`
      : `Yes, I went to the ER on Oct ${day} for ${c.pick(ER_REASONS)}. They sent me home the same day.`;
  }
  for (const t of setup.readings) {
    if (c.chance(0.1)) continue;
    sc.readings![t] = readingLine(t, setup, c);
  }
  const n = c.next();
  if (n < 0.05) sc.needs = cg ? `${who} needs a refill of ${med}.` : `I need a refill of my ${med}.`;
  else if (n < 0.09) sc.needs = 'Can I get an appointment with the doctor?';
  else if (n < 0.11) sc.needs = 'Please have the nurse call me.';
  return sc;
}

// ───────────────────────────── the care team's month

export interface TeamWorkView {
  nurseCalls: number;
  reviews: number;
  flagsResolved: number;
  tasksClosed: number;
  minutes: number;
  riskReviewed: number;
  riskNotMet: number;
}

export interface CloseView {
  filed: number;
  attested: number;
  unfiled: number;
  unattested: number;
}

const LATEST = toMs('2026-10-29T16:30:00');

/** Moves a time into working hours (09:00–16:30, Mon–Fri) and never past 29 Oct. */
function workTime(ms: number): number {
  let t = Math.min(ms, LATEST);
  for (let guard = 0; guard < 10; guard++) {
    const iso = toIso(t);
    const date = dateOf(iso);
    const h = Number(iso.slice(11, 13)) + Number(iso.slice(14, 16)) / 60;
    if (!isBusinessDay(date) || h >= 16.5) {
      const next = addBusinessDays(date, 1);
      t = toMs(`${next}T09:${pad((t / MINUTE) % 50)}:00`);
      if (t > LATEST) return LATEST - 30 * MINUTE;
      continue;
    }
    if (h < 9) return toMs(`${date}T09:${pad((t / MINUTE) % 40)}:00`);
    return t;
  }
  return Math.min(t, LATEST);
}

const RESOLUTIONS: Partial<Record<string, readonly string[]>> = {
  missed_meds: ['Refill sent to the pharmacy; patient restarted the medicine.', 'Pharmacy called; refill ready today. Patient will pick it up.'],
  bp_high: ['Recheck in 3 days; physician notified of the reading.', 'Home readings reviewed; physician adjusted the dose.'],
  glucose_high: ['Diet and doses reviewed; physician notified.', 'Missed doses this week; adherence plan agreed; physician notified.'],
  glucose_low: ['Physician notified; dose review requested.'],
  weight_up: ['Diuretic adherence reviewed; physician notified; weight recheck in 2 days.'],
  leg_swelling: ['Diuretic adherence reviewed; physician notified; weight recheck in 2 days.'],
  weight_gain: ['Diuretic adherence reviewed; physician notified; weight recheck in 2 days.'],
  oxygen_low: ['Inhaler use reviewed; physician notified; same-week visit booked.'],
  er_visit: ['Discharge summary requested; medicines reconciled; follow-up visit booked.'],
  falls: ['No injury; home safety reviewed; physician asked about a PT referral.'],
  low_mood: ['PHQ-9 done by phone; physician notified for follow-up.'],
  palpitations: ['Physician notified; ECG booked at the practice.'],
  rescue_inhaler: ['Inhaler technique reviewed; physician notified.'],
  confusion: ['Caregiver counselled; physician notified; visit booked.'],
  low_glucose_spells: ['Physician notified; dose review requested.'],
};

const RISK_REASONS = [
  'an ER visit in the last 6 months',
  'medicine changes in the last 3 months',
  'readings above target at the last two visits',
  'a fall in the last 6 months',
] as const;

class Team {
  readonly out: TeamWorkView = { nurseCalls: 0, reviews: 0, flagsResolved: 0, tasksClosed: 0, minutes: 0, riskReviewed: 0, riskNotMet: 0 };
  constructor(private svc: Service) {}

  /** A timed piece of work, never overlapping the patient's previous one. */
  timed(p: Patient, cursor: { t: number }, activity: ActivityKey, startMs: number, secs: number, outcome: string, callId: number | null = null, counts?: boolean): { start: number; end: number } {
    const start = workTime(Math.max(startMs, cursor.t));
    const end = start + secs * 1000;
    const c = counts ?? ACTIVITIES[activity].counts;
    this.svc.db
      .prepare('INSERT INTO time_entry (patient_id, user, activity, outcome, started_at, ended_at, seconds, counts, call_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(p.id, p.care_manager, activity, outcome, toIso(start), toIso(end), secs, c ? 1 : 0, callId);
    this.svc.log('time.logged', `${ACTIVITIES[activity].label}: ${fmtDuration(secs)}, ${c ? 'counted' : 'not counted'} — ${outcome} (simulated team).`, p.id, p.care_manager, toIso(end));
    cursor.t = end + 4 * MINUTE;
    this.out.minutes += secs / 60;
    return { start, end };
  }

  nurseCall(p: Patient, cursor: { t: number }, startMs: number, secs: number, reached: boolean, note: string, purpose = 'Nurse call', scheduledId?: number): number {
    const start = workTime(Math.max(startMs, cursor.t));
    const answers = JSON.stringify({ symptoms: {}, readings: {}, requests: [], meds: { status: 'ok' } });
    const transcript = JSON.stringify([{ who: 'system', text: 'Simulated nurse call (synthetic data; no transcript kept).' }]);
    let id: number;
    const end = toIso(start + secs * 1000);
    if (scheduledId) {
      this.svc.db
        .prepare(
          `UPDATE call SET status = 'done', started_at = ?, ended_at = ?, outcome = ?, answered_by = ?, transcript = ?, answers = ?, nurse_note = ? WHERE id = ?`,
        )
        .run(toIso(start), end, reached ? 'completed' : 'no_answer', reached ? 'patient' : null, transcript, answers, reached ? note : null, scheduledId);
      id = scheduledId;
    } else {
      const info = this.svc.db
        .prepare(
          `INSERT INTO call (patient_id, kind, status, attempt, purpose, started_at, ended_at, outcome, answered_by, transcript, answers, flag, nurse_note)
           VALUES (?, 'nurse', 'done', 1, ?, ?, ?, ?, ?, ?, ?, 'none', ?)`,
        )
        .run(p.id, purpose, toIso(start), end, reached ? 'completed' : 'no_answer', reached ? 'patient' : null, transcript, answers, reached ? note : null);
      id = Number(info.lastInsertRowid);
    }
    this.timed(p, cursor, 'nurse_call', start, secs, reached ? 'Completed' : 'No answer', id, reached);
    this.svc.log('call.nurse', `Nurse call ${fmtDateTime(toIso(start))}: ${reached ? 'completed' : 'no answer'}, ${fmtDuration(secs)} (simulated team).${reached ? ` ${note}` : ''}`, p.id, p.care_manager, end);
    if (reached) this.out.nurseCalls += 1;
    return id;
  }

  closeTasks(p: Patient, at: string, note: string, filter: (t: Task) => boolean = () => true): void {
    for (const t of this.svc.tasksOf(p.id).filter((x) => x.status === 'open' && filter(x))) {
      this.svc.db.prepare("UPDATE task SET status = 'done', closed_at = ?, close_note = ? WHERE id = ?").run(at, note, t.id);
      this.svc.log('task.closed', `Task closed: ${t.title} — ${note}`, p.id, p.care_manager, at);
      this.out.tasksClosed += 1;
    }
  }
}

function lastHumanTouch(svc: Service, p: Patient): string | null {
  const c = svc.consentOf(p.id);
  const calls = svc.callsOf(p.id).filter((x) => x.kind === 'nurse' && x.status === 'done' && x.outcome === 'completed' && x.answered_by);
  const dates = [...calls.map((x) => dateOf(x.started_at!)), ...(c ? [c.consent_date] : [])].sort();
  return dates.length ? dates[dates.length - 1] : null;
}

function simulatePatient(svc: Service, team: Team, p: Patient, month: string): void {
  const r = new Rng(`${p.mrn}-team`);
  const cursor = { t: toMs(`${month}-05T09:30:00`) };
  const setup = svc.setupOf(p.id);
  const monthCalls = svc.callsOf(p.id).filter((c) => c.status === 'done' && inMonth(c.started_at, month));

  // 1. Flags from this month's calls.
  for (const f of svc.flagsOf(p.id).filter((x) => !x.resolved_at && inMonth(x.raised_at, month))) {
    if (f.level === 'urgent') {
      const id = team.nurseCall(p, cursor, toMs(f.raised_at) + r.int(2, 6) * MINUTE, r.int(16, 22) * 60, true, 'Took the live transfer: patient called 911 with the nurse on the line; EMS took the patient to the ER.', 'Live transfer from AI check-in');
      const at = toIso(cursor.t);
      const note = r.chance(0.5)
        ? 'Seen in the ER and admitted overnight for observation; discharged 2 days later. Transition follow-up done.'
        : 'Evaluated in the ER and discharged the same day; follow-up visit booked with the physician.';
      svc.db.prepare('UPDATE flag SET acknowledged_at = COALESCE(acknowledged_at, ?), resolved_at = ?, note = ? WHERE id = ?').run(at, at, note, f.id);
      svc.log('flag.resolved', `Urgent flag resolved: ${note}`, p.id, p.care_manager, at);
      team.out.flagsResolved += 1;
      const follow = toMs(`${addBusinessDays(dateOf(at), 2)}T10:00:00`);
      team.nurseCall(p, cursor, follow, r.int(12, 18) * 60, true, 'Post-discharge call: medicines reconciled, follow-up visit confirmed.', 'Transition follow-up');
      svc.db.prepare('UPDATE call SET reviewed_at = ? WHERE id = ?').run(at, f.call_id);
      void id;
      continue;
    }
    const ack = toMs(`${addBusinessDays(dateOf(f.raised_at), 1)}T09:${pad(r.int(0, 45))}:00`);
    svc.db.prepare('UPDATE flag SET acknowledged_at = COALESCE(acknowledged_at, ?) WHERE id = ?').run(toIso(ack), f.id);
    const reached = r.chance(0.9);
    if (!reached) team.nurseCall(p, cursor, ack + 20 * MINUTE, 60, false, '');
    const start = reached ? ack + 20 * MINUTE : toMs(`${addBusinessDays(dateOf(toIso(ack)), 1)}T10:30:00`);
    const rules = f.rule.split(',');
    const resolution = RESOLUTIONS[rules[0]] ? r.pick(RESOLUTIONS[rules[0]]!) : 'Followed up by phone; physician notified.';
    team.nurseCall(p, cursor, start, r.int(8, 14) * 60, true, `Follow-up on: ${f.summary}. ${resolution}`, 'Follow-up call');
    if (rules.includes('missed_meds') || rules.includes('er_visit')) team.timed(p, cursor, 'ehr_med_review', cursor.t, r.int(3, 5) * 60, 'Medication list updated');
    if (r.chance(0.6)) team.timed(p, cursor, 'coordination', cursor.t, r.int(3, 6) * 60, r.pick(['Pharmacy contacted', 'Appointment arranged', 'Other coordination']));
    const at = toIso(cursor.t);
    svc.db.prepare('UPDATE flag SET resolved_at = ?, note = ? WHERE id = ?').run(at, resolution, f.id);
    svc.log('flag.resolved', `Concern flag resolved: ${resolution}`, p.id, p.care_manager, at);
    if (f.call_id) svc.db.prepare('UPDATE call SET reviewed_at = ? WHERE id = ?').run(at, f.call_id);
    team.out.flagsResolved += 1;
    team.closeTasks(p, at, 'Done on the follow-up call');
  }

  // 2. Open tasks: patients the AI didn't reach, who asked for a person, who get no AI calls, or who opted out.
  for (const t of svc.tasksOf(p.id).filter((x) => x.status === 'open')) {
    const due = toMs(`${t.due}T${pad(r.int(9, 14))}:${pad(r.int(0, 59))}:00`);
    if (t.kind === 'optout') {
      team.nurseCall(p, cursor, due, r.int(3, 5) * 60, true, 'Opt-out confirmed; no more check-in calls.', 'Opt-out confirmation');
      team.closeTasks(p, toIso(cursor.t), 'Opt-out confirmed by phone', (x) => x.kind === 'optout');
    } else if (t.kind === 'call') {
      const reached = r.chance(t.title.startsWith('Not reached') ? 0.7 : 0.92);
      const spanish = p.preferred_language !== 'English';
      team.nurseCall(
        p,
        cursor,
        due,
        reached ? r.int(9, 14) * 60 : 60,
        reached,
        `Monthly check-in by nurse${spanish ? ' (in Spanish)' : ''}: medicines, symptoms and readings reviewed; no concerns.`,
        'Nurse check-in call',
      );
      if (reached) team.closeTasks(p, toIso(cursor.t), 'Nurse call completed', (x) => x.kind === 'call');
    } else if (t.kind !== 'physician') {
      team.timed(p, cursor, 'coordination', due, r.int(3, 6) * 60, r.pick(['Pharmacy contacted', 'Appointment arranged', 'Other coordination']));
      team.closeTasks(p, toIso(cursor.t), 'Done', (x) => x.id === t.id);
    }
  }

  if (p.status !== 'active') return;
  const fresh = svc.patient(p.id);

  if (fresh.program === 'apcm') {
    // 3. The operator's policy: a nurse speaks to every APCM patient at least every 90 days.
    const touch = lastHumanTouch(svc, fresh);
    const cutoff = addDays(lastDayOfMonth(month), -HUMAN_TOUCH_DAYS);
    if (!touch || touch < cutoff) {
      const reached = r.chance(0.85);
      team.nurseCall(fresh, cursor, toMs(`${month}-1${r.int(3, 9)}T13:00:00`), reached ? r.int(8, 12) * 60 : 60, reached, 'Quarterly nurse check-in: care plan goals reviewed with the patient.', 'Nurse touch (90-day policy)');
    }
    // 4. Routine review of AI calls with no concerns.
    for (const c of svc.callsOf(fresh.id).filter((x) => x.kind === 'ai' && x.status === 'done' && inMonth(x.started_at, month) && x.answered_by && x.flag === 'none' && !x.reviewed_at)) {
      const { end } = team.timed(fresh, cursor, 'call_review', toMs(c.ended_at!) + r.int(30, 240) * MINUTE, r.int(50, 140), 'Reviewed, no action', c.id);
      svc.db.prepare('UPDATE call SET reviewed_at = ? WHERE id = ?').run(toIso(end), c.id);
      team.out.reviews += 1;
    }
  } else if (fresh.program === 'ccm') {
    // 5. CCM: the monthly nurse call plus EHR work, toward the 20 counted minutes.
    const sched = svc.callsOf(fresh.id).find((x) => x.kind === 'nurse' && x.status === 'scheduled' && inMonth(x.scheduled_for, month));
    const at = sched ? toMs(sched.scheduled_for!) : toMs(`${month}-12T10:00:00`);
    let reached = r.chance(0.86);
    if (!reached) {
      team.nurseCall(fresh, cursor, at, 60, false, '');
      reached = r.chance(0.7);
      const retry = toMs(`${addBusinessDays(dateOf(toIso(at)), 3)}T11:00:00`);
      team.nurseCall(fresh, cursor, retry, reached ? r.int(13, 18) * 60 : 60, reached, 'Monthly CCM call: symptoms, medicines and goals reviewed.', 'Monthly nurse call', sched?.id);
    } else {
      team.nurseCall(fresh, cursor, at, r.int(13, 19) * 60, true, 'Monthly CCM call: symptoms, medicines and goals reviewed.', 'Monthly nurse call', sched?.id);
    }
    if (reached) {
      if (r.chance(0.85)) team.timed(fresh, cursor, 'ehr_chart_review', cursor.t, r.int(2, 4) * 60, 'No changes needed');
      if (r.chance(0.8)) team.timed(fresh, cursor, 'ehr_med_review', cursor.t, r.int(2, 4) * 60, r.pick(['No discrepancies', 'Medication list updated']));
      if (r.chance(0.3)) team.timed(fresh, cursor, 'coordination', cursor.t, r.int(3, 8) * 60, r.pick(['Pharmacy contacted', 'Specialist office contacted', 'Appointment arranged']));
    }
  }

  // 6. Annual care plan review when it is due.
  if (setup?.ehr_plan_reviewed_on && setup.ehr_plan_reviewed_on < addDays(`${month}-01`, -335)) {
    const { end } = team.timed(fresh, cursor, 'ehr_care_plan_review', cursor.t, r.int(10, 15) * 60, 'Care plan updated');
    svc.db.prepare('UPDATE call_setup SET ehr_plan_reviewed_on = ? WHERE patient_id = ?').run(dateOf(toIso(end)), fresh.id);
  }

  // 7. Clinician review where the codes alone don't show significant risk.
  if (riskReviewNeeded(fresh.qualifying_codes) && !fresh.risk_note) {
    const roll = r.next();
    const at = toIso(workTime(cursor.t));
    if (roll < 0.45) {
      const note = `Chart reviewed with the physician: ${conditionList(fresh.qualifying_codes)}, with ${r.pick(RISK_REASONS)}; at significant risk of decompensation.`;
      svc.db.prepare('UPDATE patient SET risk_note = ?, risk_note_by = ?, risk_note_at = ? WHERE id = ?').run(note, fresh.care_manager, at, fresh.id);
      svc.log('eligibility.risk_basis', `Risk basis documented: ${note}`, fresh.id, fresh.care_manager, at);
      team.out.riskReviewed += 1;
    } else if (roll < 0.75) {
      const reason = 'does not meet the chronic-condition risk standard (clinician review)';
      svc.db.prepare("UPDATE patient SET status = 'paused', ineligible_reason = ? WHERE id = ?").run(reason, fresh.id);
      svc.db.prepare("UPDATE call SET status = 'cancelled' WHERE patient_id = ? AND status = 'scheduled'").run(fresh.id);
      svc.log('patient.status', `Status: paused — ${reason}. Not billed; future calls cancelled.`, fresh.id, fresh.care_manager, at);
      team.out.riskReviewed += 1;
      team.out.riskNotMet += 1;
    }
  }

  // 8. The monthly note: a minute of documentation for every patient worked this month.
  if (monthCalls.length || svc.timeOf(fresh.id, month).length) team.timed(fresh, cursor, 'documentation', cursor.t, r.int(45, 90), 'Documentation completed');
}

export function simulateTeamMonth(svc: Service): TeamWorkView {
  const month = svc.month();
  const team = new Team(svc);
  const simulated = new Set(svc.practices().filter((x) => x.simulated).map((x) => x.id));
  for (const p of svc.patients()) {
    if (!simulated.has(p.practice_id)) continue;
    if (!['active', 'opted_out'].includes(p.status)) continue;
    simulatePatient(svc, team, p, month);
  }
  team.out.minutes = Math.round(team.out.minutes);
  return team.out;
}

/**
 * Month end for the simulated practices: notes filed and physicians sign, with the gaps a real
 * month has (one care manager behind on notes, one physician who hasn't signed everything).
 */
export function closeMonthForSimulated(svc: Service): CloseView {
  evaluateBilling(svc, true);
  const month = svc.month();
  const out: CloseView = { filed: 0, attested: 0, unfiled: 0, unattested: 0 };
  const due = monthEndPatients(svc, month);
  for (const pr of svc.practices().filter((x) => x.simulated)) {
    const mine = due.filter((p) => p.practice_id === pr.id).sort((a, b) => a.mrn.localeCompare(b.mrn));
    const skipFile = new Set(pr.code === 'GCS' ? mine.slice(-3).map((p) => p.id) : []);
    const filedIds: number[] = [];
    mine.forEach((p, k) => {
      if (skipFile.has(p.id) || !svc.monthCloseOf(p.id, month)) {
        out.unfiled += 1;
        return;
      }
      const at = toIso(toMs(`${month}-30T09:00:00`) + ((k * 7) % 170) * MINUTE);
      svc.db.prepare('UPDATE month_close SET note_text = ?, filed_at = ? WHERE patient_id = ? AND month = ?').run(buildNote(svc, p, month), at, p.id, month);
      svc.log('note.filed', 'Note filed in the EHR (simulated team).', p.id, p.care_manager, at);
      filedIds.push(p.id);
      out.filed += 1;
    });
    const holdBack = new Set(pr.code === 'HCP' ? filedIds.slice(-6) : []);
    const rec = svc.attestPractice(pr, pr.physician, `${month}-30T12:40:00`, attestationText(month, pr.name), filedIds.filter((id) => !holdBack.has(id)));
    out.attested += rec?.patientIds.length ?? 0;
    out.unattested += holdBack.size;
  }
  return out;
}
