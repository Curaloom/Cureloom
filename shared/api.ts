// What GET /api/state returns. The server computes every derived value
// (queue, brief, stepper, billing, note drafts) so the client only renders.
import type { ActivityKey, BillingCode, BillingSettings } from './constants';
import type { Call, CallSetup, CarePlan, ClaimLine, Consent, Flag, MonthClose, Patient, Task, TimeEntry } from './model';
import type { Mapping } from './mapper';
import type { NurseScript } from './nurseScript';
import type { ReadingStatus } from './rules';
import type { Complexity, Coverage, Finding, OpsDecision, PatientStatus, Program, Role } from './types';

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
  /** The escalation task a physician timer belongs to. */
  taskId: number | null;
}

export interface CallView extends Call {
  findings: Finding[];
  summary: string;
  seconds: number;
}

export type BillingState = 'ready' | 'held' | 'not_enrolled';

export interface BillingView {
  status: BillingState;
  reason: string | null;
  /** The primary code: 99490, 99487 or an APCM G-code. */
  code: BillingCode | null;
  /** Total of all lines once ready; null while held. */
  amount: number | null;
  minutes: number;
  /** Claim lines once the program rule is met (ready, or waiting only on the note or attestation). */
  lines: ClaimLine[];
  /** Everything but the physician's signature is in place. */
  awaitingAttestation: boolean;
  complexity: Complexity;
}

export type EnrollBucket = 'awaiting_confirmation' | 'needs_consent' | 'needs_setup' | 'needs_care_plan' | 'not_eligible' | 'stopped';

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

export type QueueCategory = 'urgent' | 'concern' | 'unreached' | 'ccm_due' | 'tasks' | 'review';

export interface QueueRow {
  patientId: number;
  name: string;
  mrn: string;
  program: string;
  category: QueueCategory;
  categoryLabel: string;
  reason: string;
  minutes: number;
  ackDueAt: string | null;
  acknowledged: boolean;
}

export interface PatientView extends Patient {
  name: string;
  age: number;
  codes: { code: string; name: string }[];
  consent: Consent | null;
  setup: CallSetup | null;
  calls: CallView[];
  tasks: Task[];
  flags: Flag[];
  time: TimeEntry[];
  countedSeconds: number;
  minutes: number;
  meets20: boolean;
  completedContact: boolean;
  billing: BillingView;
  enrollBucket: EnrollBucket | null;
  brief: BriefView;
  steps: StepView[];
  note: NoteView | null;
  queue: QueueRow | null;
  ai: { ok: boolean; reason: string | null };
  monthClose: MonthClose | null;
  /** The patient's October lines for a nurse call, from the seed script. */
  script: NurseScript | null;
  payerLabel: string;
  /** Distinct chronic conditions, one code each, in roster order. */
  conditions: { code: string; name: string; label: string; condition: string }[];
  /** Programs the nurse can pick in call setup, with the reason when one is not allowed. */
  programOptions: ProgramOption[];
  carePlan: CarePlan | null;
  draftPlan: CarePlan | null;
  /** The latest plan returned by the physician, while no newer draft exists. */
  returnedPlan: CarePlan | null;
  profile: ClinicalProfile;
  reconciliation: ReconciliationView | null;
}

export interface ProgramOption {
  program: Program;
  code: BillingCode;
  tier: string;
  fee: number;
  block: string | null;
}

export interface ClinicalProfile {
  conditions: {
    code: string;
    name: string;
    label: string;
    readings: { label: string; target: string; points: { when: string; value: string; status: ReadingStatus }[] }[];
    symptoms: { label: string; level: 'concern' | 'urgent'; history: { when: string; present: boolean; detail: string | null }[] }[];
  }[];
  /** Newest first: calls, notes, findings, flags, plan approvals, escalations. */
  log: { at: string; kind: 'call' | 'finding' | 'flag' | 'plan' | 'escalation' | 'note'; text: string }[];
  symptomLog: { at: string; label: string; present: boolean; detail: string | null; source: string }[];
}

export interface ReconciliationView {
  patientId: number;
  nurseSeconds: number;
  physicianSeconds: number;
  totalSeconds: number;
  countedMinutes: number;
  entries: { at: string; activity: string; by: string; role: 'nurse' | 'physician'; seconds: number; outcome: string | null }[];
  excluded: { at: string; what: string; seconds: number; why: string }[];
  lines: ClaimLine[];
  total: number;
  complexity: Complexity;
  complexityBy: string | null;
  audit: string;
}

export interface PreflightView {
  month: string;
  /** Date of service: the last day of the billing month. */
  dos: string;
  open: boolean;
  renderingNpi: string;
  claims: { patientId: number; mrn: string; name: string; codes: string[]; total: number; errors: string[]; sanitized: string[] }[];
  clean: number;
  excluded: number;
  /** Lines in the export file. */
  lines: number;
}

