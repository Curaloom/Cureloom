// The AI check-in call as a state machine:
//   ring → identify → disclose → medications → symptoms → ER → readings → needs → close.
// An urgent answer jumps straight to the escalation line and ends the call.
// The same machine drives the batch "Run October AI calls" and the tester's
// simulator; the server replays the tester's inputs through it to record a call.

import { PRACTICE } from './constants';
import { emptyAnswers, mergeAnswers, parseUtterance } from './parse';
import { RULES, READINGS } from './rules';
import type { AnsweredBy, Answers, CallOutcome, ReadingType, RuleCode, TranscriptLine } from './types';

export interface AiContext {
  firstName: string;
  lastName: string;
  phone: string;
  /** e.g. "Joan Rowe (daughter)" */
  caregiverName: string | null;
  readings: ReadingType[];
  symptoms: RuleCode[];
  /** Call start, "YYYY-MM-DDTHH:MM:SS". */
  callAt: string;
}

export type AiStepKey =
  | 'ring'
  | 'identify'
  | 'disclose'
  | 'meds'
  | `symptom:${RuleCode}`
  | 'er'
  | `reading:${ReadingType}`
  | 'needs';

export type AiEnd =
  | 'completed'
  | 'no_answer'
  | 'wrong_person'
  | 'escalated'
  | 'opted_out'
  | 'wants_human'
  | 'call_back';

export interface AiState {
  steps: AiStepKey[];
  i: number;
  transcript: TranscriptLine[];
  answers: Answers;
  answeredBy?: AnsweredBy;
  outcome?: CallOutcome;
  end?: AiEnd;
  escalation?: '911' | '988';
  done: boolean;
}

export interface AiOption {
  id: string;
  label: string;
  say?: string;
}

export interface AiPrompt {
  step: AiStepKey;
  options: AiOption[];
  textPlaceholder?: string;
}

export interface AiInput {
  choice?: string;
  text?: string;
}

export const DISCLOSURE = `This is an automated call from ${PRACTICE.name}, Dr. Anita Patel's office. This call is recorded.`;

function caregiverFirst(ctx: AiContext): string {
  return ctx.caregiverName?.split(' ')[0] ?? 'there';
}

function caregiverRelation(ctx: AiContext): string | null {
  const m = /\(([^)]+)\)/.exec(ctx.caregiverName ?? '');
  return m ? m[1] : null;
}

function isCg(s: AiState) {
  return s.answeredBy === 'caregiver';
}

function your(s: AiState, ctx: AiContext) {
  return isCg(s) ? `${ctx.firstName}'s` : 'your';
}

function question(step: AiStepKey, s: AiState, ctx: AiContext): string {
  const cg = isCg(s);
  const first = ctx.firstName;
  const subj = { caregiver: cg, name: first };
  if (step === 'identify')
    return `I'm calling for ${first} ${ctx.lastName}. Am I speaking with ${first}, or with someone who helps with ${first}'s care?`;
  if (step === 'disclose')
    return (
      `This is ${first}'s monthly check-in. It takes about three minutes: a few questions about medicines, symptoms, and readings. ` +
      `You can ask for a nurse at any time, or say "stop calling me" and these automated calls will stop. Is now a good time?`
    );
  if (step === 'meds')
    return cg
      ? `Is ${first} taking all of ${first}'s medicines as prescribed? Has any run out, or been stopped?`
      : 'Are you taking all your medicines as prescribed? Have you run out of any, or stopped any?';
  if (step === 'er')
    return cg
      ? `Since the last check-in, has ${first} been to an emergency room or stayed in a hospital?`
      : 'Since your last check-in, have you been to an emergency room or stayed in a hospital?';
  if (step === 'needs')
    return cg
      ? `Is there anything ${first} needs from the office — a refill, an appointment, or a call from the nurse?`
      : 'Is there anything you need from the office — a refill, an appointment, or a call from your nurse?';
  if (step.startsWith('symptom:')) return RULES[step.slice(8) as RuleCode].question(subj);
  if (step.startsWith('reading:')) return READINGS[step.slice(8) as ReadingType].question(subj);
  return '';
}

