import { useState } from 'react';
import { ClipboardCheck, ShieldAlert, ShieldCheck, Stethoscope, TriangleAlert } from 'lucide-react';
import type { CarePlanItem, EscalationItem } from '../../shared/api';
import { ACTIVITIES, CCM_MINUTES, COMPLEX_MINUTES } from '../../shared/constants';
import { fmtDateTime } from '../../shared/time';
import { FlagBadge, ProgramBadge, StatusBadge, ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { Gate } from '@/components/app/gate';
import { InfoTip } from '@/components/app/info-tip';
import { PageHeader } from '@/components/app/page-header';
import { PlanDoc } from '@/components/app/plan-doc';
import { Duration, LiveDot } from '@/components/app/time';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useServerRealMs, useStore } from '../store';

export function Physician() {
  const { state } = useStore();
  const ph = state.physician;
  const [tab, setTab] = useState(() => (ph.carePlans.length || !ph.escalations.length ? 'plans' : 'escalations'));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Care plans & escalations"
        description="Approve each patient's care plan before the program starts, and work the escalations the nurse sends you. Escalation time counts toward the patient's month."
        meta={
          ph.chain.ok ? (
            <ToneBadge tone="ok">
              <ShieldCheck />
              Signature chain verified · {ph.chain.approvals} approvals
            </ToneBadge>
          ) : (
            <ToneBadge tone="danger">
              <ShieldAlert />
              Chain broken: {ph.chain.broken.map((b) => `${b.name} v${b.version}`).join(', ')}
            </ToneBadge>
          )
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="plans" className="gap-1.5">
            Care plans
            <span className="text-xs text-muted-foreground tabular-nums">{ph.carePlans.length}</span>
          </TabsTrigger>
          <TabsTrigger value="escalations" className="gap-1.5">
            Escalations
            <span className="text-xs text-muted-foreground tabular-nums">{ph.escalations.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="flex flex-col gap-4">
          {!ph.carePlans.length ? (
            <Card>
              <EmptyState icon={<ClipboardCheck />} title="No care plans waiting" description="Plans arrive here when the nurse saves a call setup." />
            </Card>
          ) : (
            ph.carePlans.map((c) => <PlanCard key={c.plan.id} c={c} />)
          )}
        </TabsContent>
        <TabsContent value="escalations" className="flex flex-col gap-4">
          {!ph.escalations.length ? (
            <Card>
              <EmptyState icon={<Stethoscope />} title="Nothing escalated to you" />
            </Card>
          ) : (
            ph.escalations.map((e) => <EscalationCard key={e.taskId} e={e} />)
          )}
          {ph.closed.length > 0 && (
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle>Closed this month</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <ul className="flex flex-col gap-1.5 text-sm">
                  {ph.closed.map((c) => (
                    <li key={c.taskId}>
                      <span className="text-xs text-muted-foreground">{fmtDateTime(c.closedAt)}</span> ·{' '}
                      <a href={`#/patient/${c.patientId}`} className="font-medium hover:underline">
                        {c.name}
                      </a>
                      : {c.title}
                      {c.note && <span className="text-muted-foreground"> — {c.note}</span>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlanCard({ c }: { c: CarePlanItem }) {
  const { role, act, say } = useStore();
  const [note, setNote] = useState('');
  const [returning, setReturning] = useState(false);
  const physician = role === 'physician';
  const gate = physician ? null : 'Physician only';
  const initiate = c.status === 'plan_review';
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <a href={`#/patient/${c.patientId}`} className="hover:underline">
            {c.name}
          </a>
          <span className="font-mono text-sm font-normal text-muted-foreground">{c.mrn}</span>
          <StatusBadge status={c.status} />
        </CardTitle>
        <CardDescription>
          Care plan v{c.plan.version}, compiled {fmtDateTime(c.plan.created_at)} from the call setup by {c.plan.created_by}
          {c.previous ? `. v${c.previous.version} stays in effect until you approve.` : '.'}
        </CardDescription>
        <CardAction className="flex flex-wrap gap-2">
          <Gate reason={gate}>
            <Button variant="outline" size="sm" disabled={!physician} onClick={() => setReturning((v) => !v)}>
              Request changes
            </Button>
          </Gate>
          <Gate reason={gate}>
            <Button
              size="sm"
              disabled={!physician}
              onClick={async () => {
                const r = await act('approveCarePlan', { planId: c.plan.id });
                if (r.ok) say(initiate ? `${c.name}: care plan approved, program started.` : `${c.name}: care plan v${c.plan.version} approved.`, 'ok');
              }}
            >
              {initiate ? 'Approve & Initiate Care Program' : `Approve v${c.plan.version}`}
            </Button>
          </Gate>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {c.gaps.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            Check: {c.gaps.join('; ')}.
          </p>
        )}
        <PlanDoc c={c.plan.content} />
        {returning && (
          <div className="flex flex-wrap gap-2">
            <Input className="min-w-64 flex-1" placeholder="What should change?" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              variant="outline"
              disabled={!physician || !note.trim()}
              onClick={async () => {
                const r = await act('returnCarePlan', { planId: c.plan.id, note });
                if (r.ok) setReturning(false);
              }}
            >
              Send back to the nurse
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Approving records your NPI, the time and the version, with a SHA-256 signature hash chained to this patient's previous approval, so any later change is
          detectable.
        </p>
      </CardContent>
    </Card>
  );
}

function EscalationCard({ e }: { e: EscalationItem }) {
  const { state, role, act } = useStore();
  const real = useServerRealMs();
  const t = state.physicianTimer;
  const mine = t && t.taskId === e.taskId;
  const physician = role === 'physician';
  const [outcome, setOutcome] = useState('');
  const [directive, setDirective] = useState('');
  const [complex, setComplex] = useState(e.complexity === 'complex');
  const secs = mine ? ((real - t!.startedRealMs) / 1000) * t!.speed : 0;
  const projected = e.minutes + Math.floor(secs / 60);
  return (
    <Card className={mine ? 'gap-4 border-red-200 dark:border-red-900' : 'gap-4'}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <a href={`#/patient/${e.patientId}`} className="hover:underline">
            {e.name}
          </a>
          <span className="font-mono text-sm font-normal text-muted-foreground">{e.mrn}</span>
          <ProgramBadge program={e.program} />
        </CardTitle>
        <CardDescription>
          {e.request}
          <span className="block text-xs">
            {e.from} · {fmtDateTime(e.createdAt)} · {e.minutes} counted min this month · billing: {e.billing}
          </span>
        </CardDescription>
        <CardAction>
          {mine ? (
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
              <LiveDot />
              <Duration seconds={secs} />
            </span>
          ) : (
            <Gate reason={!physician ? 'Physician only' : t ? 'Close the open escalation first' : null}>
              <Button size="sm" disabled={!physician || !!t} onClick={() => act('openEscalation', { taskId: e.taskId })}>
                Open escalation
              </Button>
            </Gate>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(e.flags.length > 0 || e.readings.length > 0) && (
          <ul className="flex flex-col gap-1.5 text-sm">
            {e.flags.map((f, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <FlagBadge level={f.level} /> {f.summary} <span className="text-xs text-muted-foreground">({f.state})</span>
              </li>
            ))}
            {e.readings.map((r) => (
              <li key={r.label} className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-mono">{r.value}</span>
                <span className="text-xs text-muted-foreground">target {r.target}</span>
                {r.status !== 'in_range' && <ToneBadge tone="warn">{r.status === 'above' ? 'above target' : 'below target'}</ToneBadge>}
              </li>
            ))}
          </ul>
        )}
        {mine && (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <Textarea rows={2} placeholder="Directive or order update for the nurse (optional)" value={directive} onChange={(ev) => setDirective(ev.target.value)} />
            {e.program === 'ccm' && (
              <label htmlFor={`complex-${e.taskId}`} className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox id={`complex-${e.taskId}`} className="mt-0.5" checked={complex} onCheckedChange={(v) => setComplex(v === true)} />
                <span>
                  Moderate or high complexity medical decision making this month
                  <InfoTip>
                    Complex CCM bills 99487 at {COMPLEX_MINUTES} counted minutes, then 99489 per further 30. Without the mark, the month stays 99490 + 99439.
                  </InfoTip>
                  {complex && (
                    <span className="block text-xs text-muted-foreground">
                      With this review the month is at about {projected} counted minutes.{' '}
                      {projected >= COMPLEX_MINUTES ? 'Complex CCM applies.' : projected >= CCM_MINUTES ? 'Below 60, the month stays standard CCM.' : ''}
                    </span>
                  )}
                </span>
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <NativeSelect size="sm" value={outcome} onChange={(ev) => setOutcome(ev.target.value)} aria-label="Outcome">
                <NativeSelectOption value="">Outcome…</NativeSelectOption>
                {ACTIVITIES.practitioner_review.outcomes.map((o) => (
                  <NativeSelectOption key={o} value={o}>
                    {o}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button
                size="sm"
                disabled={!physician || !outcome}
                onClick={() =>
                  act('closeEscalation', {
                    taskId: e.taskId,
                    outcome,
                    directive,
                    // Only send the mark when the physician changed it.
                    complexity: e.program === 'ccm' && complex !== (e.complexity === 'complex') ? (complex ? 'complex' : 'standard') : undefined,
                  })
                }
              >
                Close and log time
              </Button>
              <Button size="sm" variant="ghost" disabled={!physician} onClick={() => act('discardPhysicianTimer')}>
                Discard timer
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
