import { TriangleAlert } from 'lucide-react';
import type { RunView } from '../../shared/api';
import { fmtDateTime } from '../../shared/time';
import { FlagBadge, ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * The calls from one "Run October AI calls". No card: it sits inside a dialog or a card.
 * In a narrow container (the Simulator card) the time and flag fold into the patient and outcome cells.
 */
export function RunSummary({ run }: { run: RunView }) {
  const head = 'text-muted-foreground';
  const wide = 'hidden @2xl:table-cell';
  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex flex-col items-start gap-2">
        <ToneBadge tone="neutral">
          {run.items.length} call{run.items.length === 1 ? '' : 's'}
        </ToneBadge>
        {run.notes.map((n) => (
          <div key={n} className="flex w-full items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>{n}</span>
          </div>
        ))}
      </div>
      {run.items.length ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={`${wide} ${head}`}>When</TableHead>
                <TableHead className={head}>Patient</TableHead>
                <TableHead className={head}>Outcome</TableHead>
                <TableHead className={`${wide} ${head}`}>Flag</TableHead>
                <TableHead className={head}>What happened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.items.map((i, k) => (
                <TableRow key={k}>
                  <TableCell className={`${wide} align-top whitespace-nowrap tabular-nums`}>{fmtDateTime(i.at)}</TableCell>
                  <TableCell className="align-top">
                    <a href={`#/patient/${i.patientId}`} className="font-medium hover:underline">
                      {i.name}
                    </a>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{i.mrn}</span>
                      <span className="tabular-nums @2xl:hidden"> · {fmtDateTime(i.at)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-28 align-top whitespace-normal">
                    {i.outcome}
                    {(i.flag === 'urgent' || i.flag === 'concern') && (
                      <div className="mt-1 @2xl:hidden">
                        <FlagBadge level={i.flag} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className={`${wide} align-top`}>
                    {i.flag === 'urgent' || i.flag === 'concern' ? <FlagBadge level={i.flag} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="min-w-56 align-top whitespace-normal">
                    {i.detail}
                    {i.firstLine && <div className="mt-0.5 text-xs text-muted-foreground italic">AI: “{i.firstLine}”</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No calls were placed" />
      )}
    </div>
  );
}
