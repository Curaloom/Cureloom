import { useState, type ReactElement, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, CircleAlert, CircleCheck, History, Send } from 'lucide-react';
import type { CallView, PatientView, StepView, TimerView } from '../../shared/api';
import { ACTIVITIES, type ActivityKey } from '../../shared/constants';
import type { Flag } from '../../shared/model';
import { fmtDate, fmtDateTime, fmtShort } from '../../shared/time';
import { FlagBadge, ProgramBadge, StatusBadge, ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { InfoTip } from '@/components/app/info-tip';
import { PageHeader } from '@/components/app/page-header';
import { PlanDoc } from '@/components/app/plan-doc';
import { Duration, LiveDot } from '@/components/app/time';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { go } from '../router';
import { useServerRealMs, useStore } from '../store';
import { ConsentModal } from './ConsentModal';
import { SetupModal } from './SetupModal';
import { Transcript } from './Transcript';

const EHR: ActivityKey[] = ['ehr_chart_review', 'ehr_med_review', 'ehr_care_plan_review'];
const OTHER: ActivityKey[] = ['coordination', 'education', 'documentation'];

/**
 * PageHeader sets its actions beside a flex-1 title column, which squeezes the title on a phone.
 * Below md (no sidebar, 1rem page padding) the actions take the content width, less a scrollbar's
 * worth, so they wrap onto their own line under the title.
 */
const HEADER_ACTIONS = 'flex flex-wrap items-center gap-2 max-md:w-[calc(100vw-3rem)]';

export function PatientMonth({ id }: { id: number }) {
  const { state, role, act } = useStore();
  const p = state.patients.find((x) => x.id === id);
  const [consent, setConsent] = useState(false);
  const [setup, setSetup] = useState(false);
  if (!p) return <EmptyState title="Patient not found" />;
  const nurse = role === 'nurse';
  const inCall = p.calls.find((c) => c.kind === 'nurse' && c.status === 'in_progress');

  async function startCall() {
    const r = await act<{ id: number }>('startNurseCall', { patientId: p!.id });
    if (r.ok && r.result) go(`/call/${r.result.id}`);
  }

  const facts = [
    String(p.age),
    `DOB ${fmtDate(p.dob)}`,
    p.phone,
    `${p.insurance_name} (${p.payerLabel}${p.is_qmb && !/QMB/.test(p.payerLabel) ? ', QMB' : ''})`,
    p.caregiver_name && `Caregiver ${[p.caregiver_name, p.caregiver_phone].filter(Boolean).join(', ')}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          <>
            {p.name} <span className="font-normal text-muted-foreground">{p.mrn}</span>
          </>
        }
        meta={
          <>
            <StatusBadge status={p.status} />
            {p.program ? <ProgramBadge program={p.program} /> : p.proposed_program && <ToneBadge tone="neutral">{p.proposed_program.toUpperCase()} proposed</ToneBadge>}
            {p.prefers_human && <ToneBadge tone="neutral">Prefers a human</ToneBadge>}
            {p.ineligible_reason && <span>{p.ineligible_reason}</span>}
          </>
        }
        description={facts.join(' · ')}
        actions={
          <div className={HEADER_ACTIONS}>
            <RoleGate allowed={nurse}>
              <div className="flex h-8 items-center gap-2 rounded-md border bg-background px-3 shadow-xs">
                <Switch
                  id="prefers-human"
                  checked={p.prefers_human}
                  disabled={!nurse}
                  onCheckedChange={(value) => act('setPrefersHuman', { patientId: p.id, value })}
                />
                <Label htmlFor="prefers-human">Prefers a human</Label>
              </div>
            </RoleGate>
            <Button variant="outline" size="sm" asChild>
              <a href={`#/events?patient=${p.id}`}>
                <History />
                Audit trail
              </a>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="month">
        <TabsList>
          <TabsTrigger value="month">This month</TabsTrigger>
          <TabsTrigger value="profile">Clinical profile</TabsTrigger>
          <TabsTrigger value="plan" className="gap-1.5">
            Care plan
            {p.carePlan && <span className="text-xs text-muted-foreground">v{p.carePlan.version}</span>}
            {p.draftPlan && <ToneBadge tone="info">draft</ToneBadge>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileView p={p} />
        </TabsContent>
        <TabsContent value="plan">
          <CarePlanView p={p} />
        </TabsContent>
        <TabsContent value="month">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-4">
              <Brief p={p} />
              <Panel title="This month">
                <ol className="flex flex-col">
                  {p.steps.map((s) => (
                    <Step key={s.key} s={s}>
                      {stepActions(s, p)}
                    </Step>
                  ))}
                </ol>
              </Panel>
              <CallsCard p={p} />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <TimerCard p={p} />
              <MinutesCard p={p} />
              <TasksCard p={p} />
              <EscalateCard p={p} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
      {consent && <ConsentModal patientId={p.id} onClose={() => setConsent(false)} />}
      {setup && <SetupModal patientId={p.id} onClose={() => setSetup(false)} />}
    </div>
  );

  function stepActions(s: StepView, p: PatientView): ReactNode {
    const enrolled = p.status === 'active' || p.status === 'opted_out';
    switch (s.key) {
      case 'consent':
        return p.status === 'confirmed' ? (
          <RoleGate allowed={nurse}>
            <Button size="sm" disabled={!nurse} onClick={() => setConsent(true)}>
              Open consent script
            </Button>
          </RoleGate>
        ) : null;
      case 'setup':
        return ['consented', 'plan_review', 'active', 'paused'].includes(p.status) ? (
          <RoleGate allowed={nurse}>
            <Button variant="outline" size="sm" disabled={!nurse} onClick={() => setSetup(true)}>
              {p.setup ? 'Edit call setup' : 'Fill call setup'}
            </Button>
          </RoleGate>
        ) : null;
      case 'contact':
        if (!enrolled) return null;
        return (
          <>
            {inCall ? (
              <Button size="sm" asChild>
                <a href={`#/call/${inCall.id}`}>Return to call</a>
              </Button>
            ) : (
              <RoleGate allowed={nurse}>
                <Button size="sm" disabled={!nurse} onClick={startCall}>
                  Start nurse call
                </Button>
              </RoleGate>
            )}
            {p.calls
              .filter((c) => c.kind === 'ai' && c.status === 'done' && c.started_at?.startsWith(state.clock.month) && c.answered_by && !c.reviewed_at)
              .map((c) => (
                <RoleGate key={c.id} allowed={nurse}>
                  <Button variant="outline" size="sm" disabled={!nurse} onClick={() => act('markCallReviewed', { callId: c.id })}>
                    Mark AI call {fmtShort(c.started_at)} reviewed
                  </Button>
                </RoleGate>
              ))}
          </>
        );
      case 'flags': {
        const open = p.flags.filter((f) => !f.resolved_at);
        return open.length ? <FlagActions flags={open} /> : null;
      }
      case 'chart':
      case 'meds':
      case 'plan': {
        const a = EHR[['chart', 'meds', 'plan'].indexOf(s.key)];
        return enrolled ? (
          <RoleGate allowed={nurse}>
            <Button variant="outline" size="sm" disabled={!nurse || !!state.timer} onClick={() => act('startActivity', { patientId: p.id, activity: a })}>
              Working in EHR
            </Button>
          </RoleGate>
        ) : null;
      }
      case 'tasks':
        return enrolled ? (
          <RoleGate allowed={nurse}>
            <Button
              variant="outline"
              size="sm"
              disabled={!nurse || !!state.timer}
              onClick={() => act('startActivity', { patientId: p.id, activity: 'coordination' })}
            >
              Start coordination timer
            </Button>
          </RoleGate>
        ) : null;
      case 'note':
        return (
          <Button variant="outline" size="sm" asChild>
            <a href={`#/month-end/${p.id}`}>Month-end note</a>
          </Button>
        );
      default:
        return null;
    }
  }
}

/** A card with a compact header. */
function Panel({
  title,
  tip,
  action,
  className,
  children,
}: {
  title: ReactNode;
  tip?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn('gap-3 py-4', className)}>
      <CardHeader className="flex min-h-5 items-center justify-between gap-2 px-4">
        <CardTitle className="flex items-center gap-1.5">
          {title}
          {tip && <InfoTip>{tip}</InfoTip>}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  );
}

/** Renders a role-gated control; when the role may not use it, the (disabled) control gets a tooltip naming who can. */
function RoleGate({
  allowed,
  label = 'Nurse only',
  className,
  children,
}: {
  allowed: boolean;
  label?: string;
  className?: string;
  children: ReactElement;
}) {
  if (allowed) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn('inline-flex rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function StepIcon({ s }: { s: StepView }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
      {s.state === 'done' ? (
        <CircleCheck className="size-6 text-emerald-600" />
      ) : s.state === 'attention' ? (
        <CircleAlert className="size-6 text-destructive" />
      ) : s.state === 'na' ? (
        <span className="size-5 rounded-full border-2 border-dashed border-muted-foreground/30" />
      ) : (
        <span className="flex size-5 items-center justify-center rounded-full border-2 border-muted-foreground/40 text-[11px] font-semibold text-muted-foreground">
          {s.n}
        </span>
      )}
    </span>
  );
}

function Step({ s, children }: { s: StepView; children: ReactNode }) {
  return (
    <li className="flex gap-3 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0">
      <StepIcon s={s} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className={cn('leading-6 font-medium', s.state === 'na' && 'text-muted-foreground')}>{s.label}</div>
        <div className="text-sm text-muted-foreground">{s.detail}</div>
        {children && <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </li>
  );
}

function None({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/** Brief labels sit in a 120px column, or above their value on a phone. */
const DT = 'text-muted-foreground max-sm:-mb-1.5 max-sm:text-xs';

function Brief({ p }: { p: PatientView }) {
  const b = p.brief;
  return (
    <Panel title="Brief" className="border-l-4 border-l-primary">
      <dl className="grid gap-y-2 text-sm sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-x-4">
        <dt className={DT}>Last month</dt>
        <dd>{b.lastMonth ?? <None>No call last month</None>}</dd>
        <dt className={DT}>This month</dt>
        <dd>{b.contact}</dd>
        {p.program === 'apcm' && (
          <>
            <dt className={DT}>AI call</dt>
            <dd>
              {b.aiCall.length ? (
                <ul className="flex flex-col gap-1">
                  {b.aiCall.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              ) : (
                <None>No AI call yet</None>
              )}
            </dd>
          </>
        )}
        <dt className={DT}>Readings</dt>
        <dd className="min-w-0">
          {b.readings.length ? (
            <div className="overflow-x-auto">
              <table className="-my-0.5 text-sm">
                <tbody>
                  {b.readings.map((r) => (
                    <tr key={r.label}>
                      <td className="py-0.5 pr-4 align-middle">{r.label}</td>
                      <td className="py-0.5 pr-4 align-middle font-mono whitespace-nowrap tabular-nums">{r.value}</td>
                      <td className="py-0.5 pr-4 align-middle whitespace-nowrap text-muted-foreground">target {r.target}</td>
                      <td className="py-0.5 pr-4 align-middle">
                        {r.status === 'in_range' ? (
                          <ToneBadge tone="ok">In range</ToneBadge>
                        ) : (
                          <ToneBadge tone="warn">{r.status === 'above' ? 'Above target' : 'Below target'}</ToneBadge>
                        )}
                      </td>
                      <td className="py-0.5 align-middle text-xs whitespace-nowrap text-muted-foreground">{r.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <None>None reported yet</None>
          )}
        </dd>
        <dt className={DT}>Flags</dt>
        <dd>
          {b.flags.length ? (
            <ul className="flex flex-col gap-1">
              {b.flags.map((f) => (
                <li key={f.id} className="flex items-start gap-2">
                  <FlagBadge level={f.level} />
                  <span className="min-w-0">
                    {f.summary} <span className="text-xs whitespace-nowrap text-muted-foreground">{f.state}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <None>None</None>
          )}
        </dd>
        <dt className={DT}>Open tasks</dt>
        <dd>
          {b.openTasks.length ? (
            <ul className="flex flex-col gap-1">
              {b.openTasks.map((t) => (
                <li key={t.id}>
                  {t.title} <span className="text-xs whitespace-nowrap text-muted-foreground">due {fmtShort(t.due)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <None>None</None>
          )}
        </dd>
      </dl>
    </Panel>
  );
}

function FlagActions({ flags }: { flags: Flag[] }) {
  const { role, act } = useStore();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const nurse = role === 'nurse';
  return (
    <div className="flex w-full flex-col gap-2">
      {flags.map((f) => (
        <div
          key={f.id}
          className={cn(
            'flex flex-col gap-2.5 rounded-md border p-3',
            f.level === 'urgent' ? 'border-destructive/30 bg-destructive/5' : 'border-amber-200 bg-amber-50',
          )}
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <FlagBadge level={f.level} />
              <span className="font-medium">{f.summary}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Raised {fmtDateTime(f.raised_at)}
              {f.acknowledged_at ? ` · acknowledged ${fmtDateTime(f.acknowledged_at)}` : ''}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!f.acknowledged_at && (
              <RoleGate allowed={nurse}>
                <Button variant="outline" size="sm" disabled={!nurse} onClick={() => act('acknowledgeFlag', { flagId: f.id })}>
                  Acknowledge
                </Button>
              </RoleGate>
            )}
            <div className="flex min-w-60 flex-1 gap-2">
              <Input
                className="h-8 bg-background"
                aria-label="Resolution"
                placeholder="Resolution, e.g. called 911"
                value={notes[f.id] ?? ''}
                onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })}
              />
              <RoleGate allowed={nurse}>
                <Button size="sm" disabled={!nurse || !(notes[f.id] ?? '').trim()} onClick={() => act('resolveFlag', { flagId: f.id, note: notes[f.id] })}>
                  Resolve
                </Button>
              </RoleGate>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CallsCard({ p }: { p: PatientView }) {
  const { state } = useStore();
  const month = state.clock.month;
  const calls = p.calls.filter((c) => (c.started_at ?? c.scheduled_for ?? '').startsWith(month));
  return (
    <Panel title="Calls this month">
      {!calls.length ? (
        <p className="text-sm text-muted-foreground">No calls this month.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {calls.map((c) => (
            <CallRow key={c.id} c={c} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CallRow({ c }: { c: CallView }) {
  const hasTranscript = c.transcript.length > 0 && c.status === 'done';
  const timed = c.status === 'done' && c.seconds > 0;
  const head = (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
      <ToneBadge tone={c.kind === 'ai' ? 'info' : 'neutral'} className="mt-0.5 w-12">
        {c.kind === 'ai' ? 'AI' : 'Nurse'}
      </ToneBadge>
      <div className="min-w-0 flex-1 basis-56 text-sm">{c.summary}</div>
      {(timed || hasTranscript) && (
        <div className="ml-auto flex items-center gap-2">
          {timed && <Duration seconds={c.seconds} className="text-xs text-muted-foreground" />}
          {hasTranscript && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="-my-1 h-7 text-muted-foreground [&[data-state=open]>svg]:rotate-180">
                Transcript
                <ChevronDown className="transition-transform" />
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
      )}
    </div>
  );
  if (!hasTranscript) return <li className="py-2.5 first:pt-0 last:pb-0">{head}</li>;
  return (
    <Collapsible asChild>
      <li className="py-2.5 first:pt-0 last:pb-0">
        {head}
        <CollapsibleContent className="pt-2.5">
          <Transcript lines={c.transcript} />
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

/** "chart review" → "Chart review". */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Where a running timer lives: its call, the consent script, or the patient month. */
function timerHref(t: TimerView): string {
  if (t.callId && t.activity === 'nurse_call') return `#/call/${t.callId}`;
  if (t.activity === 'consent_call') return '#/enroll';
  return `#/patient/${t.patientId}`;
}

function TimerCard({ p }: { p: PatientView }) {
  const { state, role, act } = useStore();
  const real = useServerRealMs();
  const [outcome, setOutcome] = useState('');
  const [ehr, setEhr] = useState<ActivityKey>('ehr_chart_review');
  const [other, setOther] = useState<ActivityKey>('coordination');
  const t = state.timer;
  const nurse = role === 'nurse';
  const enrolled = ['active', 'opted_out', 'paused', 'consented'].includes(p.status);

  if (t && t.patientId === p.id) {
    const secs = ((real - t.startedRealMs) / 1000) * t.speed;
    const isCall = t.activity === 'nurse_call' || t.activity === 'consent_call';
    const outcomes = ACTIVITIES[t.activity].outcomes;
    return (
      <Panel
        title={ACTIVITIES[t.activity].ehr ? 'Working in EHR' : 'Timer running'}
        action={t.speed === 60 ? <ToneBadge tone="neutral">1 s = 1 min</ToneBadge> : undefined}
        className="border-primary bg-primary/5"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2.5">
              <LiveDot className="size-2.5" />
              <Duration seconds={secs} className="font-sans text-3xl font-semibold tabular-nums" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t.activityLabel} · started {fmtDateTime(t.startedAt)}
            </p>
          </div>
          {isCall ? (
            <Button size="sm" asChild>
              {t.callId ? <a href={`#/call/${t.callId}`}>Go to the call</a> : <a href="#/enroll">Go to the consent script</a>}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger size="sm" className="w-full bg-background" aria-label="Outcome">
                  <SelectValue placeholder="Outcome…" />
                </SelectTrigger>
                <SelectContent>
                  {outcomes.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <RoleGate allowed={nurse} className="flex flex-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={!outcome || !nurse}
                    onClick={async () => {
                      const r = await act('stopActivity', { outcome });
                      if (r.ok) setOutcome('');
                    }}
                  >
                    Stop and save
                  </Button>
                </RoleGate>
                <RoleGate allowed={nurse}>
                  <Button variant="outline" size="sm" disabled={!nurse} onClick={() => act('discardTimer')}>
                    Discard
                  </Button>
                </RoleGate>
              </div>
            </div>
          )}
        </div>
      </Panel>
    );
  }
  return (
    <Panel title="Log work" tip="Minutes come only from timers, floored to whole minutes">
      {t ? (
        <p className="text-sm text-muted-foreground">
          Timer running for{' '}
          <a href={timerHref(t)} className="font-medium text-foreground underline-offset-4 hover:underline">
            {t.patientName}
          </a>
        </p>
      ) : !enrolled ? (
        <p className="text-sm text-muted-foreground">Available once enrolled</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-ehr" className="text-xs text-muted-foreground">
              EHR activity
            </Label>
            <div className="flex gap-2">
              <Select value={ehr} onValueChange={(v) => setEhr(v as ActivityKey)}>
                <SelectTrigger id="log-ehr" size="sm" className="min-w-0 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EHR.map((a) => (
                    <SelectItem key={a} value={a}>
                      {sentence(ACTIVITIES[a].label.replace('EHR ', ''))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <RoleGate allowed={nurse}>
                <Button size="sm" disabled={!nurse} onClick={() => act('startActivity', { patientId: p.id, activity: ehr })}>
                  Start
                </Button>
              </RoleGate>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-other" className="text-xs text-muted-foreground">
              Other work
            </Label>
            <div className="flex gap-2">
              <Select value={other} onValueChange={(v) => setOther(v as ActivityKey)}>
                <SelectTrigger id="log-other" size="sm" className="min-w-0 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OTHER.map((a) => (
                    <SelectItem key={a} value={a}>
                      {ACTIVITIES[a].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <RoleGate allowed={nurse}>
                <Button variant="outline" size="sm" disabled={!nurse} onClick={() => act('startActivity', { patientId: p.id, activity: other })}>
                  Start
                </Button>
              </RoleGate>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function MinutesCard({ p }: { p: PatientView }) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex min-h-5 items-center gap-2 px-4">
        <CardTitle className="flex items-center gap-1.5">
          Minutes this month
          {p.program === 'apcm' && <InfoTip>AI call time is shown in the note, never counted</InfoTip>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4">
        <span className="text-3xl font-semibold tabular-nums">{p.minutes}</span>
        <span className="text-sm text-muted-foreground">counted min · {p.countedSeconds} s</span>
        {p.meets20 && (
          <ToneBadge tone="ok" className="ml-auto self-center">
            Meets 20 min
          </ToneBadge>
        )}
      </CardContent>
      {p.time.length > 0 && (
        <CardContent className="border-t p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 pl-4 text-xs text-muted-foreground">When</TableHead>
                  <TableHead className="h-8 text-xs text-muted-foreground">Activity</TableHead>
                  <TableHead className="h-8 pr-4 text-right text-xs text-muted-foreground">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.time.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="pl-4 align-top text-muted-foreground">{fmtShort(t.started_at)}</TableCell>
                    <TableCell className="align-top whitespace-normal">
                      {ACTIVITIES[t.activity].label}
                      {t.outcome && <div className="text-xs text-muted-foreground">{t.outcome}</div>}
                    </TableCell>
                    <TableCell className="pr-4 text-right align-top tabular-nums">
                      <Duration seconds={t.seconds} />
                      {!t.counts && <div className="text-xs text-muted-foreground">not counted</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function TasksCard({ p }: { p: PatientView }) {
  const { role, act } = useStore();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const open = p.tasks.filter((t) => t.status === 'open');
  const done = p.tasks.filter((t) => t.status === 'done');
  const nurse = role === 'nurse';
  return (
    <Panel title="Tasks" action={<ToneBadge tone="neutral">{open.length} open</ToneBadge>}>
      <div className="flex flex-col gap-3">
        {open.length ? (
          <ul className="flex flex-col divide-y">
            {open.map((t) => {
              const canClose = nurse || (role === 'physician' && t.kind === 'physician');
              return (
                <li key={t.id} className="flex flex-col gap-2 py-2.5 first:pt-0">
                  <div className="flex flex-col gap-0.5">
                    <div className="text-sm">
                      <span className="font-medium">{t.title}</span> <span className="text-xs whitespace-nowrap text-muted-foreground">due {fmtShort(t.due)}</span>
                    </div>
                    {t.reason && <div className="text-xs text-muted-foreground">{t.reason}</div>}
                  </div>
                  <div className="flex gap-2">
                    {t.kind === 'call' && (
                      <RoleGate allowed={nurse}>
                        <Button
                          size="sm"
                          disabled={!nurse}
                          onClick={async () => {
                            const r = await act<{ id: number }>('startNurseCall', { patientId: p.id });
                            if (r.ok && r.result) go(`/call/${r.result.id}`);
                          }}
                        >
                          Call now
                        </Button>
                      </RoleGate>
                    )}
                    <RoleGate allowed={canClose} label={t.kind === 'physician' ? 'Nurse or physician' : 'Nurse only'}>
                      <Button variant="outline" size="sm" disabled={!canClose} onClick={() => act('closeTask', { taskId: t.id })}>
                        Close
                      </Button>
                    </RoleGate>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No open tasks.</p>
        )}
        {done.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-muted-foreground [&[data-state=open]>svg]:rotate-90">
                <ChevronRight className="transition-transform" />
                {done.length} done
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="flex flex-col gap-1.5 pt-1.5 text-sm">
                {done.map((t) => (
                  <li key={t.id} className="flex gap-2">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <span className="min-w-0">
                      {t.title} <span className="text-xs text-muted-foreground">{fmtShort(t.closed_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
        <form
          className="flex flex-wrap gap-2 border-t pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await act('addTask', { patientId: p.id, title, due });
            if (r.ok) {
              setTitle('');
              setDue('');
            }
          }}
        >
          <Input
            className="h-8 min-w-48 flex-1"
            aria-label="Task title"
            placeholder="Add a task"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!nurse}
          />
          <Input
            className="h-8 w-40 md:w-36"
            type="date"
            aria-label="Due date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            disabled={!nurse}
          />
          <RoleGate allowed={nurse}>
            <Button variant="outline" size="sm" disabled={!nurse || !title.trim()}>
              Add
            </Button>
          </RoleGate>
        </form>
      </div>
    </Panel>
  );
}

function EscalateCard({ p }: { p: PatientView }) {
  const { role, act } = useStore();
  const [note, setNote] = useState('');
  if (!['active', 'opted_out'].includes(p.status)) return null;
  const nurse = role === 'nurse';
  return (
    <Panel title="Escalate to physician">
      <div className="flex flex-col gap-2">
        <Textarea
          rows={2}
          aria-label="Note for the physician"
          placeholder="What should Dr. Patel review?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!nurse}
        />
        <RoleGate allowed={nurse} className="self-start">
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={!nurse || !note.trim()}
            onClick={async () => {
              const r = await act('escalate', { patientId: p.id, note });
              if (r.ok) setNote('');
            }}
          >
            <Send />
            Send
          </Button>
        </RoleGate>
      </div>
    </Panel>
  );
}

function ProfileView({ p }: { p: PatientView }) {
  const pr = p.profile;
  return (
    <div className="flex flex-col gap-4">
      {!pr.conditions.length ? (
        <Card>
          <EmptyState title="No chronic conditions on record" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pr.conditions.map((c) => (
            <Panel key={c.code} title={c.label}>
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{c.code}</span> {c.name}
                </p>
                {c.readings.map((r) => (
                  <div key={r.label} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">
                      {r.label} {r.target && <span className="font-normal text-muted-foreground">· target {r.target}</span>}
                    </span>
                    {r.points.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {r.points.map((pt, i) => (
                          <ToneBadge key={i} tone={pt.status === 'in_range' ? 'ok' : 'warn'} className="font-mono">
                            {pt.when}: {pt.value}
                          </ToneBadge>
                        ))}
                      </div>
                    ) : (
                      <None>No readings reported yet</None>
                    )}
                  </div>
                ))}
                {c.symptoms.length > 0 && (
                  <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                    {c.symptoms.map((sy) => (
                      <div key={sy.label} className="contents">
                        <dt className="flex items-center gap-1.5">
                          {sy.label}
                          {sy.level === 'urgent' && <FlagBadge level="urgent" />}
                        </dt>
                        <dd className="text-right text-xs">
                          {sy.history.length ? (
                            sy.history.map((h, i) => (
                              <span key={i} className={h.present ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                                {i ? ' · ' : ''}
                                {h.when} {h.present ? 'yes' : 'no'}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">not asked yet</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {!c.readings.length && !c.symptoms.length && <None>Nothing in the call setup tracks this condition</None>}
              </div>
            </Panel>
          ))}
        </div>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Running log">
          {!pr.log.length ? (
            <None>Nothing logged yet</None>
          ) : (
            <ol className="flex flex-col divide-y text-sm">
              {pr.log.map((l, i) => (
                <li key={i} className="grid grid-cols-[92px_84px_minmax(0,1fr)] gap-2 py-1.5">
                  <span className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(l.at)}</span>
                  <span>
                    <ToneBadge tone={l.kind === 'finding' || l.kind === 'flag' ? 'warn' : l.kind === 'plan' || l.kind === 'escalation' ? 'info' : 'neutral'}>{l.kind}</ToneBadge>
                  </span>
                  <span>{l.text}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="Symptom tracking log">
          {!pr.symptomLog.length ? (
            <None>No symptom answers yet</None>
          ) : (
            <Table>
              <TableBody>
                {pr.symptomLog.map((sy, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">{fmtShort(sy.at)}</TableCell>
                    <TableCell className="text-sm whitespace-normal">{sy.label}</TableCell>
                    <TableCell>{sy.present ? <ToneBadge tone="warn">yes</ToneBadge> : <span className="text-xs text-muted-foreground">no</span>}</TableCell>
                    <TableCell className="text-xs whitespace-normal text-muted-foreground">
                      {sy.detail ? `${sy.detail} · ` : ''}
                      {sy.source}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}

function CarePlanView({ p }: { p: PatientView }) {
  const plan = p.carePlan;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel title={plan ? `In effect: v${plan.version}` : 'No approved care plan'}>
        {plan ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Approved by {plan.approved_by}, NPI <span className="font-mono">{plan.approver_npi}</span>, on {fmtDateTime(plan.approved_at)}.
            </p>
            <PlanDoc c={plan.content} />
            <p className="font-mono text-[11px] break-all text-muted-foreground">Signature hash {plan.hash}</p>
          </div>
        ) : (
          <None>The physician approves the care plan after the call setup. No calls are scheduled until then.</None>
        )}
      </Panel>
      <Panel title={p.draftPlan ? `Draft v${p.draftPlan.version}, waiting for the physician` : p.returnedPlan ? `v${p.returnedPlan.version} returned` : 'No draft'}>
        {p.draftPlan ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Compiled {fmtDateTime(p.draftPlan.created_at)} from the call setup. The physician approves it on{' '}
              <a href="#/physician" className="text-foreground underline underline-offset-4">
                Care plans & escalations
              </a>
              .
            </p>
            <PlanDoc c={p.draftPlan.content} />
          </div>
        ) : p.returnedPlan ? (
          <p className="text-sm">
            The physician asked for changes: <span className="font-medium">{p.returnedPlan.return_note}</span>. Update the call setup to draft a new version.
          </p>
        ) : (
          <None>Changing the call setup drafts a new version for approval.</None>
        )}
      </Panel>
    </div>
  );
}
