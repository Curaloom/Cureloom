import { useState, type ReactNode } from 'react';
import { ArchiveRestore, CalendarDays, CalendarPlus, PhoneCall, RotateCcw, Save, SkipForward } from 'lucide-react';
import type { RunView } from '../../../shared/api';
import { DEMO_LAST_DATE } from '../../../shared/constants';
import { addDays, dateOf, fmtDateTime, fmtDay, fmtTime, isBusinessDay, toIso } from '../../../shared/time';
import { RunSummary } from '@/screens/RunSummary';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { go } from '@/router';
import { useDemoNowMs, useStore } from '@/store';
import { ConfirmDialog } from './confirm-dialog';
import { HOME } from './nav';

/** Right-side sheet with the demo clock, the scripted AI run, checkpoints and reset. */
export function SimulationPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state, role, act, busy, say } = useStore();
  const now = toIso(useDemoNowMs());
  const [run, setRun] = useState<RunView | null>(null);
  const [pickDate, setPickDate] = useState(false);
  const c = state.clock;
  const nextDays = Array.from({ length: 31 }, (_, i) => addDays(dateOf(now), i + 1)).filter((d) => d <= DEMO_LAST_DATE);

  async function runAiCalls() {
    const r = await act<RunView>('runAiCalls');
    if (r.ok && r.result) {
      onOpenChange(false);
      setRun(r.result);
    }
  }

  async function saveCheckpoint() {
    const r = await act('saveCheckpoint');
    if (r.ok) say('Checkpoint saved.', 'ok');
  }

  async function restoreCheckpoint() {
    const r = await act('restoreCheckpoint');
    if (r.ok) say('Checkpoint restored.', 'ok');
  }

  async function reset() {
    const r = await act('reset');
    if (r.ok) {
      setRun(null);
      onOpenChange(false);
      go(`/${HOME[role]}`);
      say('Reset to seed: Monday 5 Oct 2026.', 'ok');
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-sm">
          <SheetHeader className="border-b">
            <SheetTitle className="text-base">Simulation</SheetTitle>
            <SheetDescription>Clock, scripted calls and checkpoints.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 p-4">
            <Section label="Clock">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-semibold tracking-tight">{fmtDay(now)}</span>
                <span className="text-2xl text-muted-foreground tabular-nums">{fmtTime(now)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => act('advanceDay')}>
                  <CalendarPlus />
                  +1 day
                </Button>
                <Button variant="outline" size="sm" disabled={busy || !nextDays.length} onClick={() => setPickDate(true)}>
                  <CalendarDays />
                  Go to date…
                </Button>
                <Button variant="outline" size="sm" className="col-span-2" disabled={busy || c.afterMonthEnd} onClick={() => act('jumpToMonthEnd')}>
                  <SkipForward />
                  Jump to month end
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                <div className="grid gap-0.5">
                  <Label htmlFor="sim-speed">1 s = 1 min</Label>
                  <span className="text-xs text-muted-foreground">Applies while a timer runs</span>
                </div>
                <Switch
                  id="sim-speed"
                  checked={c.speed === 60}
                  disabled={busy}
                  onCheckedChange={(on) => act('setSpeed', { speed: on ? 60 : 1 })}
                />
              </div>
            </Section>
            <Separator />
            <Section label="AI calls">
              <Button disabled={busy} onClick={runAiCalls}>
                <PhoneCall />
                Run October AI calls
              </Button>
            </Section>
            <Separator />
            <Section label="Checkpoint">
              <div className="flex flex-wrap gap-2 *:flex-1">
                <Button variant="outline" size="sm" disabled={busy} onClick={saveCheckpoint}>
                  <Save />
                  Save checkpoint
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm" disabled={busy || !state.checkpoint.savedAt}>
                      <ArchiveRestore />
                      Restore checkpoint
                    </Button>
                  }
                  title="Restore checkpoint?"
                  description="Everything done since it was saved is discarded."
                  confirmLabel="Restore"
                  onConfirm={restoreCheckpoint}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {state.checkpoint.demoAt ? `Saved at ${fmtDateTime(state.checkpoint.demoAt)}` : 'No checkpoint saved'}
              </p>
            </Section>
            <Separator />
            <Section label="Reset">
              <ConfirmDialog
                trigger={
                  <Button
                    variant="outline"
                    disabled={busy}
                    className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive dark:border-destructive/40"
                  >
                    <RotateCcw />
                    Reset to seed
                  </Button>
                }
                title="Reset to seed?"
                description="Clears all activity and returns to Monday 5 Oct, 09:00."
                confirmLabel="Reset"
                destructive
                onConfirm={reset}
              />
            </Section>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={pickDate} onOpenChange={setPickDate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Go to date</DialogTitle>
            <DialogDescription>Forward only. Each day starts at 09:00.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {nextDays.map((d) => (
              <Button
                key={d}
                variant="outline"
                size="sm"
                disabled={busy}
                className={cn(!isBusinessDay(d) && 'text-muted-foreground')}
                onClick={async () => {
                  const r = await act('setDate', { date: d });
                  if (r.ok) setPickDate(false);
                }}
              >
                {fmtDay(d)}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!run} onOpenChange={(o) => !o && setRun(null)}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-4xl"
          onOpenAutoFocus={(e) => {
            // Focus the dialog itself rather than ringing the close button.
            e.preventDefault();
            if (e.currentTarget instanceof HTMLElement) e.currentTarget.focus();
          }}
          onClick={(e) => {
            // Following a patient link leaves the dialog behind otherwise.
            if (e.target instanceof Element && e.target.closest('a[href^="#/"]')) setRun(null);
          }}
        >
          <DialogHeader>
            <DialogTitle>October AI calls</DialogTitle>
          </DialogHeader>
          {run && <RunSummary run={run} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h3>
      {children}
    </section>
  );
}
