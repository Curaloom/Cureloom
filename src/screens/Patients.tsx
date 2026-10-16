import { useState } from 'react';
import type { PatientStatus } from '../../shared/types';
import { useStore } from '../store';
import { BillingBadge, Card, Empty, num, StatusBadge } from '../ui';

export function Patients() {
  const { state } = useStore();
  const [practice, setPractice] = useState('');
  const [status, setStatus] = useState<PatientStatus | ''>('');
  const [q, setQ] = useState('');
  const rows = state.patients.filter(
    (p) => (!practice || p.practiceCode === practice) && (!status || p.status === status) && (!q || `${p.name} ${p.mrn}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Patients</h1>
        <p className="muted">
          Everyone on the {state.practices.length} client practices' rosters for {state.clock.monthLabel}: {num(state.patients.length)} patients,{' '}
          {num(state.patients.filter((p) => p.status === 'active').length)} active.
        </p>
      </div>
      <Card
        title={`${num(rows.length)} shown`}
        actions={
          <div className="row gap tight wrap">
            <input className="input" placeholder="Search name or MRN" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
            <select className="input" value={practice} onChange={(e) => setPractice(e.target.value)} aria-label="Practice">
              <option value="">All practices</option>
              {state.practices.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as PatientStatus | '')} aria-label="Status">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="eligible_unconfirmed">Awaiting confirmation</option>
              <option value="confirmed">Confirmed, no consent</option>
              <option value="consented">Consented, no setup</option>
              <option value="paused">Paused</option>
              <option value="opted_out">Opted out</option>
              <option value="ineligible">Not eligible</option>
              <option value="needs_visit">Needs a visit</option>
            </select>
          </div>
        }
      >
        {!rows.length ? (
          <Empty>No patients match.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>MRN</th>
                <th>Patient</th>
                <th>Practice</th>
                <th>Status</th>
                <th>Program</th>
                <th>Contact this month</th>
                <th className="right">Minutes</th>
                <th>Billing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.mrn}</td>
                  <td>
                    <a href={`#/patient/${p.id}`}>{p.name}</a>
                    <div className="muted small">
                      {p.age} · {p.phone}
                    </div>
                  </td>
                  <td className="small">
                    {p.practiceName}
                    <div className="muted">{p.careManager}</div>
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                    {p.ineligible_reason && <div className="muted small">{p.ineligible_reason}</div>}
                  </td>
                  <td>{p.program?.toUpperCase() ?? '—'}</td>
                  <td className="small">{p.status === 'active' || p.status === 'opted_out' ? p.contact : '—'}</td>
                  <td className="right mono">{p.minutes}</td>
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
    </div>
  );
}
