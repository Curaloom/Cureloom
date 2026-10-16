import { useRef, useState, type ReactElement } from 'react';
import { ChevronDown, Download, FileDown, FileSpreadsheet, Upload } from 'lucide-react';
import { fmtDateTime } from '../../shared/time';
import { ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStore } from '../store';

/** Edge-to-edge table inside a card: the outer columns get the card's inset. */
const EDGE = '[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4';

/** A disabled control with a tooltip naming why; renders the control as is when `reason` is null. */
function Gate({ reason, children }: { reason: string | null; children: ReactElement }) {
  if (!reason) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

export function Roster() {
  const { state, role, act, say } = useStore();
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const up = state.roster;
  const canUpload = role === 'manager';
  const gate = canUpload ? null : 'Practice manager only';

  async function upload(file: File) {
    const csv = await file.text();
    const r = await act('uploadRoster', { filename: file.name, csv });
    if (r.ok) say(`${file.name} uploaded.`, 'ok');
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Roster"
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
              <DropdownMenuItem asChild>
                <a href="/api/seed/october-roster.csv" download>
                  <FileSpreadsheet />
                  october-roster.csv
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/seed/roster-with-errors.csv" download>
                  <FileSpreadsheet />
                  roster-with-errors.csv
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <Card className="py-4">
        <CardContent className="px-4">
          <div
            className={cn(
              'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
              drag && canUpload ? 'border-primary bg-primary/5' : 'border-border',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f && canUpload) upload(f);
            }}
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Upload className="size-5" />
            </div>
            <p className="text-sm font-medium">Drop a roster CSV here</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Gate reason={gate}>
                <Button variant="outline" disabled={!canUpload} onClick={() => input.current?.click()}>
                  Choose file
                </Button>
              </Gate>
              <Gate reason={gate}>
                <Button disabled={!canUpload} onClick={() => act('uploadSeedRoster').then((r) => r.ok && say('October roster uploaded.', 'ok'))}>
                  Upload October roster
                </Button>
              </Gate>
            </div>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = '';
              }}
            />
          </div>
        </CardContent>
      </Card>
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-4 py-4 [.border-b]:pb-4">
          <CardTitle className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            Last upload
            {up && <span className="truncate font-mono text-sm font-normal text-muted-foreground">{up.filename}</span>}
          </CardTitle>
          {up && (
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>
                {fmtDateTime(up.at)} · {up.by}
              </span>
              <ToneBadge tone="ok">{up.accepted} accepted</ToneBadge>
              {up.rejected > 0 && <ToneBadge tone="danger">{up.rejected} rejected</ToneBadge>}
            </CardDescription>
          )}
          {up && up.rejected > 0 && (
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
          {!up ? (
            <EmptyState icon={<FileSpreadsheet />} title="No roster uploaded this month" />
          ) : (
            <div className="overflow-x-auto">
              <Table className={EDGE}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 text-right text-muted-foreground">Row</TableHead>
                    <TableHead className="text-muted-foreground">MRN</TableHead>
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Result</TableHead>
                    <TableHead className="text-muted-foreground">Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {up.rows.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{r.row}</TableCell>
                      <TableCell className="font-mono text-xs">{r.mrn || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="font-medium">{r.name || <span className="font-normal text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{r.accepted ? <ToneBadge tone="ok">Accepted</ToneBadge> : <ToneBadge tone="danger">Rejected</ToneBadge>}</TableCell>
                      <TableCell className={cn('min-w-64 whitespace-normal', !r.accepted && 'text-destructive')}>
                        {r.accepted ? r.outcome : r.errors.join('; ')}
                      </TableCell>
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
