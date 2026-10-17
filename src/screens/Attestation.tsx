import type { ReactElement, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { fmtDateTime } from '../../shared/time';
import { ProgramBadge, ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { PageHeader } from '@/components/app/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { money } from '@/lib/format';
import { useStore } from '../store';

export function Attestation() {
  const { state, role, act, say } = useStore();
  const month = state.clock.month;
  const byId = new Map(state.patients.map((p) => [p.id, p]));
  const urgent = state.patients.flatMap((p) => p.flags.filter((f) => f.level === 'urgent' && f.raised_at.startsWith(month)).map((f) => ({ p, f })));
  const escalations = state.patients.flatMap((p) => p.tasks.filter((t) => t.kind === 'physician' && t.status === 'open').map((t) => ({ p, t })));
  const pending = state.attestation.pending.map((id) => byId.get(id)!);
  const toBill = pending.filter((p) => p.billing.awaitingAttestation);
  const unfiled = state.monthEnd.total - state.monthEnd.filed;
  const physician = role === 'physician';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attestation"
        meta={
          <>
            <span>{state.clock.monthLabel}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              Notes filed {state.monthEnd.filed} of {state.monthEnd.total}
            </span>
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <Card className="gap-4">
          <CardHeader>
            <SectionTitle count={urgent.length}>Urgent flags this month</SectionTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!urgent.length ? (
              <EmptyState title="No urgent flags" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 text-muted-foreground">Patient</TableHead>
                      <TableHead className="text-muted-foreground">Flag</TableHead>
                      <TableHead className="pr-6 text-muted-foreground">Timeline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {urgent.map(({ p, f }) => (
                      <TableRow key={f.id}>
                        <TableCell className="pl-6 align-top">
                          <a href={`#/patient/${p.id}`} className="font-medium hover:underline">
                            {p.name}
                          </a>
                        </TableCell>
                        <TableCell className="min-w-48 align-top whitespace-normal">
                          {f.summary}
                          {f.note && <div className="mt-0.5 text-xs text-muted-foreground">Resolution: {f.note}</div>}
                        </TableCell>
                        <TableCell className="pr-6 align-top">
                          <dl className="grid grid-cols-[auto_auto] justify-start gap-x-2 gap-y-1 text-xs">
                            <dt className="text-muted-foreground">Raised</dt>
                            <dd className="tabular-nums">{fmtDateTime(f.raised_at)}</dd>
                            <dt className="text-muted-foreground">Acknowledged</dt>
                            <dd className="tabular-nums">
                              {f.acknowledged_at ? fmtDateTime(f.acknowledged_at) : <ToneBadge tone="danger">Not acknowledged</ToneBadge>}
                            </dd>
                            <dt className="text-muted-foreground">Resolved</dt>
                            <dd className="tabular-nums">{f.resolved_at ? fmtDateTime(f.resolved_at) : <ToneBadge tone="warn">Open</ToneBadge>}</dd>
                          </dl>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <SectionTitle count={escalations.length}>Escalated to you</SectionTitle>
          </CardHeader>
          <CardContent className={escalations.length ? 'px-6' : 'p-0'}>
            {!escalations.length ? (
              <EmptyState title="Nothing waiting" />
            ) : (
              <ul className="flex flex-col divide-y border-t">
                {escalations.map(({ p, t }) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div>
                        <a href={`#/patient/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </a>
                        : {t.title.replace('Physician review requested: ', '')}
                      </div>
                      {t.reason && <div className="mt-0.5 text-xs text-muted-foreground">{t.reason}</div>}
                    </div>
                    <PhysicianOnly physician={physician}>
                      <Button variant="outline" size="sm" disabled={!physician} onClick={() => act('closeTask', { taskId: t.id, note: 'Reviewed by physician' })}>
                        Reviewed
                      </Button>
                    </PhysicianOnly>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>To bill</CardTitle>
        </CardHeader>
        {unfiled > 0 && (
          <CardContent>
            <Alert className="border-amber-200 bg-amber-50 py-2.5 text-amber-900 [&>svg]:text-amber-600">
              <TriangleAlert />
              <AlertDescription className="text-amber-900">
                {unfiled} note{unfiled === 1 ? '' : 's'} not filed yet; those patients are not covered by this signature
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
        <CardContent className="p-0">
          {!pending.length ? (
            <EmptyState title="No filed notes waiting for your signature" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 text-muted-foreground">Patient</TableHead>
                    <TableHead className="text-muted-foreground">Program</TableHead>
                    <TableHead className="text-muted-foreground">Code</TableHead>
                    <TableHead className="pr-6 text-right text-muted-foreground">Amount after signing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6">
                        <a href={`#/month-end/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </a>{' '}
                        <span className="font-mono text-xs text-muted-foreground">{p.mrn}</span>
                      </TableCell>
                      <TableCell>
                        <ProgramBadge program={p.program} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.billing.awaitingAttestation ? p.billing.lines.map((l) => (l.units > 1 ? `${l.code} ×${l.units}` : l.code)).join(' + ') : '—'}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {p.billing.awaitingAttestation ? (
                          money(p.billing.lines.reduce((sum, l) => sum + l.amount, 0))
                        ) : (
                          <span className="text-xs text-muted-foreground">Held: {p.billing.reason}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {pending.length > 0 && (
          <CardContent>
            <p className="text-xs text-muted-foreground">{toBill.length} ready to bill once signed</p>
          </CardContent>
        )}
      </Card>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Attestation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <blockquote className="rounded-r-md border-l-4 border-primary bg-muted/50 p-4 text-sm leading-relaxed">{state.attestation.text}</blockquote>
          <PhysicianOnly physician={physician}>
            <Button
              disabled={!physician || !pending.length}
              onClick={async () => {
                const r = await act('signAttestation', { text: state.attestation.text });
                if (r.ok) say('Attestation signed.', 'ok');
              }}
            >
              Sign attestation
            </Button>
          </PhysicianOnly>
          {state.attestation.records.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {state.attestation.records.map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  Signed {fmtDateTime(r.signedAt)} by {r.by} for {r.patientIds.length} patient{r.patientIds.length === 1 ? '' : 's'}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SectionTitle({ count, children }: { count: number; children: ReactNode }) {
  return (
    <CardTitle className="flex items-baseline gap-2">
      {children}
      <span className="text-sm font-normal text-muted-foreground tabular-nums">{count}</span>
    </CardTitle>
  );
}

/** For other roles the button stays disabled and the tooltip names the role. */
function PhysicianOnly({ physician, children }: { physician: boolean; children: ReactElement }) {
  if (physician) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>Physician only</TooltipContent>
    </Tooltip>
  );
}
