// What the server sends. GET /api/state returns the whole demo as slim
// patient summaries plus everything derived (queue, billing pre-flight,
// operator dashboard); GET /api/patient/:id returns one patient in full.
// The server computes every derived value so the client only renders.
import type { ActivityKey, BillingCode, PracticeInfo } from './constants';
import type { Call, CallSetup, Consent, Flag, MonthClose, Patient, Task, TimeEntry } from './model';
import type { NurseScript } from './nurseScript';
import type { PilotInputs, RoiInputs } from './roi';
import type { ReadingStatus } from './rules';
import type { Coverage, Finding, PatientStatus, Program, Role, TranscriptLine } from './types';

export interface ClockView {
  demoNow: string;
  demoNowMs: number;
  serverRealMs: number;
  /** Idle demo time stops ticking here. */
  capMs: number;
  /** Demo seconds recorded per real second while a timer runs (60 = 1 s is 1 min). */
  speed: number;
  month: string;
  monthLabel: string;
  afterMonthEnd: boolean;
}

export interface TimerView {
  patientId: number;
  patientName: string;
  activity: ActivityKey;
  activityLabel: string;
  startedAt: string;
  startedRealMs: number;
  speed: number;
  callId: number | null;
}

export interface CallView extends Call {
  findings: Finding[];
  summary: string;
  seconds: number;
}

export type BillingState = 'ready' | 'held' | 'not_enrolled';

export type CheckKey = 'consent' | 'coverage' | 'eligibility' | 'duplicate' | 'program' | 'human_touch' | 'qmb' | 'note' | 'attestation';

export interface PreflightCheck {
  key: CheckKey;
  label: string;
  status: 'pass' | 'fail' | 'warn';
  /** A failing blocking check holds the claim; a warning doesn't. */
  blocking: boolean;
  detail: string;
}

export interface BillingView {
  status: BillingState;
  reason: string | null;
  code: BillingCode | null;
  amount: number | null;
  minutes: number;
  /** Everything but the physician's signature is in place. */
  awaitingAttestation: boolean;
  checks: PreflightCheck[];
  warnings: number;
}

export type EnrollBucket = 'awaiting_confirmation' | 'needs_consent' | 'needs_setup' | 'not_eligible' | 'stopped';

export interface BriefView {
  lastMonth: string | null;
  contact: string;
  aiCall: string[];
  readings: { label: string; value: string; target: string; status: ReadingStatus; when: string }[];
  openTasks: { id: number; title: string; due: string }[];
  flags: { id: number; level: 'concern' | 'urgent'; summary: string; state: string }[];
}

export interface StepView {
  n: number;
  key: string;
  label: string;
  state: 'done' | 'open' | 'attention' | 'na';
  detail: string;
}

export interface NoteView {
  draft: string;
  text: string;
  edited: boolean;
  filedAt: string | null;
  attestedAt: string | null;
  changedSinceFiled: boolean;
}

export type QueueCategory = 'urgent' | 'concern' | 'unreached' | 'ccm_due' | 'touch_due' | 'tasks' | 'review';

/** Needs a person now; scheduled nurse work (the CCM monthly call); an optional spot-check of a clean AI call. */
export type QueueLane = 'person' | 'scheduled' | 'review';

export interface QueueRow {
  patientId: number;
  name: string;
  mrn: string;
  practiceCode: string;
  practiceName: string;
  careManager: string;
  program: string;
  category: QueueCategory;
  categoryLabel: string;
  lane: QueueLane;
  reason: string;
  minutes: number;
  ackDueAt: string | null;
  acknowledged: boolean;
}

/** One patient as every list needs them. Small enough to send ~300 of them every few seconds. */
export interface PatientSummary {
  id: number;
  mrn: string;
  name: string;
  first_name: string;
  last_name: string;
  dob: string;
  age: number;
  phone: string;
  practiceId: number;
  practiceCode: string;
  practiceName: string;
  /** Simulated practices are run by the month simulation; the live one by hand. */
  simulated: boolean;
  careManager: string;
  status: PatientStatus;
  ineligible_reason: string | null;
  program: Program | null;
  coverage: Coverage;
  is_qmb: boolean;
  prefers_human: boolean;
  preferred_language: string;
  last_visit_date: string | null;
  caregiver_name: string | null;
  /** Qualifying ICD-10 codes; names come from shared/codes. */
  codes: string[];
  consent: Pick<Consent, 'method' | 'consent_date' | 'automated_calls_ok' | 'texts_ok' | 'revoked_at'> | null;
  hasSetup: boolean;
  minutes: number;
  completedContact: boolean;
  /** One line about this month's contact. */
  contact: string;
  billing: BillingView;
  enrollBucket: EnrollBucket | null;
  inMonthEnd: boolean;
  note: Pick<NoteView, 'filedAt' | 'attestedAt' | 'edited'> | null;
  ai: { ok: boolean; reason: string | null };
  /** Lower-acuity conditions only and no documented risk basis yet. */
  riskReview: boolean;
}

