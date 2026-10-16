// What GET /api/state returns. The server computes every derived value
// (queue, brief, stepper, billing, note drafts) so the client only renders.
import type { ActivityKey, BillingCode } from './constants';
import type { Call, CallSetup, Consent, Flag, MonthClose, Patient, Task, TimeEntry } from './model';
import type { NurseScript } from './nurseScript';
import type { ReadingStatus } from './rules';
import type { Finding, Role } from './types';

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

export interface BillingView {
  status: BillingState;
  reason: string | null;
  code: BillingCode | null;
  amount: number | null;
  minutes: number;
  /** Everything but the physician's signature is in place. */
  awaitingAttestation: boolean;
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
  timer: TimerView | null;
  patients: PatientView[];
  queue: QueueRow[];
  alerts: AlertView[];
  roster: RosterUploadView | null;
  lastRun: RunView | null;
  billing: { rows: { patientId: number; mrn: string; name: string; program: string | null; billing: BillingView }[]; readyCount: number; readyTotal: number };
  monthEnd: { patientIds: number[]; filed: number; total: number };
  attestation: { text: string; records: AttestationRecord[]; pending: number[] };
  checkpoint: { savedAt: string | null; demoAt: string | null };
  counts: { events: number; outbox: number };
}
