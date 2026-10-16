// Keyword rules that turn what a patient says into structured answers.
// The prototype must work without an LLM, so these are deliberately simple
// and predictable: a step's own question is answered by yes/no, and passing
// mentions elsewhere fill fields but never override an explicit answer.

import { addDays, dateOf } from './time';
import type { Answers, ReadingType, RuleCode, TranscriptLine } from './types';

export function emptyAnswers(): Answers {
  return { symptoms: {}, readings: {}, requests: [] };
}

const YES =
  /^\s*(yes|yeah|yep|yup|uh-huh|a little|a bit|some|sometimes|i have|i do|i did|it has|it is|correct|definitely|sure|ok|okay)\b/i;
const NO =
  /^\s*(no|nope|nah|none|not really|never|nothing|not at all|i haven'?t|i don'?t|i didn'?t|haven'?t|didn'?t|i'?m fine|all good)\b/i;
const NEG = /\b(no|not|never|without|haven'?t|hasn'?t|didn'?t|don'?t|doesn'?t|isn'?t|wasn'?t|nor)\b/i;

const SYMPTOM_PATTERNS: Partial<Record<RuleCode, RegExp>> = {
  chest_pain:
    /\bchest\b[^.;]*\b(pain|tight|tightness|pressure|hurt|hurts|hurting|ache|aching)\b|\b(pain|tightness|pressure)\b[^.;]*\bchest\b/i,
  breathing_severe: /can'?t (catch (my|her|his) )?breath|can'?t breathe|hard to (talk|breathe)|gasping|can'?t lie (down )?flat/i,
  stroke_signs: /\bface\b[^.;]*\bdroop|\bdrooping\b|numb(ness)? on one side|weak(ness)? on one side|slurr(ed|ing)|trouble (speaking|talking)/i,
  fainting: /\bfaint(ed|ing)?\b|passed out|blacked out/i,
  self_harm: /\b(hurt|harm|kill)(ing)? (myself|herself|himself)\b|end (my|her|his) life|suicid/i,
  weight_gain: /\bgained\b[^.;]*\b(pounds?|lbs?)\b/i,
  leg_swelling: /\bswell(ing|ed|s)?\b|\bswollen\b/i,
  palpitations: /\b(racing|pounding|fluttering|irregular)\b[^.;]*\bheart|\bpalpitations?\b/i,
  low_glucose_spells: /\bshaky\b|\bsweaty spells?\b|\blow sugars?\b/i,
  low_mood: /\b(feel|feeling|felt|been)\b[^.;]*\b(down|sad|hopeless|depressed)\b/i,
  confusion: /\bconfus(ed|ion)\b|\bmixed up\b/i,
  falls: /\b(fell|fall|falls|fallen|tripped)\b/i,
};

const INHALER = /\b(rescue )?inhaler\b/i;
const INHALER_MORE = /\bmore than usual\b|\bmore often\b|\bup from\b|\ba lot more\b|\bmore and more\b/i;
const TIMES_A_DAY = /\b(\d+|once|twice|two|three|four|five|six|seven|eight)\s*(times)?\s*a day\b/i;
const WORD_NUM: Record<string, number> = {
  once: 1, twice: 2, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
};

const MED_ISSUE =
  /\b(ran out|run out|running out|out of|stopped taking|not taking|haven'?t been taking|missed|skipping|skipped|can'?t afford)\b/i;
const MED_NAME =
  /(?:ran out of|run out of|running out of|out of|stopped taking|not taking|missed|skipped|skipping)\s+(?:my\s+|the\s+|her\s+|his\s+)?([a-z][a-z-]{2,})/i;
const GENERIC_MED = new Set([
  'pills', 'pill', 'medicine', 'medicines', 'meds', 'medication', 'medications', 'doses', 'dose', 'it', 'them',
  'water', 'prescription', 'prescriptions', 'some', 'one', 'a', 'any',
]);
const NOT_MEDS_AFTER_OUT_OF = /out of (breath|the hospital|the er|town|bed|it|state)\b/i;
const MED_OK = /\btaking (them|all|everything|my|it|every)\b|\ball of them\b/i;
const MED_CHANGE =
  /\b(changed|change in|switched|increased|decreased|lowered|raised|started (?:a |on )?new)\b|\bnew\b[^.;]*\b(dose|pill|prescription|medicine)\b/i;
const MED_WORD =
  /\b(pills?|doses?|diuretic|medicines?|medications?|meds|prescriptions?|insulin|metformin|inhaler|water pill|lasix|furosemide)\b/i;

const ER = /\b(er|e\.r\.|emergency room|emergency department|hospital|ambulance|urgent care)\b/i;

const BP = /(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})/i;
const GLUCOSE_WORD = /\b(sugar|sugars|glucose)\b/i;
const OXYGEN_WORD = /\b(oxygen|o2|sats?|saturation|pulse ox)\b/i;
const WEIGHT_WORD = /\b(pounds|lbs?|weigh|weighed|weight)\b/i;