/** One patient in full, for the patient, call, month-end and setup screens. */
export interface PatientView extends PatientSummary {
  patient: Patient;
  practice: PracticeInfo;
  consent: Consent | null;
  setup: CallSetup | null;
  calls: CallView[];
  tasks: Task[];
  flags: Flag[];
  time: TimeEntry[];
  countedSeconds: number;
  meets20: boolean;
  brief: BriefView;
  steps: StepView[];
  note: NoteView | null;
  monthClose: MonthClose | null;
  lastHumanTouch: string | null;
  /** The patient's October lines for a nurse call, from the seed script (live practice only). */
  script: NurseScript | null;
}

export interface AlertView {
  flagId: number;
  patientId: number;
  name: string;
  mrn: string;
  practiceName: string;
  live: boolean;
  summary: string;
  escalation: '911' | '988' | null;
  raisedAt: string;
  ackDueAt: string | null;
  acknowledgedAt: string | null;
}

export interface RosterRowResult {
  row: number;
  mrn: string;
  name: string;
  accepted: boolean;
  outcome: string;
  errors: string[];
  raw: Record<string, string>;
}

export interface RosterUploadView {
  at: string;
  by: string;
  practice: string;
  filename: string;
  accepted: number;
  rejected: number;
  rows: RosterRowResult[];
}

export interface RunItem {
  at: string;
  patientId: number;
  mrn: string;
  name: string;
  practice: string;
  live: boolean;
  outcome: string;
  flag: string;
  detail: string;
  firstLine: string | null;
}

export interface RunView {
  at: string;
  items: RunItem[];
  notes: string[];
}

export interface AttestationRecord {
  signedAt: string;
  by: string;
  practice: string;
  month: string;
  patientIds: number[];
  text: string;
}

export interface EligibilityRunView {
  at: string;
  by: string;
  checked: number;
  verified: number;
  maSwitches: { patientId: number; mrn: string; name: string; practice: string; avoided: number }[];
  qmbEnded: { patientId: number; mrn: string; name: string; practice: string; avoided: number }[];
}

export interface FastForwardView {
  aiRun: boolean;
  nurseCalls: number;
  reviews: number;
  flagsResolved: number;
  tasksClosed: number;
  minutes: number;
  riskReviewed: number;
  riskNotMet: number;
  filed: number;
  attested: number;
  unfiled: number;
  unattested: number;
}

export interface PracticeRow {
  id: number;
  code: string;
  name: string;
  physician: string;
  careManager: string;
  simulated: boolean;
  enrolled: number;
  apcm: number;
  ccm: number;
  /** Share of AI-eligible APCM patients reached by an AI check-in this month. */
  aiReached: number | null;
  exceptions: number;
  apcmMinutesPerPatient: number | null;
  ccmMeets20: number | null;
  ready: number;
  readyAmount: number;
  held: number;
  awaitingAttestation: number;
  notFiled: number;
}

export interface NurseRow {
  name: string;
  practices: string[];
  patients: number;
  minutes: number;
  apcmMinutesPerPatient: number | null;
  ccmMinutesPerPatient: number | null;
  /** Patients in the "needs a person" lane right now. */
  openQueue: number;
}

