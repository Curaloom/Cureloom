import { CircleAlert, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

/** Renders the store's toast as a bottom-centre pill. */
export function AppToast() {
  const { toast } = useStore();
  if (!toast) return null;
  const ok = toast.kind === 'ok';
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <div
      key={`${toast.kind}:${toast.text}`}
      role={ok ? 'status' : 'alert'}
      className={cn(
        'fixed bottom-6 left-1/2 z-[100] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg',
        'animate-in fade-in slide-in-from-bottom-2',
        ok ? 'bg-emerald-600' : 'bg-destructive',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{toast.text}</span>
    </div>
  );
}