const OPT_OUT =
  /\b(stop calling|stop these calls|stop the calls|don'?t call (me )?(again|anymore)|take me off|opt(?:ing)? out|unsubscribe|remove me)\b/i;
const WANTS_HUMAN =
  /\b(talk|speak) (to|with) (a |the |my |an actual |a real )?(nurse|person|human|someone)\b|\breal person\b|\bhuman\b/i;
const CALL_BACK = /\b(call (me )?back( later)?|call later|not a good time|busy right now|bad time)\b/i;
const NOTHING_NEEDED = /\b(nothing|that'?s (it|all|everything)|i'?m (good|fine|all set)|all set|no thanks?)\b/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function clauses(text: string): string[] {
  return text.split(/[.;!?]|\bbut\b|,\s*(?=and\b)/i).map((c) => c.trim()).filter(Boolean);
}

/** Whether a pattern is mentioned, and whether every mention is negated. */
function mention(text: string, re: RegExp): { hit: boolean; negated: boolean } {
  let hit = false;
  let positive = false;
  for (const c of clauses(text)) {
    const m = re.exec(c);
    if (!m) continue;
    hit = true;
    if (!NEG.test(c.slice(0, m.index))) positive = true;
  }
  return { hit, negated: hit && !positive };
}

/** The patient's words as a short detail: no leading yes/no, no leading "I". */
export function detailOf(text: string): string {
  let s = text.trim();
  s = s.replace(/^(yes|yeah|yep|no|nope|well|so|um|oh)\b[\s,.!—–-]*/i, '');
  s = s.replace(/^(i'?ve been|i have been|i'?m|i am|i have|i'?ve|i)\s+/i, '');
  s = s.replace(/[.!\s]+$/, '');
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function parseDate(text: string, callDate: string): string | undefined {
  const [cy, cm] = callDate.split('-').map(Number);
  const mk = (month: number, day: number) => {
    const year = month > cm ? cy - 1 : cy;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  let m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(text);
  if (m) return mk(MONTHS[m[1].toLowerCase()], Number(m[2]));
  m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)[a-z]*\b/i.exec(text);
  if (m) return mk(MONTHS[m[2].toLowerCase()], Number(m[1]));
  m = /\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b/i.exec(text);
  if (m) return mk(cm, Number(m[1]));
  if (/\btoday\b/i.test(text)) return dateOf(callDate);
  if (/\byesterday\b/i.test(text)) return addDays(callDate, -1);
  return undefined;
}

function numbers(text: string, min: number, max: number): number[] {
  const out: number[] = [];
  const re = /\b(\d{2,3}(?:\.\d)?)\b(?!\s*(?:days?|times?|years?|weeks?|hours?|minutes?|%|lbs?|pounds))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    if (n >= min && n <= max) out.push(n);
  }
  return out;
}

function parseReading(type: ReadingType, text: string, atStep: boolean): Answers['readings'] {
  const t = text.trim();
  switch (type) {
    case 'bp': {
      const m = BP.exec(t);
      if (!m) return {};
      const sys = Number(m[1]);
      const dia = Number(m[2]);
      if (sys < 60 || sys > 260 || dia < 30 || dia > 160) return {};
      return { bp: { sys, dia, text: t } };
    }
    case 'glucose': {
      if (!atStep && !GLUCOSE_WORD.test(t)) return {};
      const vals = numbers(t.replace(BP, ' '), 30, 600);
      return vals.length ? { glucose: { values: vals, text: t } } : {};
    }
    case 'oxygen': {
      if (!atStep && !OXYGEN_WORD.test(t)) return {};
      const m = /\b(\d{2,3})\s*%?/.exec(t.replace(BP, ' '));
      const pct = m ? Number(m[1]) : NaN;
      return pct >= 50 && pct <= 100 ? { oxygen: { pct, text: t } } : {};
    }
    case 'weight': {
      if (!atStep && !/\b(pounds|lbs?)\b|\bweigh(ed)?\b/i.test(t)) return {};
      if (/\bgained\b/i.test(t)) return {};
      const m = /\b(\d{2,3}(?:\.\d)?)\s*(?:lbs?|pounds)?\b/i.exec(t.replace(BP, ' '));
      const lb = m ? Number(m[1]) : NaN;
      return lb >= 70 && lb <= 600 ? { weight: { lb, text: t } } : {};
    }
  }
}

/** Parse one thing the patient (or caregiver) said, in answer to `step`. */
export function parseUtterance(text: string, step: string | undefined, callDate: string): Answers {
  const a = emptyAnswers();
  const t = text.trim();
  if (!t) return a;
  const st = step ?? '';
  const startsYes = YES.test(t);
  const startsNo = NO.test(t);
  const detail = detailOf(t);

  if (OPT_OUT.test(t)) a.optOut = true;
  if (st !== 'needs' && WANTS_HUMAN.test(t)) a.wantsHuman = true;
  if ((st === 'disclose' || st === 'opening') && CALL_BACK.test(t)) a.callBackLater = true;

  // Symptom answered at its own question.
  let stepRule: RuleCode | undefined;
  if (st.startsWith('symptom:')) {
    stepRule = st.slice(8) as RuleCode;
    let present: boolean | undefined;
    if (stepRule === 'rescue_inhaler') {
      present = inhalerIncrease(t) ?? (startsYes ? true : startsNo ? false : undefined);
    } else if (startsNo) present = false;
    else if (startsYes) present = true;
    else {
      const re = SYMPTOM_PATTERNS[stepRule];
      if (re) {
        const m = mention(t, re);
        if (m.hit) present = !m.negated;
      }
    }
    if (present !== undefined) {
      a.symptoms[stepRule] = { present, viaStep: true, detail: present ? detail : undefined };
    }
  }

  // Passing mentions of other symptoms.
  for (const [code, re] of Object.entries(SYMPTOM_PATTERNS) as [RuleCode, RegExp][]) {
    if (code === stepRule) continue;
    if (st === 'er' && code !== 'chest_pain' && code !== 'breathing_severe') continue; // reasons for a past visit
    const m = mention(t, re);
    if (m.hit) a.symptoms[code] = { present: !m.negated, detail: !m.negated ? detail : undefined };
  }
  if (stepRule !== 'rescue_inhaler' && INHALER.test(t)) {
    const inc = inhalerIncrease(t);
    if (inc) a.symptoms.rescue_inhaler = { present: true, detail };
  }

  // Medications.
  const outOfOther = NOT_MEDS_AFTER_OUT_OF.test(t);
  const issue = MED_ISSUE.test(t) && !outOfOther ? mention(t, MED_ISSUE) : { hit: false, negated: false };
  if (issue.hit && !issue.negated) {
    const nm = MED_NAME.exec(t);
    const name = nm && !GENERIC_MED.has(nm[1].toLowerCase()) ? nm[1].toLowerCase() : undefined;
    a.meds = { status: 'issue', detail, medName: name };
  } else if (st === 'meds') {
    if (startsYes || MED_OK.test(t) || (issue.hit && issue.negated)) a.meds = { status: 'ok' };
    else if (startsNo) a.meds = { status: 'issue', detail: detail || 'not taking all medicines as prescribed' };
  }
  if (MED_CHANGE.test(t) && MED_WORD.test(t)) {
    const m = mention(t, MED_CHANGE);
    if (!m.negated) a.medChange = detail;
  }

  // ER or hospital.
  if (st === 'er') {
    const m = mention(t, ER);
    const visited = startsNo ? false : startsYes || (m.hit && !m.negated);
    a.erVisit = { visited, viaStep: true };
    if (visited) {
      a.erVisit.date = parseDate(t, callDate);
      a.erVisit.detail = detail;
    }
  } else {
    const m = mention(t, ER);
    if (m.hit) {
      a.erVisit = { visited: !m.negated };
      if (!m.negated) {
        a.erVisit.date = parseDate(t, callDate);
        a.erVisit.detail = detail;
      }
    }
  }

  // Readings.
  const readingStep = st.startsWith('reading:') ? (st.slice(8) as ReadingType) : undefined;
  for (const type of ['bp', 'glucose', 'oxygen', 'weight'] as ReadingType[]) {
    Object.assign(a.readings, parseReading(type, t, type === readingStep));
  }
  if (readingStep && !a.readings[readingStep]) a.readingNotes = { [readingStep]: t };

  // Requests.
  if (st === 'needs') {
    if (!(startsNo || NOTHING_NEEDED.test(t))) {
      if (/\brefill/i.test(t)) a.requests.push({ kind: 'refill', text: detail });
      if (/\bappointment\b|\bsee (the )?(doctor|dr)/i.test(t)) a.requests.push({ kind: 'appointment', text: detail });
      if (/\bnurse\b|\bcall me\b|\btalk to (someone|a person)\b/i.test(t)) a.requests.push({ kind: 'nurse', text: detail });
      if (!a.requests.length) a.requests.push({ kind: 'other', text: detail });
    }
  } else if (/\brefill/i.test(t) && !mention(t, /\brefill/i).negated) {
    a.requests.push({ kind: 'refill', text: detail });
  }

  if (st === 'general' || st === 'opening') a.general = t;
  return a;
}

function inhalerIncrease(t: string): boolean | undefined {
  if (!INHALER.test(t) && !TIMES_A_DAY.test(t)) return undefined;
  if (INHALER_MORE.test(t)) return true;
  const m = TIMES_A_DAY.exec(t);
  if (m) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORD_NUM[m[1].toLowerCase()];
    return n >= 3;
  }
  return undefined;
}

export function mergeAnswers(base: Answers, p: Answers): Answers {
  const out: Answers = JSON.parse(JSON.stringify(base));
  if (p.meds && (!out.meds || p.meds.status === 'issue' || out.meds.status !== 'issue')) out.meds = p.meds;
  if (p.medChange) out.medChange = p.medChange;
  for (const [code, s] of Object.entries(p.symptoms) as [RuleCode, NonNullable<Answers['symptoms'][RuleCode]>][]) {
    const ex = out.symptoms[code];
    if (!ex || s.viaStep || (!ex.viaStep && s.present)) out.symptoms[code] = s;
  }
  Object.assign(out.readings, p.readings);
  if (p.readingNotes) {
    out.readingNotes = { ...(out.readingNotes ?? {}), ...p.readingNotes };
    for (const k of Object.keys(p.readings) as ReadingType[]) delete out.readingNotes[k];
  }
  for (const r of p.requests) {
    if (!out.requests.some((x) => x.kind === r.kind)) out.requests.push(r);
  }
  if (p.erVisit) {
    const ex = out.erVisit;
    if (!ex || p.erVisit.viaStep || (!ex.viaStep && p.erVisit.visited)) {
      out.erVisit = {
        ...p.erVisit,
        date: p.erVisit.date ?? (p.erVisit.visited ? ex?.date : undefined),
        detail: p.erVisit.detail ?? (p.erVisit.visited ? ex?.detail : undefined),
      };
    } else if (ex.visited && p.erVisit.visited) {
      ex.date = ex.date ?? p.erVisit.date;
      ex.detail = ex.detail ?? p.erVisit.detail;
    }
  }
  if (p.general) out.general = out.general ? `${out.general} ${p.general}` : p.general;
  if (p.optOut) out.optOut = true;
  if (p.wantsHuman) out.wantsHuman = true;
  if (p.callBackLater) out.callBackLater = true;
  return out;
}

/** Fold every patient or caregiver line of a transcript into answers. */
export function answersFromTranscript(lines: TranscriptLine[], callDate: string): Answers {
  let a = emptyAnswers();
  for (const l of lines) {
    if (l.who !== 'patient' && l.who !== 'caregiver') continue;
    a = mergeAnswers(a, parseUtterance(l.text, l.step, callDate));
  }
  return a;
}
