import { CalendarDays, FlaskConical } from 'lucide-react';
import { fmtDay, fmtTime, toIso } from '../../../shared/time';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useDemoNowMs, useServerRealMs, useStore } from '@/store';
import { Duration, LiveDot } from './time';

/** Sticky, h-14 (3.5rem). Sticky elements in a page sit at `top-14`. */
export function AppHeader({
  title,
  timerHideFor,
  onOpenSimulation,
}: {
  title: string;
  /** Hide the timer pill for this patient's page (-1 on any call page, -2 on the physician queues): that screen shows its own timer. */
  timerHideFor: number | null;
  onOpenSimulation: () => void;
}) {
  const now = toIso(useDemoNowMs());
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <div className="min-w-0 flex-1 truncate font-medium">{title}</div>
      <div className="flex items-center gap-2">
        <TimerPill hideFor={timerHideFor} />
        <div className="hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium text-muted-foreground tabular-nums sm:inline-flex">
          <CalendarDays className="size-3.5" />
          {fmtDay(now)} · {fmtTime(now)}
        </div>
        <Button variant="outline" size="sm" onClick={onOpenSimulation} aria-label="Simulation">
          <FlaskConical />
          <span className="hidden sm:inline">Simulation</span>
        </Button>
      </div>
    </header>
  );
}

function TimerPill({ hideFor }: { hideFor: number | null }) {
  const { state, role } = useStore();
  const real = useServerRealMs();
  // Each role sees its own timer: the physician's escalation timer, or the nurse's.
  const t = role === 'physician' ? state.physicianTimer : state.timer;
  if (!t || hideFor === t.patientId || (hideFor === -1 && t.callId) || (hideFor === -2 && t.taskId)) return null;
  const secs = Math.max(0, ((real - t.startedRealMs) / 1000) * t.speed);
  const href = t.taskId
    ? '#/physician'
    : t.callId && t.activity === 'nurse_call'
      ? `#/call/${t.callId}`
      : t.activity === 'consent_call'
        ? '#/enroll'
        : `#/patient/${t.patientId}`;
  return (
    <a
      href={href}
      title={`${t.activityLabel} · ${t.patientName}`}
      className="inline-flex h-8 min-w-0 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-800 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200 dark:hover:bg-red-950"
    >
      <LiveDot />
      <span className="hidden max-w-56 truncate lg:inline">
        {t.activityLabel} · {t.patientName}
      </span>
      <Duration seconds={secs} />
    </a>
  );
}
