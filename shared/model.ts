// Row shapes for the nine tables, as the server hands them to the client.
import type { ActivityKey, BillingCode } from './constants';
import type {
  AnsweredBy,
  Answers,
  CallKind,
  CallOutcome,
  CallStatus,
  Coverage,
  FlagLevel,
  PatientStatus,
  Program,
  ReadingType,
  RuleCode,
  Targets,
  TranscriptLine,
} from './types';

export interface Patient {
  id: number;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  phone: string;
  state: string;
  coverage: Coverage;
  is_qmb: boolean;
  qualifying_codes: string[];
  last_visit_date: string | null;
  caregiver_name: string | null;
  caregiver_phone: string | null;
  preferred_language: string;
  prefers_human: boolean;
  status: PatientStatus;
  ineligible_reason: string | null;
  program: Program | null;
}

export interface Consent {
  id: number;
  patient_id: number;
  method: 'at_visit' | 'nurse_phone';
  consent_date: string;
  captured_by: string;
  explained_availability: boolean;
  explained_cost_sharing: boolean;
  explained_one_practitioner: boolean;
  explained_right_to_stop: boolean;
  automated_calls_ok: boolean;
  texts_ok: boolean;
  revoked_at: string | null;
}

export interface CallSetup {
  patient_id: number;
  readings: ReadingType[];
  symptoms_to_watch: RuleCode[];
  targets: Targets;
  ehr_plan_reviewed_on: string | null;
}

export interface Call {
  id: number;
  patient_id: number;
  kind: CallKind;
  status: CallStatus;
  scheduled_for: string | null;
  attempt: number;
  purpose: string | null;
  started_at: string | null;
  ended_at: string | null;
  outcome: CallOutcome | null;
  answered_by: AnsweredBy | null;
  transcript: TranscriptLine[];
  answers: Answers | null;
  flag: FlagLevel;
  nurse_note: string | null;
  reviewed_at: string | null;
}

export type TaskKind =
  | 'call'
  | 'followup'
  | 'transition'
  | 'refill'
  | 'request'
  | 'optout'
  | 'physician'
  | 'other';

export interface Task {
  id: number;
  patient_id: number;
  title: string;
  reason: string;
  due: string;
  status: 'open' | 'done';
  kind: TaskKind;
  created_at: string;
  closed_at: string | null;
  close_note: string | null;
  call_id: number | null;
}

export interface Flag {
  id: number;
  patient_id: number;
  call_id: number | null;
  level: 'concern' | 'urgent';
  rule: string;
  summary: string;
  escalation: '911' | '988' | null;
  raised_at: string;
  ack_due_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  note: string | null;
}

export interface TimeEntry {
  id: number;
  patient_id: number;
  user: string;
  activity: ActivityKey;
  outcome: string | null;
  started_at: string;
  ended_at: string;
  seconds: number;
  counts: boolean;
  call_id: number | null;
}

export interface MonthClose {
  patient_id: number;
  month: string;
  note_text: string | null;
  filed_at: string | null;
  attested_at: string | null;
  billing_status: 'ready' | 'held';
  held_reason: string | null;
  code: BillingCode | null;
  amount: number | null;
}

export interface EventRow {
  id: number;
  at: string;
  actor: string;
  patient_id: number | null;
  type: string;
  detail: string;
}