export function aiStart(ctx: AiContext): AiState {
  const steps: AiStepKey[] = [
    'ring',
    'identify',
    'disclose',
    'meds',
    ...ctx.symptoms.map((r) => `symptom:${r}` as AiStepKey),
    'er',
    ...ctx.readings.map((r) => `reading:${r}` as AiStepKey),
    'needs',
  ];
  return {
    steps,
    i: 0,
    transcript: [{ who: 'system', text: `Dialing ${ctx.phone}…`, step: 'ring' }],
    answers: emptyAnswers(),
    done: false,
  };
}

export function aiPrompt(s: AiState, ctx: AiContext): AiPrompt | null {
  if (s.done) return null;
  const step = s.steps[s.i];
  const first = ctx.firstName;
  const cg = isCg(s);
  switch (true) {
    case step === 'ring':
      return {
        step,
        options: [
          { id: 'answer', label: 'Pick up' },
          { id: 'no_answer', label: 'No answer' },
        ],
      };
    case step === 'identify': {
      const opts: AiOption[] = [{ id: 'patient', label: 'Patient answers', say: `Yes, this is ${first}.` }];
      if (ctx.caregiverName) {
        const rel = caregiverRelation(ctx);
        opts.push({
          id: 'caregiver',
          label: `Caregiver answers (${ctx.caregiverName})`,
          say: `This is ${ctx.caregiverName.replace(/\s*\(.*\)/, '')}${rel ? `, ${first}'s ${rel}` : ''}.`,
        });
      }
      opts.push({ id: 'wrong', label: 'Wrong number', say: 'Wrong number.' });
      return { step, options: opts };
    }
    case step === 'disclose':
      return {
        step,
        options: [
          { id: 'yes', label: 'Yes, now is fine', say: 'Yes, now is fine.' },
          { id: 'nurse', label: 'Wants a nurse', say: "I'd rather talk to a nurse." },
          { id: 'stop', label: '"Stop calling me"', say: 'Stop calling me.' },
          { id: 'later', label: 'Call back later', say: 'Not now, call me back later.' },
        ],
        textPlaceholder: 'Or type what the person says…',
      };
    case step === 'meds':
      return {
        step,
        options: [
          {
            id: 'yes',
            label: 'Taking all of them',
            say: cg ? `Yes, ${first} is taking all of them.` : 'Yes, I am taking all of them.',
          },
          { id: 'no', label: 'No', say: 'No.' },
        ],
        textPlaceholder: 'e.g. I ran out of metformin 3 days ago',
      };
    case step.startsWith('symptom:'):
    case step === 'er':
      return {
        step,
        options: [
          { id: 'no', label: 'No', say: 'No.' },
          { id: 'yes', label: 'Yes', say: 'Yes.' },
        ],
        textPlaceholder: 'Or type the answer, e.g. "Yes, chest tightness on the stairs today"',
      };
    case step.startsWith('reading:'): {
      const type = step.slice(8) as ReadingType;
      const eg = { bp: '128/80', glucose: '118', weight: '182', oxygen: '94' }[type];
      return {
        step,
        options: [{ id: 'unknown', label: "Didn't check", say: "I didn't check it." }],
        textPlaceholder: `Type a reading, e.g. ${eg}`,
      };
    }
    case step === 'needs':
      return {
        step,
        options: [
          { id: 'nothing', label: 'Nothing', say: 'No, nothing, thank you.' },
          { id: 'refill', label: 'A refill', say: 'I need a refill.' },
          { id: 'appointment', label: 'An appointment', say: 'I need an appointment.' },
          { id: 'nurse', label: 'Nurse to call', say: 'Please have the nurse call me.' },
        ],
        textPlaceholder: 'Or type the request…',
      };
  }
  return null;
}

