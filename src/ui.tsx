import { useEffect, useState, type ReactNode } from 'react';
import type { BillingView } from '../shared/api';
import type { PatientStatus } from '../shared/types';
import { fmtDuration } from '../shared/time';
import { getCsv, STANDALONE } from './transport';

export function Badge({ tone = 'neutral', children }: { tone?: string; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const STATUS_TONE: Record<PatientStatus, string> = {
  eligible_unconfirmed: 'info',
  confirmed: 'info',
  consented: 'info',
  active: 'ok',
  ineligible: 'neutral',
  needs_visit: 'warn',
  opted_out: 'neutral',
  paused: 'warn',
};

const STATUS_LABEL: Record<PatientStatus, string> = {
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

/** A CSV the UI offers. The shared browser-only page can't download files, so there it shows the CSV to copy instead. */
export function CsvButton({ name, label, primary, small }: { name: string; label: string; primary?: boolean; small?: boolean }) {
  const [open, setOpen] = useState<{ filename: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const cls = `btn ${primary ? 'btn-primary' : ''} ${small ? 'btn-small' : ''}`;
  if (!STANDALONE)
    return (
      <a className={cls} href={`/api/csv/${name}`}>
        {label}
      </a>
    );
  return (
    <>
      <button
        className={cls}
        onClick={async () => {
          setCopied(false);
          setOpen(await getCsv(name));
        }}
      >
        {label}
      </button>
      {open && (
        <Modal title={open.filename} onClose={() => setOpen(null)} wide>
          <p className="muted small">This shared page can't download files. Copy the CSV and paste it into a spreadsheet or a .csv file.</p>
          <textarea className="note-edit csv" readOnly value={open.text} onFocus={(e) => e.currentTarget.select()} />
          <button
            className="btn btn-primary"
            onClick={() => {
              navigator.clipboard
                .writeText(open.text)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? 'Copied' : 'Copy CSV'}
          </button>
        </Modal>
      )}
    </>
  );
}

/** Two-step button: browsers inside the shared page block confirm() dialogs. */
export function ConfirmButton({
  className,
  disabled,
  onConfirm,
  confirmLabel,
  title,
  children,
}: {
  className: string;
  disabled?: boolean;
  onConfirm: () => void;
  confirmLabel: string;
  title?: string;
  children: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`${className} ${armed ? 'armed' : ''}`}
      disabled={disabled}
      title={title}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
