import { addBusinessDays, fmtShort } from './time';
import type { Answers, Finding, FlagLevel, ReadingType, RuleCode, Targets } from './types';

export interface Subject {
  caregiver: boolean;
  /** Patient's first name. */
  name: string;
}

type TaskKind = 'followup' | 'transition' | 'refill' | 'request';

export interface RuleDef {
  label: string;
  level: 'concern' | 'urgent';
  escalation?: '911' | '988';
  task?: { kind: TaskKind; title: string };
  question: (s: Subject) => string;
}

export const RULES: Record<RuleCode, RuleDef> = {
  chest_pain: {
    label: 'Chest pain, pressure, or tightness',
    level: 'urgent',
    escalation: '911',
    question: () => 'Any chest pain, pressure, or tightness since the last check-in?',
  },
  breathing_severe: {
    label: 'Severe shortness of breath',
    level: 'urgent',
    escalation: '911',
    question: () => 'Any shortness of breath that makes it hard to talk, or hard to lie flat?',
  },
  stroke_signs: {
    label: 'Stroke warning signs',
    level: 'urgent',
    escalation: '911',
    question: () => 'Any new weakness or numbness on one side, a drooping face, or trouble speaking?',
  },
  fainting: {
    label: 'Fainting',
    level: 'urgent',
    escalation: '911',
    question: () => 'Any fainting or passing out?',
  },
  self_harm: {
    label: 'Thoughts of self-harm',
    level: 'urgent',
    escalation: '988',
    question: (s) =>
      s.caregiver
        ? `Has ${s.name} mentioned any thoughts of self-harm?`
        : 'Have you had any thoughts of hurting yourself?',
  },
  rescue_inhaler: {
    label: 'More rescue inhaler use',
    level: 'concern',
    task: { kind: 'followup', title: 'Breathing follow-up' },
    question: (s) =>
      s.caregiver
        ? `Is ${s.name} using the rescue inhaler more than usual?`
        : 'Are you using your rescue inhaler more than usual?',
  },
  weight_gain: {
    label: 'Rapid weight gain',
    level: 'concern',
    task: { kind: 'followup', title: 'Fluid and weight follow-up' },
    question: () => 'Has the weight gone up 3 pounds in a day, or 5 pounds in a week?',
  },
  leg_swelling: {
    label: 'Leg or ankle swelling',
    level: 'concern',
    task: { kind: 'followup', title: 'Fluid and weight follow-up' },
    question: () => 'Any new or worse swelling in the legs or ankles?',
  },
  palpitations: {
    label: 'Racing or irregular heartbeat',
    level: 'concern',
    task: { kind: 'followup', title: 'Heart rhythm follow-up' },
    question: () => 'Any racing, pounding, or irregular heartbeat?',
  },
  low_glucose_spells: {
    label: 'Possible low blood sugar spells',
    level: 'concern',
    task: { kind: 'followup', title: 'Low blood sugar follow-up' },
    question: () => 'Any shaky, sweaty, or confused spells that could be low blood sugar?',
  },
  low_mood: {
    label: 'Low mood',
    level: 'concern',
    task: { kind: 'followup', title: 'Mood follow-up' },
    question: (s) =>
      s.caregiver
        ? `Has ${s.name} seemed down or hopeless most days in the last two weeks?`
        : 'Have you felt down, depressed, or hopeless most days in the last two weeks?',
  },
  confusion: {
    label: 'New or worse confusion',
    level: 'concern',
    task: { kind: 'followup', title: 'Memory and safety follow-up' },
    question: () => 'Any new or worse confusion?',
  },
  falls: {
    label: 'Fall',
    level: 'concern',
    task: { kind: 'followup', title: 'Fall follow-up' },
    question: () => 'Any falls since the last check-in?',
  },
};

export const READINGS: Record<
  ReadingType,
  { label: string; unit: string; question: (s: Subject) => string }
