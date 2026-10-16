import { useEffect, useState } from 'react';
import { fmtDateTime } from '../../shared/time';
import { go } from '../router';
import { useStore } from '../store';
import { Badge, BillingBadge, Card, Empty } from '../ui';

export function MonthEnd({ selected }: { selected: number | null }) {
  const { state, role, act, say } = useStore();
  const list = state.patients.filter((p) => state.monthEnd.patientIds.includes(p.id));
  const p = list.find((x) => x.id === selected) ?? null;
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const nurse = role === 'nurse';

  useEffect(() => {
    if (!dirty) setText(p?.note?.text ?? '');
  }, [p?.id, p?.note?.text, dirty]);
  useEffect(() => setDirty(false), [p?.id]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      say('Note copied. Paste it into the EHR.', 'ok');
    } catch {
      say('Copy failed in this browser. Select the text and copy it by hand.');
    }
    if (p) act('noteCopied', { patientId: p.id });
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Month end · {state.clock.monthLabel}</h1>
        <p className="muted">
          The system drafts each note from logged activity. Read it, copy it into the EHR, and mark it filed. {state.monthEnd.filed} of {state.monthEnd.total} filed.
          {!state.clock.afterMonthEnd && ' (It is not month end yet; drafts update as work is logged.)'}
        </p>
      </div>
      <div className="monthend-grid">
        <Card title="Patients">
          <ul className="pick-list">
            {list.map((x) => (
              <li key={x.id}>
                <button className={`pick ${x.id === selected ? 'on' : ''}`} onClick={() => go(`/month-end/${x.id}`)}>
                  <span>
                    <strong>{x.name}</strong> <span className="muted small">{x.mrn} · {x.program?.toUpperCase()}</span>
                    <span className="small block">
                      {x.minutes} min · <BillingBadge b={x.billing} /> {x.billing.reason && <span className="muted">{x.billing.reason}</span>}
                    </span>
                  </span>
                  {x.note?.filedAt ? <Badge tone="ok">Filed</Badge> : x.note?.edited ? <Badge tone="info">Edited</Badge> : <Badge>Draft</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {!p || !p.note ? (
          <Card>
            <Empty>Pick a patient to see the draft note.</Empty>
          </Card>
        ) : (
          <Card
            title={`${p.name} · ${p.mrn}`}
            actions={
              <span className="row gap tight">
                <a className="btn btn-small" href={`#/patient/${p.id}`}>
                  Patient month
                </a>
              </span>
            }
          >
            <p className="muted small">
              {p.note.filedAt ? `Filed in EHR ${fmtDateTime(p.note.filedAt)}` : 'Not filed yet'}
              {p.note.attestedAt ? ` · attested ${fmtDateTime(p.note.attestedAt)}` : ''}
              {p.note.changedSinceFiled ? ' · new activity since filing: update the filed note' : ''}
            </p>
            <textarea
              className="note-edit"
              value={text}
              readOnly={!!p.note.filedAt && !p.note.changedSinceFiled}
              onChange={(e) => {
                setText(e.target.value);
                setDirty(true);
              }}
              spellCheck={false}
            />
            <div className="row gap tight wrap">
              <button className="btn" onClick={copy}>
                Copy note
              </button>
              {!p.note.filedAt && (
                <>
                  <button
                    className="btn"
                    disabled={!nurse || !dirty}
                    onClick={async () => {
                      const r = await act('saveNote', { patientId: p.id, text });
                      if (r.ok) setDirty(false);
                    }}
                  >
                    Save edits
                  </button>
                  <button
                    className="btn"
                    disabled={!nurse || (!p.note.edited && !dirty)}
                    onClick={async () => {
                      const r = await act('revertNote', { patientId: p.id });
                      if (r.ok) setDirty(false);
                    }}
                  >
                    Back to system draft
                  </button>
                </>
              )}
              <button
                className="btn btn-primary"
                disabled={!nurse || (!!p.note.filedAt && !p.note.changedSinceFiled && !dirty)}
                onClick={async () => {
                  const body = p.note!.changedSinceFiled && !dirty ? p.note!.draft : text;
                  const r = await act('fileNote', { patientId: p.id, text: body });
                  if (r.ok) {
                    setDirty(false);
                    const next = list.find((x) => !x.note?.filedAt && x.id !== p.id);
                    if (next) go(`/month-end/${next.id}`);
                  }
                }}
              >
                {p.note.filedAt ? 'Update filed note' : 'Mark filed in EHR'}
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
