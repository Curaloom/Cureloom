import { useEffect, useState, type ReactNode } from 'react';
import type { BillingView, PreflightCheck } from '../shared/api';
import type { PatientStatus } from '../shared/types';
import { fmtDuration } from '../shared/time';

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
  if (b.status === 'ready') return <Badge tone="ok">✓ Ready</Badge>;
  if (b.status === 'held') return <Badge tone="warn">‖ Held</Badge>;
  return <Badge>Not enrolled</Badge>;
}

/** A pre-flight check's state as icon plus word, never colour alone. */
export function CheckState({ c }: { c: Pick<PreflightCheck, 'status' | 'blocking'> }) {
  if (c.status === 'pass') return <Badge tone="ok">✓ Pass</Badge>;
  if (c.status === 'warn') return <Badge tone="info">! Warning</Badge>;
  return <Badge tone={c.blocking ? 'danger' : 'warn'}>✕ {c.blocking ? 'Holds claim' : 'Fail'}</Badge>;
}

export function money(n: number | null | undefined): string {
  return n == null ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Whole dollars with separators: $1,234. */
export function usd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  const s = Math.round(Math.abs(n)).toLocaleString('en-US');
  return n < 0 ? `−$${s}` : `$${s}`;
}

export function num(n: number | null | undefined, digits = 0): string {
  return n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(n: number | null | undefined, digits = 0): string {
  return n == null || Number.isNaN(n) ? '—' : `${(n * 100).toFixed(digits)}%`;
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

export function Loading() {
  return <p className="empty">Loading…</p>;
}

export function Duration({ seconds }: { seconds: number }) {
  return <span className="mono">{fmtDuration(seconds)}</span>;
}

/** A long wait reads in days and hours, not as a 195-hour clock. */
function fmtWait(seconds: number): string {
  if (seconds < 86400) return fmtDuration(seconds);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d} day${d === 1 ? '' : 's'}${h ? ` ${h} h` : ''}`;
}

export function Countdown({ dueMs, nowMs }: { dueMs: number; nowMs: number }) {
  const left = Math.round((dueMs - nowMs) / 1000);
  if (left <= 0) return <span className="countdown overdue">overdue by {fmtWait(-left)}</span>;
  return <span className="countdown">{fmtWait(left)} left</span>;
}

/** "Lakeside Care Partners'" and "Oakridge's". */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** "a, b and c" */
export function listJoin(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** A stat tile. The hero variant carries the one number the page is about. */
export function Kpi({ label, value, sub, hero, tone }: { label: string; value: ReactNode; sub?: ReactNode; hero?: boolean; tone?: 'ok' | 'warn' | 'danger' }) {
  return (
    <div className={`kpi ${hero ? 'kpi-hero' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone ? `kpi-${tone}` : ''}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export interface BarRow {
  label: string;
  value: number;
  /** Shown at the bar's tip instead of the raw value. */
  display?: string;
  hint?: string;
}

/**
 * Single-series horizontal bars: one hue, value at the tip, a tooltip on hover
 * and a table view for screen readers and anyone who wants the numbers.
 */
export function BarList({ rows, unit, empty = 'Nothing yet.', label }: { rows: BarRow[]; unit: string; empty?: string; label: string }) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="bars-wrap">
      <div className="bars-tools">
        <button className="btn-link small" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {table ? (
        <table className="table compact">
          <thead>
            <tr>
              <th>{label}</th>
              <th className="right">{unit}</th>
              <th className="right">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="right tnum">{r.display ?? num(r.value)}</td>
                <td className="right tnum">{pct(total ? r.value / total : null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="bars" aria-label={label}>
          {rows.map((r, i) => (
            <li
              key={r.label}
              className={`bar-row ${hover === i ? 'hover' : ''}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              aria-label={`${r.label}: ${r.display ?? num(r.value)} ${unit}`}
            >
              <span className="bar-label">{r.label}</span>
              <span className="bar-track">
                <span className="bar" style={{ width: `${Math.max(0.5, (r.value / max) * 100)}%` }} />
                <span className="bar-value tnum">{r.display ?? num(r.value)}</span>
              </span>
              {hover === i && (
                <span className="tip" role="tooltip">
                  <strong>{r.label}</strong>
                  <span>
                    {r.display ?? num(r.value)} {unit} · {pct(total ? r.value / total : null)} of total
                  </span>
                  {r.hint && <span className="muted">{r.hint}</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface CompareRow {
  label: string;
  today: number;
  with: number;
  fmt: (n: number) => string;
  note?: string;
}

/**
 * Before/after pairs: today in recessive gray, with Cureloom in the accent hue.
 * Both bars are direct-labelled because the gray alone is too light to read as a mark.
 */
export function CompareBars({ rows, todayLabel = 'Today', withLabel = 'With Cureloom' }: { rows: CompareRow[]; todayLabel?: string; withLabel?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="compare">
      <div className="legend" aria-hidden>
        <span>
          <i className="sw sw-today" /> {todayLabel}
        </span>
        <span>
          <i className="sw sw-with" /> {withLabel}
        </span>
      </div>
      {rows.map((r) => {
        const max = Math.max(r.today, r.with, 0.0001);
        return (
          <div key={r.label} className="compare-row">
            <div className="compare-label">
              {r.label}
              {r.note && <span className="muted small"> · {r.note}</span>}
            </div>
            {(['today', 'with'] as const).map((k) => (
              <div
                key={k}
                className={`bar-row ${hover === `${r.label}:${k}` ? 'hover' : ''}`}
                onMouseEnter={() => setHover(`${r.label}:${k}`)}
                onMouseLeave={() => setHover(null)}
                aria-label={`${r.label}, ${k === 'today' ? todayLabel : withLabel}: ${r.fmt(r[k])}`}
              >
                <span className="bar-label small muted">{k === 'today' ? todayLabel : withLabel}</span>
                <span className="bar-track">
                  <span className={`bar ${k === 'today' ? 'bar-today' : ''}`} style={{ width: `${Math.max(0.5, (r[k] / max) * 100)}%` }} />
                  <span className="bar-value tnum">{r.fmt(r[k])}</span>
                </span>
                {hover === `${r.label}:${k}` && (
                  <span className="tip" role="tooltip">
                    <strong>{r.label}</strong>
                    <span>
                      {k === 'today' ? todayLabel : withLabel}: {r.fmt(r[k])}
                    </span>
                    {k === 'with' && r.today > 0 && <span className="muted">{pct(1 - r.with / r.today)} lower than today</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** The line every screen shows somewhere: nothing here is real. */
export function SyntheticNote({ children }: { children?: ReactNode }) {
  return (
    <p className="synthetic-note">
      <strong>Synthetic data.</strong> Every practice, patient and phone number is fictional; nothing is dialled or sent. {children}
    </p>
  );
}
