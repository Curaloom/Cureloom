import { useEffect, useState, type ReactElement } from 'react';
import { Copy, FileText } from 'lucide-react';
import type { NoteView } from '../../shared/api';
import { fmtDateTime } from '../../shared/time';
import { BillingBadge, ProgramBadge, ToneBadge } from '@/components/app/badges';
import { EmptyState } from '@/components/app/empty-state';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { go } from '../router';
import { useStore } from '../store';

export function MonthEnd({ selected }: { selected: number | null }) {
  const { state, role, act, say } = useStore();
  const list = state.patients.filter((p) => state.monthEnd.patientIds.includes(p.id));
  const p = list.find((x) => x.id === selected) ?? null;
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const nurse = role === 'nurse';
  const { filed, total } = state.monthEnd;

  useEffect(() => {
    if (!dirty) setText(p?.note?.text ?? '');
  }, [p?.id, p?.note?.text, dirty]);
  useEffect(() => setDirty(false), [p?.id]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      say('Note copied. Paste it into the EHR.', 'ok');
    } catch {
      say('Copy failed in this browser. Select the text and copy it by hand.');
    }
    if (p) act('noteCopied', { patientId: p.id });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Month end"
        meta={
          <>
            <span className="mr-2">{state.clock.monthLabel}</span>
            <span className="flex items-center gap-2">
              <Progress value={total ? (filed / total) * 100 : 0} className="w-40" aria-label="Notes filed" />
              <span className="tabular-nums">
                {filed} of {total} filed
              </span>
            </span>
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>Patients</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            {!list.length ? (
              <EmptyState title="No notes this month" />
            ) : (
              <ul className="flex flex-col gap-0.5">
                {list.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      aria-current={x.id === selected ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50',
                        x.id === selected && 'bg-accent hover:bg-accent',
                      )}
                      onClick={() => go(`/month-end/${x.id}`)}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold">{x.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{x.mrn}</span>
                          <ProgramBadge program={x.program} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="tabular-nums">{x.minutes} min</span>
                          <BillingBadge b={x.billing} />
                          {x.billing.reason && <span>{x.billing.reason}</span>}
                        </div>
                      </div>
                      <NoteBadge note={x.note} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {!p || !p.note ? (
          <Card className="py-0">
            <EmptyState icon={<FileText />} title="Pick a patient to see the draft note" />
          </Card>
        ) : (
          <Card className="gap-4">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-baseline gap-x-2 text-base">
                {p.name}
                <span className="font-mono text-xs font-normal text-muted-foreground">{p.mrn}</span>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                <span>{p.note.filedAt ? `Filed ${fmtDateTime(p.note.filedAt)}` : 'Not filed yet'}</span>
                {p.note.attestedAt && <span>· attested {fmtDateTime(p.note.attestedAt)}</span>}
                {p.note.changedSinceFiled && (
                  <ToneBadge tone="warn" className="ml-1">
                    New activity since filing
                  </ToneBadge>
                )}
              </CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" asChild>
                  <a href={`#/patient/${p.id}`}>Patient month</a>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea
                aria-label="Note"
                className="min-h-[520px] font-mono text-xs leading-relaxed field-sizing-fixed read-only:bg-muted/40 md:text-xs"
                value={text}
                readOnly={!!p.note.filedAt && !p.note.changedSinceFiled}
                onChange={(e) => {
                  setText(e.target.value);
                  setDirty(true);
                }}
                spellCheck={false}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={copy}>
                  <Copy />
                  Copy note
                </Button>
                {!p.note.filedAt && (
                  <>
                    <NurseOnly nurse={nurse}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!nurse || !dirty}
                        onClick={async () => {
                          const r = await act('saveNote', { patientId: p.id, text });
                          if (r.ok) setDirty(false);
                        }}
                      >
                        Save edits
                      </Button>
                    </NurseOnly>
                    <NurseOnly nurse={nurse}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!nurse || (!p.note.edited && !dirty)}
                        onClick={async () => {
                          const r = await act('revertNote', { patientId: p.id });
                          if (r.ok) setDirty(false);
                        }}
                      >
                        Back to system draft
                      </Button>
                    </NurseOnly>
                  </>
                )}
                <div className="ml-auto">
                  <NurseOnly nurse={nurse}>
                    <Button
                      size="sm"
                      disabled={!nurse || (!!p.note.filedAt && !p.note.changedSinceFiled && !dirty)}
                      onClick={async () => {
                        const body = p.note!.changedSinceFiled && !dirty ? p.note!.draft : text;
                        const r = await act('fileNote', { patientId: p.id, text: body });
                        if (r.ok) {
                          setDirty(false);
                          const next = list.find((x) => !x.note?.filedAt && x.id !== p.id);
                          if (next) go(`/month-end/${next.id}`);
                        }
                      }}
                    >
                      {p.note.filedAt ? 'Update filed note' : 'Mark filed in EHR'}
                    </Button>
                  </NurseOnly>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function NoteBadge({ note }: { note: NoteView | null }) {
  if (note?.filedAt) return <ToneBadge tone="ok">Filed</ToneBadge>;
  if (note?.edited) return <ToneBadge tone="info">Edited</ToneBadge>;
  return <ToneBadge tone="neutral">Draft</ToneBadge>;
}

/** For other roles the button stays disabled and the tooltip names the role. */
function NurseOnly({ nurse, children }: { nurse: boolean; children: ReactElement }) {
  if (nurse) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>Nurse only</TooltipContent>
    </Tooltip>
  );
}
