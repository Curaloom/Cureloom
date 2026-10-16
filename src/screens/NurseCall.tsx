import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Check, MessageSquareText, Pause, Play } from 'lucide-react';
import type { CallView, PatientView } from '../../shared/api';
import type { Task } from '../../shared/model';
import { nurseSteps } from '../../shared/nurseScript';
import { emptyAnswers } from '../../shared/parse';
import { assess, evaluateReading, levelOf, READINGS, RULES } from '../../shared/rules';
import { fmtDateTime, fmtDuration, fmtShort } from '../../shared/time';
import type { Answers, CallOutcome, Finding, FlagLevel } from '../../shared/types';
import { FlagBadge, ProgramBadge, ToneBadge, type Tone } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { InfoTip } from '@/components/app/info-tip';
import { PageHeader } from '@/components/app/page-header';
import { Duration, LiveDot } from '@/components/app/time';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useServerRealMs, useStore } from '../store';
import { Transcript } from './Transcript';

interface EndResult {
  call: CallView;
  tasks: Task[];
  findings: Finding[];
  level: FlagLevel;
  entry: { seconds: number; counts: boolean };
}

const PACE_MS = 300;

const END_OUTCOMES = ['completed', 'no_answer', 'declined'] as const;
type EndOutcome = (typeof END_OUTCOMES)[number];

/**
 * PageHeader sets its actions beside a flex-1 title column, which squeezes the title on a phone.
 * Below md (no sidebar, 1rem page padding) the actions take the content width, less a scrollbar's
 * worth, so they wrap onto their own line under the title.
 */
const HEADER_ACTIONS = 'flex flex-wrap items-center gap-2 max-md:w-[calc(100vw-3rem)]';

