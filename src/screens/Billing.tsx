import { Download } from 'lucide-react';
import type { BillingState } from '../../shared/api';
import { CODE_LABEL, FEES, type BillingCode } from '../../shared/constants';
import { BillingBadge, ProgramBadge, ToneBadge, type Tone } from '@/components/app/badges';
import { InfoTip } from '@/components/app/info-tip';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { money } from '@/lib/format';
import { useStore } from '../store';

const GROUP_BADGE: Record<BillingState, { tone: Tone; label: string }> = {
  ready: { tone: 'ok', label: 'Ready' },
  held: { tone: 'warn', label: 'Held' },
  not_enrolled: { tone: 'neutral', label: 'Not enrolled' },
};

interface Group {
  label: string;
  status: BillingState;
  detail: string;
  order: number;
  mrns: string[];
  amount: number;
}

export function Billing() {
  const { state } = useStore();
  const rows = state.billing.rows;
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const b = r.billing;
    const detail =
      b.status === 'ready' ? `${b.code} (${money(FEES[b.code as BillingCode])})` : b.status === 'held' ? (b.reason ?? '').replace(/ \(\d+\)$/, '') : '';
    const label = b.status === 'ready' ? `Ready, ${detail}` : b.status === 'held' ? `Held: ${detail}` : 'Not enrolled';
    const order = b.status === 'ready' ? 0 : b.status === 'held' ? 1 : 2;
    const g = groups.get(label) ?? { label, status: b.status, detail, order, mrns: [], amount: 0 };
    g.mrns.push(r.mrn);
    g.amount += b.amount ?? 0;
    groups.set(label, g);
  }
  const summary = [...groups.values()].sort((a, b) => a.order - b.order || b.amount - a.amount || a.label.localeCompare(b.label));
  const head = 'text-muted-foreground';
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Billing"
        meta={<span>{state.clock.monthLabel}</span>}
        actions={
          <Button asChild>
            <a href="/api/billing.csv">
              <Download />
              Download CSV
            </a>
          </Button>
        }
      />
      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Summary
            <InfoTip>Ready = program rule met, note filed, attestation signed</InfoTip>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={`pl-6 ${head}`}>Status</TableHead>
                  <TableHead className={head}>Patients</TableHead>
                  <TableHead className={`pr-6 text-right ${head}`}>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((g) => (
                  <TableRow key={g.label}>
                    <TableCell className="pl-6 whitespace-normal">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <ToneBadge tone={GROUP_BADGE[g.status].tone}>{GROUP_BADGE[g.status].label}</ToneBadge>
                        {g.detail && <span>{g.detail}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-normal">{g.mrns.join(', ')}</TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      {g.order === 0 ? money(Math.round(g.amount * 100) / 100) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold hover:bg-transparent">
                  <TableCell className="pl-6">Total ready</TableCell>
                  <TableCell className="tabular-nums">
                    {state.billing.readyCount} patient{state.billing.readyCount === 1 ? '' : 's'}
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">{money(state.billing.readyTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="flex items-baseline gap-2">
            Every patient
            <span className="text-sm font-normal text-muted-foreground tabular-nums">{rows.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={`pl-6 ${head}`}>MRN</TableHead>
                  <TableHead className={head}>Patient</TableHead>
                  <TableHead className={head}>Program</TableHead>
                  <TableHead className={head}>Code</TableHead>
                  <TableHead className={`text-right ${head}`}>Amount</TableHead>
                  <TableHead className={head}>Status</TableHead>
                  <TableHead className={head}>Reason</TableHead>
                  <TableHead className={`pr-6 text-right ${head}`}>Counted min</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.patientId}>
                    <TableCell className="pl-6 font-mono text-xs">{r.mrn}</TableCell>
                    <TableCell>
                      <a href={`#/patient/${r.patientId}`} className="font-medium hover:underline">
                        {r.name}
                      </a>
                    </TableCell>
                    <TableCell>{r.program ? <ProgramBadge program={r.program} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.billing.code ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0} className="cursor-help rounded-sm underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                              {r.billing.code}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{CODE_LABEL[r.billing.code]}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.billing.amount == null ? <span className="text-muted-foreground">—</span> : money(r.billing.amount)}
                    </TableCell>
                    <TableCell>
                      <BillingBadge b={r.billing} />
                    </TableCell>
                    <TableCell className="min-w-40 text-xs whitespace-normal text-muted-foreground">{r.billing.reason ?? ''}</TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">{r.billing.minutes}</TableCell>
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
