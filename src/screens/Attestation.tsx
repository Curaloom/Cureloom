import { fmtDateTime } from '../../shared/time';
import { useStore } from '../store';
import { Badge, Card, Empty, money } from '../ui';

export function Attestation() {
  const { state, role, act, say } = useStore();
  const month = state.clock.month;
  const byId = new Map(state.patients.map((p) => [p.id, p]));
  const urgent = state.patients.flatMap((p) => p.flags.filter((f) => f.level === 'urgent' && f.raised_at.startsWith(month)).map((f) => ({ p, f })));
  const escalations = state.patients.flatMap((p) => p.tasks.filter((t) => t.kind === 'physician' && t.status === 'open').map((t) => ({ p, t })));
  const pending = state.attestation.pending.map((id) => byId.get(id)!);
  const toBill = pending.filter((p) => p.billing.awaitingAttestation);
  const unfiled = state.monthEnd.total - state.monthEnd.filed;
  const physician = role === 'physician';

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Monthly attestation · {state.clock.monthLabel}</h1>
        <p className="muted">
          Signed by {state.staff.physician.name} after the nurse files the notes. Care plan approvals and escalations are on{' '}
          <a href="#/physician">Care plans & escalations</a>.
        </p>
      </div>
      <div className="grid2">
        <Card title={`Urgent flags this month (${urgent.length})`}>
          {!urgent.length ? (
            <Empty>None.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Flag</th>
                  <th>Raised · acknowledged · resolved</th>
                </tr>
              </thead>
              <tbody>
                {urgent.map(({ p, f }) => (
                  <tr key={f.id}>
                    <td>
                      <a href={`#/patient/${p.id}`}>{p.name}</a>
                    </td>
                    <td className="small">
                      {f.summary}
                      {f.note && <div className="muted">Resolution: {f.note}</div>}
                    </td>
                    <td className="small nowrap">
                      {fmtDateTime(f.raised_at)}
                      <br />
                      {f.acknowledged_at ? fmtDateTime(f.acknowledged_at) : <Badge tone="danger">not acknowledged</Badge>}
                      <br />
                      {f.resolved_at ? fmtDateTime(f.resolved_at) : <Badge tone="warn">open</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title={`Escalated to you (${escalations.length})`}>
          {!escalations.length ? (
            <Empty>Nothing waiting.</Empty>
          ) : (
            <ul className="tasks">
              {escalations.map(({ p, t }) => (
                <li key={t.id}>
                  <div>
                    <a href={`#/patient/${p.id}`}>{p.name}</a>: {t.title.replace('Physician review requested: ', '')}
                    <div className="muted small">{t.reason}</div>
                  </div>
                  <button className="btn btn-small" disabled={!physician} onClick={() => act('closeTask', { taskId: t.id, note: 'Reviewed by physician' })}>
                    Reviewed
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Notes and patients to bill">
        <p>
          Notes filed: <strong>{state.monthEnd.filed}</strong> of {state.monthEnd.total}.
          {unfiled > 0 && <span className="warn-text"> {unfiled} not filed yet; those patients are not covered by this signature.</span>}
        </p>
        {!pending.length ? (
          <Empty>No filed notes are waiting for your signature.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Program</th>
                <th>Code</th>
                <th className="right">Amount after signing</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a href={`#/month-end/${p.id}`}>{p.name}</a> <span className="muted small">{p.mrn}</span>
                  </td>
                  <td>{p.program?.toUpperCase()}</td>
                  <td className="mono">{p.billing.awaitingAttestation ? p.billing.lines.map((l) => (l.units > 1 ? `${l.code} ×${l.units}` : l.code)).join(' + ') : '—'}</td>
                  <td className="right">
                    {p.billing.awaitingAttestation ? money(p.billing.lines.reduce((s, l) => s + l.amount, 0)) : <span className="muted small">held: {p.billing.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small">{toBill.length} of these will be ready to bill once signed.</p>
      </Card>
      <Card title="Attestation">
        <blockquote className="attest">{state.attestation.text}</blockquote>
        <button
          className="btn btn-primary"
          disabled={!physician || !pending.length}
          onClick={async () => {
            const r = await act('signAttestation', { text: state.attestation.text });
            if (r.ok) say('Attestation signed.', 'ok');
          }}
        >
          Sign attestation
        </button>
        {!physician && <span className="hint"> Switch to the Physician role to sign.</span>}
        {state.attestation.records.map((r, i) => (
          <p key={i} className="muted small">
            Signed {fmtDateTime(r.signedAt)} by {r.by} for {r.patientIds.length} patient{r.patientIds.length === 1 ? '' : 's'}.
          </p>
        ))}
      </Card>
    </div>
  );
}
