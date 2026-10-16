// Transitional. Screens migrate to @/components/app and @/components/ui; delete when src/screens no longer import this.
import type { ReactNode } from 'react';
import { ToneBadge, type Tone } from '@/components/app/badges';
import { Card as UiCard, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export { BillingBadge, StatusBadge } from '@/components/app/badges';
export { Countdown, Duration } from '@/components/app/time';
export { money } from '@/lib/format';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <ToneBadge tone={tone} className="mr-1">
      {children}
    </ToneBadge>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    // Like the old .card: the whole card scrolls sideways when a table is too wide.
    <UiCard className={cn('gap-3 overflow-x-auto py-4', className)}>
      {(title || actions) && (
        <CardHeader className="flex flex-wrap items-center gap-2 px-4">
          {title && <CardTitle className="leading-snug">{title}</CardTitle>}
          {actions && <CardAction className="ml-auto flex flex-wrap items-center gap-2 self-center">{actions}</CardAction>}
        </CardHeader>
      )}
      <CardContent className="px-4">{children}</CardContent>
    </UiCard>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className={cn('max-h-[calc(100dvh-4rem)] overflow-y-auto', wide && 'sm:max-w-4xl')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="min-w-0">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
