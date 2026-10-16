import { useEffect, useMemo, useState } from 'react';
import type { BillingState, EligibilityRunView, PatientSummary } from '../../shared/api';
import { CODE_LABEL, FEES } from '../../shared/constants';
import { fmtDateTime } from '../../shared/time';
import { useStore } from '../store';
import { Badge, BarList, BillingBadge, Card, Empty, Kpi, money, num, usd } from '../ui';

/** The held reason without the per-patient detail, so like reasons group together. */
export function reasonKey(reason: string | null): string {
  return (reason ?? '').replace(/ \(\d+\)$/, '').replace(/: also enrolled at .*/, '').replace(/ for [A-Z][a-z]+ \d{4}$/, '');
}

/** What a held claim would have paid: the code's national rate. */
function heldValue(p: PatientSummary): number {
  return p.billing.code ? FEES[p.billing.code] : 0;
}

/** Held for something the team can still fix this month, as opposed to paused, opted out or not eligible. */
const FIXABLE = ['under 20 minutes', 'no completed contact', 'note not filed in EHR', 'awaiting physician attestation', 'coverage not verified', 'risk basis not documented', 'QMB not verified'];
function fixable(p: PatientSummary): boolean {
  return p.billing.status === 'held' && FIXABLE.some((f) => (p.billing.reason ?? '').startsWith(f));
}

const PAGE = 50;