export function NurseCall({ callId }: { callId: number }) {
  const { state, role, act } = useStore();
  const real = useServerRealMs();
  const p = state.patients.find((x) => x.calls.some((c) => c.id === callId));
  const call = p?.calls.find((c) => c.id === callId);
  const [result, setResult] = useState<EndResult | null>(null);
  const [who, setWho] = useState<'patient' | 'caregiver'>('patient');
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<EndOutcome>('completed');
  const [nurseNote, setNurseNote] = useState('');
  const [playing, setPlaying] = useState(false);
  const stopPlay = useRef(false);

  const steps = useMemo(
    () =>
      p && p.setup ? nurseSteps({ firstName: p.first_name, readings: p.setup.readings, symptoms: p.setup.symptoms_to_watch }, p.script ?? undefined) : [],
    [p?.id, p?.setup, p?.script],
  );
  const transcript = call?.transcript ?? [];
  const answered = new Set(transcript.filter((l) => l.who !== 'nurse').map((l) => l.step));
  const asked = new Set(transcript.filter((l) => l.who === 'nurse').map((l) => l.step));
  const idx = Math.max(0, steps.findIndex((s) => !answered.has(s.key)));
  const current = steps[idx];
  const allDone = steps.length > 0 && steps.every((s) => answered.has(s.key));

  useEffect(() => () => void (stopPlay.current = true), []);

  if (!p || !call) return <EmptyState title="Call not found" />;

  if (result || call.status === 'done') {
    return <CallResult p={p} call={call} result={result} />;
  }
  const t = state.timer;
  const secs = t && t.callId === callId ? ((real - t.startedRealMs) / 1000) * t.speed : 0;
  const nurse = role === 'nurse';

  async function line(lineWho: 'nurse' | 'patient' | 'caregiver', lineText: string, step: string) {
    return act('addNurseCallLine', { callId, who: lineWho, text: lineText, step });
  }

  async function ask(i: number) {
    const s = steps[i];
    if (!asked.has(s.key)) await line('nurse', s.question, s.key);
  }

  async function reply(replyText: string) {
    if (!current) return;
    if (!asked.has(current.key)) await line('nurse', current.question, current.key);
    await line(who, replyText, current.key);
    setText('');
  }

  async function play() {
    setPlaying(true);
    stopPlay.current = false;
    const wait = () => new Promise((r) => setTimeout(r, PACE_MS));
    for (let i = idx; i < steps.length; i++) {
      if (stopPlay.current) break;
      const s = steps[i];
      if (!asked.has(s.key)) {
        const r = await line('nurse', s.question, s.key);
        if (!r.ok) break;
        await wait();
      }
      if (stopPlay.current) break;
      const r = await line(who, s.reply, s.key);
      if (!r.ok) break;
      await wait();
    }
    setPlaying(false);
  }

  async function end() {
    stopPlay.current = true;
    const r = await act<EndResult>('endNurseCall', { callId, outcome, answeredBy: who, nurseNote });
    if (r.ok && r.result) setResult(r.result);
  }

  const replyClass =
    'flex w-full flex-col items-start gap-0.5 rounded-md border bg-background p-2.5 text-left text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          <>
            Nurse call · {p.name} <span className="font-normal text-muted-foreground">{p.mrn}</span>
          </>
        }
        meta={
          <>
            <span>{[p.phone, p.caregiver_name && `Caregiver ${[p.caregiver_name, p.caregiver_phone].filter(Boolean).join(', ')}`].filter(Boolean).join(' · ')}</span>
            <ProgramBadge program={p.program} />
            <ToneBadge tone="neutral">Simulated</ToneBadge>
          </>
        }
        actions={
          <div className={HEADER_ACTIONS}>
            <div className="flex items-center gap-2 pr-2">
              <LiveDot className="size-2.5" />
              <Duration seconds={secs} className="font-sans text-2xl font-semibold tabular-nums" />
              <span className="text-xs text-muted-foreground">{t?.speed === 60 ? '1 s = 1 min' : 'real time'}</span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={`#/patient/${p.id}`}>Patient month</a>
            </Button>
          </div>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        <Panel title="Script">
          <ol className="-mx-2 flex flex-col gap-0.5">
            {steps.map((s, i) => {
              const done = answered.has(s.key);
              const isCurrent = i === idx && !allDone;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    disabled={!nurse || done}
                    onClick={() => ask(i)}
                    className={cn(
                      'flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default',
                      isCurrent ? 'bg-accent' : 'disabled:hover:bg-transparent',
                      done && 'opacity-60',
                    )}
                  >
                    <span className="flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {done && <Check className="size-3 text-emerald-600" />}
                      {s.label}
                    </span>
                    <span className="text-sm leading-snug">{s.question}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Transcript">
            {transcript.length ? (
              <ScrollArea className="h-[360px] rounded-md border bg-muted/40">
                <Transcript lines={transcript} live className="rounded-none border-0 bg-transparent" />
              </ScrollArea>
            ) : (
              <EmptyState icon={<MessageSquareText />} title="Ask the first question or play the script" />
            )}
          </Panel>

          <Panel title={current && !allDone ? `Patient's answer · ${current.label}` : 'Script finished'}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {p.caregiver_name && (
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    aria-label="Who is speaking"
                    value={who}
                    onValueChange={(v) => {
                      if (v === 'patient' || v === 'caregiver') setWho(v);
                    }}
                  >
                    <ToggleGroupItem value="patient">Patient</ToggleGroupItem>
                    <ToggleGroupItem value="caregiver">Caregiver</ToggleGroupItem>
                  </ToggleGroup>
                )}
                <RoleGate allowed={nurse}>
                  <Button size="sm" disabled={!nurse || playing || allDone} onClick={play}>
                    <Play />
                    {playing ? 'Playing…' : idx === 0 ? 'Play script' : 'Play the rest'}
                  </Button>
                </RoleGate>
                {playing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      stopPlay.current = true;
                    }}
                  >
                    <Pause />
                    Pause
                  </Button>
                )}
              </div>
              {current && !allDone && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className={cn(replyClass, current.scripted && 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100')}
                    disabled={!nurse || playing}
                    onClick={() => reply(current.reply)}
                  >
                    {current.scripted && <span className="text-[10px] font-semibold text-emerald-700 uppercase">October script</span>}
                    {`“${current.reply}”`}
                  </button>
                  {current.reply !== 'No.' && current.key.startsWith('symptom:') && (
                    <button type="button" className={replyClass} disabled={!nurse || playing} onClick={() => reply('No.')}>
                      “No.”
                    </button>
                  )}
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (text.trim()) reply(text.trim());
                    }}
                  >
                    <Input
                      className="h-8"
                      aria-label="What was said"
                      placeholder={`Type what the ${who} says…`}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      disabled={!nurse || playing}
                    />
                    <Button variant="outline" size="sm" disabled={!nurse || playing || !text.trim()}>
                      Add
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="End call" tip="Only a completed call counts toward minutes">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={outcome} onValueChange={(v) => setOutcome(END_OUTCOMES.find((o) => o === v) ?? 'completed')}>
                <SelectTrigger size="sm" className="w-full sm:w-auto" aria-label="Outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed — reached the {who}</SelectItem>
                  <SelectItem value="no_answer">No answer</SelectItem>
                  <SelectItem value="declined">Reached, but declined the call</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="h-8 min-w-48 flex-1"
                aria-label="Nurse note"
                placeholder="Nurse note (optional)"
                value={nurseNote}
                onChange={(e) => setNurseNote(e.target.value)}
              />
              <RoleGate allowed={nurse}>
                <Button size="sm" disabled={!nurse} onClick={end}>
                  End call
                </Button>
              </RoleGate>
            </div>
          </Panel>
        </div>

        <AnswerFields p={p} answers={call.answers ?? emptyAnswers()} />
      </div>
    </div>
  );
}