> = {
  bp: {
    label: 'Blood pressure',
    unit: 'mmHg',
    question: (s) =>
      s.caregiver ? `What was ${s.name}'s most recent blood pressure?` : 'What was your most recent blood pressure?',
  },
  glucose: {
    label: 'Fasting glucose',
    unit: 'mg/dL',
    question: (s) =>
      s.caregiver
        ? `What was ${s.name}'s most recent fasting blood sugar?`
        : 'What was your most recent fasting blood sugar?',
  },
  weight: {
    label: 'Weight',
    unit: 'lb',
    question: (s) => (s.caregiver ? `What did ${s.name} weigh this morning?` : 'What did you weigh this morning?'),
  },
  oxygen: {
    label: 'Oxygen saturation',
    unit: '%',
    question: (s) =>
      s.caregiver
        ? `What was ${s.name}'s most recent oxygen level on the finger monitor?`
        : 'What was your most recent oxygen level on the finger monitor?',
  },
};

export const DEFAULT_TARGETS: Targets = {
  bp: { sysMax: 140, diaMax: 90 },
  glucose: { min: 90, max: 130 },
  weight: { baseline: null, maxGain: 5 },
  oxygen: { min: 92 },
};

export function targetText(type: ReadingType, t: Targets): string {
  switch (type) {
    case 'bp':
      return `below ${t.bp.sysMax}/${t.bp.diaMax}`;
    case 'glucose':
      return `${t.glucose.min}–${t.glucose.max}`;
    case 'weight':
      return t.weight.baseline != null
        ? `under ${t.weight.maxGain} lb above ${t.weight.baseline} lb`
        : `no gain of ${t.weight.maxGain} lb or more`;
    case 'oxygen':
      return `${t.oxygen.min}% or higher`;
  }
}

export type ReadingStatus = 'in_range' | 'above' | 'below';

export interface ReadingResult {
  type: ReadingType;
  value: string;
  target: string;
  status: ReadingStatus;
  finding?: Finding;
}

export function readingValueText(type: ReadingType, a: Answers): string | null {
  const r = a.readings;
  switch (type) {
    case 'bp':
      return r.bp ? `${r.bp.sys}/${r.bp.dia}` : null;
    case 'glucose':
      if (!r.glucose) return null;
      return r.glucose.values.length > 1
        ? `${Math.min(...r.glucose.values)}–${Math.max(...r.glucose.values)} mg/dL`
        : `${r.glucose.values[0]} mg/dL`;
    case 'weight':
      return r.weight ? `${r.weight.lb} lb` : null;
    case 'oxygen':
      return r.oxygen ? `${r.oxygen.pct}%` : null;
  }
}

export function evaluateReading(type: ReadingType, a: Answers, t: Targets): ReadingResult | null {
  const value = readingValueText(type, a);
  if (value == null) return null;
  const target = targetText(type, t);
  const base = { type, value, target };
  const r = a.readings;
  switch (type) {
    case 'bp': {
      const { sys, dia } = r.bp!;
      if (sys >= 160 || dia >= 100)
        return {
          ...base,
          status: 'above',
          finding: { rule: 'bp_high', level: 'concern', text: `Blood pressure ${value} (target ${target})` },
        };
      if (sys < 90)
        return {
          ...base,
          status: 'below',
          finding: { rule: 'bp_low', level: 'concern', text: `Low blood pressure ${value}` },
        };
      if (sys >= t.bp.sysMax || dia >= t.bp.diaMax) return { ...base, status: 'above' };
      return { ...base, status: 'in_range' };
    }
    case 'glucose': {
      const vals = r.glucose!.values;
      const hi = Math.max(...vals);
      const lo = Math.min(...vals);
      if (hi > 180)
        return {
          ...base,
          status: 'above',
          finding: {
            rule: 'glucose_high',
            level: 'concern',
            text: `Fasting glucose ${value} against a ${target} target`,
          },
        };
      if (lo < 70)
        return {
          ...base,
          status: 'below',
          finding: { rule: 'glucose_low', level: 'concern', text: `Low glucose ${value} (target ${target})` },
        };
      if (hi > t.glucose.max) return { ...base, status: 'above' };
      if (lo < t.glucose.min) return { ...base, status: 'below' };
      return { ...base, status: 'in_range' };
    }
    case 'weight': {
      const lb = r.weight!.lb;
      if (t.weight.baseline != null && lb - t.weight.baseline >= t.weight.maxGain)
        return {
          ...base,
          status: 'above',
          finding: {
            rule: 'weight_up',
            level: 'concern',
            text: `Weight ${value}, up ${Math.round((lb - t.weight.baseline) * 10) / 10} lb from ${t.weight.baseline} lb`,
          },
        };
      return { ...base, status: 'in_range' };
    }
    case 'oxygen': {
      const pct = r.oxygen!.pct;
      if (pct < t.oxygen.min)
        return {
          ...base,
          status: 'below',
          finding: { rule: 'oxygen_low', level: 'concern', text: `Oxygen ${value} (target ${target})` },
        };
      return { ...base, status: 'in_range' };
    }
  }
}

