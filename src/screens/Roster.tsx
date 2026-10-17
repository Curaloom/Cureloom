import { useEffect, useMemo, useRef, useState } from 'react';
import type { OpportunityBucket, OpportunityRow } from '../../shared/api';
import { FIELDS, type FieldKey } from '../../shared/mapper';
import { fmtDate, fmtDateTime } from '../../shared/time';
import type { Program } from '../../shared/types';
import { useStore } from '../store';
import { Badge, Card, Empty, money, StatusBadge } from '../ui';

const BUCKETS: { key: OpportunityBucket | 'all'; label: string }[] = [
  { key: 'review', label: 'To review' },
  { key: 'held', label: 'Held' },
  { key: 'approved', label: 'Approved' },
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'not_eligible', label: 'Not eligible' },
  { key: 'all', label: 'All' },
];

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function ConfidenceBadge({ value, reasons }: { value: number; reasons: string[] }) {
  const tone = value >= 80 ? 'ok' : value >= 60 ? 'warn' : 'danger';
  return (
    <span title={reasons.join('\n')}>
      <Badge tone={tone}>{value}</Badge>
    </span>
  );
}

export function Roster() {
  const { state, role, act, say } = useStore();
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const canUpload = role === 'manager';
  const ops = state.ops;

  async function upload(file: File) {
    const xlsx = /\.xlsx$/i.test(file.name);
    if (!xlsx && !/\.(csv|txt)$/i.test(file.name)) {
      say('Upload a .csv or .xlsx file.');
      return;
    }
    const body = xlsx ? { filename: file.name, xlsxBase64: toBase64(await file.arrayBuffer()) } : { filename: file.name, csv: await file.text() };
    const r = await act('previewRoster', body);
    if (r.ok) say(`${file.name} read. Check the column mapping.`, 'ok');
  }

  const e = ops.emrr;
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Roster & opportunity</h1>
        <p className="muted">
          Upload the EHR export (CSV or Excel). Cureloom maps the columns, checks payer and ICD-10 codes, and proposes a program for each patient. Nothing
          connects to the EHR; every phone number must be a fictional 555-01XX number.
        </p>
      </div>

      <div className="kpis">
        <div className="kpi primary">
          <div className="label">eMRR, approved and enrolled</div>
          <div className="value">{money(e.approved)}</div>
          <div className="sub">
            {e.approvedCount} patient{e.approvedCount === 1 ? '' : 's'} · per month at your fee schedule
          </div>
        </div>
        <div className="kpi">
          <div className="label">Pending opportunity</div>
          <div className="value">{money(e.pending)}</div>
          <div className="sub">{e.pendingCount} to review or held</div>
        </div>
        <div className="kpi">
          <div className="label">Rejected · not eligible</div>
          <div className="value">
            {e.rejectedCount} · {e.notEligibleCount}
          </div>
          <div className="sub">patients</div>
        </div>
        <div className="kpi">
          <div className="label">ICD-10 chronic matrix</div>
          <div className="value">{ops.icd.groups}</div>
          <div className="sub">condition groups, {ops.icd.prefixes} code prefixes loaded</div>
        </div>
      </div>

      {ops.preview ? (
        <MappingCard />
      ) : (
        <Card title="Upload the roster">
          <div
            className={`dropzone ${drag ? 'drag' : ''} ${canUpload ? '' : 'disabled'}`}
            onDragOver={(ev) => {
              ev.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(ev) => {
              ev.preventDefault();
              setDrag(false);
              const f = ev.dataTransfer.files[0];
              if (f && canUpload) upload(f);
            }}
          >
            <p>
              <strong>Drop a CSV or Excel (.xlsx) export here</strong> or
            </p>
            <div className="row gap">
              <button className="btn" disabled={!canUpload} onClick={() => input.current?.click()}>
                Choose a file…
              </button>
              <button className="btn btn-primary" disabled={!canUpload} onClick={() => act('previewSeedRoster')}>
                Use the October roster
              </button>
            </div>
            <input
              ref={input}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (f) upload(f);
                ev.target.value = '';
              }}
            />
            {!canUpload && <p className="hint">Switch to the Practice manager role to upload.</p>}
            <p className="hint">
              Samples: <a href="/api/seed/october-roster.csv">october-roster.csv</a> · <a href="/api/seed/october-roster.xlsx">october-roster.xlsx</a> (the 15
              seed patients, EHR-style headers) · <a href="/api/seed/roster-with-errors.csv">roster-with-errors.csv</a> (rejected rows)
            </p>
          </div>
        </Card>
      )}

      <Matrix />
      <LastUpload />
    </div>
  );
}

