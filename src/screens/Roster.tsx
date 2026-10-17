import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileDown, FileSpreadsheet, Inbox, Upload } from 'lucide-react';
import type { OpportunityBucket, OpportunityRow } from '../../shared/api';
import { FIELDS, type FieldKey } from '../../shared/mapper';
import { fmtDate, fmtDateTime } from '../../shared/time';
import type { Program } from '../../shared/types';
import { ConfidenceBadge, StatusBadge, ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { Gate } from '@/components/app/gate';
import { PageHeader } from '@/components/app/page-header';
import { StatCard, StatGrid } from '@/components/app/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useStore } from '../store';

/** Edge-to-edge table inside a card: the outer columns get the card's inset. */
const EDGE = '[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4';

const BUCKETS: { key: OpportunityBucket | 'all'; label: string }[] = [
  { key: 'review', label: 'To review' },
  { key: 'held', label: 'Held' },
  { key: 'approved', label: 'Approved' },
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'not_eligible', label: 'Not eligible' },
  { key: 'all', label: 'All' },
];

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function Roster() {
  const { state, role, act, say } = useStore();
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const canUpload = role === 'manager';
  const gate = canUpload ? null : 'Practice manager only';
  const ops = state.ops;
  const e = ops.emrr;

  async function upload(file: File) {
    const xlsx = /\.xlsx$/i.test(file.name);
    if (!xlsx && !/\.(csv|txt)$/i.test(file.name)) {
      say('Upload a .csv or .xlsx file.');
      return;
    }
    const body = xlsx ? { filename: file.name, xlsxBase64: toBase64(await file.arrayBuffer()) } : { filename: file.name, csv: await file.text() };
    const r = await act('previewRoster', body);
    if (r.ok) say(`${file.name} read. Check the column mapping.`, 'ok');
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Roster & opportunity"
        description="Upload the EHR export. Cureloom maps the columns, reads the payer and ICD-10 codes, and proposes a program for each patient."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown />
                Sample files
                <ChevronDown className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {['october-roster.csv', 'october-roster.xlsx', 'roster-with-errors.csv'].map((f) => (
                <DropdownMenuItem key={f} asChild>
                  <a href={`/api/seed/${f}`} download>
                    <FileSpreadsheet />
                    {f}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <StatGrid>
        <StatCard primary label="eMRR, approved and enrolled" value={money(e.approved)} sub={`${e.approvedCount} patients · per month at your fee schedule`} />
        <StatCard label="Pending opportunity" value={money(e.pending)} sub={`${e.pendingCount} to review or held`} />
        <StatCard label="Rejected · not eligible" value={`${e.rejectedCount} · ${e.notEligibleCount}`} sub="patients" />
        <StatCard label="ICD-10 chronic matrix" value={ops.icd.groups} sub={`condition groups, ${ops.icd.prefixes} code prefixes loaded`} />
      </StatGrid>

      {ops.preview ? (
        <MappingCard />
      ) : (
        <Card className="py-4">
          <CardContent className="px-4">
            <div
              className={cn(
                'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                drag && canUpload ? 'border-primary bg-primary/5' : 'border-border',
              )}
              onDragOver={(ev) => {
                ev.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(ev) => {
                ev.preventDefault();
                setDrag(false);
                const f = ev.dataTransfer.files[0];
                if (f && canUpload) upload(f);
              }}
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Upload className="size-5" />
              </div>
              <p className="text-sm font-medium">Drop the EHR export here: CSV or Excel (.xlsx)</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Gate reason={gate}>
                  <Button variant="outline" disabled={!canUpload} onClick={() => input.current?.click()}>
                    Choose file
                  </Button>
                </Gate>
                <Gate reason={gate}>
                  <Button disabled={!canUpload} onClick={() => act('previewSeedRoster')}>
                    Use the October roster
                  </Button>
                </Gate>
              </div>
              <p className="text-xs text-muted-foreground">Nothing connects to the EHR. Every phone number must be a fictional 555-01XX number.</p>
              <input
                ref={input}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) upload(f);
                  ev.target.value = '';
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Matrix />
      <LastImport />
    </div>
  );
}

function MappingCard() {
  const { state, role, act, say } = useStore();
  const p = state.ops.preview!;
  const initial = useMemo(() => Object.fromEntries(FIELDS.map((f) => [f.key, p.mapping[f.key].column])) as Record<FieldKey, number | null>, [p]);
  const [cols, setCols] = useState(initial);
  useEffect(() => setCols(initial), [initial]);
  const used = Object.values(cols).filter((c) => c != null);
  const dupes = used.length !== new Set(used).size;
  const missing = FIELDS.filter((f) => f.required && cols[f.key] == null);
  const manager = role === 'manager';
  const blocked = !manager ? 'Practice manager only' : dupes ? 'Two fields point at the same column' : missing.length ? `Map ${missing.map((f) => f.label).join(', ')}` : null;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          Column mapping
          <span className="truncate font-mono text-sm font-normal text-muted-foreground">{p.filename}</span>
        </CardTitle>
        <CardDescription>
          {p.savedLayout
            ? 'This layout was confirmed before, so the saved mapping is used.'
            : 'Proposed by matching each header against known names and spellings. Check the sample values, fix anything wrong, then import.'}{' '}
          Required fields are marked *.
        </CardDescription>
        <CardAction className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!manager} onClick={() => act('cancelRosterPreview')}>
            Discard
          </Button>
          <Gate reason={blocked}>
            <Button
              size="sm"
              disabled={!!blocked}
              onClick={async () => {
                const r = await act('importRoster', { mapping: cols });
                if (r.ok) say(`${p.filename} imported.`, 'ok');
              }}
            >
              Import {p.rowCount} rows
            </Button>
          </Gate>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FIELDS.map((f) => {
            const c = cols[f.key];
            const m = p.mapping[f.key];
            const sample = c == null ? '' : p.sample.map((r) => r[c]).filter(Boolean).slice(0, 2).join(' · ');
            const miss = f.required && c == null;
            return (
              <div key={f.key} className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={`map-${f.key}`} className="flex items-center gap-1.5 text-xs font-medium">
                  {f.label}
                  {f.required && <span className="text-destructive">*</span>}
                  {c != null && c === m.column && m.source === 'auto' && <ToneBadge tone={m.score >= 0.95 ? 'ok' : 'warn'}>{Math.round(m.score * 100)}%</ToneBadge>}
                  {c != null && c === m.column && m.source === 'saved' && <ToneBadge tone="neutral">saved</ToneBadge>}
                </label>
                <NativeSelect
                  id={`map-${f.key}`}
                  size="sm"
                  className="w-full"
                  aria-invalid={miss || undefined}
                  value={c ?? ''}
                  onChange={(ev) => setCols({ ...cols, [f.key]: ev.target.value === '' ? null : Number(ev.target.value) })}
                >
                  <NativeSelectOption value="">— not in this file —</NativeSelectOption>
                  {p.headers.map((h, i) => (
                    <NativeSelectOption key={i} value={i}>
                      {h}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <span className="truncate text-xs text-muted-foreground">{sample || ' '}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Matrix() {
  const { state, role, act, say } = useStore();
  const rows = state.ops.matrix;
  const count = (k: OpportunityBucket | 'all') => (k === 'all' ? rows.length : rows.filter((r) => r.bucket === k).length);
  const [bucket, setBucket] = useState<OpportunityBucket | 'all'>(() => (rows.some((r) => r.bucket === 'review') ? 'review' : 'all'));
  const list = rows.filter((r) => bucket === 'all' || r.bucket === bucket).sort((a, b) => Number(b.inLastUpload) - Number(a.inLastUpload) || a.mrn.localeCompare(b.mrn));
  const manager = role === 'manager';
  const ready80 = rows.filter((r) => r.bucket === 'review' && r.confidence >= 80).length;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-4 py-4 [.border-b]:pb-4">
        <CardTitle>Opportunity matrix</CardTitle>
        <CardDescription>Determined program, confidence and projected revenue per patient. Approve to start enrollment.</CardDescription>
        <CardAction>
          <Gate reason={!manager ? 'Practice manager only' : !ready80 ? 'No rows at 80 or more awaiting review' : null}>
            <Button
              variant="outline"
              size="sm"
              disabled={!manager || !ready80}
              onClick={async () => {
                const r = await act<number>('opsApproveAll', { minConfidence: 80 });
                if (r.ok) say(`${r.result} approved.`, 'ok');
              }}
            >
              Approve all ≥ 80 ({ready80})
            </Button>
          </Gate>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto border-b px-4 py-2">
          <Tabs value={bucket} onValueChange={(v) => setBucket(v as OpportunityBucket | 'all')}>
            <TabsList>
              {BUCKETS.map((b) => (
                <TabsTrigger key={b.key} value={b.key} className="gap-1.5">
                  {b.label}
                  <span className="text-xs text-muted-foreground tabular-nums">{count(b.key)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {!list.length ? (
          <EmptyState icon={<Inbox />} title="Nobody here" />
        ) : (
          <div className="overflow-x-auto">
            <Table className={EDGE}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Patient</TableHead>
                  <TableHead className="text-muted-foreground">Payer</TableHead>
                  <TableHead className="text-muted-foreground">Chronic conditions</TableHead>
                  <TableHead className="text-muted-foreground">Determined program</TableHead>
                  <TableHead className="text-right text-muted-foreground">Confidence</TableHead>
                  <TableHead className="text-right text-muted-foreground">$/month</TableHead>
                  <TableHead className="text-muted-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <MatrixRow key={r.patientId} r={r} manager={manager} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatrixRow({ r, manager }: { r: OpportunityRow; manager: boolean }) {
  const { act } = useStore();
  const [program, setProgram] = useState<Program | null>(r.program);
  const allowed = r.options.filter((o) => !o.block);
  const chosen = r.options.find((o) => o.program === program);
  const pending = r.bucket === 'review' || r.bucket === 'held';
  const decide = (decision: string) => act('opsDecide', { patientId: r.patientId, decision, program: decision === 'approved' ? program : null });
  const gate = manager ? null : 'Practice manager only';
  return (
    <TableRow>
      <TableCell className="align-top">
        <a href={`#/patient/${r.patientId}`} className="font-medium hover:underline">
          {r.name}
        </a>
        <div className="text-xs text-muted-foreground">
          <span className="font-mono">{r.mrn}</span> · {fmtDate(r.dob)} ({r.age}) · {r.sex}
        </div>
      </TableCell>
      <TableCell className="max-w-56 align-top whitespace-normal">
        <div className="text-sm">{r.insuranceName}</div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {r.payerLabel}
          {r.isQmb && !/QMB/.test(r.payerLabel) && <ToneBadge tone="info">QMB</ToneBadge>}
        </div>
      </TableCell>
      <TableCell className="align-top whitespace-normal">
        <span className="mr-1 font-semibold tabular-nums">{r.conditions}</span>
        <span className="font-mono text-xs">
          {r.codes.map((c, i) => (
            <Tooltip key={c.code}>
              <TooltipTrigger asChild>
                <span tabIndex={0} className={cn('cursor-help outline-none', !c.chronic && 'text-muted-foreground line-through decoration-muted-foreground/40')}>
                  {i ? ', ' : ''}
                  {c.code}
                </span>
              </TooltipTrigger>
              <TooltipContent>{c.chronic ? c.name : 'Not a chronic condition in the matrix'}</TooltipContent>
            </Tooltip>
          ))}
        </span>
      </TableCell>
      <TableCell className="align-top">
        {pending && allowed.length > 1 && manager ? (
          <NativeSelect size="sm" value={program ?? ''} onChange={(e) => setProgram(e.target.value as Program)} aria-label="Program">
            {allowed.map((o) => (
              <NativeSelectOption key={o.program} value={o.program}>
                {o.tier} · {o.code}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : r.code ? (
          <span className="text-sm">
            <span className="font-medium">{r.tier}</span> <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {r.reason && <div className="mt-0.5 max-w-64 text-xs whitespace-normal text-muted-foreground">{r.reason}</div>}
      </TableCell>
      <TableCell className="text-right align-top">
        <ConfidenceBadge value={r.confidence} reasons={r.reasons} />
      </TableCell>
      <TableCell className="text-right align-top tabular-nums">{money(pending && chosen ? chosen.fee : r.code ? r.monthly : null)}</TableCell>
      <TableCell className="align-top">
        {pending ? (
          <div className="flex gap-1.5">
            <Gate reason={gate}>
              <Button size="xs" disabled={!manager} onClick={() => decide('approved')}>
                Approve
              </Button>
            </Gate>
            {r.bucket !== 'held' && (
              <Button size="xs" variant="outline" disabled={!manager} onClick={() => decide('held')}>
                Hold
              </Button>
            )}
            <Button size="xs" variant="outline" disabled={!manager} onClick={() => decide('rejected')}>
              Reject
            </Button>
          </div>
        ) : r.bucket === 'rejected' ? (
          <Button size="xs" variant="outline" disabled={!manager} onClick={() => decide('reopen')}>
            Reopen
          </Button>
        ) : (
          <div className="flex flex-col items-start gap-0.5">
            <StatusBadge status={r.status} />
            {r.decidedAt && <span className="text-xs text-muted-foreground">decided {fmtDateTime(r.decidedAt)}</span>}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function LastImport() {
  const { state } = useStore();
  const up = state.roster;
  if (!up) return null;
  const rejected = up.rows.filter((r) => !r.accepted);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-4 py-4 [.border-b]:pb-4">
        <CardTitle className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          Last import
          <span className="truncate font-mono text-sm font-normal text-muted-foreground">{up.filename}</span>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span>
            {fmtDateTime(up.at)} · {up.by}
          </span>
          <ToneBadge tone="ok">{up.accepted} accepted</ToneBadge>
          {up.rejected > 0 && <ToneBadge tone="danger">{up.rejected} rejected</ToneBadge>}
        </CardDescription>
        {rejected.length > 0 && (
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/roster-errors.csv">
                <Download />
                <span className="sr-only sm:not-sr-only">Download error list</span>
              </a>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {rejected.length > 0 && (
          <div className="overflow-x-auto">
            <Table className={EDGE}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-right text-muted-foreground">Row</TableHead>
                  <TableHead className="text-muted-foreground">Patient ID</TableHead>
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Why it was rejected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejected.map((r) => (
                  <TableRow key={r.row}>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{r.row}</TableCell>
                    <TableCell className="font-mono text-xs">{r.mrn || '—'}</TableCell>
                    <TableCell className="font-medium">{r.name || '—'}</TableCell>
                    <TableCell className="min-w-64 whitespace-normal text-destructive">{r.errors.join('; ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="m-2 text-muted-foreground">
              <ChevronDown />
              What happened to each accepted row
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="flex flex-col gap-1 px-4 pb-4 text-sm">
              {up.rows
                .filter((r) => r.accepted)
                .map((r) => (
                  <li key={r.row}>
                    <span className="font-mono text-xs">{r.mrn}</span> {r.name}: <span className="text-muted-foreground">{r.outcome}</span>
                  </li>
                ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
