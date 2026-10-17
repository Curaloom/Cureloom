import { useState } from 'react';
import type { PatientView, ReconciliationView } from '../../shared/api';
import { BILLING_CODES, CODE_LABEL, PLACEHOLDER_FEES, type BillingCode, type BillingSettings } from '../../shared/constants';
import { npiValid } from '../../shared/npi';
import { tierLabel } from '../../shared/program';
import { fmtDay, fmtDuration, fmtShort } from '../../shared/time';
import type { Program } from '../../shared/types';
import { useStore } from '../store';
import { Badge, BillingBadge, Card, Empty, Modal, money } from '../ui';

function linesText(lines: PatientView['billing']['lines']): string {
  return lines.map((l) => (l.units > 1 ? `${l.code} ×${l.units}` : l.code)).join(' + ');
}

export function Billing() {
  const { state } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const patients = state.patients;
  const ledger = patients.filter((p) => p.billing.lines.length > 0);
  const held = patients.filter((p) => p.billing.status === 'held' && !p.billing.lines.length);
  const notEnrolled = patients.filter((p) => p.billing.status === 'not_enrolled');
  const pf = state.preflight;
  const selected = patients.find((p) => p.id === open);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Billing reconciliation · {state.clock.monthLabel}</h1>
        <p className="muted">
          Recalculated after every change. A month is ready once the program rule is met, the care plan is approved, the note is filed in the EHR and the physician
          has attested. Click a patient for the micro-ledger.
        </p>
      </div>

      <div className="kpis">
        <div className="kpi primary">
          <div className="label">Ready to bill</div>
          <div className="value">{money(state.billing.readyTotal)}</div>
          <div className="sub">{state.billing.readyCount} patients</div>
        </div>
        <div className="kpi">
          <div className="label">Milestone met, paperwork left</div>
          <div className="value">{ledger.filter((p) => p.billing.status === 'held').length}</div>
          <div className="sub">note to file or attestation to sign</div>
        </div>
        <div className="kpi">
          <div className="label">Held</div>
          <div className="value">{held.length}</div>
          <div className="sub">program rule not met yet</div>
        </div>
        <div className="kpi">
          <div className="label">CMS-1500 file</div>
          <div className="value">{pf.open ? `${pf.lines} lines` : 'Closed'}</div>
          <div className="sub">{pf.open ? `${pf.clean} claims clean · ${pf.excluded} excluded` : `opens ${fmtDay(pf.dos)}, the date of service`}</div>
        </div>
      </div>

      <Dispatcher />

      <Card title={`Ledger queue: milestones met (${ledger.length})`}>
        {!ledger.length ? (
          <Empty>No patient has met the program rule yet this month.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Program</th>
                <th>Claim lines</th>
                <th className="right">Counted min</th>
                <th className="right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => setOpen(p.id)}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="muted small">{p.mrn}</div>
                  </td>
                  <td>
                    {tierLabel(p.billing.code)}
                    {p.billing.complexity === 'complex' && <Badge tone="info">complexity marked</Badge>}
                  </td>
                  <td className="lines">{linesText(p.billing.lines)}</td>
                  <td className="right mono">{p.billing.minutes}</td>
                  <td className="right mono">{money(p.billing.lines.reduce((s, l) => s + l.amount, 0))}</td>
                  <td>
                    <BillingBadge b={p.billing} />
                    {p.billing.reason && <div className="muted small">{p.billing.reason}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={`Held (${held.length}) and not enrolled (${notEnrolled.length})`}>
        <table className="table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Program</th>
              <th>Reason</th>
              <th className="right">Counted min</th>
            </tr>
          </thead>
          <tbody>
            {[...held, ...notEnrolled].map((p) => (
              <tr key={p.id} className={p.reconciliation ? 'clickable' : ''} onClick={() => p.reconciliation && setOpen(p.id)}>
                <td>
                  {p.name} <span className="muted small">{p.mrn}</span>
                </td>
                <td>{p.program?.toUpperCase() ?? '—'}</td>
                <td className="small">
                  <BillingBadge b={p.billing} /> {p.billing.reason}
                </td>
                <td className="right mono">{p.billing.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SettingsCard />

      {selected?.reconciliation && <ReconciliationModal p={selected} r={selected.reconciliation} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Dispatcher() {
  const { state } = useStore();
  const pf = state.preflight;
  return (
    <Card title="Billing dispatcher">
      <div className="row gap wrap">
        <a className={`btn btn-primary ${pf.open && pf.clean ? '' : 'disabled'}`} href={pf.open && pf.clean ? '/api/cms1500.csv' : undefined} aria-disabled={!pf.open || !pf.clean}>
          CMS-1500 CSV
        </a>
        <a className={`btn ${pf.open && pf.clean ? '' : 'disabled'}`} href={pf.open && pf.clean ? '/api/cms1500.xlsx' : undefined} aria-disabled={!pf.open || !pf.clean}>
          CMS-1500 XLSX
        </a>
        <a className={`btn ${pf.excluded ? '' : 'disabled'}`} href={pf.excluded ? '/api/cms1500-exceptions.csv' : undefined} aria-disabled={!pf.excluded}>
          Exceptions report
        </a>
        <a className="btn" href="/api/billing.csv">
          Billing list CSV
        </a>
      </div>
      <p className="muted small">
        Flat file with the 18 CMS-1500 (02/12) columns, one row per claim line, date of service {pf.dos.replace(/-/g, '')} (the last day of the month). Pre-flight
        checks every claim first: two distinct chronic conditions for CCM and APCM Level 2–3, date of service not in the future and inside the month, NPI check
        digits, field formats. Commas, semicolons, tabs and quotes are stripped from patient fields. A claim with any failing line is left out whole and listed in
        the exceptions report.
      </p>
      {!pf.open && (
        <p className="warn-text">
          The export opens on {fmtDay(pf.dos)}, the date of service. Move the demo clock there with “Go to date…”.
        </p>
      )}
      {pf.claims.length > 0 && (
        <table className="table compact">
          <thead>
            <tr>
              <th>Pre-flight</th>
              <th>Patient</th>
              <th>Codes</th>
              <th className="right">Charge</th>
              <th>Findings</th>
            </tr>
          </thead>
          <tbody>
            {pf.claims.map((c) => (
              <tr key={c.patientId}>
                <td>{c.errors.length ? <Badge tone="danger">Excluded</Badge> : <Badge tone="ok">Clean</Badge>}</td>
                <td>
                  {c.name} <span className="muted small">{c.mrn}</span>
                </td>
                <td className="lines">{c.codes.join(' + ')}</td>
                <td className="right mono">{money(c.total)}</td>
                <td className="small">
                  {c.errors.map((e) => (
                    <div key={e} className="danger-text">
                      {e}
                    </div>
                  ))}
                  {c.sanitized.map((e) => (
                    <div key={e} className="muted">
                      Sanitized {e}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ReconciliationModal({ p, r, onClose }: { p: PatientView; r: ReconciliationView; onClose: () => void }) {
  const t = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return (
    <Modal title={`Micro-ledger · ${p.name} (${p.mrn})`} onClose={onClose} wide>
      <div className="kpis">
        <div className="kpi">
          <div className="label">Nurse time</div>
          <div className="value">{t(r.nurseSeconds)}</div>
        </div>
        <div className="kpi">
          <div className="label">Physician escalation time</div>
          <div className="value">{t(r.physicianSeconds)}</div>
        </div>
        <div className="kpi primary">
          <div className="label">Total counted</div>
          <div className="value">{t(r.totalSeconds)}</div>
          <div className="sub">{r.countedMinutes} whole minutes for billing</div>
        </div>
        <div className="kpi">
          <div className="label">Claim</div>
          <div className="value lines">{r.lines.length ? linesText(r.lines) : '—'}</div>
          <div className="sub">
            {money(r.total)}
            {r.complexity === 'complex' ? ` · complexity marked by ${r.complexityBy}` : ''}
          </div>
        </div>
      </div>
      <h3>Counted time</h3>
      {!r.entries.length ? (
        <Empty>No counted time this month.</Empty>
      ) : (
        <table className="table compact">
          <tbody>
            {r.entries.map((e, i) => (
              <tr key={i}>
                <td className="small nowrap">{fmtShort(e.at)}</td>
                <td className="small">
                  {e.activity}
                  {e.outcome && <span className="muted"> · {e.outcome}</span>}
                </td>
                <td className="small">
                  {e.by} <Badge tone={e.role === 'physician' ? 'info' : 'neutral'}>{e.role}</Badge>
                </td>
                <td className="right mono small">{fmtDuration(e.seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {r.excluded.length > 0 && (
        <>
          <h3>Not counted</h3>
          <table className="table compact">
            <tbody>
              {r.excluded.map((e, i) => (
                <tr key={i}>
                  <td className="small nowrap">{fmtShort(e.at)}</td>
                  <td className="small">{e.what}</td>
                  <td className="small muted">{e.why}</td>
                  <td className="right mono small">{fmtDuration(e.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h3>Audit trail summary</h3>
      <p className="muted small">Compiled from the event log. The browser extension will add EHR page context here once it is built.</p>
      <pre className="audit">{r.audit}</pre>
    </Modal>
  );
}

function SettingsCard() {
  const { state, role, act, say } = useStore();
  const s = state.settings;
  const [draft, setDraft] = useState<BillingSettings>(s);
  const [vbp, setVbp] = useState(s.valueBasedPayers.join('\n'));
  const manager = role === 'manager';
  const set = <K extends keyof BillingSettings>(k: K, v: BillingSettings[K]) => setDraft({ ...draft, [k]: v });
  return (
    <Card
      title="Billing settings"
      actions={
        <button
          className="btn btn-primary"
          disabled={!manager}
          onClick={async () => {
            const r = await act('saveBillingSettings', { settings: { ...draft, valueBasedPayers: vbp.split('\n') } });
            if (r.ok) say('Billing settings saved.', 'ok');
          }}
        >
          Save settings
        </button>
      }
    >
      <div className="grid2">
        <div>
          <h3>Fee schedule</h3>
          <table className="table compact">
            <tbody>
              {BILLING_CODES.map((c: BillingCode) => (
                <tr key={c}>
                  <td className="mono">{c}</td>
                  <td className="small">
                    {CODE_LABEL[c]}
                    {PLACEHOLDER_FEES.includes(c) && <div className="muted">placeholder: verify against the CY2026 fee schedule</div>}
                  </td>
                  <td className="right">
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      style={{ width: 96 }}
                      value={draft.fees[c]}
                      disabled={!manager}
                      onChange={(e) => set('fees', { ...draft.fees, [c]: Number(e.target.value) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stack tight">
          <h3>Claim defaults</h3>
          {(['renderingNpi', 'billingNpi'] as const).map((k) => (
            <label key={k} className="lbl">
              {k === 'renderingNpi' ? 'Rendering provider NPI (box 24J)' : 'Billing provider NPI (box 33a)'}{' '}
              {npiValid(draft[k]) ? <Badge tone="ok">check digit OK</Badge> : <Badge tone="danger">fails check digit</Badge>}
              <input className="input" value={draft[k]} disabled={!manager} onChange={(e) => set(k, e.target.value.trim())} />
            </label>
          ))}
          <label className="lbl">
            Place of service (box 24B)
            <select className="input" value={draft.placeOfService} disabled={!manager} onChange={(e) => set('placeOfService', e.target.value as '11' | '12')}>
              <option value="11">11 Office</option>
              <option value="12">12 Home</option>
            </select>
          </label>
          <label className="lbl">
            Modifier 1 (optional, e.g. GQ)
            <input className="input" value={draft.modifier} maxLength={2} disabled={!manager} onChange={(e) => set('modifier', e.target.value.toUpperCase())} />
          </label>
          <label className="lbl">
            Program proposed for traditional Medicare, 2+ conditions, not QMB
            <select className="input" value={draft.twoPlusDefault} disabled={!manager} onChange={(e) => set('twoPlusDefault', e.target.value as Program)}>
              <option value="ccm">CCM (99490)</option>
              <option value="apcm">APCM Level 2 (G0557)</option>
            </select>
          </label>
          <label className="lbl">
            Participating value-based payers (one per line; APCM-eligible)
            <textarea className="input" rows={3} value={vbp} disabled={!manager} onChange={(e) => setVbp(e.target.value)} />
          </label>
        </div>
      </div>
      {!manager && <p className="hint">Switch to the Practice manager role to change settings.</p>}
    </Card>
  );
}
