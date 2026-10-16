import { useState } from 'react';
import type { RunItem, RunView } from '../../shared/api';
import { fmtDateTime } from '../../shared/time';
import { Badge, Empty, Kpi, num, pct } from '../ui';

type Filter = 'exceptions' | 'all' | 'live';

/** Calls whose result needs a person: a flag, an opt-out, an ask for a nurse, or a third unanswered try. Earlier unanswered tries retry on their own. */
function needsPerson(i: RunItem): boolean {
  return i.flag !== 'none' || /Opted out|Asked for a person|Not reached after|Nurse call requested/.test(i.detail);
}

export function RunSummary({ run }: { run: RunView }) {
  const [filter, setFilter] = useState<Filter>('exceptions');
  const items = run.items;
  const patients = new Set(items.map((i) => i.patientId));
  const reached = new Set(items.filter((i) => i.outcome.startsWith('completed') || i.outcome.startsWith('escalated')).map((i) => i.patientId));
  const caregiver = items.filter((i) => i.outcome.includes('caregiver')).length;
  const urgent = items.filter((i) => i.flag === 'urgent').length;
  const concern = items.filter((i) => i.flag === 'concern').length;
  const exceptions = items.filter(needsPerson);
  const routed = new Set(exceptions.map((i) => i.patientId)).size;
  const retried = items.filter((i) => /Next try/.test(i.detail)).length;
  const shown = filter === 'all' ? items : filter === 'live' ? items.filter((i) => i.live) : exceptions;
  return (
    <div className="run stack tight">
      <div className="kpis kpis-4">
        <Kpi label="Calls placed" value={num(items.length)} sub={`${num(patients.size)} patients, up to 3 tries each`} />
        <Kpi label="Patients reached" value={pct(patients.size ? reached.size / patients.size : null)} sub={`${num(reached.size)} of ${num(patients.size)} · ${num(caregiver)} by a caregiver`} />
        <Kpi
          label="Routed to a nurse"
          value={num(routed)}
          sub={`${num(concern)} concerns, ${num(urgent)} urgent; the rest asked for a person, opted out or weren't reached in 3 tries`}
        />
        <Kpi label="Urgent" value={num(urgent)} sub="911 or 988 advised; live transfer to the nurse requested" tone={urgent ? 'danger' : undefined} />
      </div>
      <p className="muted small">
        Every connected call opens with the disclosure: automated, recorded, in the practice's name. {num(retried)} unanswered tries were retried automatically, 2 business days
        later. Nothing was really dialled: Westfield's calls follow their October script, and the simulated practices' answers are synthetic.
      </p>
      {run.notes.map((n) => (
        <p key={n} className="note-line">
          {n}
        </p>
      ))}
      <div className="seg-group light" role="group" aria-label="Which calls">
        {(
          [
            ['exceptions', `Needs a person (${routed})`],
            ['live', `Westfield only (${items.filter((i) => i.live).length})`],
            ['all', `All calls (${items.length})`],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button key={k} className={`seg ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>
      {shown.length ? (
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
            {shown.map((i, k) => (
              <tr key={k}>
                <td className="nowrap small">{fmtDateTime(i.at)}</td>
                <td>
                  <a href={`#/patient/${i.patientId}`}>{i.name}</a> <span className="muted small">{i.mrn}</span>
                  <div className="muted small">{i.practice}</div>
                </td>
                <td className="small">{i.outcome}</td>
                <td>{i.flag === 'urgent' ? <Badge tone="danger">Urgent</Badge> : i.flag === 'concern' ? <Badge tone="warn">Concern</Badge> : '—'}</td>
                <td className="small">
                  {i.detail}
                  {i.firstLine && filter !== 'all' && <div className="first-line">AI: “{i.firstLine}”</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>No calls here.</Empty>
      )}
    </div>
  );
}
