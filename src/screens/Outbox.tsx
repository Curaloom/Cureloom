import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import type { EventRow } from '../../shared/model';
import { fmtDateTime } from '../../shared/time';
import { ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { InfoTip } from '@/components/app/info-tip';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStore } from '../store';

export function Outbox() {
  const { state } = useStore();
  const [rows, setRows] = useState<EventRow[]>([]);
  useEffect(() => {
    fetch('/api/events?prefix=outbox.')
      .then((r) => r.json())
      .then((r: EventRow[]) => setRows(r.reverse()))
      .catch(() => setRows([]));
  }, [state.counts.outbox]);
  const names = new Map(state.patients.map((p) => [p.id, p.name]));
  const head = 'text-muted-foreground';
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Outbox"
        meta={
          <>
            <span className="tabular-nums">
              {rows.length} message{rows.length === 1 ? '' : 's'}
            </span>
            <InfoTip>Nothing is actually sent</InfoTip>
          </>
        }
      />
      <Card className="py-0">
        <CardContent className="p-0">
          {!rows.length ? (
            <EmptyState icon={<Send />} title="Nothing yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={`pl-4 ${head}`}>Time</TableHead>
                    <TableHead className={head}>Kind</TableHead>
                    <TableHead className={head}>Patient</TableHead>
                    <TableHead className={`pr-4 ${head}`}>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-4 align-top whitespace-nowrap tabular-nums">{fmtDateTime(e.at)}</TableCell>
                      <TableCell className="align-top">
                        {e.type === 'outbox.text' ? <ToneBadge tone="info">Text</ToneBadge> : <ToneBadge tone="warn">Alert</ToneBadge>}
                      </TableCell>
                      <TableCell className="align-top">
                        {e.patient_id != null ? (
                          <a href={`#/patient/${e.patient_id}`} className="font-medium hover:underline">
                            {names.get(e.patient_id)}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-80 pr-4 align-top whitespace-normal">{e.detail}</TableCell>
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
