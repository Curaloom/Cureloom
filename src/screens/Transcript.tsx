import { useEffect, useRef } from 'react';
import type { TranscriptLine } from '../../shared/types';
import { cn } from '@/lib/utils';

const WHO = { ai: 'AI', nurse: 'Nurse', patient: 'Patient', caregiver: 'Caregiver', system: '' } as const;

const WHO_CLASS: Record<TranscriptLine['who'], string> = {
  ai: 'text-blue-700',
  nurse: 'text-primary',
  patient: 'text-emerald-700',
  caregiver: 'text-emerald-700',
  system: '',
};

/** The call transcript. It grows with its lines; a parent that wants a fixed height wraps it in a ScrollArea. */
export function Transcript({ lines, live, className }: { lines: TranscriptLine[]; live?: boolean; className?: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (live) end.current?.scrollIntoView({ block: 'nearest' });
  }, [lines.length, live]);
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-md border bg-muted/40 p-3 text-sm', className)}>
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2">
          {WHO[l.who] && (
            <span className={cn('w-16 shrink-0 pt-0.5 text-[11px] font-semibold uppercase', WHO_CLASS[l.who])}>{WHO[l.who]}</span>
          )}
          <span
            className={cn(
              'min-w-0',
              l.who === 'system' && 'text-muted-foreground italic',
              l.step === 'disclosure' && 'rounded bg-blue-50 px-1',
            )}
          >
            {l.text}
          </span>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