export function Billing() {
  const { state, role, act } = useStore();
  const [practice, setPractice] = useState('');
  const [status, setStatus] = useState<BillingState | ''>('');
  const [reason, setReason] = useState('');
  const [q, setQ] = useState('');
  const [elig, setElig] = useState<EligibilityRunView | null>(null);
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [practice, status, reason, q]);
  const ops = state.ops;
  const enrolled = state.patients.filter((p) => p.billing.status !== 'not_enrolled');
  const held = enrolled.filter((p) => p.billing.status === 'held');
  const fixableHeld = held.filter(fixable);
  const fixableTotal = fixableHeld.reduce((a, p) => a + heldValue(p), 0);
  const awaiting = enrolled.filter((p) => p.billing.awaitingAttestation).length;
  const unverified = ops.integrity.coverageUnverified;
  const reasons = useMemo(() => [...new Set(held.map((p) => reasonKey(p.billing.reason)))].sort(), [held]);
  const rows = state.patients.filter(
    (p) =>
      (!practice || p.practiceCode === practice) &&
      (status ? p.billing.status === status : p.billing.status !== 'not_enrolled') &&
      (!reason || reasonKey(p.billing.reason) === reason) &&
      (!q || `${p.name} ${p.mrn}`.toLowerCase().includes(q.toLowerCase())),
  );
  const last = state.lastEligibility;

  return (
    <div className="stack">
      <div className="page-head row between wrap">
        <div>
          <h1>Billing pre-flight · {state.clock.monthLabel}</h1>
          <p className="muted">
            Every enrolled patient-month is checked before it goes to the practice's biller. Ready months pass every check; held months say exactly why. Recalculated after every
            change.
          </p>
        </div>
        <div className="row gap tight wrap">
          <a className="btn" href="/api/billing.csv">
            Pre-flight CSV
          </a>
          <a className="btn" href="/api/held.csv">
            Held CSV
          </a>
          <a className="btn btn-primary" href="/api/claims.csv">
            Claims-ready CSV
          </a>
        </div>
      </div>

      <div className="kpis kpis-4h">
        <Kpi hero label="Ready to bill" value={money(state.billing.readyTotal)} sub={`${num(state.billing.readyCount)} patient-months passed every check`} />
        <Kpi
          label="Held, each with a reason"
          value={num(held.length)}
          sub={`${num(fixableHeld.length)} still fixable this month (minutes, contact, note, signature, verification), worth ${usd(fixableTotal)}`}
        />
        <Kpi label="Awaiting physician signature" value={num(awaiting)} sub="Everything else in place" />
        <Kpi label="Caught before submission" value={money(ops.integrity.avoided)} sub="Claims that would have been denied or recouped" />
      </div>

      <div className="grid2">
        <Card
          title="Eligibility check"
          actions={
            <button
              className="btn btn-primary btn-small"
              disabled={role !== 'manager' || unverified === 0}
              title={role !== 'manager' ? 'The ops lead runs the eligibility check' : unverified === 0 ? 'Everyone is verified this month' : ''}
              onClick={async () => {
                const r = await act<EligibilityRunView>('runEligibilityCheck');
                if (r.ok && r.result) setElig(r.result);
              }}
            >
              Run eligibility check
            </button>
          }
        >
          <p className="small">
            Coverage can change mid-year: a patient who moved to Medicare Advantage can't be billed to traditional Medicare, and a patient who lost QMB status bills G0557, not G0558.
            The check runs a (simulated) eligibility query for every patient not yet verified this month.
          </p>
          {unverified > 0 ? (
            <p className="warn-text small">
              ✕ {num(unverified)} enrolled patient{unverified === 1 ? '' : 's'} not verified for {state.clock.monthLabel}: those claims are held.
            </p>
          ) : (
            <p className="small">✓ Every enrolled patient is verified for {state.clock.monthLabel}.</p>
          )}
          {(elig ?? last) && <EligibilityResult r={(elig ?? last)!} />}
        </Card>
        <Card title="Why claims are held">
          <BarList label="Held reason" unit="patients" rows={ops.billing.byReason.map((r) => ({ label: r.reason, value: r.count }))} empty="Nothing held." />
        </Card>
      </div>

      <Card title="Program-integrity checks">
        <table className="table">
          <thead>
            <tr>
              <th>Check</th>
              <th className="right">Patients</th>
              <th>What happens</th>
            </tr>
          </thead>
          <tbody>
            <IntegrityRow label="Moved to Medicare Advantage" n={ops.integrity.maSwitches} what="Paused and held: traditional Medicare would deny the claim." />
            <IntegrityRow label="QMB status ended" n={ops.integrity.qmbEnded} what="Billed as G0557 instead of G0558." />
            <IntegrityRow label="Enrolled at two client practices" n={ops.integrity.duplicates} what="The later enrollment is held: only one practitioner may bill per month." />
            <IntegrityRow
              label="Lower-acuity conditions only, risk basis not documented"
              n={ops.integrity.riskPending}
              what="Held until a clinician documents why the conditions put the patient at significant risk."
            />
            <IntegrityRow label="Risk basis documented" n={ops.integrity.riskDocumented} what="Billable; the note is in the audit packet." ok />
            <IntegrityRow label="Risk standard not met" n={ops.integrity.riskNotMet} what="Taken off the program by a clinician; not billed." />
            <IntegrityRow label="No nurse contact in 90 days (operator policy)" n={ops.integrity.touchOverdue} what="Warning only: a nurse touch is queued." warn />
          </tbody>
        </table>
      </Card>

      <Card title={`${num(rows.length)} patient-month${rows.length === 1 ? '' : 's'}`}>
        <div className="row gap tight wrap filters">
            <input className="input" placeholder="Search name or MRN" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
            <select className="input" value={practice} onChange={(e) => setPractice(e.target.value)} aria-label="Practice">
              <option value="">All practices</option>
              {state.practices.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as BillingState | '')} aria-label="Status">
              <option value="">Ready and held</option>
              <option value="ready">Ready</option>
              <option value="held">Held</option>
              <option value="not_enrolled">Not enrolled</option>
            </select>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Held reason">
              <option value="">Any reason</option>
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
        </div>
        {!rows.length ? (
          <Empty>No patients match.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Practice</th>
                <th>Patient</th>
                <th>Code</th>
                <th className="right">Amount</th>
                <th>Status</th>
                <th>Why held · warnings</th>
                <th className="right">Min</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((p) => {
                const fails = p.billing.checks.filter((c) => c.status === 'fail');
                const warns = p.billing.checks.filter((c) => c.status === 'warn');
                return (
                  <tr key={p.id}>
                    <td className="small" title={p.practiceName}>
                      {p.practiceCode}
                    </td>
                    <td>
                      <a href={`#/patient/${p.id}`}>{p.name}</a>
                      <div className="muted small">
                        {p.mrn} · {p.program?.toUpperCase() ?? '—'}
                      </div>
                    </td>
                    <td className="mono" title={p.billing.code ? CODE_LABEL[p.billing.code] : ''}>
                      {p.billing.code ?? '—'}
                    </td>
                    <td className="right tnum">{money(p.billing.amount)}</td>
                    <td>
                      <BillingBadge b={p.billing} />
                    </td>
                    <td className="small">
                      {p.billing.status === 'not_enrolled' ? (
                        <span className="muted">{p.billing.reason}</span>
                      ) : (
                        <>
                          {p.billing.reason && <div>{p.billing.reason}</div>}
                          {fails.length > 1 && <div className="muted">Also failing: {fails.slice(1).map((c) => c.label).join('; ')}</div>}
                          {warns.map((c) => (
                            <div key={c.key} className="muted">
                              ! {c.label}
                            </div>
                          ))}
                        </>
                      )}
                    </td>
                    <td className="right tnum">{p.billing.minutes}</td>
                    <td>
                      {p.billing.status !== 'not_enrolled' && (
                        <a className="btn btn-small" href={`#/audit/${p.id}`}>
                          Audit packet
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {rows.length > limit && (
          <div className="row gap tight">
            <button className="btn btn-small" onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, rows.length - limit)} more
            </button>
            <button className="btn btn-small" onClick={() => setLimit(rows.length)}>
              Show all {num(rows.length)}
            </button>
            <span className="muted small">
              Showing {num(limit)} of {num(rows.length)}
            </span>
          </div>
        )}
        <p className="hint">
          Amounts are 2026 national non-facility rates, before geographic adjustment and sequestration. The practice bills under its own NPI through its own biller; Cureloom
          prepares the claim lines and the evidence.
        </p>
      </Card>
    </div>
  );
}

function IntegrityRow({ label, n, what, ok, warn }: { label: string; n: number; what: string; ok?: boolean; warn?: boolean }) {
  return (
    <tr>
      <td>
        {n === 0 ? <Badge tone="ok">✓ None</Badge> : ok ? <Badge tone="ok">✓ {num(n)}</Badge> : warn ? <Badge tone="info">! {num(n)}</Badge> : <Badge tone="warn">‖ {num(n)}</Badge>} {label}
      </td>
      <td className="right tnum">{num(n)}</td>
      <td className="small muted">{what}</td>
    </tr>
  );
}

function EligibilityResult({ r }: { r: EligibilityRunView }) {
  const caught = [...r.maSwitches.map((x) => ({ ...x, what: 'now Medicare Advantage: paused, claim held' })), ...r.qmbEnded.map((x) => ({ ...x, what: 'QMB ended: G0558 → G0557' }))];
  return (
    <div className="elig">
      <p className="small">
        <strong>Last run {fmtDateTime(r.at)}</strong> by {r.by}: {num(r.checked)} checked, {num(r.verified)} verified unchanged.
      </p>
      {caught.length ? (
        <ul className="plain small">
          {caught.map((x) => (
            <li key={`${x.patientId}-${x.what}`}>
              <Badge tone="warn">Caught</Badge> <a href={`#/patient/${x.patientId}`}>{x.name}</a> ({x.mrn}, {x.practice}): {x.what} · {money(x.avoided)} not billed in error
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">No coverage changes found.</p>
      )}
    </div>
  );
}
