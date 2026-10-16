// The nurse's call script for one patient: her questions in order, with the
// patient's October lines from the seed script where section 5 gives them
// and a plain default reply everywhere else.

import { PRACTICE } from './constants';
import { READINGS, RULES } from './rules';
import type { ReadingType, RuleCode } from './types';

export interface NurseScript {
  opening?: string;
  general?: string;
  meds?: string;
  symptoms?: Partial<Record<RuleCode, string>>;
  er?: string;
  readings?: Partial<Record<ReadingType, string>>;
  needs?: string;
  close?: string;
}

export interface NurseStep {
  key: string;
  label: string;
  question: string;
  reply: string;
  scripted: boolean;
}

export function nurseSteps(
  ctx: { firstName: string; readings: ReadingType[]; symptoms: RuleCode[] },
  script?: NurseScript,
): NurseStep[] {
  const first = ctx.firstName;
  const subj = { caregiver: false, name: first };
  const sc = script ?? {};
  const step = (key: string, label: string, question: string, scripted: string | undefined, fallback: string) => ({
    key,
    label,
    question,
    reply: scripted ?? fallback,
    scripted: scripted != null,
  });
  return [
    step(
      'opening',
      'Opening',
      `Hi ${first}, this is Rachel, the nurse at Dr. Patel's office, calling for your monthly check-in. Is now still a good time?`,
      sc.opening,
      "Yes, now's fine.",
    ),
    step('general', 'How are things', 'How have you been since we last talked?', sc.general, "I've been doing alright."),
    step(
      'meds',
      'Medications',
      "Are you taking all your medicines as prescribed? Any you've run out of, stopped, or had changed?",
      sc.meds,
      "Yes, I'm taking all of them.",
    ),
    ...ctx.symptoms.map((r) =>
      step(`symptom:${r}`, RULES[r].label, RULES[r].question(subj), sc.symptoms?.[r], 'No.'),
    ),
    step('er', 'ER or hospital', 'Any emergency room visits or hospital stays since we last talked?', sc.er, 'No.'),
    ...ctx.readings.map((r) =>
      step(`reading:${r}`, READINGS[r].label, READINGS[r].question(subj), sc.readings?.[r], "I haven't checked it lately."),
    ),
    step(
      'needs',
      'Needs',
      'Is there anything you need from us — refills, appointments, questions?',
      sc.needs,
      "No, that's everything.",
    ),
    step(
      'close',
      'Close',
      `Thanks, ${first}. I'll update Dr. Patel and follow up on anything we talked about. You can call us any time at ${PRACTICE.phone}.`,
      sc.close,
      'Thank you. Bye.',
    ),
  ];
}
