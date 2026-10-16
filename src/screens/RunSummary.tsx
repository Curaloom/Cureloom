import type { RunView } from '../../shared/api';
import { fmtDateTime } from '../../shared/time';
import { Badge, Empty } from '../ui';

export function RunSummary({ run }: { run: RunView }) {
  return (
    <div className="run">
      <p className="muted">
        {run.items.length} call{run.items.length === 1 ? '' : 's'} placed, in time order. Every connected call opens with the
        disclosure line; nothing was really dialled.
      </p>
      {run.notes.map((n) => (
        <p key={n} className="note-line">
          {n}
        </p>
      ))}
      {run.items.length ? (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Patient</th>
              <th>Outcome</th>
              <th>Flag</th>
              <th>What happened</th>
            </tr>
          </thead>
          <tbody>
            {run.items.map((i, k) => (
              <tr key={k}>
                <td className="nowrap">{fmtDateTime(i.at)}</td>
                <td>
                  <a href={`#/patient/${i.patientId}`}>{i.name}</a> <span className="muted">{i.mrn}</span>
                </td>
                <td>{i.outcome}</td>
                <td>
                  {i.flag === 'urgent' ? <Badge tone="danger">Urgent</Badge> : i.flag === 'concern' ? <Badge tone="warn">Concern</Badge> : '—'}
                </td>
                <td>
                  {i.detail}
                  {i.firstLine && <div className="first-line">AI: “{i.firstLine}”</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>No calls were placed.</Empty>
      )}
    </div>
  );
}
