export type Role = 'nurse' | 'physician' | 'manager';
export type Program = 'ccm' | 'apcm';
/** Payer class: traditional Medicare, Medicare Advantage, a participating value-based payer, or anything else. */
export type Coverage = 'traditional' | 'advantage' | 'vbc' | 'other';
export type Sex = 'M' | 'F' | 'U';
export type OpsDecision = 'approved' | 'rejected' | 'held';
/** The physician's medical decision making mark for a CCM month. */
export type Complexity = 'standard' | 'complex';
export type PatientStatus =
  | 'eligible_unconfirmed'
  | 'confirmed'
  | 'consented'
  | 'plan_review'
  | 'active'
  | 'ineligible'
  | 'needs_visit'
  | 'opted_out'
  | 'paused';

export type ReadingType = 'bp' | 'glucose' | 'weight' | 'oxygen';

/** Symptom red-flag rules the call setup can watch for. */
export type RuleCode =
  | 'chest_pain'
  | 'breathing_severe'
  | 'stroke_signs'
  | 'fainting'
  | 'self_harm'
  | 'leg_swelling'
  | 'weight_gain'
  | 'rescue_inhaler'
  | 'low_glucose_spells'
  | 'palpitations'
  | 'low_mood'
  | 'falls'
  | 'confusion';

/** Everything an assessment can produce: symptom rules plus answer-derived rules. */
export type FindingRule =
  | RuleCode
  | 'missed_meds'
  | 'med_change'
  | 'er_visit'
  | 'bp_high'
  | 'bp_low'
  | 'glucose_high'
  | 'glucose_low'
  | 'weight_up'
  | 'oxygen_low'
  | 'request';

export type FlagLevel = 'none' | 'concern' | 'urgent';
export type CallKind = 'ai' | 'nurse';
export type CallStatus = 'scheduled' | 'in_progress' | 'done' | 'cancelled';
export type CallOutcome = 'completed' | 'no_answer' | 'declined' | 'escalated' | 'opted_out';
export type AnsweredBy = 'patient' | 'caregiver';

export interface Targets {
  bp: { sysMax: number; diaMax: number };
  glucose: { min: number; max: number };
  weight: { baseline: number | null; maxGain: number };
  oxygen: { min: number };
}

export interface SymptomAnswer {
  present: boolean;
  detail?: string;
  /** True when answered at the symptom's own question; such answers win over passing mentions. */
  viaStep?: boolean;
}

export interface Answers {
  meds?: { status: 'ok' | 'issue'; detail?: string; medName?: string };
  medChange?: string;
  symptoms: Partial<Record<RuleCode, SymptomAnswer>>;
  readings: {
    bp?: { sys: number; dia: number; text: string };
    glucose?: { values: number[]; text: string };
    weight?: { lb: number; text: string };
    oxygen?: { pct: number; text: string };
  };
  readingNotes?: Partial<Record<ReadingType, string>>;
  requests: { kind: 'refill' | 'appointment' | 'nurse' | 'other'; text: string }[];
  erVisit?: { visited: boolean; date?: string; detail?: string; viaStep?: boolean };
  general?: string;
  optOut?: boolean;
  wantsHuman?: boolean;
  callBackLater?: boolean;
}

export interface Finding {
  rule: FindingRule;
  level: 'info' | 'concern' | 'urgent';
  text: string;
  escalation?: '911' | '988';
}

export interface TranscriptLine {
  who: 'ai' | 'nurse' | 'patient' | 'caregiver' | 'system';
  text: string;
  step?: string;
}
