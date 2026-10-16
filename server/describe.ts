// Plain-language summaries of calls and answers, shared by the brief, the
// queue, the event trail and the note draft.

import type { Call, CallSetup } from '../shared/model';
import { assess, evaluateReading, RULES, READINGS, readingValueText, type ReadingResult } from '../shared/rules';
import { fmtDateTime, fmtShort, toMs } from '../shared/time';
import type { Answers, Finding, ReadingType, RuleCode } from '../shared/types';
import { flagSummary, lcFirst } from './service';

export function reached(c: Call): boolean {
  return c.status === 'done' && (c.outcome === 'completed' || c.outcome === 'escalated') && c.answered_by != null;
}

export function callFindings(c: Call, setup: CallSetup | null): Finding[] {
  if (!reached(c) || !c.answers || !setup) return [];
  return assess(c.answers, setup);
}

export function callSeconds(c: Call): number {
  if (!c.started_at || !c.ended_at) return 0;
  return Math.max(0, Math.round((toMs(c.ended_at) - toMs(c.started_at)) / 1000));
}

export function callLabel(c: Call): string {
  return c.kind === 'ai' ? 'AI check-in' : 'Nurse call';
}

export function readingsShort(a: Answers | null): string {
  if (!a) return '';
  const parts: string[] = [];
  for (const t of ['bp', 'glucose', 'weight', 'oxygen'] as ReadingType[]) {
    const v = readingValueText(t, a);
    if (v) parts.push(`${t === 'bp' ? 'BP' : READINGS[t].label.toLowerCase().replace('fasting ', '')} ${v}`);
  }
  return parts.join(', ');
}

export function callSummary(c: Call, setup: CallSetup | null): string {
  const when = fmtShort(c.started_at ?? c.scheduled_for);
  const label = callLabel(c);
  if (c.status === 'scheduled') return `${label} scheduled ${fmtDateTime(c.scheduled_for)}`;
  if (c.status === 'cancelled') return `${label} for ${fmtShort(c.scheduled_for)} cancelled`;
  if (c.status === 'in_progress') return `${label} in progress`;
  const by = c.answered_by === 'caregiver' ? ', answered by caregiver' : '';
  switch (c.outcome) {
    case 'no_answer':
      return `${label} ${when} — no answer${c.kind === 'ai' ? ` (try ${c.attempt})` : ''}`;
    case 'declined':
      return `${label} ${when} — ${c.answers?.wantsHuman ? 'asked for a person' : c.answers?.callBackLater ? 'asked to be called back' : 'declined'}`;
    case 'opted_out':
      return `${label} ${when} — opted out ("stop calling me")`;
    case 'escalated': {
      const f = callFindings(c, setup).filter((x) => x.level === 'urgent');
      const esc = f.find((x) => x.escalation)?.escalation === '988' ? 'Told to call or text 988' : 'Told to call 911';
      return `${label} ${when} — URGENT${by}: ${lcFirst(flagSummary(f))}. ${esc}.`;
    }
    default: {
      const f = callFindings(c, setup);
      const concern = f.filter((x) => x.level === 'concern');
      const r = readingsShort(c.answers);
      const head = `${label} ${when} — completed${by}`;
      if (concern.length) return `${head}, concern: ${lcFirst(flagSummary(concern))}.`;
      return `${head}, no concerns.${r ? ` ${r.charAt(0).toUpperCase()}${r.slice(1)}.` : ''}`;
    }
  }
}

/** The detailed answer lines for the note draft. */
export function answerLines(c: Call, setup: CallSetup | null): string[] {
  const a = c.answers;
  if (!a || !reached(c)) return [];
  const out: string[] = [];
  out.push(
    `Medications: ${a.meds?.status === 'issue' ? a.meds.detail : a.meds?.status === 'ok' ? 'taking all as prescribed' : 'not asked'}${a.medChange ? `; change reported: ${a.medChange}` : ''}`,
  );
  const watched = setup?.symptoms_to_watch ?? [];
  const present = (Object.entries(a.symptoms) as [RuleCode, { present: boolean; detail?: string }][]).filter(([, s]) => s?.present);
  if (present.length) {
    out.push(`Symptoms: ${present.map(([code, s]) => `${RULES[code].label.toLowerCase()}${s.detail ? ` — "${s.detail}"` : ''}`).join('; ')}`);
  } else if (c.outcome === 'completed') {
    out.push(`Symptoms: none of the watched symptoms (${watched.map((r) => RULES[r].label.toLowerCase()).join(', ') || 'none set'})`);
  }
  if (c.outcome === 'completed' || a.erVisit) {
    out.push(
      `ER or hospital since last contact: ${a.erVisit?.visited ? `yes${a.erVisit.date ? `, ${fmtShort(a.erVisit.date)}` : ''}${a.erVisit.detail ? ` — ${a.erVisit.detail}` : ''}` : 'no'}`,
    );
  }
  const readings = readingResults(a, setup);
  if (readings.length) {
    out.push(
      `Readings: ${readings
        .map((r) => `${READINGS[r.type].label.toLowerCase()} ${r.value} (target ${r.target}, ${statusText(r.status)})`)
        .join('; ')}`,
    );
  }
  const notes = Object.entries(a.readingNotes ?? {});
  if (notes.length) out.push(`Readings not given: ${notes.map(([t, n]) => `${READINGS[t as ReadingType].label.toLowerCase()} ("${n}")`).join('; ')}`);
  if (a.requests.length) out.push(`Requests: ${a.requests.map((r) => r.text).join('; ')}`);
  return out;
}

export function statusText(s: ReadingResult['status']): string {
  return s === 'in_range' ? 'in range' : s === 'above' ? 'above target' : 'below target';
}

export function readingResults(a: Answers, setup: CallSetup | null): ReadingResult[] {
  if (!setup) return [];
  const out: ReadingResult[] = [];
  for (const t of ['bp', 'glucose', 'weight', 'oxygen'] as ReadingType[]) {
    const r = evaluateReading(t, a, setup.targets);
    if (r) out.push(r);
  }
  return out;
}
