import { fmtDay, toIso } from '../../shared/time';
import { go } from '../router';
import { useDemoNowMs, useStore } from '../store';
import { Badge, Card, Countdown, Empty } from '../ui';

const TONE = { urgent: 'danger', concern: 'warn', unreached: 'warn', ccm_due: 'info', tasks: 'neutral', review: 'ok' } as const;

export function Queue() {
  const { state } = useStore();
  const nowMs = useDemoNowMs();
  const q = state.queue;
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Today · {fmtDay(toIso(nowMs))}</h1>
        <p className="muted">
          {q.length} patient{q.length === 1 ? '' : 's'} need you, in order: urgent, concern, not reached after 3 tries, CCM calls due, open tasks, quick reviews.
        </p>
      </div>
      <Card>
        {!q.length ? (
          <Empty>Nothing needs you right now.</Empty>
        ) : (
          <table className="table queue">
            <thead>
              <tr>
                <th>Why</th>
                <th>Patient</th>
                <th>Program</th>
                <th>Reason</th>
                <th className="right">Minutes this month</th>
              </tr>
            </thead>
            <tbody>
              {q.map((r) => (
                <tr key={r.patientId} className={`clickable row-${r.category}`} onClick={() => go(`/patient/${r.patientId}`)}>
                  <td>
                    <Badge tone={TONE[r.category]}>{r.categoryLabel}</Badge>
                  </td>
                  <td>
                    <a href={`#/patient/${r.patientId}`} onClick={(e) => e.stopPropagation()}>
                      {r.name}
                    </a>
                    <div className="muted small">{r.mrn}</div>
                  </td>
                  <td>{r.program}</td>
                  <td>
                    {r.reason}
                    {r.ackDueAt && (
                      <div className="small">
                        Acknowledge within 30 min: <Countdown dueMs={Date.parse(`${r.ackDueAt}Z`)} nowMs={nowMs} />
                      </div>
                    )}
                  </td>
                  <td className="right mono">{r.minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
