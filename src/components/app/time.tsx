import { fmtDuration } from '../../../shared/time';
import { cn } from '@/lib/utils';

/** Seconds as m:ss (or h:mm:ss). */
export function Duration({ seconds, className }: { seconds: number; className?: string }) {
  return <span className={cn('font-mono tabular-nums', className)}>{fmtDuration(seconds)}</span>;
}

/** "12:30 left", or "overdue by 1:05" in the destructive colour. */
export function Countdown({ dueMs, nowMs, className }: { dueMs: number; nowMs: number; className?: string }) {
  const left = Math.round((dueMs - nowMs) / 1000);
  if (left <= 0) {
    return <span className={cn('font-semibold text-destructive tabular-nums', className)}>overdue by {fmtDuration(-left)}</span>;
  }
  return <span className={cn('font-semibold tabular-nums', className)}>{fmtDuration(left)} left</span>;
}

/** Pulsing red dot for anything recording or live. */
export function LiveDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 animate-pulse rounded-full bg-red-500', className)} />;
}
