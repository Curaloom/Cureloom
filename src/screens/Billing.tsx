import { useState } from 'react';
import { Download, FileSpreadsheet, FileWarning, Inbox, TriangleAlert } from 'lucide-react';
import type { PatientView, ReconciliationView } from '../../shared/api';
import { BILLING_CODES, CODE_LABEL, PLACEHOLDER_FEES, type BillingSettings } from '../../shared/constants';
import type { ClaimLine } from '../../shared/model';
import { npiValid } from '../../shared/npi';
import { tierLabel } from '../../shared/program';
import { fmtDay, fmtDuration, fmtShort } from '../../shared/time';
import type { Program } from '../../shared/types';
import { BillingBadge, ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { Gate } from '@/components/app/gate';
import { InfoTip } from '@/components/app/info-tip';
import { PageHeader } from '@/components/app/page-header';
import { StatCard, StatGrid } from '@/components/app/stat-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useStore } from '../store';

/** Edge-to-edge table inside a card: the outer columns get the card's inset. */
const EDGE = '[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4';
const HEAD = 'text-muted-foreground';

function linesText(lines: ClaimLine[]): string {
  return lines.map((l) => (l.units > 1 ? `${l.code} ×${l.units}` : l.code)).join(' + ');
}

export function Billing() {
  const { state } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const patients = state.patients;
  const ledger = patients.filter((p) => p.billing.lines.length > 0);
  const held = patients.filter((p) => p.billing.status === 'held' && !p.billing.lines.length);
  const notEnrolled = patients.filter((p) => p.billing.status === 'not_enrolled');
  const pf = state.preflight;
  const selected = patients.find((p) => p.id === open);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Billing reconciliation"
        meta={<span>{state.clock.monthLabel}</span>}
        description="A month is ready once the program rule is met, the care plan is approved, the note is filed and the physician has attested."
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href="/api/billing.csv">
              <Download />
              Billing list CSV
            </a>
          </Button>
        }
      />

      <StatGrid>
        <StatCard primary label="Ready to bill" value={money(state.billing.readyTotal)} sub={`${state.billing.readyCount} patients`} />
        <StatCard label="Milestone met, paperwork left" value={ledger.filter((p) => p.billing.status === 'held').length} sub="note to file or attestation to sign" />
        <StatCard label="Held" value={held.length} sub="program rule not met yet" />
        <StatCard
          label="CMS-1500 file"
          value={pf.open ? `${pf.lines} lines` : 'Closed'}
          sub={pf.open ? `${pf.clean} claims clean · ${pf.excluded} excluded` : `opens ${fmtDay(pf.dos)}, the date of service`}
        />
      </StatGrid>

      <Dispatcher />

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-4 py-4 [.border-b]:pb-4">
          <CardTitle className="flex items-baseline gap-2">
            Ledger queue
            <span className="text-sm font-normal text-muted-foreground tabular-nums">{ledger.length}</span>
          </CardTitle>
          <CardDescription>Patients who met the program rule this month. Click a row for the micro-ledger.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!ledger.length ? (
            <EmptyState icon={<Inbox />} title="No patient has met the program rule yet this month" />
          ) : (
            <div className="overflow-x-auto">
              <Table className={EDGE}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={HEAD}>Patient</TableHead>
                    <TableHead className={HEAD}>Program</TableHead>
                    <TableHead className={HEAD}>Claim lines</TableHead>
                    <TableHead className={`text-right ${HEAD}`}>Counted min</TableHead>
                    <TableHead className={`text-right ${HEAD}`}>Amount</TableHead>
                    <TableHead className={HEAD}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => setOpen(p.id)}>
                      <TableCell>
                        <span className="font-medium">{p.name}</span>
                        <div className="font-mono text-xs text-muted-foreground">{p.mrn}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{tierLabel(p.billing.code)}</span>
                        {p.billing.complexity === 'complex' && (
                          <ToneBadge tone="info" className="ml-1.5">
                            complexity marked
                          </ToneBadge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{linesText(p.billing.lines)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.billing.minutes}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(p.billing.lines.reduce((s, l) => s + l.amount, 0))}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-0.5">
                          <BillingBadge b={p.billing} />
                          {p.billing.reason && <span className="text-xs text-muted-foreground">{p.billing.reason}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-4 py-4 [.border-b]:pb-4">
          <CardTitle className="flex items-baseline gap-2">
            Held and not enrolled
            <span className="text-sm font-normal text-muted-foreground tabular-nums">{held.length + notEnrolled.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className={EDGE}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={HEAD}>Patient</TableHead>
                  <TableHead className={HEAD}>Program</TableHead>
                  <TableHead className={HEAD}>Status</TableHead>
                  <TableHead className={HEAD}>Reason</TableHead>
                  <TableHead className={`text-right ${HEAD}`}>Counted min</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...held, ...notEnrolled].map((p) => (
                  <TableRow key={p.id} className={cn(p.reconciliation && 'cursor-pointer')} onClick={() => p.reconciliation && setOpen(p.id)}>
                    <TableCell>
                      <span className="font-medium">{p.name}</span> <span className="font-mono text-xs text-muted-foreground">{p.mrn}</span>
                    </TableCell>
                    <TableCell className="text-sm">{p.program?.toUpperCase() ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <BillingBadge b={p.billing} />
                    </TableCell>
                    <TableCell className="min-w-48 text-xs whitespace-normal text-muted-foreground">{p.billing.reason}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.billing.minutes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SettingsCard />

      {selected?.reconciliation && <ReconciliationDialog p={selected} r={selected.reconciliation} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Dispatcher() {
  const { state } = useStore();
  const pf = state.preflight;
  const closed = !pf.open ? `Opens ${fmtDay(pf.dos)}, the date of service` : !pf.clean ? 'No clean claims yet' : null;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-4 py-4 [.border-b]:pb-4">
        <CardTitle className="flex items-center gap-1.5">
          Billing dispatcher
          <InfoTip>
            18 CMS-1500 (02/12) columns, one row per claim line. Date of service is the last day of the month. A claim with any failing line is left out
            whole.
          </InfoTip>
        </CardTitle>
        <CardDescription>Pre-flight checks every ready claim before the file is built.</CardDescription>
        <CardAction className="flex flex-wrap gap-2">
          <Gate reason={closed}>
            <Button size="sm" disabled={!!closed} asChild={!closed}>
              {closed ? (
                <span>
                  <FileSpreadsheet />
                  CMS-1500 CSV
                </span>
              ) : (
                <a href="/api/cms1500.csv">
                  <FileSpreadsheet />
                  CMS-1500 CSV
                </a>
              )}
            </Button>
          </Gate>
          <Gate reason={closed}>
            <Button size="sm" variant="outline" disabled={!!closed} asChild={!closed}>
              {closed ? (
                <span>
                  <FileSpreadsheet />
                  XLSX
                </span>
              ) : (
                <a href="/api/cms1500.xlsx">
                  <FileSpreadsheet />
                  XLSX
                </a>
              )}
            </Button>
          </Gate>
          <Gate reason={pf.excluded ? null : 'No excluded claims'}>
            <Button size="sm" variant="outline" disabled={!pf.excluded} asChild={!!pf.excluded}>
              {pf.excluded ? (
                <a href="/api/cms1500-exceptions.csv">
                  <FileWarning />
                  Exceptions
                </a>
              ) : (
                <span>
                  <FileWarning />
                  Exceptions
                </span>
              )}
            </Button>
          </Gate>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-0">
        {!pf.open && (
          <Alert className="mx-4 mt-4 w-auto">
            <TriangleAlert />
            <AlertTitle>Export opens on {fmtDay(pf.dos)}</AlertTitle>
            <AlertDescription>The date of service is the last day of the month and cannot be in the future. Move the demo clock there from Simulation.</AlertDescription>
          </Alert>
        )}
        {!pf.claims.length ? (
          <EmptyState icon={<Inbox />} title="No ready claims yet" />
        ) : (
          <div className="overflow-x-auto">
            <Table className={EDGE}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={HEAD}>Pre-flight</TableHead>
                  <TableHead className={HEAD}>Patient</TableHead>
                  <TableHead className={HEAD}>Codes</TableHead>
                  <TableHead className={`text-right ${HEAD}`}>Charge</TableHead>
                  <TableHead className={HEAD}>Findings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pf.claims.map((c) => (
                  <TableRow key={c.patientId}>
                    <TableCell className="align-top">{c.errors.length ? <ToneBadge tone="danger">Excluded</ToneBadge> : <ToneBadge tone="ok">Clean</ToneBadge>}</TableCell>
                    <TableCell className="align-top">
                      <span className="font-medium">{c.name}</span> <span className="font-mono text-xs text-muted-foreground">{c.mrn}</span>
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs">{c.codes.join(' + ')}</TableCell>
                    <TableCell className="text-right align-top tabular-nums">{money(c.total)}</TableCell>
                    <TableCell className="min-w-64 align-top text-xs whitespace-normal">
                      {c.errors.map((e) => (
                        <div key={e} className="text-destructive">
                          {e}
                        </div>
                      ))}
                      {c.sanitized.map((e) => (
                        <div key={e} className="text-muted-foreground">
                          Sanitized {e}
                        </div>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReconciliationDialog({ p, r, onClose }: { p: PatientView; r: ReconciliationView; onClose: () => void }) {
  const t = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Micro-ledger · {p.name}</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{p.mrn}</span> · {tierLabel(p.billing.code)}
            {r.complexity === 'complex' ? ` · complexity marked by ${r.complexityBy}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Nurse time" value={t(r.nurseSeconds)} />
          <StatCard label="Physician escalation" value={t(r.physicianSeconds)} />
          <StatCard primary label="Total counted" value={t(r.totalSeconds)} sub={`${r.countedMinutes} whole minutes`} />
          <StatCard label="Claim" value={<span className="font-mono text-base">{r.lines.length ? linesText(r.lines) : '—'}</span>} sub={money(r.total)} />
        </div>
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Counted time</h3>
          {!r.entries.length ? (
            <p className="text-sm text-muted-foreground">No counted time this month.</p>
          ) : (
            <Table>
              <TableBody>
                {r.entries.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">{fmtShort(e.at)}</TableCell>
                    <TableCell className="text-sm whitespace-normal">
                      {e.activity}
                      {e.outcome && <span className="text-muted-foreground"> · {e.outcome}</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.by} <ToneBadge tone={e.role === 'physician' ? 'info' : 'neutral'}>{e.role}</ToneBadge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtDuration(e.seconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
        {r.excluded.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Not counted</h3>
            <Table>
              <TableBody>
                {r.excluded.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">{fmtShort(e.at)}</TableCell>
                    <TableCell className="text-sm">{e.what}</TableCell>
                    <TableCell className="text-xs whitespace-normal text-muted-foreground">{e.why}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmtDuration(e.seconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            Audit trail summary
            <InfoTip>Compiled from the event log. The browser extension will add EHR page context once it is built.</InfoTip>
          </h3>
          <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">{r.audit}</pre>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function SettingsCard() {
  const { state, role, act, say } = useStore();
  const s = state.settings;
  const [draft, setDraft] = useState<BillingSettings>(s);
  const [vbp, setVbp] = useState(s.valueBasedPayers.join('\n'));
  const manager = role === 'manager';
  const set = <K extends keyof BillingSettings>(k: K, v: BillingSettings[K]) => setDraft({ ...draft, [k]: v });
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Billing settings</CardTitle>
        <CardDescription>Fee schedule and claim defaults used for revenue projections and the CMS-1500 file.</CardDescription>
        <CardAction>
          <Gate reason={manager ? null : 'Practice manager only'}>
            <Button
              size="sm"
              disabled={!manager}
              onClick={async () => {
                const r = await act('saveBillingSettings', { settings: { ...draft, valueBasedPayers: vbp.split('\n') } });
                if (r.ok) say('Billing settings saved.', 'ok');
              }}
            >
              Save settings
            </Button>
          </Gate>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Fee schedule</h3>
          <Table>
            <TableBody>
              {BILLING_CODES.map((c) => (
                <TableRow key={c} className="hover:bg-transparent">
                  <TableCell className="w-16 align-top font-mono text-xs">{c}</TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    {CODE_LABEL[c]}
                    {PLACEHOLDER_FEES.includes(c) && <div className="text-xs text-amber-700 dark:text-amber-400">Placeholder: verify against the CY2026 fee schedule</div>}
                  </TableCell>
                  <TableCell className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      aria-label={`Fee for ${c}`}
                      className="h-8 text-right tabular-nums"
                      value={draft.fees[c]}
                      disabled={!manager}
                      onChange={(e) => set('fees', { ...draft.fees, [c]: Number(e.target.value) })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium">Claim defaults</h3>
          {(['renderingNpi', 'billingNpi'] as const).map((k) => (
            <Field key={k} className="gap-1.5">
              <FieldLabel htmlFor={k} className="flex items-center gap-2">
                {k === 'renderingNpi' ? 'Rendering provider NPI (box 24J)' : 'Billing provider NPI (box 33a)'}
                {npiValid(draft[k]) ? <ToneBadge tone="ok">check digit OK</ToneBadge> : <ToneBadge tone="danger">fails check digit</ToneBadge>}
              </FieldLabel>
              <Input id={k} className="font-mono" value={draft[k]} disabled={!manager} onChange={(e) => set(k, e.target.value.trim())} />
            </Field>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="pos">Place of service (box 24B)</FieldLabel>
              <NativeSelect id="pos" className="w-full" value={draft.placeOfService} disabled={!manager} onChange={(e) => set('placeOfService', e.target.value as '11' | '12')}>
                <NativeSelectOption value="11">11 Office</NativeSelectOption>
                <NativeSelectOption value="12">12 Home</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="mod">Modifier 1</FieldLabel>
              <Input id="mod" placeholder="e.g. GQ" maxLength={2} value={draft.modifier} disabled={!manager} onChange={(e) => set('modifier', e.target.value.toUpperCase())} />
            </Field>
          </div>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="two-plus">Program proposed for traditional Medicare, 2+ conditions, not QMB</FieldLabel>
            <NativeSelect id="two-plus" className="w-full" value={draft.twoPlusDefault} disabled={!manager} onChange={(e) => set('twoPlusDefault', e.target.value as Program)}>
              <NativeSelectOption value="ccm">CCM · 99490</NativeSelectOption>
              <NativeSelectOption value="apcm">APCM Level 2 · G0557</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="vbp">Participating value-based payers</FieldLabel>
            <Textarea id="vbp" rows={3} value={vbp} disabled={!manager} onChange={(e) => setVbp(e.target.value)} />
            <FieldDescription>One per line. These payers are APCM-eligible.</FieldDescription>
          </Field>
        </section>
      </CardContent>
    </Card>
  );
}
