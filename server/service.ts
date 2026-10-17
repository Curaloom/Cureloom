import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aiCallSeconds,
  replay,
  runScripted,
  type AiContext,
  type AiInput,
  type AiScript,
  type AiState,
} from '../shared/aiCall';
import { qualifyingCodes } from '../shared/codes';
import { DEFAULT_MATRIX, matrixRows, type Condition, type MatrixRow } from '../shared/icd10';
import { FIELDS, headerSignature, suggestMapping, type FieldKey, type Mapping } from '../shared/mapper';
import { npiValid } from '../shared/npi';
import { programBlock } from '../shared/program';
import {
  ACK_WINDOW_MINUTES,
  ACTIVITIES,
  BILLING_CODES,
  DEFAULT_BILLING_SETTINGS,
  AI_CALL_HOUR,
  AI_MAX_ATTEMPTS,
  AI_RETRY_BUSINESS_DAYS,
  DEMO_LAST_DATE,
  DEMO_START,
  MONTH_END,
  PRACTICE,
  ROLE_LABEL,
  STAFF,
  WORKDAY_END_HOUR,
  WORKDAY_START_HOUR,
  type ActivityKey,
  type BillingSettings,
} from '../shared/constants';
import type { AttestationRecord, RosterPreview, RosterRowResult, RosterUploadView, RunItem, RunView } from '../shared/api';
import type { Call, CallSetup, CarePlan, Consent, EventRow, Flag, MonthClose, Patient, Task, TaskKind, TimeEntry } from '../shared/model';
import type { NurseScript } from '../shared/nurseScript';
import { answersFromTranscript, emptyAnswers, mergeAnswers, parseUtterance } from '../shared/parse';
import { assess, DEFAULT_TARGETS, levelOf, RULES, tasksFor, type TaskDraft } from '../shared/rules';
import {
  addBusinessDays,
  addDays,
  dateOf,
  fmtDate,
  fmtDateTime,
  fmtDay,
  fmtDuration,
  fmtShort,
  fmtTime,
  inMonth,
  isBusinessDay,
  MINUTE,
  monthOf,
  nextBusinessDay,
  toIso,
  toMs,
} from '../shared/time';
import type {
  Answers,
  CallOutcome,
  Finding,
  FlagLevel,
  PatientStatus,
  Complexity,
  Coverage,
  OpsDecision,
  Program,
  ReadingType,
  Role,
  RuleCode,
  Targets,
  TranscriptLine,
} from '../shared/types';
import { evaluateBilling } from './billing';
import { approvalHash, compileCarePlan } from './carePlan';
import { SCHEMA_VERSION, TABLES, type DB } from './db';
import { determine, type Determination } from './determine';
import { classifyPayer } from './payer';
import { parseCsv, parseRoster, parseRosterCsv, type RosterRow } from './roster';

export class UserError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const AI_ACTOR = 'AI caller';
export const SYSTEM = 'System';
export const TESTER = 'Tester';

/** Nurse and physician each have one timer, so a physician can time an escalation while a nurse call runs. */
export type TimerSlot = 'nurse' | 'physician';

interface Timer {
  patientId: number;
  activity: ActivityKey;
  callId: number | null;
  taskId?: number | null;
  startedAt: string;
  startedReal: number;
  speed: number;
  user: string;
}

interface StagedUpload {
  filename: string;
  at: string;
  by: string;
  signature: string;
  table: string[][];
  mapping: Mapping;
  saved: boolean;
}

/** A roster row plus what the payer and the determination made of it. */
interface PatientInput extends RosterRow {
  coverage: Coverage;
  qmb: boolean;
  d: Determination;
}

interface SeptemberSeed {
  active: {
    mrn: string;
    program: Program;
    september_overrides?: Partial<RosterRow>;
    consent: { method: 'at_visit' | 'nurse_phone'; consent_date: string; automated_calls_ok: boolean; texts_ok: boolean };
    call_setup: {
      readings: ReadingType[];
      symptoms_to_watch: RuleCode[];
      targets: Partial<Targets>;
      ehr_plan_reviewed_on: string;
    };
    september_call: {
      kind: 'ai' | 'nurse';
      at: string;
      answered_by: 'patient' | 'caregiver';
      readings: Partial<Record<ReadingType, string>>;
      note?: string;
    };
    october_call: { kind: 'ai' | 'nurse'; at: string };
  }[];
}

