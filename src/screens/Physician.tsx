import { useState } from 'react';
import type { CarePlanItem, EscalationItem } from '../../shared/api';
import { ACTIVITIES, CCM_MINUTES, COMPLEX_MINUTES } from '../../shared/constants';
import type { CarePlanContent } from '../../shared/model';
import { fmtDateTime } from '../../shared/time';
import { useServerRealMs, useStore } from '../store';
import { Badge, Card, Duration, Empty, StatusBadge } from '../ui';

export function Physician() {
  const { state } = useStore();
  const ph = state.physician;
  return (
    <div className="stack">
      <div className="page-head row between">
        <div>
          <h1>Care plans & escalations</h1>
          <p className="muted">
            Queue A: approve each patient's care plan before the program starts. Queue B: escalations from the nurse. Time spent in an escalation counts toward
            the patient's month.
          </p>
        </div>
        {ph.chain.ok ? (
          <Badge tone="ok">Signature chain verified · {ph.chain.approvals} approvals</Badge>
        ) : (
          <Badge tone="danger">
            Signature chain broken: {ph.chain.broken.map((b) => `${b.name} v${b.version}`).join(', ')}
          </Badge>
        )}
      </div>
      <Card title={`Queue A · Care plans awaiting approval (${ph.carePlans.length})`}>
        {!ph.carePlans.length ? <Empty>No care plans waiting.</Empty> : <div className="stack">{ph.carePlans.map((c) => <PlanCard key={c.plan.id} c={c} />)}</div>}
      </Card>
      <Card title={`Queue B · Escalations (${ph.escalations.length})`}>
        {!ph.escalations.length ? <Empty>Nothing escalated to you.</Empty> : <div className="stack">{ph.escalations.map((e) => <EscalationCard key={e.taskId} e={e} />)}</div>}
        {ph.closed.length > 0 && (
          <details>
            <summary className="small">{ph.closed.length} closed this month</summary>
            <ul className="plain small">
              {ph.closed.map((c) => (
                <li key={c.taskId}>
                  {fmtDateTime(c.closedAt)} · <a href={`#/patient/${c.patientId}`}>{c.name}</a>: {c.title}
                  {c.note && <span className="muted"> — {c.note}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
    </div>
  );
}

export function PlanDoc({ c }: { c: CarePlanContent }) {
  return (
    <div className="plan-doc">
      <h3>
        Program: {c.tier} {c.code && <span className="mono small">({c.code})</span>}
      </h3>
      <h3>Problems and goals</h3>
      <ul>
        {c.problems.map((p) => (
          <li key={p.code}>
            <strong>
              <span className="mono">{p.code}</span> {p.name}
            </strong>
            <div className="small muted">{p.goals.join('; ')}</div>
          </li>
        ))}
      </ul>
      <h3>Monitoring</h3>
      <ul className="small">
        <li>Readings: {c.monitoring.readings.join(', ') || 'none'}</li>
        {c.monitoring.targets.length > 0 && <li>Targets: {c.monitoring.targets.join('; ')}</li>}
        <li>Symptoms watched: {c.monitoring.symptoms.join('; ') || 'none'}</li>
      </ul>
      <h3>Contact and team</h3>
      <ul className="small">
        <li>{c.contact}</li>
        <li>Consent: {c.consent}</li>
        {c.caregiver && <li>Caregiver: {c.caregiver}</li>}
        <li>Team: {c.team.join('; ')}</li>
      </ul>
    </div>
  );
}

function PlanCard({ c }: { c: CarePlanItem }) {
  const { role, act, say } = useStore();
  const [note, setNote] = useState('');
  const [returning, setReturning] = useState(false);
  const physician = role === 'physician';
  const initiate = c.status === 'plan_review';
  return (
    <div className="card">
      <div className="row between">
        <div>
          <strong>
            <a href={`#/patient/${c.patientId}`}>{c.name}</a>
          </strong>{' '}
          <span className="muted small">{c.mrn}</span> <StatusBadge status={c.status} />
          <div className="muted small">
            Care plan v{c.plan.version} compiled {fmtDateTime(c.plan.created_at)} from the call setup by {c.plan.created_by}
            {c.previous ? ` · v${c.previous.version} stays in effect until you approve` : ''}
          </div>
        </div>
        <div className="row gap tight">
          <button className="btn btn-small" disabled={!physician} onClick={() => setReturning((v) => !v)}>
            Request changes
          </button>
          <button
            className="btn btn-small btn-primary"
            disabled={!physician}
            onClick={async () => {
              const r = await act('approveCarePlan', { planId: c.plan.id });
              if (r.ok) say(initiate ? `${c.name}: care plan approved, program started.` : `${c.name}: care plan v${c.plan.version} approved.`, 'ok');
            }}
          >
            {initiate ? 'Approve & Initiate Care Program' : `Approve v${c.plan.version}`}
          </button>
        </div>
      </div>
      {c.gaps.length > 0 && <p className="warn-text small">Check: {c.gaps.join('; ')}.</p>}
      <PlanDoc c={c.plan.content} />
      {returning && (
        <div className="row gap tight" style={{ marginTop: 8 }}>
          <input className="input grow" placeholder="What should change?" value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            className="btn btn-small"
            disabled={!physician || !note.trim()}
            onClick={async () => {
              const r = await act('returnCarePlan', { planId: c.plan.id, note });
              if (r.ok) setReturning(false);
            }}
          >
            Send back to the nurse
          </button>
        </div>
      )}
      {!physician && <p className="hint">Switch to the Physician role to approve.</p>}
      <p className="muted small">
        Approving records your NPI, the time and the version, with a SHA-256 signature hash chained to this patient's previous approval, so any later change is
        detectable.
      </p>
    </div>
  );
}

function EscalationCard({ e }: { e: EscalationItem }) {
  const { state, role, act } = useStore();
  const real = useServerRealMs();
  const t = state.physicianTimer;
  const mine = t && t.taskId === e.taskId;
  const physician = role === 'physician';
  const [outcome, setOutcome] = useState('');
  const [directive, setDirective] = useState('');
  const [complex, setComplex] = useState(e.complexity === 'complex');
  const secs = mine ? ((real - t!.startedRealMs) / 1000) * t!.speed : 0;
  const projected = e.minutes + Math.floor(secs / 60);
  return (
    <div className={`card ${mine ? 'timer-card on' : ''}`}>
      <div className="row between">
        <div>
          <strong>
            <a href={`#/patient/${e.patientId}`}>{e.name}</a>
          </strong>{' '}
          <span className="muted small">
            {e.mrn} · {e.program?.toUpperCase() ?? '—'} · {e.minutes} counted min this month
          </span>
          <div>{e.request}</div>
          <div className="muted small">
            {e.from} · {fmtDateTime(e.createdAt)} · billing: {e.billing}
          </div>
        </div>
        {mine ? (
          <div className="timer-big">
            <span className="dot" /> <Duration seconds={secs} />
          </div>
        ) : (
          <button className="btn btn-primary btn-small" disabled={!physician || !!t} onClick={() => act('openEscalation', { taskId: e.taskId })} title={t ? 'Close the open escalation first' : ''}>
            Open escalation
          </button>
        )}
      </div>
      {(e.flags.length > 0 || e.readings.length > 0) && (
        <ul className="plain small">
          {e.flags.map((f, i) => (
            <li key={i}>
              <Badge tone={f.level === 'urgent' ? 'danger' : 'warn'}>{f.level}</Badge> {f.summary} <span className="muted">({f.state})</span>
            </li>
          ))}
          {e.readings.map((r) => (
            <li key={r.label}>
              {r.label}: <span className="mono">{r.value}</span> <span className="muted">target {r.target}</span>{' '}
              {r.status !== 'in_range' && <Badge tone="warn">{r.status === 'above' ? 'above' : 'below'}</Badge>}
            </li>
          ))}
        </ul>
      )}
      {mine && (
        <div className="stack tight">
          <textarea className="input" rows={2} placeholder="Directive or order update for the nurse (optional)" value={directive} onChange={(ev) => setDirective(ev.target.value)} />
          {e.program === 'ccm' && (
            <label className="check">
              <input type="checkbox" checked={complex} onChange={(ev) => setComplex(ev.target.checked)} />
              Moderate or high complexity medical decision making this month (complex CCM: 99487 at {COMPLEX_MINUTES} min, then 99489 per 30 min)
            </label>
          )}
          {e.program === 'ccm' && complex && (
            <p className="muted small">
              With this review the month is at about {projected} counted minutes.{' '}
              {projected >= COMPLEX_MINUTES ? 'Complex CCM applies.' : projected >= CCM_MINUTES ? 'Below 60, the month stays standard CCM.' : ''}
            </p>
          )}
          <div className="row gap tight">
            <select className="input" value={outcome} onChange={(ev) => setOutcome(ev.target.value)}>
              <option value="">Outcome…</option>
              {ACTIVITIES.practitioner_review.outcomes.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              disabled={!physician || !outcome}
              onClick={() =>
                act('closeEscalation', {
                  taskId: e.taskId,
                  outcome,
                  directive,
                  // Only send the mark when the physician changed it.
                  complexity: e.program === 'ccm' && complex !== (e.complexity === 'complex') ? (complex ? 'complex' : 'standard') : undefined,
                })
              }
            >
              Close and log time
            </button>
            <button className="btn" disabled={!physician} onClick={() => act('discardPhysicianTimer')}>
              Discard timer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
