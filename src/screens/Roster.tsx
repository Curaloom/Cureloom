import { useRef, useState } from 'react';
import { fmtDateTime } from '../../shared/time';
import { useStore } from '../store';
import { Badge, Card, Empty } from '../ui';

export function Roster() {
  const { state, role, act, say } = useStore();
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const up = state.roster;
  const canUpload = role === 'manager';

  async function upload(file: File) {
    const csv = await file.text();
    const r = await act('uploadRoster', { filename: file.name, csv });
    if (r.ok) say(`${file.name} uploaded.`, 'ok');
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Roster upload</h1>
        <p className="muted">The roster comes from the EHR as a CSV. Nothing connects to the EHR; every phone number must be a fictional 555-01XX number.</p>
      </div>
      <Card title="Upload the monthly roster">
        <div
          className={`dropzone ${drag ? 'drag' : ''} ${canUpload ? '' : 'disabled'}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f && canUpload) upload(f);
          }}
        >
          <p>
            <strong>Drop a roster CSV here</strong> or
          </p>
          <div className="row gap">
            <button className="btn" disabled={!canUpload} onClick={() => input.current?.click()}>
              Choose a file…
            </button>
            <button className="btn btn-primary" disabled={!canUpload} onClick={() => act('uploadSeedRoster').then((r) => r.ok && say('October roster uploaded.', 'ok'))}>
              Upload the October roster
            </button>
          </div>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = '';
            }}
          />
          {!canUpload && <p className="hint">Switch to the Practice manager role to upload.</p>}
          <p className="hint">
            Files: <a href="/api/seed/october-roster.csv">october-roster.csv</a> (the 15 seed patients) ·{' '}
            <a href="/api/seed/roster-with-errors.csv">roster-with-errors.csv</a> (shows rejected rows)
          </p>
        </div>
      </Card>
      <Card
        title={up ? `Last upload: ${up.filename}` : 'Last upload'}
        actions={
          up && up.rejected > 0 ? (
            <a className="btn" href="/api/roster-errors.csv">
              Download error list
            </a>
          ) : null
        }
      >
        {!up ? (
          <Empty>No roster uploaded yet this month.</Empty>
        ) : (
          <>
            <p className="muted">
              {fmtDateTime(up.at)} by {up.by} · <strong>{up.accepted}</strong> accepted · <strong>{up.rejected}</strong> rejected
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>MRN</th>
                  <th>Name</th>
                  <th>Result</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {up.rows.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td className="mono">{r.mrn || '—'}</td>
                    <td>{r.name || '—'}</td>
                    <td>{r.accepted ? <Badge tone="ok">Accepted</Badge> : <Badge tone="danger">Rejected</Badge>}</td>
                    <td>{r.accepted ? r.outcome : r.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}
