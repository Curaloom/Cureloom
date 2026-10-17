import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import type { EventRow } from '../../shared/model';
import { fmtDateTime } from '../../shared/time';
import { EmptyState } from '@/components/app/empty-state';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { go } from '../router';
import { useStore } from '../store';

export function Events({ patientId }: { patientId: number | null }) {
  const { state } = useStore();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [type, setType] = useState('');
  const count = state.counts.events;

  useEffect(() => {
    const q = patientId != null ? `?patientId=${patientId}` : '';
    fetch(`/api/events${q}`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, [patientId, count]);

  const byId = new Map(state.patients.map((p) => [p.id, p]));
  const filtered = patientId != null ? byId.get(patientId) : undefined;
  const types = [...new Set(rows.map((r) => r.type.split('.')[0]))].sort();
  const shown = rows.filter((r) => !type || r.type.startsWith(type));
  const head = 'text-muted-foreground';
  const countLabel = `${shown.length} event${shown.length === 1 ? '' : 's'}`;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Audit trail"
        meta={
          filtered ? (
            <>
              <span className="font-medium text-foreground">{filtered.name}</span>
              <span className="font-mono text-xs">{filtered.mrn}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{countLabel}</span>
            </>
          ) : (
            <span className="tabular-nums">{countLabel}</span>
          )
        }
      />
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-end gap-2 border-b px-4 py-3">
          <NativeSelect
            size="sm"
            aria-label="Patient"
            value={patientId ?? ''}
            onChange={(e) => go(e.target.value ? `/events?patient=${e.target.value}` : '/events')}
          >
            <NativeSelectOption value="">All patients and demo actions</NativeSelectOption>
            {state.patients.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name} ({p.mrn})
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect size="sm" aria-label="Event type" value={type} onChange={(e) => setType(e.target.value)}>
            <NativeSelectOption value="">All types</NativeSelectOption>
            {types.map((t) => (
              <NativeSelectOption key={t}>{t}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <CardContent className="p-0">
          {!shown.length ? (
            <EmptyState icon={<History />} title="No events" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={`pl-4 text-right ${head}`}>#</TableHead>
                    <TableHead className={head}>Time</TableHead>
                    <TableHead className={head}>Actor</TableHead>
                    {patientId == null && <TableHead className={head}>Patient</TableHead>}
                    <TableHead className={head}>Type</TableHead>
                    <TableHead className={`pr-4 ${head}`}>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((e) => {
                    const p = e.patient_id != null ? byId.get(e.patient_id) : undefined;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="pl-4 text-right align-top text-xs leading-5 text-muted-foreground tabular-nums">{e.id}</TableCell>
                        <TableCell className="align-top whitespace-nowrap tabular-nums">{fmtDateTime(e.at)}</TableCell>
                        <TableCell className="align-top">{e.actor}</TableCell>
                        {patientId == null && (
                          <TableCell className="align-top">
                            {e.patient_id != null ? (
                              <a href={`#/events?patient=${e.patient_id}`} className="font-medium hover:underline">
                                {p?.name}
                                {p && <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">{p.mrn}</span>}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="align-top font-mono text-xs leading-5">{e.type}</TableCell>
                        <TableCell className="min-w-80 pr-4 align-top whitespace-normal">{e.detail}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
