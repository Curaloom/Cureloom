import { useEffect, useState } from 'react';
import type { EventRow } from '../../shared/model';
import { fmtDateTime } from '../../shared/time';
import { useStore } from '../store';
import { getEvents } from '../transport';
import { Badge, Card, Empty } from '../ui';

export function Outbox() {
  const { state } = useStore();
  const [rows, setRows] = useState<EventRow[]>([]);
  useEffect(() => {
    getEvents({ prefix: 'outbox.' })
      .then((r: EventRow[]) => setRows(r.reverse()))
      .catch(() => setRows([]));
  }, [state.counts.outbox]);
  const names = new Map(state.patients.map((p) => [p.id, p.name]));
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Outbox</h1>
        <p className="muted">Alerts and texts the system would send. Nothing is sent: no phone calls, no texts.</p>
      </div>
      <Card>
        {!rows.length ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Demo time</th>
                <th>Kind</th>
                <th>Patient</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap small">{fmtDateTime(e.at)}</td>
                  <td>{e.type === 'outbox.text' ? <Badge tone="info">Text</Badge> : <Badge tone="warn">Alert</Badge>}</td>
                  <td className="small">{e.patient_id != null ? <a href={`#/patient/${e.patient_id}`}>{names.get(e.patient_id)}</a> : '—'}</td>
                  <td className="small">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
