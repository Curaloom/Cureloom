import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** A headline number: label, value, one line of context. `primary` tints the card for the figure that matters most. */
export function StatCard({ label, value, sub, primary }: { label: ReactNode; value: ReactNode; sub?: ReactNode; primary?: boolean }) {
  return (
    <Card className={cn('gap-1 py-4', primary && 'border-primary/40 bg-primary/5')}>
      <CardContent className="flex flex-col gap-1 px-4">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn('text-2xl font-semibold tracking-tight tabular-nums', primary && 'text-primary')}>{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