function urgentPresent(a: Answers): { rule: RuleCode; escalation: '911' | '988' } | null {
  for (const [code, s] of Object.entries(a.symptoms) as [RuleCode, NonNullable<Answers['symptoms'][RuleCode]>][]) {
    const def = RULES[code];
    if (s?.present && def.level === 'urgent') return { rule: code, escalation: def.escalation ?? '911' };
  }
  return null;
}

function hasConcern(p: Answers): boolean {
  if (p.meds?.status === 'issue') return true;
  if (p.erVisit?.visited) return true;
  return Object.entries(p.symptoms).some(([code, s]) => s?.present && RULES[code as RuleCode].level === 'concern');
}

function finish(s: AiState, outcome: CallOutcome, end: AiEnd, line?: string): AiState {
  if (line) s.transcript.push({ who: 'ai', text: line });
  s.outcome = outcome;
  s.end = end;
  s.done = true;
  return s;
}

export function aiAnswer(prev: AiState, ctx: AiContext, input: AiInput): AiState {
  if (prev.done) return prev;
  const s: AiState = JSON.parse(JSON.stringify(prev));
  const step = s.steps[s.i];
  const prompt = aiPrompt(s, ctx);
  const opt = prompt?.options.find((o) => o.id === input.choice);
  const text = input.text?.trim() || opt?.say || '';

  if (step === 'ring') {
    if (input.choice === 'no_answer') {
      s.transcript.push({ who: 'system', text: 'No answer after 6 rings. No voicemail left.' });
      return finish(s, 'no_answer', 'no_answer');
    }
    s.transcript.push({ who: 'ai', text: DISCLOSURE, step: 'disclosure' });
    s.i += 1;
    s.transcript.push({ who: 'ai', text: question('identify', s, ctx), step: 'identify' });
    return s;
  }

  if (step === 'identify') {
    let who: 'patient' | 'caregiver' | 'wrong' = 'patient';
    if (input.choice === 'caregiver' || input.choice === 'wrong' || input.choice === 'patient') who = input.choice;
    else if (/wrong|not here|no one by that name|not available/i.test(text)) who = 'wrong';
    else if (ctx.caregiverName && /caregiver|daughter|son|wife|husband|helps/i.test(text)) who = 'caregiver';
    if (who === 'wrong') {
      s.transcript.push({ who: 'patient', text, step });
      return finish(s, 'no_answer', 'wrong_person', 'Sorry to bother you. Goodbye.');
    }
    s.answeredBy = who;
    s.transcript.push({ who, text, step });
    s.i += 1;
    s.transcript.push({ who: 'ai', text: question('disclose', s, ctx), step: 'disclose' });
    return s;
  }

  const who = s.answeredBy ?? 'patient';
  s.transcript.push({ who, text, step });
  const patch = parseUtterance(text, step, ctx.callAt);
  s.answers = mergeAnswers(s.answers, patch);
  const yourNurse = isCg(s) ? `${ctx.firstName}'s nurse` : 'your nurse';

  if (patch.optOut || (step === 'disclose' && input.choice === 'stop')) {
    s.answers.optOut = true;
    return finish(
      s,
      'opted_out',
      'opted_out',
      "Understood. We'll stop these automated calls. A nurse from Dr. Patel's office will call once to confirm. Goodbye.",
    );
  }
  if (patch.wantsHuman || (step === 'disclose' && input.choice === 'nurse')) {
    s.answers.wantsHuman = true;
    return finish(s, 'declined', 'wants_human', `Of course. I'll ask Rachel, ${yourNurse}, to call. Goodbye.`);
  }
  if (step === 'disclose' && (input.choice === 'later' || patch.callBackLater)) {
    s.answers.callBackLater = true;
    return finish(s, 'declined', 'call_back', "No problem. We'll try again on the next business day. Goodbye.");
  }

  const urgent = urgentPresent(s.answers);
  if (urgent) {
    s.escalation = urgent.escalation;
    const line =
      urgent.escalation === '988'
        ? `Thank you for telling me. Please call or text 988 now to reach the Suicide and Crisis Lifeline, or call 911 if you are in danger. I'm alerting ${yourNurse} and Dr. Patel's office right away. Goodbye.`
        : `What you're describing could be serious. Please hang up and call 911 now. I'm alerting ${yourNurse} and Dr. Patel's office right away. Goodbye.`;
    return finish(s, 'escalated', 'escalated', line);
  }

  if (hasConcern(patch)) {
    s.transcript.push({ who: 'ai', text: `Thank you. I'll make sure Rachel, ${yourNurse}, sees that today.` });
  }

  s.i += 1;
  if (s.i < s.steps.length) {
    const next = s.steps[s.i];
    s.transcript.push({ who: 'ai', text: question(next, s, ctx), step: next });
    return s;
  }
  const thanks = isCg(s) ? caregiverFirst(ctx) : ctx.firstName;
  return finish(
    s,
    'completed',
    'completed',
    `Thank you, ${thanks}. Rachel, ${yourNurse}, will review this. If anything gets worse, call the office at ${PRACTICE.phone}, or 911 in an emergency. Goodbye.`,
  );
}