export interface Script {
  ai: Record<string, AiScript[]>;
  nurse: Record<string, NurseScript>;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SEED_DIR = path.resolve(HERE, '../seed');

export interface ServiceOptions {
  db: DB;
  realNow?: () => number;
  seedDir?: string;
  checkpointPath?: string;
}

const ENROLLED: PatientStatus[] = ['consented', 'plan_review', 'active', 'paused', 'opted_out'];

export function isEnrolled(p: Patient): boolean {
  return ENROLLED.includes(p.status);
}

export function fullName(p: Patient): string {
  return `${p.first_name} ${p.last_name}`;
}

function mergeTargets(t: Partial<Targets> | null | undefined): Targets {
  return {
    bp: { ...DEFAULT_TARGETS.bp, ...(t?.bp ?? {}) },
    glucose: { ...DEFAULT_TARGETS.glucose, ...(t?.glucose ?? {}) },
    weight: { ...DEFAULT_TARGETS.weight, ...(t?.weight ?? {}) },
    oxygen: { ...DEFAULT_TARGETS.oxygen, ...(t?.oxygen ?? {}) },
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Lowercase the first letter unless it starts an acronym such as "ER". */
export function lcFirst(s: string): string {
  return /^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

export function flagSummary(findings: Finding[]): string {
  const parts = findings.filter((f) => f.level !== 'info').map((f) => lcFirst(f.text));
  return cap(parts.join('; '));
}

export class Service {
  readonly db: DB;
  readonly seedDir: string;
  readonly checkpointPath: string | null;
  private realNow: () => number;
  private scriptCache: Script | null = null;
  private matrixCache: MatrixRow[] | null = null;

  constructor(o: ServiceOptions) {
    this.db = o.db;
    this.realNow = o.realNow ?? Date.now;
    this.seedDir = o.seedDir ?? DEFAULT_SEED_DIR;
    this.checkpointPath = o.checkpointPath ?? null;
  }

  // ───────────────────────────── settings, clock, log

  kv<T>(key: string, fallback: T): T {
    const r = this.db.prepare('SELECT value FROM demo WHERE key = ?').get(key) as { value: string } | undefined;
    return r ? (JSON.parse(r.value) as T) : fallback;
  }

  setKv(key: string, value: unknown): void {
    this.db
      .prepare('INSERT INTO demo (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value));
  }

  isEmpty(): boolean {
    return !this.db.prepare("SELECT 1 FROM demo WHERE key = 'clock'").get();
  }

  realMs(): number {
    return this.realNow();
  }

  private clockBase(): { demo: number; real: number } {
    return this.kv('clock', { demo: toMs(DEMO_START), real: this.realNow() });
  }

  /** Idle demo time ticks in real time but stops at the end of the working day. */
  capFor(demoMs: number): number {
    return toMs(`${toIso(demoMs).slice(0, 10)}T${String(WORKDAY_END_HOUR).padStart(2, '0')}:00:00`);
  }

  demoNowMs(): number {
    const b = this.clockBase();
    const elapsed = Math.max(0, this.realNow() - b.real);
    return b.demo + Math.min(elapsed, Math.max(0, this.capFor(b.demo) - b.demo));
  }

  now(): string {
    return toIso(Math.floor(this.demoNowMs() / 1000) * 1000);
  }

  month(): string {
    return monthOf(this.now());
  }

  speed(): number {
    return this.kv('speed', 60);
  }

  private setNow(ms: number): void {
    this.setKv('clock', { demo: ms, real: this.realNow() });
  }

  private advanceTo(ms: number): void {
    if (ms > this.demoNowMs()) this.setNow(ms);
  }

  log(type: string, detail: string, patientId: number | null, actor: string, at?: string): void {
    this.db
      .prepare('INSERT INTO event (at, actor, patient_id, type, detail) VALUES (?, ?, ?, ?, ?)')
      .run(at ?? this.now(), actor, patientId, type, detail);
  }

  /** Simulated messages: nothing is ever sent, they land in the outbox list. */
  private outbox(channel: 'alert' | 'text', to: string, body: string, patientId: number | null, at?: string): void {
    this.log(`outbox.${channel}`, `To ${to}: ${body}`, patientId, SYSTEM, at);
  }

  private need(role: Role | undefined, allowed: Role[], what: string): string {
    if (!role || !allowed.includes(role)) {
      throw new UserError(`Switch to the ${allowed.map((r) => ROLE_LABEL[r]).join(' or ')} role to ${what}.`, 403);
    }
    return STAFF[role].name;
  }

  /** Every command runs in a transaction and re-evaluates billing afterwards. */
  tx<T>(fn: () => T): T {
    return this.db.transaction(() => {
      const r = fn();
      evaluateBilling(this);
      return r;
    })();
  }

  // ───────────────────────────── reads

  private toPatient(r: any): Patient {
    return {
      ...r,
      is_qmb: !!r.is_qmb,
      prefers_human: !!r.prefers_human,
      qualifying_codes: JSON.parse(r.qualifying_codes),
      diagnosis_codes: JSON.parse(r.diagnosis_codes),
      confidence_reasons: JSON.parse(r.confidence_reasons),
    };
  }

  /** The practice's billing settings: fee schedule, NPIs, place of service, program default, value-based payers. */
  settings(): BillingSettings {
    const s = this.kv<Partial<BillingSettings>>('billingSettings', {});
    return { ...DEFAULT_BILLING_SETTINGS, ...s, fees: { ...DEFAULT_BILLING_SETTINGS.fees, ...(s.fees ?? {}) } };
  }

  /** The ICD-10 chronic condition matrix as loaded into the local database. */
  icdMatrix(): MatrixRow[] {
    if (!this.matrixCache) {
      const rows = this.db.prepare('SELECT prefix, condition, label FROM icd10_chronic ORDER BY prefix').all() as MatrixRow[];
      this.matrixCache = rows.length ? rows : DEFAULT_MATRIX;
    }
    return this.matrixCache;
  }

  patients(): Patient[] {
    return (this.db.prepare('SELECT * FROM patient ORDER BY mrn').all() as any[]).map((r) => this.toPatient(r));
  }

  patient(id: number): Patient {
    const r = this.db.prepare('SELECT * FROM patient WHERE id = ?').get(id);
    if (!r) throw new UserError(`No patient with id ${id}`, 404);
    return this.toPatient(r);
  }

  patientByMrn(mrn: string): Patient | null {
    const r = this.db.prepare('SELECT * FROM patient WHERE mrn = ?').get(mrn);
    return r ? this.toPatient(r) : null;
  }

  consentOf(pid: number): Consent | null {
    const r = this.db.prepare('SELECT * FROM consent WHERE patient_id = ? ORDER BY id DESC LIMIT 1').get(pid) as any;
    if (!r) return null;
    for (const k of [
      'explained_availability',
      'explained_cost_sharing',
      'explained_one_practitioner',
      'explained_right_to_stop',
      'automated_calls_ok',
      'texts_ok',
    ])
      r[k] = !!r[k];
    return r as Consent;
  }

  setupOf(pid: number): CallSetup | null {
    const r = this.db.prepare('SELECT * FROM call_setup WHERE patient_id = ?').get(pid) as any;
    if (!r) return null;
    return {
      ...r,
      readings: JSON.parse(r.readings),
      symptoms_to_watch: JSON.parse(r.symptoms_to_watch),
      targets: mergeTargets(JSON.parse(r.targets)),
    };
  }

  private toCall(r: any): Call {
    return { ...r, transcript: JSON.parse(r.transcript), answers: r.answers ? JSON.parse(r.answers) : null };
  }

  callsOf(pid: number): Call[] {
    return (
      this.db
        .prepare('SELECT * FROM call WHERE patient_id = ? ORDER BY COALESCE(started_at, scheduled_for), id')
        .all(pid) as any[]
    ).map((r) => this.toCall(r));
  }

  call(id: number): Call {
    const r = this.db.prepare('SELECT * FROM call WHERE id = ?').get(id);
    if (!r) throw new UserError(`No call with id ${id}`, 404);
    return this.toCall(r);
  }

  tasksOf(pid: number): Task[] {
    return this.db.prepare('SELECT * FROM task WHERE patient_id = ? ORDER BY status DESC, due, id').all(pid) as Task[];
  }

  task(id: number): Task {
    const r = this.db.prepare('SELECT * FROM task WHERE id = ?').get(id) as Task | undefined;
    if (!r) throw new UserError(`No task with id ${id}`, 404);
    return r;
  }

  flagsOf(pid: number): Flag[] {
    return this.db.prepare('SELECT * FROM flag WHERE patient_id = ? ORDER BY id').all(pid) as Flag[];
  }

  flag(id: number): Flag {
    const r = this.db.prepare('SELECT * FROM flag WHERE id = ?').get(id) as Flag | undefined;
    if (!r) throw new UserError(`No flag with id ${id}`, 404);
    return r;
  }

  allFlags(): Flag[] {
    return this.db.prepare('SELECT * FROM flag ORDER BY id').all() as Flag[];
  }

  /** Distinct chronic conditions on the patient's record. */
  conditionCount(p: Patient): number {
    return new Set(p.qualifying_codes.map((c) => this.conditionOf(c)).filter(Boolean)).size;
  }

  conditionOf(code: string): Condition | null {
    let best: MatrixRow | null = null;
    const bare = code.replace('.', '');
    for (const r of this.icdMatrix()) {
      const p = r.prefix.replace('.', '');
      if (bare.startsWith(p) && (!best || p.length > best.prefix.replace('.', '').length)) best = r;
    }
    return best?.condition ?? null;
  }

  timeOf(pid: number, month?: string): TimeEntry[] {
    const rows = this.db.prepare('SELECT * FROM time_entry WHERE patient_id = ? ORDER BY started_at, id').all(pid) as any[];
    return rows
      .map((r) => ({ ...r, counts: !!r.counts }) as TimeEntry)
      .filter((t) => !month || inMonth(t.started_at, month));
  }

  countedSeconds(pid: number, month: string): number {
    return this.timeOf(pid, month)
      .filter((t) => t.counts)
      .reduce((s, t) => s + t.seconds, 0);
  }

  monthCloseOf(pid: number, month: string): MonthClose | null {
    const r = this.db.prepare('SELECT * FROM month_close WHERE patient_id = ? AND month = ?').get(pid, month) as any;
    return r ? { ...r, lines: JSON.parse(r.lines) } : null;
  }

  private toPlan(r: any): CarePlan {
    return { ...r, content: JSON.parse(r.content) };
  }

  carePlansOf(pid: number): CarePlan[] {
    return (this.db.prepare('SELECT * FROM care_plan WHERE patient_id = ? ORDER BY version').all(pid) as any[]).map((r) => this.toPlan(r));
  }

  carePlan(id: number): CarePlan {
    const r = this.db.prepare('SELECT * FROM care_plan WHERE id = ?').get(id);
    if (!r) throw new UserError(`No care plan with id ${id}`, 404);
    return this.toPlan(r);
  }

  /** The care plan version in effect: the latest one the physician approved. */
  approvedPlan(pid: number): CarePlan | null {
    const r = this.db.prepare("SELECT * FROM care_plan WHERE patient_id = ? AND status = 'approved' ORDER BY version DESC LIMIT 1").get(pid);
    return r ? this.toPlan(r) : null;
  }

  draftPlan(pid: number): CarePlan | null {
    const r = this.db.prepare("SELECT * FROM care_plan WHERE patient_id = ? AND status = 'draft' ORDER BY version DESC LIMIT 1").get(pid);
    return r ? this.toPlan(r) : null;
  }

  /** Calls that reached the patient or caregiver this month. */
  completedContacts(pid: number, month: string): Call[] {
    return this.callsOf(pid).filter(
      (c) =>
        c.status === 'done' &&
        inMonth(c.started_at, month) &&
        (c.outcome === 'completed' || c.outcome === 'escalated') &&
        c.answered_by != null,
    );
  }

  events(filter: { patientId?: number; prefix?: string } = {}): EventRow[] {
    const where: string[] = [];
    const args: unknown[] = [];
    if (filter.patientId != null) {
      where.push('patient_id = ?');
      args.push(filter.patientId);
    }
    if (filter.prefix) {
      where.push('type LIKE ?');
      args.push(`${filter.prefix}%`);
    }
    return this.db
      .prepare(`SELECT * FROM event ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id`)
      .all(...args) as EventRow[];
  }

  timer(slot: TimerSlot = 'nurse'): Timer | null {
    return this.kv<Timer | null>(`timer.${slot}`, null);
  }

  private setTimer(slot: TimerSlot, t: Timer | null): void {
    this.setKv(`timer.${slot}`, t);
  }

  script(): Script {
    if (!this.scriptCache) {
      this.scriptCache = JSON.parse(fs.readFileSync(path.join(this.seedDir, 'october-script.json'), 'utf8'));
    }
    return this.scriptCache!;
  }

  rosterCsv(name = 'october-roster.csv'): string {
    return fs.readFileSync(path.join(this.seedDir, name), 'utf8');
  }

  aiAllowed(p: Patient): { ok: boolean; reason: string | null } {
    if (p.status !== 'active') return { ok: false, reason: 'not active' };
    if (p.program !== 'apcm') return { ok: false, reason: 'CCM patients get a nurse call' };
    if (p.prefers_human) return { ok: false, reason: 'prefers a human: nurse calls only' };
    const c = this.consentOf(p.id);
    if (!c || c.revoked_at) return { ok: false, reason: 'no active consent' };
    if (!c.automated_calls_ok) return { ok: false, reason: 'no automated-call permission in the consent' };
    if (!this.setupOf(p.id)) return { ok: false, reason: 'no call setup' };
    return { ok: true, reason: null };
  }

  aiContext(p: Patient, at: string): AiContext {
    const s = this.setupOf(p.id);
    return {
      firstName: p.first_name,
      lastName: p.last_name,
      phone: p.phone,
      caregiverName: p.caregiver_name,
      readings: s?.readings ?? [],
      symptoms: s?.symptoms_to_watch ?? [],
      callAt: at,
    };
  }

  // ───────────────────────────── reset, seed, checkpoints

  reset(): void {
    this.db.transaction(() => {
      for (const t of TABLES) this.db.prepare(`DELETE FROM ${t}`).run();
      this.db
        .prepare("DELETE FROM sqlite_sequence WHERE name IN ('patient','consent','call','task','flag','time_entry','event','care_plan')")
        .run();
      const insert = this.db.prepare('INSERT INTO icd10_chronic (prefix, condition, label) VALUES (?, ?, ?)');
      for (const r of matrixRows()) insert.run(r.prefix, r.condition, r.label);
      this.matrixCache = null;
      this.setKv('clock', { demo: toMs(DEMO_START), real: this.realNow() });
      this.setKv('speed', 60);
      this.seedSeptember();
      this.log(
        'demo.reset',
        'Reset to seed: Monday 5 Oct 2026, 09:00. Ten patients active from September; October roster not yet uploaded.',
        null,
        TESTER,
      );
      evaluateBilling(this, true);
    })();
  }

  private seedSeptember(): void {
    const seed: SeptemberSeed = JSON.parse(fs.readFileSync(path.join(this.seedDir, 'september.json'), 'utf8'));
    const today = dateOf(DEMO_START);
    const { rows } = parseRosterCsv(this.rosterCsv(), today);
    const byMrn = new Map(rows.filter((r) => r.value).map((r) => [r.value!.mrn, r.value!]));
    for (const a of seed.active) {
      const base = byMrn.get(a.mrn);
      if (!base) throw new Error(`Seed: ${a.mrn} is not in the roster CSV`);
      const r = this.assess({ ...base, ...(a.september_overrides ?? {}) }, today);
      const pid = this.insertPatient(r, 'active', null, a.program, 'approved');
      this.db
        .prepare(
          `INSERT INTO consent (patient_id, method, consent_date, captured_by, explained_availability,
            explained_cost_sharing, explained_one_practitioner, explained_right_to_stop, automated_calls_ok, texts_ok)
           VALUES (?, ?, ?, ?, 1, 1, 1, 1, ?, ?)`,
        )
        .run(
          pid,
          a.consent.method,
          a.consent.consent_date,
          a.consent.method === 'at_visit' ? `${STAFF.physician.name} (office visit)` : STAFF.nurse.name,
          a.consent.automated_calls_ok ? 1 : 0,
          a.consent.texts_ok ? 1 : 0,
        );
      this.db
        .prepare(
          'INSERT INTO call_setup (patient_id, readings, symptoms_to_watch, targets, ehr_plan_reviewed_on) VALUES (?, ?, ?, ?, ?)',
        )
        .run(
          pid,
          JSON.stringify(a.call_setup.readings),
          JSON.stringify(a.call_setup.symptoms_to_watch),
          JSON.stringify(mergeTargets(a.call_setup.targets)),
          a.call_setup.ehr_plan_reviewed_on,
        );
      const approvedAt = `${a.call_setup.ehr_plan_reviewed_on}T12:00:00`;
      const planId = this.insertPlan(this.patient(pid), STAFF.nurse.name, approvedAt);
      this.signPlan(planId, STAFF.physician.name, approvedAt);
      const sc = a.september_call;
      let answers: Answers = { ...emptyAnswers(), meds: { status: 'ok' } };
      for (const [type, text] of Object.entries(sc.readings)) {
        answers = mergeAnswers(answers, parseUtterance(text!, `reading:${type}`, sc.at));
      }
      const mins = sc.kind === 'ai' ? 3 : 15;
      this.db
        .prepare(
          `INSERT INTO call (patient_id, kind, status, attempt, purpose, started_at, ended_at, outcome, answered_by,
             transcript, answers, flag, nurse_note)
           VALUES (?, ?, 'done', 1, ?, ?, ?, 'completed', ?, ?, ?, 'none', ?)`,
        )
        .run(
          pid,
          sc.kind,
          sc.kind === 'ai' ? 'Monthly AI check-in' : 'Monthly nurse call',
          sc.at,
          toIso(toMs(sc.at) + mins * MINUTE),
          sc.answered_by,
          JSON.stringify([{ who: 'system', text: 'September check-in (seeded summary; no transcript kept).' }]),
          JSON.stringify(answers),
          sc.note ?? null,
        );
      this.scheduleMonthly(pid, a.october_call.kind, a.october_call.at);
    }
  }

  /** What the payer classifier and the program determination make of a roster row. */
  private assess(r: RosterRow, today: string): PatientInput {
    const settings = this.settings();
    const payer = classifyPayer(r.insurance_name, settings.valueBasedPayers);
    const qmb = r.is_qmb ?? payer.qmb;
    const d = determine({ codes: r.codes, repaired: r.repaired, payer, isQmb: qmb, lastVisit: r.last_visit_date }, today, settings, this.icdMatrix());
    return { ...r, coverage: payer.coverage, qmb, d };
  }

  private insertPatient(
    r: PatientInput,
    status: PatientStatus,
    reason: string | null,
    program: Program | null,
    decision: OpsDecision | null = null,
  ): number {
    const info = this.db
      .prepare(
        `INSERT INTO patient (mrn, first_name, last_name, dob, phone, state, coverage, is_qmb, qualifying_codes,
           sex, insurance_name, insurance_id, diagnosis_codes, proposed_program, confidence, confidence_reasons, ops_decision,
           last_visit_date, caregiver_name, caregiver_phone, preferred_language, prefers_human, status, ineligible_reason, program)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      )
      .run(
        r.mrn,
        r.first_name,
        r.last_name,
        r.dob,
        r.phone,
        r.state,
        r.coverage,
        r.qmb ? 1 : 0,
        JSON.stringify(qualifyingCodes(r.codes, this.icdMatrix())),
        r.sex,
        r.insurance_name,
        r.insurance_id,
        JSON.stringify(r.codes),
        program ?? r.d.program,
        r.d.confidence,
        JSON.stringify(r.d.reasons),
        decision,
        r.last_visit_date,
        r.caregiver_name,
        r.caregiver_phone,
        r.preferred_language,
        status,
        reason,
        program,
      );
    return Number(info.lastInsertRowid);
  }

  saveCheckpoint(): { savedAt: string } {
    if (!this.checkpointPath) throw new UserError('Checkpoints are not available here.');
    if (this.timer('nurse') || this.timer('physician')) throw new UserError('Stop the running timer before saving a checkpoint.');
    fs.mkdirSync(path.dirname(this.checkpointPath), { recursive: true });
    fs.rmSync(this.checkpointPath, { force: true });
    this.db.prepare('VACUUM INTO ?').run(this.checkpointPath);
    const meta = { savedAt: new Date(this.realNow()).toISOString(), demoAt: this.now(), schema: SCHEMA_VERSION };
    fs.writeFileSync(`${this.checkpointPath}.json`, JSON.stringify(meta));
    this.tx(() => this.log('demo.checkpoint', `Checkpoint saved at demo time ${fmtDateTime(meta.demoAt)}.`, null, TESTER));
    return { savedAt: meta.savedAt };
  }

  checkpointInfo(): { savedAt: string | null; demoAt: string | null } {
    if (!this.checkpointPath || !fs.existsSync(`${this.checkpointPath}.json`)) return { savedAt: null, demoAt: null };
    const meta = JSON.parse(fs.readFileSync(`${this.checkpointPath}.json`, 'utf8'));
    // A checkpoint saved under an older schema cannot be restored into this one.
    if (meta.schema !== SCHEMA_VERSION) return { savedAt: null, demoAt: null };
    return { savedAt: meta.savedAt, demoAt: meta.demoAt };
  }

  restoreCheckpoint(): void {
    const info = this.checkpointInfo();
    if (!this.checkpointPath || !info.demoAt || !fs.existsSync(this.checkpointPath))
      throw new UserError('No checkpoint saved yet.');
    this.db.prepare('ATTACH DATABASE ? AS cp').run(this.checkpointPath);
    try {
      this.db.transaction(() => {
        // Clear children before parents, then refill parents before children,
        // so no foreign key is ever dangling.
        for (const t of TABLES) this.db.prepare(`DELETE FROM main.${t}`).run();
        for (const t of [...TABLES].reverse()) this.db.prepare(`INSERT INTO main.${t} SELECT * FROM cp.${t}`).run();
        this.setNow(toMs(info.demoAt!));
        this.setTimer('nurse', null);
        this.setTimer('physician', null);
        this.matrixCache = null;
        this.log('demo.checkpoint', `Checkpoint restored (demo time ${fmtDateTime(info.demoAt!)}).`, null, TESTER);
      })();
    } finally {
      this.db.prepare('DETACH DATABASE cp').run();
    }
  }

  // ───────────────────────────── demo clock commands

  private noTimer(): void {
    const t = this.timer('nurse') ?? this.timer('physician');
    if (t) throw new UserError(`Stop the running timer (${ACTIVITIES[t.activity].label}) first.`);
  }

  private workdayStart(date: string): number {
    return toMs(`${date}T${String(WORKDAY_START_HOUR).padStart(2, '0')}:00:00`);
  }

  advanceDay(): void {
    this.tx(() => {
      this.noTimer();
      const d = addDays(dateOf(this.now()), 1);
      if (d > DEMO_LAST_DATE) throw new UserError('The demo month ends on 31 Oct.');
      this.setNow(this.workdayStart(d));
      this.log('demo.clock', `Demo date moved to ${fmtDay(d)}.`, null, TESTER);
    });
  }

  setDate(date: string): void {
    this.tx(() => {
      this.noTimer();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new UserError('Pick a date.');
      if (date <= dateOf(this.now())) throw new UserError('The demo clock only moves forward. Use Reset to start over.');
      if (date > DEMO_LAST_DATE) throw new UserError('The demo month ends on 31 Oct.');
      this.setNow(this.workdayStart(date));
      this.log('demo.clock', `Demo date moved to ${fmtDay(date)}.`, null, TESTER);
    });
  }

  jumpToMonthEnd(): void {
    this.tx(() => {
      this.noTimer();
      if (this.now() >= MONTH_END) throw new UserError('Already at month end.');
      this.setNow(toMs(MONTH_END));
      this.log('demo.clock', `Jumped to month end: ${fmtDay(MONTH_END)} ${fmtTime(MONTH_END)}.`, null, TESTER);
    });
  }

  setSpeed(speed: number): void {
    if (speed !== 1 && speed !== 60) throw new UserError('Speed is 1 (real time) or 60 (1 second = 1 minute).');
    this.tx(() => {
      this.setKv('speed', speed);
      this.log('demo.speed', speed === 60 ? 'Demo speed on: 1 second = 1 minute.' : 'Demo speed off: real time.', null, TESTER);
    });
  }

  // ───────────────────────────── scheduling helpers

  private sameDayNextMonth(at: string): string {
    const [y, m, d] = dateOf(at).split('-').map(Number);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    let date = `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
    while (!isBusinessDay(date)) date = addDays(date, 1);
    return `${date}T${at.slice(11)}`;
  }

  private insertScheduled(pid: number, kind: 'ai' | 'nurse', at: string, attempt = 1): number {
    const purpose = kind === 'ai' ? 'Monthly AI check-in' : 'Monthly nurse call';
    const info = this.db
      .prepare(`INSERT INTO call (patient_id, kind, status, scheduled_for, attempt, purpose) VALUES (?, ?, 'scheduled', ?, ?, ?)`)
      .run(pid, kind, at, attempt, purpose);
    return Number(info.lastInsertRowid);
  }

  /** A monthly check-in series: this month's call plus next month's. */
  private scheduleMonthly(pid: number, kind: 'ai' | 'nurse', at: string): void {
    this.insertScheduled(pid, kind, at);
    this.insertScheduled(pid, kind, this.sameDayNextMonth(at));
  }

  private cancelScheduled(pid: number, why: string, actor: string, kind?: 'ai' | 'nurse'): number {
    const rows = this.db
      .prepare(`SELECT id FROM call WHERE patient_id = ? AND status = 'scheduled' ${kind ? 'AND kind = ?' : ''}`)
      .all(...(kind ? [pid, kind] : [pid])) as { id: number }[];
    if (!rows.length) return 0;
    this.db
      .prepare(`UPDATE call SET status = 'cancelled' WHERE patient_id = ? AND status = 'scheduled' ${kind ? 'AND kind = ?' : ''}`)
      .run(...(kind ? [pid, kind] : [pid]));
    this.log('call.cancelled', `${rows.length} scheduled call${rows.length === 1 ? '' : 's'} cancelled: ${why}.`, pid, actor);
    return rows.length;
  }

  // ───────────────────────────── tasks and flags

  private addTaskRow(pid: number, t: TaskDraft | { kind: TaskKind; title: string; reason: string; due: string }, actor: string, callId: number | null = null, at?: string): Task | null {
    const open = this.tasksOf(pid).find((x) => x.status === 'open' && x.title === t.title);
    if (open) return null;
    const when = at ?? this.now();
    const info = this.db
      .prepare('INSERT INTO task (patient_id, title, reason, due, status, kind, created_at, call_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(pid, t.title, t.reason, t.due, 'open', t.kind, when, callId);
    this.log('task.created', `Task created: ${t.title} (due ${fmtShort(t.due)}). ${t.reason}`, pid, actor, when);
    return this.task(Number(info.lastInsertRowid));
  }

  private raiseFlag(
    p: Patient,
    callId: number | null,
    findings: Finding[],
    at: string,
    actor: string,
    opts: { acknowledgedBy?: string } = {},
  ): Flag {
    const level = levelOf(findings) as 'concern' | 'urgent';
    const relevant = findings.filter((f) => f.level === level);
    const summary = flagSummary(relevant.length ? relevant : findings);
    const escalation = relevant.find((f) => f.escalation)?.escalation ?? null;
    const ackDue = level === 'urgent' ? toIso(toMs(at) + ACK_WINDOW_MINUTES * MINUTE) : null;
    const info = this.db
      .prepare(
        `INSERT INTO flag (patient_id, call_id, level, rule, raised_at, summary, escalation, ack_due_at, acknowledged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        p.id,
        callId,
        level,
        relevant.map((f) => f.rule).join(','),
        at,
        summary,
        escalation,
        ackDue,
        opts.acknowledgedBy ? at : null,
      );
    const name = fullName(p);
    this.log('flag.raised', `${cap(level)} flag raised: ${summary}`, p.id, actor, at);
    if (level === 'urgent') {
      const told = escalation === '988' ? 'told to call or text 988' : 'told to call 911';
      this.outbox('alert', `${STAFF.nurse.name} (on-screen alert)`, `URGENT — ${name} (${p.mrn}): ${summary}. Patient ${told}. Acknowledge within ${ACK_WINDOW_MINUTES} minutes.`, p.id, at);
      this.outbox('alert', `${PRACTICE.name} front desk, ${STAFF.manager.name}`, `URGENT — ${name} (${p.mrn}) was ${told} during a check-in call. Nurse alerted.`, p.id, at);
    } else if (!opts.acknowledgedBy) {
      this.outbox('alert', `${STAFF.nurse.name} (queue)`, `Concern — ${name} (${p.mrn}): ${summary}.`, p.id, at);
    }
    if (opts.acknowledgedBy) this.log('flag.acknowledged', `${cap(level)} flag acknowledged on the call by ${opts.acknowledgedBy}.`, p.id, opts.acknowledgedBy, at);
    return this.flag(Number(info.lastInsertRowid));
  }

  addTask(role: Role, pid: number, input: { title: string; reason?: string; due?: string }): Task {
    return this.tx(() => {
      const actor = this.need(role, ['nurse'], 'add tasks');
      const title = (input.title ?? '').trim();
      if (!title) throw new UserError('Give the task a title.');
      const due = input.due && /^\d{4}-\d{2}-\d{2}$/.test(input.due) ? input.due : nextBusinessDay(this.now());
      const t = this.addTaskRow(this.patient(pid).id, { kind: 'other', title, reason: input.reason?.trim() || 'Added by nurse', due }, actor);
      if (!t) throw new UserError(`There is already an open task called "${title}".`);
      return t;
    });
  }

  closeTask(role: Role, taskId: number, note?: string): void {
    this.tx(() => {
      const t = this.task(taskId);
      const actor = this.need(role, t.kind === 'physician' ? ['physician', 'nurse'] : ['nurse'], 'close this task');
      if (t.status === 'done') throw new UserError('That task is already done.');
      this.db
        .prepare("UPDATE task SET status = 'done', closed_at = ?, close_note = ? WHERE id = ?")
        .run(this.now(), note?.trim() || null, taskId);
      this.log('task.closed', `Task closed: ${t.title}${note?.trim() ? ` — ${note.trim()}` : ''}`, t.patient_id, actor);
    });
  }

  acknowledgeFlag(role: Role, flagId: number): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'acknowledge flags');
      const f = this.flag(flagId);
      if (f.acknowledged_at) throw new UserError('Already acknowledged.');
      const now = this.now();
      this.db.prepare('UPDATE flag SET acknowledged_at = ? WHERE id = ?').run(now, flagId);
      let timing = '';
      if (f.ack_due_at) {
        const late = toMs(now) - toMs(f.ack_due_at);
        timing = late > 0 ? ` ${Math.ceil(late / MINUTE)} min after the deadline` : ` with ${Math.floor(-late / MINUTE)} min to spare`;
      }
      this.log('flag.acknowledged', `${cap(f.level)} flag acknowledged${timing}: ${f.summary}`, f.patient_id, actor);
    });
  }

  resolveFlag(role: Role, flagId: number, note: string): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'resolve flags');
      const f = this.flag(flagId);
      if (f.resolved_at) throw new UserError('Already resolved.');
      const n = (note ?? '').trim();
      if (!n) throw new UserError('Add a note saying how the flag was resolved.');
      const now = this.now();
      if (!f.acknowledged_at) {
        this.db.prepare('UPDATE flag SET acknowledged_at = ? WHERE id = ?').run(now, flagId);
        this.log('flag.acknowledged', `${cap(f.level)} flag acknowledged: ${f.summary}`, f.patient_id, actor);
      }
      this.db.prepare('UPDATE flag SET resolved_at = ?, note = ? WHERE id = ?').run(now, n, flagId);
      this.log('flag.resolved', `${cap(f.level)} flag resolved: ${n}`, f.patient_id, actor);
    });
  }

  escalateToPhysician(role: Role, pid: number, note: string): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'escalate to the physician');
      const p = this.patient(pid);
      const n = (note ?? '').trim();
      if (!n) throw new UserError('Say what you need the physician to review.');
      this.addTaskRow(p.id, { kind: 'physician', title: `Physician review requested: ${n}`, reason: `Escalated by ${actor}`, due: nextBusinessDay(this.now()) }, actor);
      this.outbox('alert', STAFF.physician.name, `Review requested for ${fullName(p)} (${p.mrn}): ${n}`, p.id);
      this.log('escalated', `Escalated to ${STAFF.physician.name}: ${n}`, p.id, actor);
    });
  }

  markCallReviewed(role: Role, callId: number): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'review calls');
      const c = this.call(callId);
      if (c.reviewed_at) throw new UserError('Already reviewed.');
      this.db.prepare('UPDATE call SET reviewed_at = ? WHERE id = ?').run(this.now(), callId);
      this.log('call.reviewed', `AI call of ${fmtShort(c.started_at)} reviewed.`, c.patient_id, actor);
    });
  }

  setPrefersHuman(role: Role, pid: number, value: boolean): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'change call preferences');
      const p = this.patient(pid);
      if (p.prefers_human === value) return;
      this.db.prepare('UPDATE patient SET prefers_human = ? WHERE id = ?').run(value ? 1 : 0, pid);
      this.log('patient.prefers_human', value ? 'Prefers a human: nurse calls only, no AI calls.' : 'No longer marked as preferring a human.', pid, actor);
      if (p.status !== 'active' || p.program !== 'apcm') return;
      if (value) {
        this.cancelScheduled(pid, 'patient prefers a human', actor, 'ai');
        this.ensureNurseCallTask(this.patient(pid), 'Prefers a human, so the monthly check-in is a nurse call.', actor);
      } else if (!this.completedContacts(pid, this.month()).length && this.aiAllowed(this.patient(pid)).ok) {
        this.scheduleMonthly(pid, 'ai', `${nextBusinessDay(this.now())}T${AI_CALL_HOUR}`);
        this.log('call.scheduled', 'AI check-in scheduled again.', pid, actor);
      }
    });
  }

  private ensureNurseCallTask(p: Patient, reason: string, actor: string): void {
    if (this.completedContacts(p.id, this.month()).length) return;
    this.addTaskRow(p.id, { kind: 'call', title: 'Nurse check-in call', reason, due: nextBusinessDay(this.now()) }, actor);
  }

  // ───────────────────────────── roster upload and enrollment

  /** Step 1 of an upload: stage the parsed table and propose a column mapping. */
  previewRoster(role: Role, filename: string, table: string[][]): RosterPreview {
    return this.tx(() => {
      const actor = this.need(role, ['manager'], 'upload the roster');
      const rows = table.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
      if (!rows.length || !rows[0].some((h) => String(h).trim())) throw new UserError('The file is empty.');
      const headers = rows[0].map((h) => String(h ?? '').trim());
      const signature = headerSignature(headers);
      const saved = this.kv<Record<string, Partial<Record<FieldKey, number | null>>>>('mappings', {})[signature];
      const stage: StagedUpload = {
        filename: filename || 'roster.csv',
        at: this.now(),
        by: actor,
        signature,
        table: rows.map((r) => headers.map((_, j) => String(r[j] ?? '').trim())),
        mapping: suggestMapping(headers, saved),
        saved: !!saved,
      };
      this.setKv('stagedUpload', stage);
      this.log('roster.previewed', `${stage.filename}: ${rows.length - 1} rows read; column mapping ${saved ? 'reused from a saved layout' : 'proposed'}.`, null, actor);
      return this.rosterPreview()!;
    });
  }

  rosterPreview(): RosterPreview | null {
    const s = this.kv<StagedUpload | null>('stagedUpload', null);
    if (!s) return null;
    return {
      filename: s.filename,
      at: s.at,
      headers: s.table[0],
      sample: s.table.slice(1, 6),
      rowCount: s.table.length - 1,
      mapping: s.mapping,
      savedLayout: s.saved,
    };
  }

  cancelRosterPreview(role: Role): void {
    this.tx(() => {
      const actor = this.need(role, ['manager'], 'upload the roster');
      this.setKv('stagedUpload', null);
      this.log('roster.cancelled', 'Staged upload discarded.', null, actor);
    });
  }

  /** Step 2: validate every row with the confirmed mapping and apply it to the roster. */
  importRoster(role: Role, columns?: Partial<Record<FieldKey, number | null>>): RosterUploadView {
    return this.tx(() => {
      const actor = this.need(role, ['manager'], 'upload the roster');
      const stage = this.kv<StagedUpload | null>('stagedUpload', null);
      if (!stage) throw new UserError('Upload a file first.');
      const mapping: Mapping = { ...stage.mapping };
      const width = stage.table[0].length;
      for (const f of FIELDS) {
        if (!columns || !(f.key in columns)) continue;
        const col = columns[f.key];
        const valid = col != null && Number.isInteger(col) && col >= 0 && col < width;
        if (valid && stage.mapping[f.key].column === col) continue;
        mapping[f.key] = valid ? { column: col!, score: 1, source: 'manual' } : { column: null, score: 0, source: 'none' };
      }
      const used = Object.values(mapping).map((m) => m.column).filter((c) => c != null);
      if (new Set(used).size !== used.length) throw new UserError('Two fields are mapped to the same column.');
      const today = dateOf(this.now());
      const { rows, headerErrors } = parseRoster(stage.table, mapping, today);
      if (headerErrors.length) throw new UserError(headerErrors.join(' '));
      const results: RosterRowResult[] = [];
      const cell = (row: number, k: FieldKey) => (mapping[k].column == null ? '' : (stage.table[row - 1][mapping[k].column!] ?? ''));
      for (const r of rows) {
        const name = `${cell(r.row, 'first_name')} ${cell(r.row, 'last_name')}`.trim();
        if (!r.value) {
          results.push({ row: r.row, mrn: cell(r.row, 'patient_id'), name, accepted: false, outcome: 'Rejected', errors: r.errors, raw: r.raw });
          continue;
        }
        const outcome = this.applyRosterRow(r.value, today, actor);
        results.push({ row: r.row, mrn: r.value.mrn, name, accepted: true, outcome, errors: [], raw: r.raw });
      }
      const view: RosterUploadView = {
        at: this.now(),
        by: actor,
        filename: stage.filename,
        accepted: results.filter((r) => r.accepted).length,
        rejected: results.filter((r) => !r.accepted).length,
        rows: results,
        mrns: results.filter((r) => r.accepted).map((r) => r.mrn),
      };
      const layouts = this.kv<Record<string, Partial<Record<FieldKey, number | null>>>>('mappings', {});
      layouts[stage.signature] = Object.fromEntries(FIELDS.map((f) => [f.key, mapping[f.key].column]));
      this.setKv('mappings', layouts);
      this.setKv('lastUpload', view);
      this.setKv('stagedUpload', null);
      this.log('roster.uploaded', `Roster ${view.filename} imported: ${view.accepted} rows accepted, ${view.rejected} rejected.`, null, actor);
      return view;
    });
  }

  /** Preview and import in one step with the proposed mapping (seed button and tests). */
  uploadRoster(role: Role, filename: string, csv: string): RosterUploadView {
    return this.tx(() => {
      this.previewRoster(role, filename, parseCsv(csv ?? ''));
      return this.importRoster(role);
    });
  }

  private applyRosterRow(row: RosterRow, today: string, actor: string): string {
    const existing = this.patientByMrn(row.mrn);
    const r = this.assess(row, today);
    const d = r.d;
    if (!existing) {
      const pid = this.insertPatient(r, d.status, d.reason, null);
      let extra = '';
      if (r.consent) {
        this.insertRosterConsent(pid, r.consent);
        extra = ` Consent from the ${fmtDate(r.consent.date)} visit recorded${r.consent.automated_calls_ok ? ' (automated calls OK)' : ''}.`;
        this.log('consent.recorded', `Consent recorded from the roster: at visit on ${fmtDate(r.consent.date)}; automated calls ${r.consent.automated_calls_ok ? 'OK' : 'not OK'}; texts ${r.consent.texts_ok ? 'OK' : 'not OK'}.`, pid, actor);
      }
      this.log('patient.added', `Added from roster: ${d.label}. Confidence ${d.confidence}.${extra}`, pid, actor);
      return `New — ${d.label}.${extra}`;
    }
    const before = existing;
    this.db
      .prepare(
        `UPDATE patient SET first_name = ?, last_name = ?, dob = ?, phone = ?, state = ?, coverage = ?, is_qmb = ?,
           qualifying_codes = ?, sex = ?, insurance_name = ?, insurance_id = ?, diagnosis_codes = ?, confidence = ?, confidence_reasons = ?,
           last_visit_date = ?, caregiver_name = ?, caregiver_phone = ?, preferred_language = ?
         WHERE id = ?`,
      )
      .run(
        r.first_name,
        r.last_name,
        r.dob,
        r.phone,
        r.state,
        r.coverage,
        r.qmb ? 1 : 0,
        JSON.stringify(qualifyingCodes(r.codes, this.icdMatrix())),
        r.sex,
        r.insurance_name,
        r.insurance_id,
        JSON.stringify(r.codes),
        d.confidence,
        JSON.stringify(d.reasons),
        r.last_visit_date,
        r.caregiver_name,
        r.caregiver_phone,
        r.preferred_language,
        existing.id,
      );
    const pid = existing.id;
    if (r.consent && !this.consentOf(pid)) {
      this.insertRosterConsent(pid, r.consent);
      this.log('consent.recorded', `Consent recorded from the roster: at visit on ${fmtDate(r.consent.date)}.`, pid, actor);
      if (existing.status === 'confirmed') this.setStatus(pid, 'consented', null, actor, 'consent arrived in the roster');
    }
    const status = this.patient(pid).status;
    const coverageChanged = r.coverage !== before.coverage;
    if (status === 'active' || status === 'consented' || status === 'plan_review') {
      const program = existing.program ?? existing.proposed_program;
      const block = program ? programBlock(program, r.coverage, d.conditions) : d.status === 'ineligible' ? d.reason : null;
      if (block) {
        const reason =
          program === 'apcm' && r.coverage === 'advantage'
            ? `${coverageChanged ? 'coverage changed to ' : ''}Medicare Advantage: APCM not covered — switch to CCM`
            : block;
        this.setStatus(pid, 'paused', reason, actor, reason);
        const n = this.cancelScheduled(pid, `paused, ${reason}`, actor);
        if (program === 'apcm' && r.coverage === 'advantage' && d.conditions >= 2) {
          this.addTaskRow(pid, { kind: 'other', title: 'Switch program to CCM', reason: `Now on ${r.insurance_name}; APCM is not covered under Medicare Advantage. Redo the call setup as CCM.`, due: nextBusinessDay(this.now()) }, actor);
        }
        this.outbox('alert', `${STAFF.nurse.name} (queue)`, `${fullName(existing)} (${existing.mrn}) paused: ${reason}. Calls cancelled.`, pid);
        return `Paused — ${reason}; ${n} scheduled call${n === 1 ? '' : 's'} cancelled.`;
      }
      if (coverageChanged) {
        this.log('patient.coverage', `Coverage changed to ${r.insurance_name}; ${program?.toUpperCase() ?? 'the program'} is still covered.`, pid, actor);
        return `Enrolled (${program?.toUpperCase() ?? 'setup pending'}) — coverage now ${r.insurance_name}; still covered.`;
      }
      return `Enrolled (${existing.program?.toUpperCase() ?? 'setup pending'}) — no change.`;
    }
    if (status === 'eligible_unconfirmed' || status === 'confirmed' || status === 'ineligible' || status === 'needs_visit') {
      if (existing.ops_decision === 'rejected') return 'Existing — rejected by practice; no change.';
      this.db.prepare('UPDATE patient SET proposed_program = ? WHERE id = ?').run(d.program, pid);
      if (d.status !== 'eligible_unconfirmed') {
        if (status !== d.status || existing.ineligible_reason !== d.reason) this.setStatus(pid, d.status, d.reason, actor, d.label);
        return `Existing — ${d.label}.`;
      }
      if (status === 'ineligible' || status === 'needs_visit') {
        this.setStatus(pid, 'eligible_unconfirmed', null, actor, 'now eligible');
        return `Existing — now ${d.label}.`;
      }
      return `Existing — ${status === 'confirmed' ? 'approved, no consent yet' : d.label}.`;
    }
    return `Existing — ${status.replace('_', ' ')}${existing.ineligible_reason ? ` (${existing.ineligible_reason})` : ''}.`;
  }

  private insertRosterConsent(pid: number, c: NonNullable<RosterRow['consent']>): void {
    this.db
      .prepare(
        `INSERT INTO consent (patient_id, method, consent_date, captured_by, explained_availability, explained_cost_sharing,
           explained_one_practitioner, explained_right_to_stop, automated_calls_ok, texts_ok)
         VALUES (?, ?, ?, ?, 1, 1, 1, 1, ?, ?)`,
      )
      .run(
        pid,
        c.method,
        c.date,
        c.method === 'at_visit' ? `${STAFF.physician.name} (office visit, from roster)` : `${STAFF.nurse.name} (from roster)`,
        c.automated_calls_ok ? 1 : 0,
        c.texts_ok ? 1 : 0,
      );
  }

  private setStatus(pid: number, status: PatientStatus, reason: string | null, actor: string, why: string): void {
    this.db.prepare('UPDATE patient SET status = ?, ineligible_reason = ? WHERE id = ?').run(status, reason, pid);
    this.log('patient.status', `Status: ${status.replace(/_/g, ' ')} — ${why}.`, pid, actor);
  }

  /** The V1 confirmation step, now an Ops approval with the proposed program. */
  confirmEligibility(role: Role, pid: number): void {
    this.need(role, ['manager'], 'confirm eligibility');
    this.opsDecide(role, pid, 'approved');
  }

  /** Ops review of a roster row in the Opportunity Matrix: approve, hold, reject, or reopen a rejected row. */
  opsDecide(role: Role, pid: number, decision: OpsDecision | 'reopen', program?: Program | null, note?: string): void {
    this.tx(() => {
      const actor = this.need(role, ['manager'], 'review the opportunity matrix');
      const p = this.patient(pid);
      const n = (note ?? '').trim();
      if (decision === 'reopen') {
        if (p.ops_decision !== 'rejected') throw new UserError(`${fullName(p)} was not rejected.`);
        this.db.prepare('UPDATE patient SET ops_decision = NULL, ops_note = NULL, ops_decided_at = NULL WHERE id = ?').run(pid);
        this.setStatus(pid, 'eligible_unconfirmed', null, actor, 'reopened for review');
        return;
      }
      if (p.status !== 'eligible_unconfirmed')
        throw new UserError(`${fullName(p)} is not awaiting review (${p.status.replace(/_/g, ' ')}).`);
      let chosen = p.proposed_program;
      if (program && program !== p.proposed_program) {
        const block = programBlock(program, p.coverage, this.conditionCount(p));
        if (block) throw new UserError(`Cannot propose ${program.toUpperCase()} for ${fullName(p)}: ${block}.`);
        chosen = program;
        this.db.prepare('UPDATE patient SET proposed_program = ? WHERE id = ?').run(program, pid);
        this.log('ops.program', `Program changed to ${program.toUpperCase()} in the opportunity matrix.`, pid, actor);
      }
      const now = this.now();
      this.db.prepare('UPDATE patient SET ops_decision = ?, ops_note = ?, ops_decided_at = ? WHERE id = ?').run(decision, n || null, now, pid);
      if (decision === 'approved') {
        const c = this.consentOf(pid);
        const next: PatientStatus = c && !c.revoked_at ? 'consented' : 'confirmed';
        this.db.prepare('UPDATE patient SET status = ?, ineligible_reason = NULL WHERE id = ?').run(next, pid);
        this.log(
          'ops.approved',
          `Approved in the opportunity matrix for ${chosen?.toUpperCase() ?? '—'}. Next: ${next === 'consented' ? 'call setup (consent already on file)' : 'consent'}.${n ? ` Note: ${n}` : ''}`,
          pid,
          actor,
        );
      } else if (decision === 'held') {
        this.log('ops.held', `Held in the opportunity matrix${n ? `: ${n}` : ''}.`, pid, actor);
      } else {
        this.setStatus(pid, 'ineligible', `rejected by practice${n ? `: ${n}` : ''}`, actor, 'rejected in the opportunity matrix');
      }
    });
  }

  /** Approves every row awaiting review at or above `minConfidence`. */
  opsApproveAll(role: Role, minConfidence: number): number {
    return this.tx(() => {
      this.need(role, ['manager'], 'review the opportunity matrix');
      const rows = this.patients().filter((p) => p.status === 'eligible_unconfirmed' && p.ops_decision !== 'held' && p.confidence >= minConfidence);
      for (const p of rows) this.opsDecide(role, p.id, 'approved');
      return rows.length;
    });
  }

  saveBillingSettings(role: Role, input: Partial<BillingSettings>): BillingSettings {
    return this.tx(() => {
      const actor = this.need(role, ['manager'], 'change billing settings');
      const cur = this.settings();
      const next: BillingSettings = { ...cur };
      if (input.fees) {
        for (const code of BILLING_CODES) {
          const v = input.fees[code];
          if (v == null) continue;
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) throw new UserError(`Fee for ${code} must be a positive amount.`);
          next.fees = { ...next.fees, [code]: Math.round(n * 100) / 100 };
        }
      }
      for (const k of ['renderingNpi', 'billingNpi'] as const) {
        if (input[k] == null) continue;
        const v = String(input[k]).trim();
        if (!npiValid(v)) throw new UserError(`${k === 'renderingNpi' ? 'Rendering' : 'Billing'} NPI ${v} fails the NPI check digit (Luhn) test.`);
        next[k] = v;
      }
      if (input.placeOfService != null) {
        if (input.placeOfService !== '11' && input.placeOfService !== '12') throw new UserError('Place of service is 11 (office) or 12 (home).');
        next.placeOfService = input.placeOfService;
      }
      if (input.modifier != null) {
        const m = String(input.modifier).trim().toUpperCase();
        if (m && !/^[A-Z0-9]{2}$/.test(m)) throw new UserError('A modifier is two letters or digits, e.g. GQ.');
        next.modifier = m;
      }
      if (input.twoPlusDefault != null) {
        if (input.twoPlusDefault !== 'ccm' && input.twoPlusDefault !== 'apcm') throw new UserError('Pick CCM or APCM.');
        next.twoPlusDefault = input.twoPlusDefault;
      }
      if (input.valueBasedPayers != null) {
        next.valueBasedPayers = input.valueBasedPayers.map((v) => String(v).trim()).filter(Boolean);
      }
      this.setKv('billingSettings', next);
      this.log('settings.billing', 'Billing settings saved.', null, actor);
      return next;
    });
  }

  /** Consent Pending queue: text the patient a link to the consent form. Nothing is sent; it lands in the outbox. */
  sendConsentLink(role: Role, pid: number): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'send consent links');
      const p = this.patient(pid);
      if (p.status !== 'confirmed') throw new UserError(`${fullName(p)} does not need consent.`);
      const link = `https://consent.example/westfield/${p.mrn.toLowerCase()}`;
      this.outbox(
        'text',
        `${fullName(p)}, ${p.phone}`,
        `${PRACTICE.name}: Dr. Patel's office invites you to monthly care management. Read and sign here: ${link} — or call us at ${PRACTICE.phone}.`,
        pid,
      );
      this.log('consent.link_sent', `Consent link sent by text to ${p.phone}.`, pid, actor);
    });
  }

  /** Tester: the patient opens the link and signs (the four items are on the form). */
  simulateConsentSigned(pid: number, input: { automatedCallsOk?: boolean; textsOk?: boolean }): void {
    this.tx(() => {
      const p = this.patient(pid);
      if (p.status !== 'confirmed') throw new UserError(`${fullName(p)} does not need consent.`);
      if (!this.events({ patientId: pid, prefix: 'consent.link_sent' }).length) throw new UserError('Send the consent link first.');
      this.db
        .prepare(
          `INSERT INTO consent (patient_id, method, consent_date, captured_by, explained_availability, explained_cost_sharing,
             explained_one_practitioner, explained_right_to_stop, automated_calls_ok, texts_ok)
           VALUES (?, 'digital_link', ?, ?, 1, 1, 1, 1, ?, ?)`,
        )
        .run(pid, dateOf(this.now()), `${fullName(p)} (signed consent link)`, input.automatedCallsOk ? 1 : 0, input.textsOk ? 1 : 0);
      this.db.prepare("UPDATE patient SET status = 'consented' WHERE id = ?").run(pid);
      this.log(
        'consent.recorded',
        `Consent signed through the link: four items on the form; automated calls ${input.automatedCallsOk ? 'OK' : 'not OK'}; texts ${input.textsOk ? 'OK' : 'not OK'}.`,
        pid,
        TESTER,
      );
    });
  }

  /** When the nurse last tried to reach a patient about consent: a consent call or a link sent. */
  lastConsentAttempt(pid: number): { at: string; how: string } | null {
    const calls = this.timeOf(pid)
      .filter((t) => t.activity === 'consent_call')
      .map((t) => ({ at: t.started_at, how: `consent call, ${(t.outcome ?? 'no outcome').toLowerCase()}` }));
    const links = this.events({ patientId: pid, prefix: 'consent.link_sent' }).map((e) => ({ at: e.at, how: 'consent link sent' }));
    return [...calls, ...links].sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
  }

  startConsentCall(role: Role, pid: number): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'make consent calls');
      const p = this.patient(pid);
      if (p.status !== 'confirmed') throw new UserError(`${fullName(p)} does not need a consent call.`);
      this.startTimer(pid, 'consent_call', null, actor);
      this.log('consent.call_started', 'Consent call started (script on screen).', pid, actor);
    });
  }

  recordConsent(
    role: Role,
    pid: number,
    input: {
      outcome: 'agreed' | 'declined' | 'call_back';
      explainedAvailability?: boolean;
      explainedCostSharing?: boolean;
      explainedOnePractitioner?: boolean;
      explainedRightToStop?: boolean;
      automatedCallsOk?: boolean;
      textsOk?: boolean;
    },
  ): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'record consent');
      const p = this.patient(pid);
      if (p.status !== 'confirmed') throw new UserError(`${fullName(p)} does not need consent.`);
      const explained = [input.explainedAvailability, input.explainedCostSharing, input.explainedOnePractitioner, input.explainedRightToStop];
      if (input.outcome === 'agreed' && !explained.every(Boolean))
        throw new UserError('Tick all four explained items before recording consent.');
      const t = this.timer();
      const label = { agreed: 'Agreed', declined: 'Declined', call_back: 'Call back later' }[input.outcome];
      if (t && t.patientId === pid && t.activity === 'consent_call') this.stopTimer(label);
      if (input.outcome !== 'agreed') {
        this.log('consent.not_given', `Consent call: ${label.toLowerCase()}.`, pid, actor);
        return;
      }
      this.db
        .prepare(
          `INSERT INTO consent (patient_id, method, consent_date, captured_by, explained_availability, explained_cost_sharing,
             explained_one_practitioner, explained_right_to_stop, automated_calls_ok, texts_ok)
           VALUES (?, 'nurse_phone', ?, ?, 1, 1, 1, 1, ?, ?)`,
        )
        .run(pid, dateOf(this.now()), actor, input.automatedCallsOk ? 1 : 0, input.textsOk ? 1 : 0);
      this.db.prepare("UPDATE patient SET status = 'consented' WHERE id = ?").run(pid);
      this.log(
        'consent.recorded',
        `Consent recorded by nurse phone call: four items explained; automated calls ${input.automatedCallsOk ? 'OK' : 'not OK'}; texts ${input.textsOk ? 'OK' : 'not OK'}.`,
        pid,
        actor,
      );
    });
  }

  saveCallSetup(
    role: Role,
    pid: number,
    input: { program: Program; readings: ReadingType[]; symptoms: RuleCode[]; targets?: Partial<Targets>; ehrPlanReviewedOn?: string | null },
  ): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'fill call setup');
      const p = this.patient(pid);
      if (!['consented', 'plan_review', 'active', 'paused'].includes(p.status)) throw new UserError(`${fullName(p)} is not ready for call setup.`);
      if (input.program !== 'ccm' && input.program !== 'apcm') throw new UserError('Pick CCM or APCM.');
      const block = programBlock(input.program, p.coverage, this.conditionCount(p));
      if (block) throw new UserError(`${input.program.toUpperCase()} is not available for ${fullName(p)}: ${block}.`);
      const readings = (input.readings ?? []).filter((r) => ['bp', 'glucose', 'weight', 'oxygen'].includes(r));
      const symptoms = (input.symptoms ?? []).filter((r) => r in RULES);
      const month = this.month();
      if ((p.status === 'active' || p.status === 'paused') && p.program && p.program !== input.program) {
        const busy =
          this.timeOf(pid, month).length > 0 ||
          this.callsOf(pid).some((c) => c.status === 'done' && inMonth(c.started_at, month));
        if (busy)
          throw new UserError(
            `One program per patient per month: ${fullName(p)} already has ${p.program.toUpperCase()} activity in ${month}. Change the program from next month.`,
          );
      }
      const targets = mergeTargets(input.targets);
      this.db
        .prepare(
          `INSERT INTO call_setup (patient_id, readings, symptoms_to_watch, targets, ehr_plan_reviewed_on) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(patient_id) DO UPDATE SET readings = excluded.readings, symptoms_to_watch = excluded.symptoms_to_watch,
             targets = excluded.targets, ehr_plan_reviewed_on = excluded.ehr_plan_reviewed_on`,
        )
        .run(pid, JSON.stringify(readings), JSON.stringify(symptoms), JSON.stringify(targets), input.ehrPlanReviewedOn || p.last_visit_date);
      const programChanged = p.program !== input.program;
      this.db.prepare('UPDATE patient SET program = ? WHERE id = ?').run(input.program, pid);
      this.log(
        'call_setup.saved',
        `Call setup: ${input.program.toUpperCase()}; readings ${readings.join(', ') || 'none'}; ${symptoms.length} symptom rules watched.`,
        pid,
        actor,
      );
      if (input.program === 'ccm') {
        for (const t of this.tasksOf(pid).filter((t) => t.status === 'open' && t.title === 'Switch program to CCM')) {
          this.db.prepare("UPDATE task SET status = 'done', closed_at = ?, close_note = ? WHERE id = ?").run(this.now(), 'Call setup saved as CCM', t.id);
          this.log('task.closed', 'Task closed: Switch program to CCM — call setup saved as CCM.', pid, actor);
        }
      }
      const plan = this.draftCarePlan(this.patient(pid), actor);
      if (p.status !== 'active') {
        if (p.status !== 'plan_review') {
          this.setStatus(pid, 'plan_review', null, actor, `call setup done; care plan v${plan!.version} awaits physician approval`);
        }
        this.outbox('alert', `${STAFF.physician.name} (care plan queue)`, `Care plan v${plan!.version} for ${fullName(p)} (${p.mrn}) is ready for approval.`, pid);
      } else if (programChanged) {
        this.cancelScheduled(pid, 'program changed', actor);
        this.scheduleFirstContact(this.patient(pid), actor);
      }
    });
  }

  /**
   * Drafts the next care plan version from what is stored now, or refreshes
   * the open draft. For an active patient whose plan has not changed, nothing
   * is drafted (returns null).
   */
  private draftCarePlan(p: Patient, actor: string): CarePlan | null {
    const content = compileCarePlan(this, p);
    const draft = this.draftPlan(p.id);
    if (draft) {
      this.db.prepare('UPDATE care_plan SET content = ?, created_at = ?, created_by = ? WHERE id = ?').run(JSON.stringify(content), this.now(), actor, draft.id);
      this.log('care_plan.drafted', `Care plan v${draft.version} draft refreshed from the call setup.`, p.id, actor);
      return this.carePlan(draft.id);
    }
    const approved = this.approvedPlan(p.id);
    if (p.status === 'active' && approved && JSON.stringify(approved.content) === JSON.stringify(content)) return null;
    const id = this.insertPlan(p, actor, this.now(), content);
    const plan = this.carePlan(id);
    this.log('care_plan.drafted', `Care plan v${plan.version} drafted for physician approval${approved ? ` (v${approved.version} stays in effect until then)` : ''}.`, p.id, actor);
    return plan;
  }

  private insertPlan(p: Patient, by: string, at: string, content = compileCarePlan(this, p)): number {
    const r = this.db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM care_plan WHERE patient_id = ?').get(p.id) as { v: number };
    const info = this.db
      .prepare("INSERT INTO care_plan (patient_id, version, content, created_at, created_by, status) VALUES (?, ?, ?, ?, ?, 'draft')")
      .run(p.id, r.v + 1, JSON.stringify(content), at, by);
    return Number(info.lastInsertRowid);
  }

  /** Approves a draft: chains its hash to the previous approval and supersedes the plan in effect. */
  private signPlan(planId: number, by: string, at: string): CarePlan {
    const plan = this.carePlan(planId);
    const prev = this.db
      .prepare('SELECT hash FROM care_plan WHERE patient_id = ? AND hash IS NOT NULL AND version < ? ORDER BY version DESC LIMIT 1')
      .get(plan.patient_id, plan.version) as { hash: string } | undefined;
    const npi = this.settings().renderingNpi;
    const hash = approvalHash(prev?.hash ?? null, { patientId: plan.patient_id, version: plan.version, npi, approvedBy: by, approvedAt: at, content: plan.content });
    this.db.prepare("UPDATE care_plan SET status = 'superseded' WHERE patient_id = ? AND status = 'approved'").run(plan.patient_id);
    this.db
      .prepare("UPDATE care_plan SET status = 'approved', approved_at = ?, approved_by = ?, approver_npi = ?, prev_hash = ?, hash = ? WHERE id = ?")
      .run(at, by, npi, prev?.hash ?? null, hash, planId);
    return this.carePlan(planId);
  }

  /** Queue A: "Approve & Initiate Care Program". */
  approveCarePlan(role: Role, planId: number): CarePlan {
    return this.tx(() => {
      const actor = this.need(role, ['physician'], 'approve care plans');
      const draft = this.carePlan(planId);
      if (draft.status !== 'draft') throw new UserError(`Care plan v${draft.version} is ${draft.status}, not a draft.`);
      const p = this.patient(draft.patient_id);
      const plan = this.signPlan(planId, actor, this.now());
      this.log(
        'care_plan.approved',
        `Care plan v${plan.version} approved by ${actor}, NPI ${plan.approver_npi}. Signature hash ${plan.hash!.slice(0, 12)}…`,
        p.id,
        actor,
      );
      if (p.status === 'plan_review') {
        this.setStatus(p.id, 'active', null, actor, `care plan approved; ${p.program?.toUpperCase() ?? ''} program initiated`);
        this.scheduleFirstContact(this.patient(p.id), actor);
      }
      return plan;
    });
  }

  returnCarePlan(role: Role, planId: number, note: string): void {
    this.tx(() => {
      const actor = this.need(role, ['physician'], 'review care plans');
      const plan = this.carePlan(planId);
      if (plan.status !== 'draft') throw new UserError(`Care plan v${plan.version} is not a draft.`);
      const n = (note ?? '').trim();
      if (!n) throw new UserError('Say what should change.');
      this.db.prepare("UPDATE care_plan SET status = 'returned', return_note = ? WHERE id = ?").run(n, planId);
      this.addTaskRow(plan.patient_id, { kind: 'other', title: 'Care plan changes requested', reason: `${actor}: ${n}`, due: nextBusinessDay(this.now()) }, actor);
      this.log('care_plan.returned', `Care plan v${plan.version} returned for changes: ${n}`, plan.patient_id, actor);
    });
  }

  // ───────────────────────────── physician escalations

  /** Queue B: opening an escalation starts the physician's timer. */
  openEscalation(role: Role, taskId: number): void {
    this.tx(() => {
      const actor = this.need(role, ['physician'], 'review escalations');
      const t = this.task(taskId);
      if (t.kind !== 'physician' || t.status !== 'open') throw new UserError('That escalation is not open.');
      this.startTimer(t.patient_id, 'practitioner_review', null, actor, 'physician', taskId);
      this.log('escalation.opened', `Escalation opened: ${t.title.replace('Physician review requested: ', '')}. Timer started.`, t.patient_id, actor);
    });
  }

  closeEscalation(role: Role, taskId: number, input: { outcome: string; directive?: string; complexity?: Complexity }): TimeEntry {
    return this.tx(() => {
      const actor = this.need(role, ['physician'], 'review escalations');
      const t = this.task(taskId);
      const timer = this.timer('physician');
      if (!timer || timer.taskId !== taskId) throw new UserError('Open the escalation first.');
      if (!ACTIVITIES.practitioner_review.outcomes.includes(input.outcome)) throw new UserError('Pick an outcome.');
      const directive = (input.directive ?? '').trim();
      const entry = this.stopTimer(input.outcome, undefined, 'physician');
      this.db
        .prepare("UPDATE task SET status = 'done', closed_at = ?, close_note = ? WHERE id = ?")
        .run(entry.ended_at, directive || input.outcome, taskId);
      this.log('task.closed', `Task closed: ${t.title}${directive ? ` — ${directive}` : ''}`, t.patient_id, actor, entry.ended_at);
      if (directive) {
        this.addTaskRow(t.patient_id, { kind: 'followup', title: `Physician directive: ${directive}`, reason: `From ${actor}'s escalation review`, due: nextBusinessDay(entry.ended_at) }, actor, null, entry.ended_at);
      }
      if (input.complexity) this.writeComplexity(t.patient_id, input.complexity, actor);
      this.log('escalation.closed', `Escalation reviewed in ${fmtDuration(entry.seconds)} (counted): ${input.outcome}.`, t.patient_id, actor, entry.ended_at);
      return entry;
    });
  }

  discardPhysicianTimer(role: Role): void {
    this.tx(() => {
      const actor = this.need(role, ['physician'], 'discard a timer');
      const t = this.timer('physician');
      if (!t) throw new UserError('No timer is running.');
      this.setTimer('physician', null);
      this.log('time.discarded', `${ACTIVITIES[t.activity].label} timer discarded; no time logged.`, t.patientId, actor);
    });
  }

  /** The physician marks this month's medical decision making as moderate/high (complex CCM) or standard. */
  setComplexity(role: Role, pid: number, complexity: Complexity): void {
    this.tx(() => {
      const actor = this.need(role, ['physician'], 'mark complexity');
      if (complexity !== 'standard' && complexity !== 'complex') throw new UserError('Complexity is standard or complex.');
      this.writeComplexity(pid, complexity, actor);
    });
  }

  private writeComplexity(pid: number, complexity: Complexity, actor: string): void {
    const p = this.patient(pid);
    if (p.program !== 'ccm') throw new UserError('Complexity applies to CCM patients only.');
    const month = this.month();
    if (!this.monthCloseOf(pid, month)) {
      this.db.prepare("INSERT INTO month_close (patient_id, month, billing_status) VALUES (?, ?, 'held')").run(pid, month);
    }
    this.db
      .prepare('UPDATE month_close SET complexity = ?, complexity_by = ?, complexity_at = ? WHERE patient_id = ? AND month = ?')
      .run(complexity, actor, this.now(), pid, month);
    this.log(
      'billing.complexity',
      complexity === 'complex'
        ? 'Medical decision making marked moderate/high for this month: complex CCM (99487) applies at 60 minutes.'
        : 'Medical decision making marked standard for this month: CCM codes apply.',
      pid,
      actor,
    );
  }

  private scheduleFirstContact(p: Patient, actor: string): void {
    const now = this.now();
    if (p.program === 'ccm') {
      this.scheduleMonthly(p.id, 'nurse', now);
      this.log('call.scheduled', 'Monthly nurse call due now.', p.id, actor);
      return;
    }
    const ai = this.aiAllowed(p);
    if (ai.ok) {
      const at = `${nextBusinessDay(now)}T${AI_CALL_HOUR}`;
      this.scheduleMonthly(p.id, 'ai', at);
      this.log('call.scheduled', `AI check-in scheduled for ${fmtDay(at)} ${fmtTime(at)}.`, p.id, actor);
    } else {
      this.ensureNurseCallTask(p, `No AI call: ${ai.reason}.`, actor);
    }
  }

  // ───────────────────────────── timers and time capture

  private startTimer(pid: number, activity: ActivityKey, callId: number | null, user: string, slot: TimerSlot = 'nurse', taskId: number | null = null): void {
    const running = this.timer(slot);
    if (running) {
      const who = running.patientId === pid ? '' : ` for ${fullName(this.patient(running.patientId))}`;
      throw new UserError(`Stop the running timer (${ACTIVITIES[running.activity].label}${who}) first.`);
    }
    const t: Timer = { patientId: pid, activity, callId, taskId, startedAt: this.now(), startedReal: this.realNow(), speed: this.speed(), user };
    this.setTimer(slot, t);
  }

  /** Stops the timer; stores exact seconds and moves the demo clock to the end of the work. */
  private stopTimer(outcome: string | null, counts?: boolean, slot: TimerSlot = 'nurse'): TimeEntry {
    const t = this.timer(slot);
    if (!t) throw new UserError('No timer is running.');
    const seconds = Math.max(0, Math.round(((this.realNow() - t.startedReal) / 1000) * t.speed));
    const ended = toIso(toMs(t.startedAt) + seconds * 1000);
    const c = counts ?? ACTIVITIES[t.activity].counts;
    const info = this.db
      .prepare(
        `INSERT INTO time_entry (patient_id, user, activity, outcome, started_at, ended_at, seconds, counts, call_id, role, task_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(t.patientId, t.user, t.activity, outcome, t.startedAt, ended, seconds, c ? 1 : 0, t.callId, slot, t.taskId ?? null);
    this.setTimer(slot, null);
    this.advanceTo(toMs(ended));
    this.log(
      'time.logged',
      `${ACTIVITIES[t.activity].label}: ${fmtDuration(seconds)}, ${c ? 'counted' : 'not counted'}${outcome ? ` — ${outcome}` : ''}.`,
      t.patientId,
      t.user,
      ended,
    );
    const r = this.db.prepare('SELECT * FROM time_entry WHERE id = ?').get(Number(info.lastInsertRowid)) as any;
    return { ...r, counts: !!r.counts };
  }

  startActivity(role: Role, pid: number, activity: ActivityKey): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'log work');
      const p = this.patient(pid);
      if (!ACTIVITIES[activity]?.manual) throw new UserError('Pick a review or activity to time.');
      if (!['active', 'opted_out', 'paused', 'consented', 'plan_review'].includes(p.status))
        throw new UserError(`${fullName(p)} is not enrolled, so there is no care management time to log.`);
      this.startTimer(pid, activity, null, actor);
      this.log('time.started', `${ACTIVITIES[activity].label} started${ACTIVITIES[activity].ehr ? ' (working in EHR)' : ''}.`, pid, actor);
    });
  }

  stopActivity(role: Role, outcome: string): TimeEntry {
    return this.tx(() => {
      this.need(role, ['nurse'], 'log work');
      const t = this.timer();
      if (!t) throw new UserError('No timer is running.');
      if (t.activity === 'nurse_call' || t.activity === 'consent_call') throw new UserError('End the call from the call screen.');
      if (!ACTIVITIES[t.activity].outcomes.includes(outcome)) throw new UserError('Pick an outcome.');
      const entry = this.stopTimer(outcome);
      if (t.activity === 'ehr_care_plan_review') {
        this.db.prepare('UPDATE call_setup SET ehr_plan_reviewed_on = ? WHERE patient_id = ?').run(dateOf(entry.ended_at), t.patientId);
      }
      return entry;
    });
  }

  discardTimer(role: Role): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'discard a timer');
      const t = this.timer();
      if (!t) throw new UserError('No timer is running.');
      if (t.activity === 'nurse_call') throw new UserError('End the call from the call screen.');
      this.setTimer('nurse', null);
      this.log('time.discarded', `${ACTIVITIES[t.activity].label} timer discarded; no time logged.`, t.patientId, actor);
    });
  }

  // ───────────────────────────── nurse calls

  startNurseCall(role: Role, pid: number): Call {
    return this.tx(() => {
      const actor = this.need(role, ['nurse'], 'make nurse calls');
      const p = this.patient(pid);
      if (!['active', 'opted_out'].includes(p.status)) throw new UserError(`${fullName(p)} is not enrolled for monthly calls.`);
      if (!this.setupOf(pid)) throw new UserError('Fill the call setup first.');
      const now = this.now();
      const due = this.db
        .prepare(
          "SELECT id FROM call WHERE patient_id = ? AND kind = 'nurse' AND status = 'scheduled' AND scheduled_for <= ? ORDER BY scheduled_for LIMIT 1",
        )
        .get(pid, `${dateOf(now)}T23:59:59`) as { id: number } | undefined;
      let callId: number;
      if (due) {
        callId = due.id;
        this.db.prepare("UPDATE call SET status = 'in_progress', started_at = ? WHERE id = ?").run(now, callId);
      } else {
        const info = this.db
          .prepare("INSERT INTO call (patient_id, kind, status, purpose, started_at) VALUES (?, 'nurse', 'in_progress', ?, ?)")
          .run(pid, p.program === 'ccm' ? 'Monthly nurse call' : 'Nurse call', now);
        callId = Number(info.lastInsertRowid);
      }
      this.startTimer(pid, 'nurse_call', callId, actor);
      this.log('call.started', `Nurse call started to ${p.phone}.`, pid, actor);
      return this.call(callId);
    });
  }

  addNurseCallLine(role: Role, callId: number, line: { who: 'nurse' | 'patient' | 'caregiver'; text: string; step?: string }): Call {
    return this.tx(() => {
      this.need(role, ['nurse'], 'make nurse calls');
      const c = this.call(callId);
      if (c.status !== 'in_progress' || c.kind !== 'nurse') throw new UserError('That call is not in progress.');
      const text = (line.text ?? '').trim();
      if (!text) throw new UserError('Nothing to add.');
      const who = ['nurse', 'patient', 'caregiver'].includes(line.who) ? line.who : 'patient';
      const transcript: TranscriptLine[] = [...c.transcript, { who, text, step: line.step }];
      const answers = answersFromTranscript(transcript, c.started_at!);
      this.db.prepare('UPDATE call SET transcript = ?, answers = ? WHERE id = ?').run(JSON.stringify(transcript), JSON.stringify(answers), callId);
      return this.call(callId);
    });
  }

  endNurseCall(
    role: Role,
    callId: number,
    input: { outcome: 'completed' | 'no_answer' | 'declined'; answeredBy?: 'patient' | 'caregiver'; nurseNote?: string },
  ): { call: Call; tasks: Task[]; findings: Finding[]; level: FlagLevel; entry: TimeEntry } {
    return this.tx(() => {
      const actor = this.need(role, ['nurse'], 'make nurse calls');
      const c = this.call(callId);
      if (c.status !== 'in_progress' || c.kind !== 'nurse') throw new UserError('That call is not in progress.');
      const p = this.patient(c.patient_id);
      const setup = this.setupOf(p.id)!;
      const reached = input.outcome === 'completed';
      const label = { completed: 'Completed', no_answer: 'No answer', declined: 'Declined' }[input.outcome] ?? 'Completed';
      const entry = this.stopTimer(label, reached);
      const answers = answersFromTranscript(c.transcript, c.started_at!);
      const findings = reached ? assess(answers, setup) : [];
      const level = reached ? levelOf(findings) : 'none';
      let outcome: CallOutcome = input.outcome === 'completed' ? 'completed' : input.outcome;
      if (reached && answers.optOut) outcome = 'opted_out';
      else if (reached && level === 'urgent') outcome = 'escalated';
      const answeredBy = reached ? (input.answeredBy ?? 'patient') : null;
      this.db
        .prepare(
          "UPDATE call SET status = 'done', ended_at = ?, outcome = ?, answered_by = ?, answers = ?, flag = ?, nurse_note = ? WHERE id = ?",
        )
        .run(entry.ended_at, outcome, answeredBy, JSON.stringify(answers), level, input.nurseNote?.trim() || null, callId);
      const at = entry.ended_at;
      const created: Task[] = [];
      if (reached) {
        if (level === 'urgent') this.raiseFlag(p, callId, findings, at, actor, { acknowledgedBy: actor });
        for (const d of tasksFor(findings, answers, at, `nurse call ${fmtShort(at)}`)) {
          const t = this.addTaskRow(p.id, d, actor, callId, at);
          if (t) created.push(t);
        }
        for (const t of this.tasksOf(p.id).filter((t) => t.status === 'open' && t.kind === 'call')) {
          this.db.prepare("UPDATE task SET status = 'done', closed_at = ?, close_note = ? WHERE id = ?").run(at, 'Nurse call completed', t.id);
          this.log('task.closed', `Task closed: ${t.title} — nurse call completed.`, p.id, actor, at);
        }
        if (outcome === 'opted_out') this.optOut(p, at, 'asked to stop during the nurse call', actor);
      } else if (p.program === 'ccm' && p.status === 'active') {
        this.insertScheduled(p.id, 'nurse', at);
      }
      const what = level === 'none' ? '' : ` ${cap(level)}: ${flagSummary(findings)}.`;
      this.log(
        'call.nurse',
        `Nurse call ${fmtDateTime(c.started_at)}: ${outcome.replace('_', ' ')}, ${fmtDuration(entry.seconds)} (${reached ? 'counted' : 'not counted'}).${what}${created.length ? ` ${created.length} task${created.length === 1 ? '' : 's'} created.` : ''}`,
        p.id,
        actor,
        at,
      );
      return { call: this.call(callId), tasks: created, findings, level, entry };
    });
  }

  private optOut(p: Patient, at: string, how: string, actor: string): void {
    this.db.prepare('UPDATE consent SET revoked_at = ? WHERE patient_id = ? AND revoked_at IS NULL').run(at, p.id);
    this.db.prepare("UPDATE patient SET status = 'opted_out' WHERE id = ?").run(p.id);
    const n = this.cancelScheduled(p.id, 'patient opted out', actor);
    this.log('consent.revoked', `Consent revoked ${fmtDate(at)}: patient ${how}. Future calls cancelled (${n}). Status: opted out.`, p.id, actor, at);
    this.addTaskRow(
      p.id,
      { kind: 'optout', title: 'Confirm opt-out by phone', reason: `Patient ${how} on ${fmtShort(at)}.`, due: nextBusinessDay(at) },
      actor,
      null,
      at,
    );
  }

  // ───────────────────────────── AI calls

  private recordAiCall(p: Patient, rowId: number | null, state: AiState, at: string): RunItem {
    const setup = this.setupOf(p.id)!;
    const secs = aiCallSeconds(state);
    const ended = toIso(toMs(at) + secs * 1000);
    const reached = state.outcome === 'completed' || state.outcome === 'escalated';
    const findings = reached ? assess(state.answers, setup) : [];
    const level: FlagLevel = state.outcome === 'escalated' ? 'urgent' : state.outcome === 'completed' ? levelOf(findings) : 'none';
    let id = rowId;
    if (id == null) {
      const info = this.db
        .prepare("INSERT INTO call (patient_id, kind, status, scheduled_for, attempt, purpose) VALUES (?, 'ai', 'scheduled', ?, 1, 'AI check-in')")
        .run(p.id, at);
      id = Number(info.lastInsertRowid);
    }
    this.db
      .prepare(
        "UPDATE call SET status = 'done', started_at = ?, ended_at = ?, outcome = ?, answered_by = ?, transcript = ?, answers = ?, flag = ? WHERE id = ?",
      )
      .run(at, ended, state.outcome, state.answeredBy ?? null, JSON.stringify(state.transcript), JSON.stringify(state.answers), level, id);
    this.advanceTo(toMs(ended));
    const row = this.call(id);
    const consent = this.consentOf(p.id);
    const by = state.answeredBy === 'caregiver' ? ` (answered by caregiver ${p.caregiver_name ?? ''})`.replace(' )', ')') : '';
    let detail = '';
    switch (state.end) {
      case 'no_answer':
      case 'wrong_person': {
        const month = monthOf(at);
        const attempts = this.callsOf(p.id).filter(
          (c) => c.kind === 'ai' && c.status === 'done' && inMonth(c.started_at, month) && c.outcome === 'no_answer',
        );
        const n = attempts.length;
        if (n < AI_MAX_ATTEMPTS) {
          const retry = `${addBusinessDays(at, AI_RETRY_BUSINESS_DAYS)}T${(row.scheduled_for ?? at).slice(11)}`;
          this.insertScheduled(p.id, 'ai', retry, row.attempt + 1);
          if (consent?.texts_ok)
            this.outbox('text', `${p.first_name} ${p.last_name}, ${p.phone}`, `${PRACTICE.name} tried to reach you for your monthly check-in. We'll call again on ${fmtDay(retry)}. Reply STOP to stop texts.`, p.id, ended);
          detail = `${state.end === 'wrong_person' ? 'Wrong person' : 'No answer'} (try ${n} of ${AI_MAX_ATTEMPTS}). Next try ${fmtDay(retry)} ${fmtTime(retry)}.`;
        } else {
          detail = `No answer (try ${n} of ${AI_MAX_ATTEMPTS}). Not reached after ${AI_MAX_ATTEMPTS} tries; nurse task created.`;
          this.addTaskRow(
            p.id,
            {
              kind: 'call',
              title: `Not reached after ${AI_MAX_ATTEMPTS} tries — nurse call`,
              reason: `AI check-in tries on ${attempts.map((c) => fmtShort(c.started_at)).join(', ')}: no answer.`,
              due: nextBusinessDay(at),
            },
            AI_ACTOR,
            id,
            ended,
          );
        }
        break;
      }
      case 'opted_out':
        detail = 'Said "stop calling me" after the disclosure. Opted out.';
        this.optOut(p, ended, 'said "stop calling me" on the AI call', AI_ACTOR);
        break;
      case 'wants_human':
        detail = 'Asked for a person. Nurse call task created.';
        this.db.prepare('UPDATE patient SET prefers_human = 1 WHERE id = ?').run(p.id);
        this.log('patient.prefers_human', 'Asked for a person on the AI call: marked as preferring a human.', p.id, AI_ACTOR, ended);
        this.cancelScheduled(p.id, 'patient asked for a person', AI_ACTOR, 'ai');
        this.addTaskRow(p.id, { kind: 'call', title: 'Nurse call requested', reason: `Asked for a person on the AI call ${fmtShort(at)}.`, due: nextBusinessDay(at) }, AI_ACTOR, id, ended);
        break;
      case 'call_back': {
        const retry = `${nextBusinessDay(at)}T${at.slice(11)}`;
        this.insertScheduled(p.id, 'ai', retry, row.attempt + 1);
        detail = `Asked to be called back. Next try ${fmtDay(retry)} ${fmtTime(retry)}.`;
        break;
      }
      case 'escalated': {
        const f = this.raiseFlag(p, id, findings, ended, AI_ACTOR);
        detail = `Urgent: ${f.summary}. ${f.escalation === '988' ? 'Told to call or text 988' : 'Told to call 911'}; call ended; nurse and practice alerted.`;
        break;
      }
      case 'completed': {
        if (level === 'concern') {
          const f = this.raiseFlag(p, id, findings, ended, AI_ACTOR);
          detail = `Concern routed to nurse: ${f.summary}.`;
        } else detail = 'No concerns.';
        for (const d of tasksFor(findings, state.answers, ended, `AI call ${fmtShort(at)}`)) this.addTaskRow(p.id, d, AI_ACTOR, id, ended);
        break;
      }
    }
    const outcomeLabel = (state.outcome ?? 'completed').replace('_', ' ');
    this.log('call.ai', `AI check-in call ${fmtDateTime(at)}: ${outcomeLabel}${by}. ${detail}`, p.id, AI_ACTOR, ended);
    return {
      at,
      patientId: p.id,
      mrn: p.mrn,
      name: fullName(p),
      outcome: `${outcomeLabel}${by}`,
      flag: level,
      detail,
      firstLine: state.transcript.find((l) => l.who === 'ai')?.text ?? null,
    };
  }

  /** "Run October AI calls": every scheduled AI call this month, in time order, with section 5's scripted answers. */
  runAiCalls(): RunView {
    return this.tx(() => {
      this.noTimer();
      const month = this.month();
      const items: RunItem[] = [];
      const notes: string[] = [];
      const script = this.script().ai;
      for (const p of this.patients().filter((x) => x.status === 'active' && x.program === 'apcm')) {
        const ai = this.aiAllowed(p);
        if (ai.ok || this.completedContacts(p.id, month).length) continue;
        this.cancelScheduled(p.id, `no AI call (${ai.reason})`, AI_ACTOR, 'ai');
        this.ensureNurseCallTask(p, `No AI call: ${ai.reason}.`, AI_ACTOR);
        notes.push(`${fullName(p)} (${p.mrn}): no AI call — ${ai.reason}. A nurse-call task is in the queue instead.`);
      }
      const runStart = this.now();
      for (let guard = 0; guard < 200; guard++) {
        const row = this.db
          .prepare(
            "SELECT * FROM call WHERE kind = 'ai' AND status = 'scheduled' AND scheduled_for LIKE ? ORDER BY scheduled_for, id LIMIT 1",
          )
          .get(`${month}%`) as any;
        if (!row) break;
        const p = this.patient(row.patient_id);
        if (!this.aiAllowed(p).ok) {
          this.db.prepare("UPDATE call SET status = 'cancelled' WHERE id = ?").run(row.id);
          this.log('call.cancelled', `Scheduled AI call cancelled: ${this.aiAllowed(p).reason}.`, p.id, AI_ACTOR);
          continue;
        }
        const at = toIso(Math.max(toMs(row.scheduled_for), Math.floor(this.demoNowMs() / 1000) * 1000));
        const attempts = script[p.mrn] ?? [{}];
        const sc = attempts[Math.min(row.attempt - 1, attempts.length - 1)];
        this.advanceTo(toMs(at));
        const { state } = runScripted(this.aiContext(p, at), sc);
        items.push(this.recordAiCall(p, row.id, state, at));
      }
      if (!items.length && !notes.length) throw new UserError('No AI calls left to run this month.');
      const now = this.now();
      for (const f of this.allFlags()) {
        if (f.level !== 'urgent' || f.acknowledged_at || !f.ack_due_at || f.raised_at < runStart) continue;
        if (f.ack_due_at >= now) continue;
        const due = toIso(toMs(now) + ACK_WINDOW_MINUTES * MINUTE);
        this.db.prepare('UPDATE flag SET ack_due_at = ? WHERE id = ?').run(due, f.id);
        this.log(
          'alert.redelivered',
          `The run compressed ${fmtShort(runStart)}–${fmtShort(now)} into one click, so this urgent alert (raised ${fmtDateTime(f.raised_at)}) is delivered to the nurse now. Acknowledge by ${fmtTime(due)}.`,
          f.patient_id,
          SYSTEM,
        );
      }
      const view: RunView = { at: now, items, notes };
      this.setKv('lastRun', view);
      this.log('ai.run', `Run October AI calls: ${items.length} call${items.length === 1 ? '' : 's'} placed${notes.length ? `, ${notes.length} patient(s) skipped` : ''}.`, null, TESTER);
      return view;
    });
  }

  /** The tester plays one APCM patient's call; the server replays the inputs through the same state machine. */
  simulateAiCall(pid: number, inputs: AiInput[]): RunItem {
    return this.tx(() => {
      this.noTimer();
      const p = this.patient(pid);
      const ai = this.aiAllowed(p);
      if (!ai.ok) throw new UserError(`No AI call for ${fullName(p)}: ${ai.reason}.`);
      const at = this.now();
      const state = replay(this.aiContext(p, at), inputs ?? []);
      if (!state.done) throw new UserError('The call is not finished yet.');
      const row = this.db
        .prepare("SELECT id FROM call WHERE patient_id = ? AND kind = 'ai' AND status = 'scheduled' AND scheduled_for LIKE ? ORDER BY scheduled_for LIMIT 1")
        .get(pid, `${this.month()}%`) as { id: number } | undefined;
      return this.recordAiCall(p, row?.id ?? null, state, at);
    });
  }

  // ───────────────────────────── month end

  saveNote(role: Role, pid: number, text: string): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'edit notes');
      const mc = this.monthCloseOf(pid, this.month());
      if (!mc) throw new UserError('No note for this patient this month.');
      if (mc.filed_at) throw new UserError('This note is already filed. Use "Update filed note" to re-file it.');
      this.db.prepare('UPDATE month_close SET note_text = ? WHERE patient_id = ? AND month = ?').run(text, pid, this.month());
      this.log('note.edited', 'Draft note edited.', pid, actor);
    });
  }

  revertNote(role: Role, pid: number): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'edit notes');
      const mc = this.monthCloseOf(pid, this.month());
      if (!mc || mc.filed_at) throw new UserError('Nothing to revert.');
      this.db.prepare('UPDATE month_close SET note_text = NULL WHERE patient_id = ? AND month = ?').run(pid, this.month());
      this.log('note.edited', 'Draft note reverted to the system draft.', pid, actor);
    });
  }

  noteCopied(role: Role, pid: number): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'copy notes');
      this.log('note.copied', 'Note copied for pasting into the EHR.', this.patient(pid).id, actor);
    });
  }

  fileNote(role: Role, pid: number, text: string): void {
    this.tx(() => {
      const actor = this.need(role, ['nurse'], 'file notes');
      const month = this.month();
      const mc = this.monthCloseOf(pid, month);
      if (!mc) throw new UserError('No note for this patient this month.');
      if (!text?.trim()) throw new UserError('The note is empty.');
      const now = this.now();
      this.db
        .prepare('UPDATE month_close SET note_text = ?, filed_at = ?, attested_at = NULL WHERE patient_id = ? AND month = ?')
        .run(text, now, pid, month);
      if (mc.attested_at) this.log('attestation.cleared', 'Note re-filed after attestation; needs the physician to sign again.', pid, actor);
      this.log('note.filed', `${mc.filed_at ? 'Updated note re-filed' : 'Note filed'} in the EHR.`, pid, actor);
    });
  }

  signAttestation(role: Role, text: string): AttestationRecord {
    return this.tx(() => {
      const actor = this.need(role, ['physician'], 'sign the attestation');
      const month = this.month();
      const pending = this.db
        .prepare('SELECT patient_id FROM month_close WHERE month = ? AND filed_at IS NOT NULL AND attested_at IS NULL')
        .all(month) as { patient_id: number }[];
      if (!pending.length) throw new UserError('There are no filed notes waiting for your attestation.');
      const now = this.now();
      for (const r of pending) {
        this.db.prepare('UPDATE month_close SET attested_at = ? WHERE patient_id = ? AND month = ?').run(now, r.patient_id, month);
        this.log('attestation.signed', `Monthly attestation signed by ${actor}.`, r.patient_id, actor);
      }
      const rec: AttestationRecord = { signedAt: now, by: actor, month, patientIds: pending.map((r) => r.patient_id), text };
      this.setKv('attestations', [...this.kv<AttestationRecord[]>('attestations', []), rec]);
      this.log('attestation.signed', `Monthly attestation signed for ${pending.length} patient${pending.length === 1 ? '' : 's'}.`, null, actor);
      return rec;
    });
  }

  // ───────────────────────────── background rules

  /** Runs before each read: an unacknowledged urgent flag past its deadline alerts the physician and practice. */
  tick(): void {
    const now = this.now();
    const overdue = this.allFlags().filter((f) => f.level === 'urgent' && !f.acknowledged_at && f.ack_due_at && f.ack_due_at < now);
    if (!overdue.length) return;
    const told = this.kv<number[]>('overdueNotified', []);
    const fresh = overdue.filter((f) => !told.includes(f.id));
    if (!fresh.length) return;
    this.tx(() => {
      for (const f of fresh) {
        const p = this.patient(f.patient_id);
        this.log('flag.ack_overdue', `Urgent flag not acknowledged within ${ACK_WINDOW_MINUTES} minutes (due ${fmtTime(f.ack_due_at)}).`, p.id, SYSTEM, f.ack_due_at!);
        this.outbox('alert', `${STAFF.physician.name} and ${STAFF.manager.name}`, `Urgent flag for ${fullName(p)} (${p.mrn}) not acknowledged by the nurse within ${ACK_WINDOW_MINUTES} minutes.`, p.id, f.ack_due_at!);
      }
      this.setKv('overdueNotified', [...told, ...fresh.map((f) => f.id)]);
    });
  }
}