/** The operator dashboard, for the whole portfolio this month. */
export interface OpsView {
  enrolled: { total: number; apcm: number; ccm: number };
  pipeline: { awaiting: number; consent: number; setup: number };
  ai: {
    eligible: number;
    placed: number;
    reachedPatients: number;
    completionRate: number | null;
    caregiver: number;
    unreached: number;
    askedForPerson: number;
    optedOut: number;
    concerns: number;
    urgent: number;
  };
  exceptions: {
    patients: number;
    share: number | null;
    /** Patients the check-in calls themselves routed to a nurse: concerns, urgent, asked for a person, not reached, opted out. */
    fromCalls: number;
    byKind: { kind: string; count: number }[];
  };
  nurse: {
    totalMinutes: number;
    apcmMinutes: number;
    ccmMinutes: number;
    apcmPerPatient: number | null;
    ccmPerPatient: number | null;
    ccmMeets20: number;
    ccmMeets20Share: number | null;
    byActivity: { label: string; minutes: number }[];
  };
  billing: { ready: number; readyAmount: number; held: number; byReason: { reason: string; count: number }[] };
  integrity: {
    coverageUnverified: number;
    maSwitches: number;
    qmbEnded: number;
    duplicates: number;
    riskPending: number;
    riskDocumented: number;
    riskNotMet: number;
    touchOverdue: number;
    avoided: number;
  };
  escalations: { urgent: number; acknowledged: number; withinSla: number; avgAckMinutes: number | null };
  practices: PracticeRow[];
  nurses: NurseRow[];
}

export interface AppState {
  /** Changes whenever any data changes; detail views refetch on it. */
  version: string;
  operator: string;
  practices: PracticeInfo[];
  /** The hand-driven practice; the physician role is its billing practitioner. */
  live: PracticeInfo;
  staff: Record<Role, { name: string; title: string; short: string }>;
  clock: ClockView;
  timer: TimerView | null;
  patients: PatientSummary[];
  queue: QueueRow[];
  alerts: AlertView[];
  roster: RosterUploadView | null;
  lastRun: RunView | null;
  lastEligibility: EligibilityRunView | null;
  /** AI check-ins still scheduled this month. */
  aiScheduled: number;
  fastForwarded: boolean;
  billing: { readyCount: number; readyTotal: number; heldCount: number };
  monthEnd: { patientIds: number[]; filed: number; total: number };
  attestation: {
    text: string;
    records: AttestationRecord[];
    pending: number[];
    urgent: { patientId: number; name: string; summary: string; note: string | null; raisedAt: string; acknowledgedAt: string | null; resolvedAt: string | null }[];
    escalations: { taskId: number; patientId: number; name: string; title: string; reason: string }[];
  };
  ops: OpsView;
  settings: { roi: RoiInputs | null; pilot: PilotInputs | null };
  checkpoint: { savedAt: string | null; demoAt: string | null };
  counts: { events: number; outbox: number };
}

/** Everything that supports (or holds) one patient's billed month, as an auditor would ask for it. */
export interface AuditPacket {
  generatedAt: string;
  month: string;
  monthLabel: string;
  operator: string;
  practice: PracticeInfo;
  patient: {
    id: number;
    name: string;
    mrn: string;
    dob: string;
    age: number;
    coverage: string;
    qmb: boolean;
    careManager: string;
    program: string | null;
    status: string;
  };
  decision: BillingView & { codeLabel: string | null };
  eligibility: {
    codes: { code: string; name: string }[];
    riskReviewNeeded: boolean;
    riskNote: string | null;
    riskNoteBy: string | null;
    riskNoteAt: string | null;
    coverageVerifiedOn: string | null;
    qmbVerifiedOn: string | null;
    lastVisit: string | null;
  };
  consent: Consent | null;
  contacts: {
    at: string;
    kind: 'ai' | 'nurse';
    purpose: string | null;
    outcome: string | null;
    answeredBy: string | null;
    seconds: number;
    reached: boolean;
    summary: string;
    nurseNote: string | null;
    reviewedAt: string | null;
    transcript: TranscriptLine[];
  }[];
  flags: { level: string; summary: string; escalation: string | null; raisedAt: string; acknowledgedAt: string | null; resolvedAt: string | null; note: string | null }[];
  tasks: { title: string; status: string; createdAt: string; closedAt: string | null; note: string | null }[];
  time: { at: string; activity: string; by: string; seconds: number; counted: boolean; outcome: string | null }[];
  countedMinutes: number;
  humanTouch: { last: string | null; policyDays: number; met: boolean };
  note: { text: string | null; filedAt: string | null; attestedAt: string | null; attestedBy: string };
  events: { at: string; actor: string; type: string; detail: string }[];
}