export function assess(a: Answers, setup: { readings: ReadingType[]; targets: Targets }): Finding[] {
  const out: Finding[] = [];
  for (const [code, s] of Object.entries(a.symptoms) as [RuleCode, NonNullable<Answers['symptoms'][RuleCode]>][]) {
    if (!s?.present) continue;
    const def = RULES[code];
    out.push({
      rule: code,
      level: def.level,
      escalation: def.escalation,
      text: s.detail ? `${def.label}: ${s.detail}` : def.label,
    });
  }
  if (a.meds?.status === 'issue') {
    out.push({ rule: 'missed_meds', level: 'concern', text: a.meds.detail ?? 'Medication problem reported' });
  }
  if (a.medChange) {
    out.push({ rule: 'med_change', level: 'info', text: `Medication change reported: ${a.medChange}` });
  }
  if (a.erVisit?.visited) {
    const when = a.erVisit.date ? ` on ${fmtShort(a.erVisit.date)}` : '';
    out.push({
      rule: 'er_visit',
      level: 'concern',
      text: `ER or hospital visit${when}${a.erVisit.detail ? `: ${a.erVisit.detail}` : ''}`,
    });
  }
  const types = new Set<ReadingType>([...setup.readings, ...(Object.keys(a.readings) as ReadingType[])]);
  for (const type of types) {
    const res = evaluateReading(type, a, setup.targets);
    if (res?.finding) out.push(res.finding);
  }
  for (const r of a.requests) {
    out.push({ rule: 'request', level: 'info', text: `Request: ${r.text}` });
  }
  return out;
}

export function levelOf(findings: Finding[]): FlagLevel {
  if (findings.some((f) => f.level === 'urgent')) return 'urgent';
  if (findings.some((f) => f.level === 'concern')) return 'concern';
  return 'none';
}

export interface TaskDraft {
  kind: TaskKind;
  title: string;
  reason: string;
  due: string;
}

/** Follow-up tasks a call's findings create. Urgent findings are handled by the flag itself. */
export function tasksFor(findings: Finding[], a: Answers, callDate: string, source: string): TaskDraft[] {
  const out: TaskDraft[] = [];
  const add = (t: TaskDraft) => {
    if (!out.some((o) => o.title === t.title)) out.push(t);
  };
  const next = addBusinessDays(callDate, 1);
  for (const f of findings) {
    if (f.level === 'urgent') continue;
    if (f.rule === 'missed_meds') {
      const name = a.meds?.medName;
      add({
        kind: 'refill',
        title: name ? `Refill ${name}` : 'Medication follow-up',
        reason: `${f.text} (${source})`,
        due: next,
      });
    } else if (f.rule === 'er_visit') {
      add({
        kind: 'transition',
        title: `Transition follow-up after ER visit${a.erVisit?.date ? ` ${fmtShort(a.erVisit.date)}` : ''}`,
        reason: `${f.text} (${source}). Contact within 2 business days.`,
        due: addBusinessDays(callDate, 2),
      });
    } else if (f.rule in RULES) {
      const def = RULES[f.rule as RuleCode];
      if (def.task) add({ kind: def.task.kind, title: def.task.title, reason: `${f.text} (${source})`, due: next });
    } else if (f.rule === 'weight_up') {
      add({ kind: 'followup', title: 'Fluid and weight follow-up', reason: `${f.text} (${source})`, due: next });
    }
  }
  const hasRefill = out.some((t) => t.kind === 'refill');
  for (const r of a.requests) {
    if (r.kind === 'refill' && !hasRefill)
      add({ kind: 'request', title: 'Refill request', reason: `${r.text} (${source})`, due: next });
    if (r.kind === 'appointment')
      add({ kind: 'request', title: 'Schedule appointment', reason: `${r.text} (${source})`, due: next });
    if (r.kind === 'nurse')
      add({ kind: 'request', title: 'Nurse call requested', reason: `${r.text} (${source})`, due: next });
    if (r.kind === 'other')
      add({ kind: 'request', title: 'Patient request', reason: `${r.text} (${source})`, due: next });
  }
  return out;
}