/** A card with a compact header. */
function Panel({ title, tip, className, children }: { title: ReactNode; tip?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="flex min-h-5 items-center gap-2 px-4">
        <CardTitle className="flex items-center gap-1.5 leading-snug">
          {title}
          {tip && <InfoTip>{tip}</InfoTip>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  );
}

/** Renders a role-gated control; when the role may not use it, the (disabled) control gets a tooltip naming who can. */
function RoleGate({ allowed, label = 'Nurse only', children }: { allowed: boolean; label?: string; children: ReactElement }) {
  if (allowed) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function AnswerRow({ k, v, filled, hit }: { k: string; v: ReactNode; filled: boolean; hit?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 border-b py-1.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn(filled ? 'font-medium' : 'text-muted-foreground', hit && 'text-amber-700')}>{v}</span>
    </div>
  );
}

function AnswerFields({ p, answers: a }: { p: PatientView; answers: Answers }) {
  const setup = p.setup;
  const findings = setup ? assess(a, setup) : [];
  const level = levelOf(findings);
  return (
    <Panel title="Answers">
      <div className="flex flex-col">
        <AnswerRow k="Medications" filled={!!a.meds} v={a.meds ? (a.meds.status === 'ok' ? 'Taking all as prescribed' : a.meds.detail) : '—'} />
        {a.medChange && <AnswerRow k="Med change" filled v={a.medChange} />}
        {setup?.symptoms_to_watch.map((r) => {
          const s = a.symptoms[r];
          return (
            <AnswerRow
              key={r}
              k={RULES[r].label}
              filled={!!s}
              hit={!!s?.present}
              v={s ? (s.present ? `Yes${s.detail ? ` — ${s.detail}` : ''}` : 'No') : '—'}
            />
          );
        })}
        <AnswerRow
          k="ER or hospital"
          filled={!!a.erVisit}
          hit={!!a.erVisit?.visited}
          v={a.erVisit ? (a.erVisit.visited ? `Yes${a.erVisit.date ? `, ${a.erVisit.date}` : ''}` : 'No') : '—'}
        />
        {setup?.readings.map((r) => {
          const res = evaluateReading(r, a, setup.targets);
          return (
            <AnswerRow
              key={r}
              k={READINGS[r].label}
              filled={!!res}
              hit={!!res && res.status !== 'in_range'}
              v={res ? `${res.value} (target ${res.target})` : (a.readingNotes?.[r] ?? '—')}
            />
          );
        })}
        <AnswerRow k="Requests" filled={a.requests.length > 0} v={a.requests.length ? a.requests.map((r) => r.text).join('; ') : '—'} />
      </div>
      <div className="mt-3">
        {level === 'none' ? (
          <p className="text-sm text-muted-foreground">No concerns so far.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <FlagBadge level={level} />
            <ul className="flex list-disc flex-col gap-1 pl-4 text-sm">
              {findings
                .filter((f) => f.level !== 'info')
                .map((f, i) => (
                  <li key={i}>{f.text}</li>
                ))}
            </ul>
            {level === 'urgent' && <p className="text-sm font-medium text-destructive">Tell the patient to call 911 now (988 for thoughts of self-harm).</p>}
          </div>
        )}
      </div>
    </Panel>
  );
}

const OUTCOME_TONE: Record<CallOutcome, Tone> = {
  completed: 'ok',
  no_answer: 'warn',
  declined: 'neutral',
  escalated: 'danger',
  opted_out: 'neutral',
};

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  completed: 'Completed',
  no_answer: 'No answer',
  declined: 'Declined',
  escalated: 'Escalated',
  opted_out: 'Opted out',
};

