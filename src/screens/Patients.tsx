import { useStore } from '../store';
import { BillingBadge, Card, StatusBadge } from '../ui';

export function Patients() {
  const { state } = useStore();
  return (
    <div className="stack">
      <div className="page-head">
        <h1>All patients</h1>
        <p className="muted">Everyone on the roster for {state.clock.monthLabel}.</p>
      </div>
      <Card>
        <table className="table">
          <thead>
            <tr>
              <th>MRN</th>
              <th>Patient</th>
              <th>Status</th>
              <th>Program</th>
              <th>Contact this month</th>
              <th className="right">Minutes</th>
              <th>Billing</th>
            </tr>
          </thead>
          <tbody>
            {state.patients.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.mrn}</td>
                <td>
                  <a href={`#/patient/${p.id}`}>{p.name}</a>
                  <div className="muted small">
                    {p.age} · {p.phone}
                  </div>
                </td>
                <td>
                  <StatusBadge status={p.status} />
                  {p.ineligible_reason && <div className="muted small">{p.ineligible_reason}</div>}
                </td>
                <td>{p.program?.toUpperCase() ?? '—'}</td>
                <td className="small">{p.status === 'active' || p.status === 'opted_out' ? p.brief.contact : '—'}</td>
                <td className="right mono">{p.minutes}</td>
                <td>
                  <BillingBadge b={p.billing} />
                  {p.billing.reason && <div className="muted small">{p.billing.reason}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
