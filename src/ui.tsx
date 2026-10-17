import { useEffect, type ReactNode } from 'react';
import type { BillingView } from '../shared/api';
import type { PatientStatus } from '../shared/types';
import { fmtDuration } from '../shared/time';

export function Badge({ tone = 'neutral', children }: { tone?: string; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const STATUS_TONE: Record<PatientStatus, string> = {
  eligible_unconfirmed: 'info',
  confirmed: 'info',
  consented: 'info',
  plan_review: 'info',
  active: 'ok',
  ineligible: 'neutral',
  needs_visit: 'warn',
  opted_out: 'neutral',
  paused: 'warn',
};

const STATUS_LABEL: Record<PatientStatus, string> = {
  eligible_unconfirmed: 'Eligible, awaiting Ops review',
  confirmed: 'Approved, no consent',
  consented: 'Consented, no call setup',
  plan_review: 'Awaiting care plan approval',
  active: 'Active',
  ineligible: 'Not eligible',
  needs_visit: 'Needs a visit',
  opted_out: 'Opted out',
  paused: 'Paused',
};

export function StatusBadge({ status }: { status: PatientStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function BillingBadge({ b }: { b: BillingView }) {
  if (b.status === 'ready') return <Badge tone="ok">Ready</Badge>;
  if (b.status === 'held') return <Badge tone="warn">Held</Badge>;
  return <Badge>Not enrolled</Badge>;
}

export function money(n: number | null | undefined): string {
  return n == null ? '—' : `$${n.toFixed(2)}`;
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Duration({ seconds }: { seconds: number }) {
  return <span className="mono">{fmtDuration(seconds)}</span>;
}

export function Countdown({ dueMs, nowMs }: { dueMs: number; nowMs: number }) {
  const left = Math.round((dueMs - nowMs) / 1000);
  if (left <= 0) return <span className="countdown overdue">overdue by {fmtDuration(-left)}</span>;
  return <span className="countdown">{fmtDuration(left)} left</span>;
}