function CallResult({ p, call, result }: { p: PatientView; call: CallView; result: EndResult | null }) {
  const draft = p.note?.draft ?? '';
  const lines = draft.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`- ${fmtDateTime(call.started_at)} · Nurse call`));
  const section: string[] = [];
  if (start >= 0) {
    section.push(lines[start]);
    for (let i = start + 1; i < lines.length && lines[i].startsWith('    '); i++) section.push(lines[i]);
  }
  const tasks = result?.tasks ?? p.tasks.filter((t) => t.call_id === call.id);
  const entry = p.time.find((t) => t.call_id === call.id);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          <>
            Call ended · {p.name} <span className="font-normal text-muted-foreground">{p.mrn}</span>
          </>
        }
        meta={
          <>
            {call.outcome && <ToneBadge tone={OUTCOME_TONE[call.outcome]}>{OUTCOME_LABEL[call.outcome]}</ToneBadge>}
            <span className="tabular-nums">
              {entry ? fmtDuration(entry.seconds) : '—'} · {entry?.counts ? 'counted' : '0 counted minutes'}
            </span>
          </>
        }
      />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Panel title="Drafted note section">
          {section.length ? (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{section.join('\n')}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">No note section yet.</p>
          )}
        </Panel>
        <Panel title="Tasks created">
          <div className="flex flex-col gap-3">
            {tasks.length ? (
              <ul className="flex flex-col divide-y">
                {tasks.map((t) => (
                  <li key={t.id} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                    <div className="text-sm">
                      <span className="font-medium">{t.title}</span> <span className="text-xs whitespace-nowrap text-muted-foreground">due {fmtShort(t.due)}</span>
                    </div>
                    {t.reason && <div className="text-xs text-muted-foreground">{t.reason}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks.</p>
            )}
            {call.flag !== 'none' && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
                <FlagBadge level={call.flag} />
                <span>{call.summary}</span>
              </div>
            )}
          </div>
        </Panel>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={`#/patient/${p.id}`}>Back to {p.first_name}'s month</a>
        </Button>
        <Button variant="outline" asChild>
          <a href="#/queue">Today queue</a>
        </Button>
      </div>
      <Panel title="Transcript">
        <Transcript lines={call.transcript} />
      </Panel>
    </div>
  );
}
