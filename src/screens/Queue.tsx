import { useState } from 'react';
import type { QueueCategory, QueueLane, QueueRow } from '../../shared/api';
import { fmtDay, toIso } from '../../shared/time';
import { go } from '../router';
import { useDemoNowMs, useStore } from '../store';
import { Badge, Card, Countdown, Empty, num } from '../ui';

const TONE: Record<QueueCategory, string> = {
  urgent: 'danger',
  concern: 'warn',
  unreached: 'warn',
  ccm_due: 'info',
  touch_due: 'info',
  tasks: 'neutral',
  review: 'ok',
};

export function Queue() {
  const { state, role } = useStore();
  const nowMs = useDemoNowMs();
  const me = state.staff.nurse.name;
  const [who, setWho] = useState<string>(role === 'nurse' ? me : '');
  const [practice, setPractice] = useState('');
  const [showReview, setShowReview] = useState(false);
  const nurses = [...new Set(state.practices.map((p) => p.careManager))];
  const mine = state.queue.filter((r) => (!who || r.careManager === who) && (!practice || r.practiceCode === practice));
  const lane = (l: QueueLane) => mine.filter((r) => r.lane === l);
  const person = lane('person');
  const scheduled = lane('scheduled');
  const review = lane('review');
  return (
    <div className="stack">
      <div className="page-head row between wrap">
        <div>
          <h1>Today · {fmtDay(toIso(nowMs))}</h1>
          <p className="muted">
            {num(person.length)} patient{person.length === 1 ? '' : 's'} need a person today. {num(scheduled.length)} CCM monthly call{scheduled.length === 1 ? ' is' : 's are'} due.
            Everyone else's month is handled by the AI check-in.
          </p>
        </div>
        <div className="row gap tight wrap">
          <select className="input" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Care manager">
            {nurses.map((n) => (
              <option key={n} value={n}>
                {n === me ? `${n} (you)` : n}
              </option>
            ))}
            <option value="">All care managers</option>
          </select>
          <select className="input" value={practice} onChange={(e) => setPractice(e.target.value)} aria-label="Practice">
            <option value="">All practices</option>
            {state.practices
              .filter((p) => !who || p.careManager === who)
              .map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <Card title={`Needs a person (${person.length})`}>
        <p className="muted small">In order: urgent, concerns, not reached after 3 tries, 90-day nurse touches, open tasks (asked for a person, no AI call, opt-out to confirm).</p>
        <QueueTable rows={person} nowMs={nowMs} showWho={!who} empty="Nobody needs a person right now." />
      </Card>
      <Card title={`CCM monthly calls due (${scheduled.length})`}>
        <p className="muted small">CCM is billed on 20 minutes of clinical staff time, so these are nurse calls by design.</p>
        <QueueTable rows={scheduled} nowMs={nowMs} showWho={!who} empty="No CCM calls due today." />
      </Card>
      <Card
        title={`Spot-check AI check-ins (${review.length})`}
        actions={
          review.length > 0 && (
            <button className="btn btn-small" onClick={() => setShowReview((v) => !v)}>
              {showReview ? 'Hide' : 'Show'}
            </button>
          )
        }
      >
        <p className="muted small">Completed check-ins with no concerns. Optional: how many to spot-check is the operator's QA policy.</p>
        {showReview && <QueueTable rows={review} nowMs={nowMs} showWho={!who} empty="Nothing to review." />}
      </Card>
    </div>
  );
}

function QueueTable({ rows, nowMs, showWho, empty }: { rows: QueueRow[]; nowMs: number; showWho: boolean; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <table className="table queue">
      <thead>
        <tr>
          <th>Why</th>
          <th>Patient</th>
          <th>Practice</th>
          <th>Program</th>
          <th>Reason</th>
          <th className="right">Minutes this month</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
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
            <td className="small">
              {r.practiceName}
              {showWho && <div className="muted">{r.careManager}</div>}
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
  );
}
