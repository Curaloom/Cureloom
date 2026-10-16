import { Inbox } from 'lucide-react';
import { fmtDay, toIso } from '../../shared/time';
import { ProgramBadge, ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { InfoTip } from '@/components/app/info-tip';
import { PageHeader } from '@/components/app/page-header';
import { Countdown } from '@/components/app/time';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { go } from '../router';
import { useDemoNowMs, useStore } from '../store';

const TONE = { urgent: 'danger', concern: 'warn', unreached: 'warn', ccm_due: 'info', tasks: 'neutral', review: 'ok' } as const;

/** Edge-to-edge table inside a card: the outer columns get the card's inset. */
const EDGE = '[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4';

export function Queue() {
  const { state } = useStore();
  const nowMs = useDemoNowMs();
  const q = state.queue;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Today"
        meta={
          <>
            <span className="font-medium text-foreground">{fmtDay(toIso(nowMs))}</span>
            <span aria-hidden>·</span>
            <span>
              {q.length} patient{q.length === 1 ? '' : 's'}
            </span>
          </>
        }
      />
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          {!q.length ? (
            <EmptyState icon={<Inbox />} title="Nothing needs you right now" />
          ) : (
            <div className="overflow-x-auto">
              <Table className={EDGE}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        Why
                        <InfoTip>Ordered: urgent, concern, not reached, CCM due, tasks, review</InfoTip>
                      </span>
                    </TableHead>
                    <TableHead className="text-muted-foreground">Patient</TableHead>
                    <TableHead className="text-muted-foreground">Program</TableHead>
                    <TableHead className="text-muted-foreground">Reason</TableHead>
                    <TableHead className="text-right text-muted-foreground">Minutes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.map((r) => (
                    <TableRow
                      key={r.patientId}
                      className={cn('cursor-pointer hover:bg-muted/50', r.category === 'urgent' && 'bg-destructive/5 hover:bg-destructive/10')}
                      onClick={() => go(`/patient/${r.patientId}`)}
                    >
                      <TableCell className="align-top">
                        <ToneBadge tone={TONE[r.category]}>{r.categoryLabel}</ToneBadge>
                      </TableCell>
                      <TableCell className="align-top">
                        <a href={`#/patient/${r.patientId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                          {r.name}
                        </a>
                        <div className="font-mono text-xs text-muted-foreground">{r.mrn}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <ProgramBadge program={r.program} />
                      </TableCell>
                      <TableCell className="min-w-72 align-top whitespace-normal">
                        {r.reason}
                        {r.ackDueAt && (
                          <div className="mt-0.5 text-xs text-destructive">
                            Acknowledge within 30 min · <Countdown dueMs={Date.parse(`${r.ackDueAt}Z`)} nowMs={nowMs} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums">{r.minutes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