/** Rough talk time, for the call record only. AI time never counts toward billing. */
export function aiCallSeconds(s: AiState): number {
  let secs = 20;
  for (const l of s.transcript) {
    if (l.who === 'system') continue;
    secs += Math.max(3, Math.round(l.text.length / (l.who === 'ai' ? 14 : 10)));
  }
  return s.outcome === 'no_answer' && !s.answeredBy ? 30 : secs;
}

/** A scripted outcome from section 5, keyed by step rather than position. */
export interface AiScript {
  pickup?: boolean;
  identify?: 'patient' | 'caregiver' | 'wrong';
  disclose?: string;
  meds?: string;
  symptoms?: Partial<Record<RuleCode, string>>;
  er?: string;
  readings?: Partial<Record<ReadingType, string>>;
  needs?: string;
}

export function scriptedInput(sc: AiScript, step: AiStepKey): AiInput {
  if (step === 'ring') return { choice: sc.pickup === false ? 'no_answer' : 'answer' };
  if (step === 'identify') return { choice: sc.identify ?? 'patient' };
  if (step === 'disclose') return sc.disclose ? { text: sc.disclose } : { choice: 'yes' };
  if (step === 'meds') return sc.meds ? { text: sc.meds } : { choice: 'yes' };
  if (step === 'er') return sc.er ? { text: sc.er } : { choice: 'no' };
  if (step === 'needs') return sc.needs ? { text: sc.needs } : { choice: 'nothing' };
  if (step.startsWith('symptom:')) {
    const t = sc.symptoms?.[step.slice(8) as RuleCode];
    return t ? { text: t } : { choice: 'no' };
  }
  if (step.startsWith('reading:')) {
    const t = sc.readings?.[step.slice(8) as ReadingType];
    return t ? { text: t } : { choice: 'unknown' };
  }
  return {};
}

/** Run a whole call from a script; returns the final state and the inputs used. */
export function runScripted(ctx: AiContext, sc: AiScript): { state: AiState; inputs: AiInput[] } {
  let s = aiStart(ctx);
  const inputs: AiInput[] = [];
  for (let guard = 0; !s.done && guard < 60; guard++) {
    const input = scriptedInput(sc, s.steps[s.i]);
    inputs.push(input);
    s = aiAnswer(s, ctx, input);
  }
  return { state: s, inputs };
}

export function replay(ctx: AiContext, inputs: AiInput[]): AiState {
  let s = aiStart(ctx);
  for (const input of inputs) {
    if (s.done) break;
    s = aiAnswer(s, ctx, input);
  }
  return s;
}
