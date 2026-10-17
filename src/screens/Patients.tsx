import { BillingBadge, ProgramBadge, StatusBadge } from '@/components/app/badges';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStore } from '../store';

/** Edge-to-edge table inside a card: the outer columns get the card's inset. */
const EDGE = '[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4';

export function Patients() {
  const { state } = useStore();
  const n = state.patients.length;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="All patients"
        meta={
          <>
            <span>{n} on the roster</span>
            <span aria-hidden>·</span>
            <span>{state.clock.monthLabel}</span>
          </>
        }
      />
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className={EDGE}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground">MRN</TableHead>
                  <TableHead className="text-muted-foreground">Patient</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Program</TableHead>
                  <TableHead className="text-muted-foreground">Contact this month</TableHead>
                  <TableHead className="text-right text-muted-foreground">Minutes</TableHead>
                  <TableHead className="text-muted-foreground">Billing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.patients.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="align-top font-mono text-xs text-muted-foreground">{p.mrn}</TableCell>
                    <TableCell className="align-top">
                      <a href={`#/patient/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </a>
                      <div className="text-xs text-muted-foreground">
                        {p.age} · {p.phone}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-48 align-top whitespace-normal">
                      <StatusBadge status={p.status} />
                      {p.ineligible_reason && <div className="mt-1 text-xs text-muted-foreground">{p.ineligible_reason}</div>}
                    </TableCell>
                    <TableCell className="align-top">
                      {p.program ? <ProgramBadge program={p.program} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="min-w-48 align-top whitespace-normal">
                      {p.status === 'active' || p.status === 'opted_out' ? p.brief.contact : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">{p.minutes}</TableCell>
                    <TableCell className="min-w-56 align-top whitespace-normal">
                      <BillingBadge b={p.billing} />
                      {p.billing.reason && <div className="mt-1 text-xs text-muted-foreground">{p.billing.reason}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