export type OpportunityBucket = 'review' | 'held' | 'approved' | 'rejected' | 'not_eligible' | 'enrolled';

export interface OpportunityRow {
  patientId: number;
  mrn: string;
  name: string;
  dob: string;
  age: number;
  sex: string;
  insuranceName: string;
  insuranceId: string;
  payerLabel: string;
  coverage: Coverage;
  isQmb: boolean;
  codes: { code: string; name: string; chronic: boolean }[];
  conditions: number;
  program: Program | null;
  code: BillingCode | null;
  tier: string;
  confidence: number;
  reasons: string[];
  monthly: number;
  bucket: OpportunityBucket;
  status: PatientStatus;
  reason: string | null;
  decision: OpsDecision | null;
  decidedAt: string | null;
  note: string | null;
  options: ProgramOption[];
  inLastUpload: boolean;
}

export interface OpsView {
  preview: RosterPreview | null;
  matrix: OpportunityRow[];
  emrr: {
    /** Approved and enrolled (active or awaiting activation) patients, per month. */
    approved: number;
    approvedCount: number;
    /** Rows awaiting review or held. */
    pending: number;
    pendingCount: number;
    rejectedCount: number;
    notEligibleCount: number;
  };
  icd: { groups: number; prefixes: number };
}

export interface CarePlanItem {
  plan: CarePlan;
  patientId: number;
  name: string;
  mrn: string;
  status: PatientStatus;
  previous: CarePlan | null;
  /** Readings a condition calls for that the call setup leaves out. */
  gaps: string[];
}

export interface EscalationItem {
  taskId: number;
  patientId: number;
  name: string;
  mrn: string;
  program: Program | null;
  request: string;
  from: string;
  createdAt: string;
  minutes: number;
  complexity: Complexity;
  flags: { level: 'concern' | 'urgent'; summary: string; state: string }[];
  readings: { label: string; value: string; target: string; status: ReadingStatus }[];
  billing: string;
}

export interface PhysicianView {
  carePlans: CarePlanItem[];
  escalations: EscalationItem[];
  /** Escalations closed this month, newest first. */
  closed: { taskId: number; patientId: number; name: string; title: string; note: string | null; closedAt: string | null }[];
  chain: { ok: boolean; approvals: number; broken: { patientId: number; name: string; version: number }[] };
}

export interface NurseQueueItem {
  patientId: number;
  name: string;
  mrn: string;
  program: string;
  /** The main reason, then any further items for the same patient. */
  items: string[];
  minutes: number;
  level?: 'urgent' | 'concern' | 'info';
  ackDueAt?: string | null;
  acknowledged?: boolean;
  /** Consent Pending only. */
  lastAttempt?: { at: string; how: string } | null;
  linkSent?: boolean;
}

export interface NurseQueues {
  consent: NurseQueueItem[];
  care: NurseQueueItem[];
  urgency: NurseQueueItem[];
  pending: NurseQueueItem[];
  /** The "care not yet delivered" list opens on this date. */
  careOpensOn: string;
}

export interface AlertView {
  flagId: number;
  patientId: number;
  name: string;
  mrn: string;
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
  filename: string;
  accepted: number;
  rejected: number;
  rows: RosterRowResult[];
  /** Patient IDs accepted from this upload: the Opportunity Matrix shows these first. */
  mrns: string[];
}

/** A staged upload waiting for Ops to confirm the column mapping. */
export interface RosterPreview {
  filename: string;
  at: string;
  headers: string[];
  sample: string[][];
  rowCount: number;
  mapping: Mapping;
  /** True when the mapping came from a layout confirmed earlier. */
  savedLayout: boolean;
}

export interface RunItem {
  at: string;
  patientId: number;
  mrn: string;
  name: string;
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
  month: string;
  patientIds: number[];
  text: string;
}

export interface AppState {
  practice: { name: string; state: string; phone: string };
  staff: Record<Role, { name: string; title: string; short: string }>;
  clock: ClockView;
  /** The nurse's timer (one per role). */
  timer: TimerView | null;
  physicianTimer: TimerView | null;
  patients: PatientView[];
  queue: QueueRow[];
  queues: NurseQueues;
  ops: OpsView;
  physician: PhysicianView;
  preflight: PreflightView;
  settings: BillingSettings;
  alerts: AlertView[];
  roster: RosterUploadView | null;
  lastRun: RunView | null;
  billing: { rows: { patientId: number; mrn: string; name: string; program: string | null; billing: BillingView }[]; readyCount: number; readyTotal: number };
  monthEnd: { patientIds: number[]; filed: number; total: number };
  attestation: { text: string; records: AttestationRecord[]; pending: number[] };
  checkpoint: { savedAt: string | null; demoAt: string | null };
  counts: { events: number; outbox: number };
}
