import { TriangleAlert } from 'lucide-react';
import { fmtTime } from '../../../shared/time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDemoNowMs, useStore } from '@/store';
import { Countdown } from './time';

/** One row per open urgent flag, on every screen. The nurse acknowledges; everyone else sees who will. */
export function UrgentAlerts() {
  const { state, role, act, busy } = useStore();
  const nowMs = useDemoNowMs();
  if (!state.alerts.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {state.alerts.map((a) => {
        const acked = !!a.acknowledgedAt;
        return (
          <Alert
            key={a.flagId}
            variant={acked ? 'default' : 'destructive'}
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 md:flex-nowrap [&>svg]:translate-y-0',
              acked
                ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100'
                : 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100',
            )}
          >
            <TriangleAlert className={acked ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'} />
            {/* Wraps on mobile; one row on desktop, where only the summary truncates. */}
            <div className="min-w-0 flex-1 basis-64 md:flex md:items-baseline md:gap-x-1.5">
              <span className="font-semibold whitespace-nowrap">Urgent · {a.name}</span>{' '}
              <span className="whitespace-nowrap opacity-70">{a.mrn}</span> <span aria-hidden>·</span>{' '}
              <span className="md:min-w-0 md:truncate" title={a.summary}>
                {a.summary}
              </span>{' '}
              <span aria-hidden>·</span>{' '}
              <span className="font-medium whitespace-nowrap">{a.escalation === '988' ? 'Told to call or text 988' : 'Told to call 911'}</span>
            </div>
            <div className="text-xs font-medium whitespace-nowrap">
              {acked ? (
                <>Acknowledged {fmtTime(a.acknowledgedAt)} · resolve when handled</>
              ) : a.ackDueAt ? (
                <>
                  Acknowledge within 30 min · <Countdown dueMs={Date.parse(`${a.ackDueAt}Z`)} nowMs={nowMs} />
                </>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!acked &&
                (role === 'nurse' ? (
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => act('acknowledgeFlag', { flagId: a.flagId })}>
                    Acknowledge
                  </Button>
                ) : (
                  <span className="text-xs opacity-75">Nurse acknowledges</span>
                ))}
              <Button size="sm" variant="outline" className="bg-background/80" asChild>
                <a href={`#/patient/${a.patientId}`}>Open patient</a>
              </Button>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