function MappingCard() {
  const { state, role, act, say } = useStore();
  const p = state.ops.preview!;
  const initial = useMemo(() => Object.fromEntries(FIELDS.map((f) => [f.key, p.mapping[f.key].column])) as Record<FieldKey, number | null>, [p]);
  const [cols, setCols] = useState(initial);
  useEffect(() => setCols(initial), [initial]);
  const used = Object.values(cols).filter((c) => c != null);
  const dupes = used.length !== new Set(used).size;
  const missing = FIELDS.filter((f) => f.required && cols[f.key] == null);

  return (
    <Card
      title={`Column mapping · ${p.filename}`}
      actions={
        <>
          <button className="btn" disabled={role !== 'manager'} onClick={() => act('cancelRosterPreview')}>
            Discard
          </button>
          <button
            className="btn btn-primary"
            disabled={role !== 'manager' || dupes || missing.length > 0}
            onClick={async () => {
              const r = await act('importRoster', { mapping: cols });
              if (r.ok) say(`${p.filename} imported.`, 'ok');
            }}
          >
            Import {p.rowCount} rows with this mapping
          </button>
        </>
      }
    >
      <p className="muted small">
        {p.savedLayout
          ? 'This file layout was confirmed before, so the saved mapping is used.'
          : 'Proposed by matching each header against known names and spellings. Check the sample values, change anything that is wrong, then import.'}{' '}
        Required fields are marked *.
      </p>
      <div className="mapping">
        {FIELDS.map((f) => {
          const c = cols[f.key];
          const m = p.mapping[f.key];
          const sample = c == null ? '' : p.sample.map((r) => r[c]).filter(Boolean).slice(0, 2).join(' · ');
          return (
            <label key={f.key} className={f.required && c == null ? 'missing' : ''}>
              <span>
                {f.label}
                {f.required ? ' *' : ''}{' '}
                {c != null && c === m.column && m.source === 'auto' && (
                  <Badge tone={m.score >= 0.95 ? 'ok' : 'warn'}>{Math.round(m.score * 100)}%</Badge>
                )}
              </span>
              <select className="input" value={c ?? ''} onChange={(e) => setCols({ ...cols, [f.key]: e.target.value === '' ? null : Number(e.target.value) })}>
                <option value="">— not in this file —</option>
                {p.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="sample">{sample || ' '}</span>
            </label>
          );
        })}
      </div>
      {dupes && <p className="warn-text">Two fields point at the same column.</p>}
      {missing.length > 0 && <p className="warn-text">Map a column for: {missing.map((f) => f.label).join(', ')}.</p>}
    </Card>
  );
}

function Matrix() {
  const { state, role, act, say } = useStore();
  const rows = state.ops.matrix;
  const counts = Object.fromEntries(BUCKETS.map((b) => [b.key, b.key === 'all' ? rows.length : rows.filter((r) => r.bucket === b.key).length]));
  const [bucket, setBucket] = useState<OpportunityBucket | 'all'>(() => (rows.some((r) => r.bucket === 'review') ? 'review' : 'all'));
  const list = rows.filter((r) => bucket === 'all' || r.bucket === bucket).sort((a, b) => Number(b.inLastUpload) - Number(a.inLastUpload) || a.mrn.localeCompare(b.mrn));
  const manager = role === 'manager';
  const ready80 = rows.filter((r) => r.bucket === 'review' && r.confidence >= 80).length;

  return (
    <Card
      title="Opportunity matrix"
      actions={
        <button
          className="btn"
          disabled={!manager || !ready80}
          title="Approve every row awaiting review with a confidence of 80 or more"
          onClick={async () => {
            const r = await act<number>('opsApproveAll', { minConfidence: 80 });
            if (r.ok) say(`${r.result} approved.`, 'ok');
          }}
        >
          Approve all ≥ 80 ({ready80})
        </button>
      }
    >
      <div className="tabs" role="tablist">
        {BUCKETS.map((b) => (
          <button key={b.key} className={`tab ${bucket === b.key ? 'on' : ''}`} onClick={() => setBucket(b.key)} role="tab" aria-selected={bucket === b.key}>
            {b.label}
            <span className="badge count">{counts[b.key]}</span>
          </button>
        ))}
      </div>
      {!list.length ? (
        <Empty>Nobody here.</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Payer</th>
              <th>Chronic conditions</th>
              <th>Determined program</th>
              <th className="right">Confidence</th>
              <th className="right">$/month</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <MatrixRow key={r.patientId} r={r} manager={manager} />
            ))}
          </tbody>
        </table>
      )}
      {!manager && <p className="hint">Switch to the Practice manager role to approve, hold or reject.</p>}
    </Card>
  );
}

