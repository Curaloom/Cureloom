import { CODE_LABEL, FEES, type BillingCode } from '../../shared/constants';
import { useStore } from '../store';
import { BillingBadge, Card, CsvButton, money } from '../ui';

export function Billing() {
  const { state } = useStore();
  const rows = state.billing.rows;
  const groups = new Map<string, { label: string; order: number; mrns: string[]; amount: number }>();
  for (const r of rows) {
    const b = r.billing;
    const label =
      b.status === 'ready'
        ? `Ready, ${b.code} (${money(FEES[b.code as BillingCode])})`
        : b.status === 'held'
          ? `Held: ${(b.reason ?? '').replace(/ \(\d+\)$/, '')}`
          : 'Not enrolled';
    const order = b.status === 'ready' ? 0 : b.status === 'held' ? 1 : 2;
    const g = groups.get(label) ?? { label, order, mrns: [], amount: 0 };
    g.mrns.push(r.mrn);
    g.amount += b.amount ?? 0;
    groups.set(label, g);
  }
  const summary = [...groups.values()].sort((a, b) => a.order - b.order || b.amount - a.amount || a.label.localeCompare(b.label));
  return (
    <div className="stack">
      <div className="page-head row between">
        <div>
          <h1>Billing list · {state.clock.monthLabel}</h1>
          <p className="muted">Recalculated after every change. Ready needs the program rule met, the note filed in the EHR, and the physician's attestation.</p>
        </div>
        <CsvButton name="billing.csv" label="Download CSV" primary />
      </div>
      <Card title="Summary">
        <table className="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Patients</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((g) => (
              <tr key={g.label}>
                <td>{g.label}</td>
                <td className="mono">{g.mrns.join(', ')}</td>
                <td className="right">{g.order === 0 ? money(Math.round(g.amount * 100) / 100) : 'none'}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total ready</td>
              <td>
                {state.billing.readyCount} patient{state.billing.readyCount === 1 ? '' : 's'}
              </td>
              <td className="right">{money(state.billing.readyTotal)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
      <Card title="Every patient">
        <table className="table">
          <thead>
            <tr>
              <th>MRN</th>
              <th>Patient</th>
              <th>Program</th>
              <th>Code</th>
              <th className="right">Amount</th>
              <th>Status</th>
              <th>Reason</th>
              <th className="right">Counted min</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.patientId}>
                <td className="mono">{r.mrn}</td>
                <td>
                  <a href={`#/patient/${r.patientId}`}>{r.name}</a>
                </td>
                <td>{r.program?.toUpperCase() ?? '—'}</td>
                <td className="mono" title={r.billing.code ? CODE_LABEL[r.billing.code] : ''}>
                  {r.billing.code ?? '—'}
                </td>
                <td className="right">{money(r.billing.amount)}</td>
                <td>
                  <BillingBadge b={r.billing} />
                </td>
                <td className="small">{r.billing.reason ?? ''}</td>
                <td className="right mono">{r.billing.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
