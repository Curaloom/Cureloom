import type { ReactNode } from 'react';
import type { BillingView } from '../../../shared/api';
import type { PatientStatus } from '../../../shared/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300',
  warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300',
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300',
  neutral: 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
};

export function ToneBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" data-tone={tone} className={cn(TONE_CLASS[tone], className)}>
      {children}
    </Badge>
  );
}

export const STATUS_TONE: Record<PatientStatus, Tone> = {
  eligible_unconfirmed: 'info',
  confirmed: 'info',
  consented: 'info',
  active: 'ok',
  ineligible: 'neutral',
  needs_visit: 'warn',
  opted_out: 'neutral',
  paused: 'warn',
};

export const STATUS_LABEL: Record<PatientStatus, string> = {
  eligible_unconfirmed: 'Eligible, awaiting confirmation',
  confirmed: 'Confirmed, no consent',
  consented: 'Consented, no call setup',
  active: 'Active',
  ineligible: 'Not eligible',
  needs_visit: 'Needs a visit',
  opted_out: 'Opted out',
  paused: 'Paused',
};

export function StatusBadge({ status }: { status: PatientStatus }) {
  return <ToneBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</ToneBadge>;
}

export function BillingBadge({ b }: { b: BillingView }) {
  if (b.status === 'ready') return <ToneBadge tone="ok">Ready</ToneBadge>;
  if (b.status === 'held') return <ToneBadge tone="warn">Held</ToneBadge>;
  return <ToneBadge tone="neutral">Not enrolled</ToneBadge>;
}

/** Takes 'ccm' / 'apcm' (or the 'CCM' / 'APCM' labels); anything else renders nothing. */
export function ProgramBadge({ program }: { program: string | null | undefined }) {
  const p = program?.toUpperCase();
  if (p !== 'CCM' && p !== 'APCM') return null;
  return <ToneBadge tone="info">{p}</ToneBadge>;
}

/** Takes a flag level; 'none', '' and null render nothing. */
export function FlagBadge({ level }: { level: string | null | undefined }) {
  if (level === 'urgent') return <ToneBadge tone="danger">Urgent</ToneBadge>;
  if (level === 'concern') return <ToneBadge tone="warn">Concern</ToneBadge>;
  return null;
}