function MatrixRow({ r, manager }: { r: OpportunityRow; manager: boolean }) {
  const { act } = useStore();
  const [program, setProgram] = useState<Program | null>(r.program);
  const allowed = r.options.filter((o) => !o.block);
  const chosen = r.options.find((o) => o.program === program);
  const decide = (decision: string) => act('opsDecide', { patientId: r.patientId, decision, program: decision === 'approved' ? program : null });
  const pending = r.bucket === 'review' || r.bucket === 'held';
  return (
    <tr>
      <td>
        <a href={`#/patient/${r.patientId}`}>{r.name}</a>
        <div className="muted small">
          {r.mrn} · {fmtDate(r.dob)} ({r.age}) · {r.sex}
        </div>
      </td>
      <td className="small">
        {r.insuranceName}
        <div className="muted">
          {r.payerLabel}
          {r.isQmb && <Badge tone="info">QMB</Badge>}
        </div>
      </td>
      <td className="small">
        <strong>{r.conditions}</strong> ·{' '}
        {r.codes.map((c, i) => (
          <span key={c.code} className={c.chronic ? 'mono' : 'mono muted'} title={c.chronic ? c.name : 'not a chronic condition in the matrix'}>
            {i ? ', ' : ''}
            {c.code}
          </span>
        ))}
      </td>
      <td>
        {pending && allowed.length > 1 && manager ? (
          <select className="input" value={program ?? ''} onChange={(e) => setProgram(e.target.value as Program)}>
            {allowed.map((o) => (
              <option key={o.program} value={o.program}>
                {o.tier} ({o.code})
              </option>
            ))}
          </select>
        ) : r.code ? (
          <>
            <strong>{r.tier}</strong> <span className="mono small">{r.code}</span>
          </>
        ) : (
          <span className="muted">—</span>
        )}
        {r.reason && <div className="muted small">{r.reason}</div>}
      </td>
      <td className="right">
        <ConfidenceBadge value={r.confidence} reasons={r.reasons} />
      </td>
      <td className="right mono">{money(pending && chosen ? chosen.fee : r.code ? r.monthly : null)}</td>
      <td className="nowrap">
        {pending ? (
          <div className="row gap tight">
            <button className="btn btn-small btn-primary" disabled={!manager} onClick={() => decide('approved')}>
              Approve
            </button>
            {r.bucket !== 'held' && (
              <button className="btn btn-small" disabled={!manager} onClick={() => decide('held')}>
                Hold
              </button>
            )}
            <button className="btn btn-small" disabled={!manager} onClick={() => decide('rejected')}>
              Reject
            </button>
          </div>
        ) : r.bucket === 'rejected' ? (
          <button className="btn btn-small" disabled={!manager} onClick={() => decide('reopen')}>
            Reopen
          </button>
        ) : (
          <>
            <StatusBadge status={r.status} />
            {r.decidedAt && <div className="muted small">decided {fmtDateTime(r.decidedAt)}</div>}
          </>
        )}
      </td>
    </tr>
  );
}

function LastUpload() {
  const { state } = useStore();
  const up = state.roster;
  if (!up) return null;
  const rejected = up.rows.filter((r) => !r.accepted);
  return (
    <Card
      title={`Last import: ${up.filename}`}
      actions={
        rejected.length ? (
          <a className="btn" href="/api/roster-errors.csv">
            Download error list
          </a>
        ) : null
      }
    >
      <p className="muted">
        {fmtDateTime(up.at)} by {up.by} · <strong>{up.accepted}</strong> accepted · <strong>{up.rejected}</strong> rejected
      </p>
      {rejected.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Row</th>
              <th>Patient ID</th>
              <th>Name</th>
              <th>Why it was rejected</th>
            </tr>
          </thead>
          <tbody>
            {rejected.map((r) => (
              <tr key={r.row}>
                <td>{r.row}</td>
                <td className="mono">{r.mrn || '—'}</td>
                <td>{r.name || '—'}</td>
                <td>{r.errors.join('; ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <details>
        <summary className="small">What happened to each accepted row</summary>
        <ul className="plain small">
          {up.rows
            .filter((r) => r.accepted)
            .map((r) => (
              <li key={r.row}>
                <span className="mono">{r.mrn}</span> {r.name}: {r.outcome}
              </li>
            ))}
        </ul>
      </details>
    </Card>
  );
}
