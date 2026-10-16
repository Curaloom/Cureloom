import type { ReactNode } from 'react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/** Compact empty state for a card or a page section. `icon` is an element, e.g. `<Inbox />`. */
export function EmptyState({
  title,
  description,
  icon,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Empty className="gap-4 px-4 py-8 md:px-4 md:py-8">
      <EmptyHeader className="gap-1">
        {icon && (
          <EmptyMedia variant="icon" className="mb-1 size-9 text-muted-foreground [&_svg:not([class*='size-'])]:size-5">
            {icon}
          </EmptyMedia>
        )}
        <EmptyTitle className="text-sm font-medium">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}
