import { FEES, type BillingCode } from '../../shared/constants';
import { fmtDateTime } from '../../shared/time';
import { useStore } from '../store';
import { Badge, Card, Empty, money } from '../ui';

export function Attestation() {
  const { state, role, act, say } = useStore();
  const byId = new Map(state.patients.map((p) => [p.id, p]));
  const urgent = state.attestation.urgent;
  const escalations = state.attestation.escalations;
  const pending = state.attestation.pending.map((id) => byId.get(id)!);
  const toBill = pending.filter((p) => p.billing.awaitingAttestation);
  const mine = state.patients.filter((p) => p.practiceId === state.live.id && p.inMonthEnd);
  const filed = mine.filter((p) => p.note?.filedAt).length;
  const unfiled = mine.length - filed;
  const physician = role === 'physician';

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Monthly attestation · {state.clock.monthLabel}</h1>
        <p className="muted">
          {state.live.name}: signed by {state.live.physician}, the billing practitioner, after the care manager files the notes. Each client practice's physician signs for their own
          patients.
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
                {urgent.map((f, i) => (
                  <tr key={i}>
                    <td>
                      <a href={`#/patient/${f.patientId}`}>{f.name}</a>
                    </td>
                    <td className="small">
                      {f.summary}
                      {f.note && <div className="muted">Resolution: {f.note}</div>}
                    </td>
                    <td className="small nowrap">
                      {fmtDateTime(f.raisedAt)}
                      <br />
                      {f.acknowledgedAt ? fmtDateTime(f.acknowledgedAt) : <Badge tone="danger">✕ not acknowledged</Badge>}
                      <br />
                      {f.resolvedAt ? fmtDateTime(f.resolvedAt) : <Badge tone="warn">open</Badge>}
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
              {escalations.map((t) => (
                <li key={t.taskId}>
                  <div>
                    <a href={`#/patient/${t.patientId}`}>{t.name}</a>: {t.title.replace('Physician review requested: ', '')}
                    <div className="muted small">{t.reason}</div>
                  </div>
                  <button className="btn btn-small" disabled={!physician} onClick={() => act('closeTask', { taskId: t.taskId, note: 'Reviewed by physician' })}>
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
          Notes filed: <strong>{filed}</strong> of {mine.length}.
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
                  <td className="mono">{p.billing.awaitingAttestation ? p.billing.code : '—'}</td>
                  <td className="right">{p.billing.awaitingAttestation ? money(feeFor(p.billing.code)) : <span className="muted small">held: {p.billing.reason}</span>}</td>
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

function feeFor(code: BillingCode | null): number | null {
  return code ? FEES[code] : null;
}
