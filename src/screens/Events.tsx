import { useEffect, useState } from 'react';
import type { EventRow } from '../../shared/model';
import { fmtDateTime } from '../../shared/time';
import { go } from '../router';
import { useStore } from '../store';
import { Card, Empty } from '../ui';

export function Events({ patientId }: { patientId: number | null }) {
  const { state } = useStore();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [type, setType] = useState('');
  const count = state.counts.events;

  useEffect(() => {
    const q = patientId != null ? `?patientId=${patientId}` : '';
    fetch(`/api/events${q}`)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, [patientId, count]);

  const names = new Map(state.patients.map((p) => [p.id, `${p.name} (${p.mrn})`]));
  const types = [...new Set(rows.map((r) => r.type.split('.')[0]))].sort();
  const shown = rows.filter((r) => !type || r.type.startsWith(type));
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Audit trail</h1>
        <p className="muted">Every change writes an event, in the order it happened.</p>
      </div>
      <Card
        actions={
          <span className="row gap tight">
            <select className="input" value={patientId ?? ''} onChange={(e) => go(e.target.value ? `/events?patient=${e.target.value}` : '/events')}>
              <option value="">All patients and demo actions</option>
              {state.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.mrn})
                </option>
              ))}
            </select>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </span>
        }
        title={patientId != null ? names.get(patientId) : `${shown.length} events`}
      >
        {!shown.length ? (
          <Empty>No events.</Empty>
        ) : (
          <table className="table events">
            <thead>
              <tr>
                <th>#</th>
                <th>Demo time</th>
                <th>Actor</th>
                {patientId == null && <th>Patient</th>}
                <th>Type</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td className="muted small">{e.id}</td>
                  <td className="nowrap small">{fmtDateTime(e.at)}</td>
                  <td className="small">{e.actor}</td>
                  {patientId == null && <td className="small">{e.patient_id != null ? <a href={`#/events?patient=${e.patient_id}`}>{names.get(e.patient_id)}</a> : '—'}</td>}
                  <td className="mono small">{e.type}</td>
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
