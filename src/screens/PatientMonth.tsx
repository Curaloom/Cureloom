import { useState } from 'react';
import type { CallView, PatientView, StepView } from '../../shared/api';
import { ACTIVITIES, type ActivityKey } from '../../shared/constants';
import type { Flag } from '../../shared/model';
import { fmtDate, fmtDateTime, fmtShort } from '../../shared/time';
import { go } from '../router';
import { useServerRealMs, useStore } from '../store';
import { Badge, Card, Duration, Empty, StatusBadge } from '../ui';
import { ConsentModal } from './ConsentModal';
import { SetupModal } from './SetupModal';
import { Transcript } from './Transcript';

const EHR: ActivityKey[] = ['ehr_chart_review', 'ehr_med_review', 'ehr_care_plan_review'];
const OTHER: ActivityKey[] = ['coordination', 'education', 'documentation'];

export function PatientMonth({ id }: { id: number }) {
  const { state, role, act } = useStore();
  const p = state.patients.find((x) => x.id === id);
  const [consent, setConsent] = useState(false);
  const [setup, setSetup] = useState(false);
  if (!p) return <Empty>No such patient.</Empty>;
  const nurse = role === 'nurse';
  const inCall = p.calls.find((c) => c.kind === 'nurse' && c.status === 'in_progress');

  async function startCall() {
    const r = await act<{ id: number }>('startNurseCall', { patientId: p!.id });
    if (r.ok && r.result) go(`/call/${r.result.id}`);
  }

  return (
    <div className="stack">
      <div className="patient-head">
        <div>
          <h1>
            {p.name} <span className="muted">· {p.mrn}</span>
          </h1>
          <div className="meta">
            <span>
              {p.age} · DOB {fmtDate(p.dob)}
            </span>
            <span>{p.phone}</span>
            <span>{p.coverage === 'traditional' ? 'Traditional Medicare' : 'Medicare Advantage'}{p.is_qmb ? ', QMB' : ''}</span>
            {p.caregiver_name && (
              <span>
                Caregiver: {p.caregiver_name}, {p.caregiver_phone}
              </span>
            )}
          </div>
          <div className="row gap tight">
            <StatusBadge status={p.status} />
            {p.program && <Badge tone="info">{p.program.toUpperCase()}</Badge>}
            {p.prefers_human && <Badge tone="neutral">Prefers a human</Badge>}
            {p.ineligible_reason && <span className="muted small">{p.ineligible_reason}</span>}
          </div>
        </div>
        <div className="head-actions">
          <label className="check" title="Patients who want a human always get a nurse call">
            <input type="checkbox" checked={p.prefers_human} disabled={!nurse} onChange={(e) => act('setPrefersHuman', { patientId: p.id, value: e.target.checked })} />
            Prefers a human
          </label>
          <a className="btn btn-small" href={`#/events?patient=${p.id}`}>
            Audit trail
          </a>
        </div>
      </div>

      <div className="patient-grid">
        <div className="stack">
          <Brief p={p} />
          <Card title="This month, step by step">
            <ol className="stepper">
              {p.steps.map((s) => (
                <Step key={s.key} s={s}>
                  {stepActions(s, p)}
                </Step>
              ))}
            </ol>
          </Card>
          <CallsCard p={p} />
        </div>
        <aside className="stack">
          <TimerCard p={p} />
          <MinutesCard p={p} />
          <TasksCard p={p} />
          <EscalateCard p={p} />
        </aside>
      </div>
      {consent && <ConsentModal patientId={p.id} onClose={() => setConsent(false)} />}
      {setup && <SetupModal patientId={p.id} onClose={() => setSetup(false)} />}
    </div>
  );

  function stepActions(s: StepView, p: PatientView) {
    const enrolled = p.status === 'active' || p.status === 'opted_out';
    switch (s.key) {
      case 'consent':
        return p.status === 'confirmed' ? (
          <button className="btn btn-small btn-primary" disabled={!nurse} onClick={() => setConsent(true)}>
            Open consent script
          </button>
        ) : null;
      case 'setup':
        return p.status === 'consented' || p.status === 'active' ? (
          <button className="btn btn-small" disabled={!nurse} onClick={() => setSetup(true)}>
            {p.setup ? 'Edit call setup' : 'Fill call setup'}
          </button>
        ) : null;
      case 'contact':
        if (!enrolled) return null;
        return (
          <div className="row gap tight">
            {inCall ? (
              <a className="btn btn-small btn-primary" href={`#/call/${inCall.id}`}>
                Return to call
              </a>
            ) : (
              <button className="btn btn-small btn-primary" disabled={!nurse} onClick={startCall}>
                Start nurse call
              </button>
            )}
            {p.calls
              .filter((c) => c.kind === 'ai' && c.status === 'done' && c.started_at?.startsWith(state.clock.month) && c.answered_by && !c.reviewed_at)
              .map((c) => (
                <button key={c.id} className="btn btn-small" disabled={!nurse} onClick={() => act('markCallReviewed', { callId: c.id })}>
                  Mark AI call {fmtShort(c.started_at)} reviewed
                </button>
              ))}
          </div>
        );
      case 'flags':
        return <FlagActions flags={p.flags.filter((f) => !f.resolved_at)} />;
      case 'chart':
      case 'meds':
      case 'plan': {
        const a = EHR[['chart', 'meds', 'plan'].indexOf(s.key)];
        return enrolled ? (
          <button className="btn btn-small" disabled={!nurse || !!state.timer} onClick={() => act('startActivity', { patientId: p.id, activity: a })}>
            Working in EHR
          </button>
        ) : null;
      }
      case 'tasks':
        return enrolled ? (
          <button className="btn btn-small" disabled={!nurse || !!state.timer} onClick={() => act('startActivity', { patientId: p.id, activity: 'coordination' })}>
            Start coordination timer
          </button>
        ) : null;
      case 'note':
        return (
          <a className="btn btn-small" href={`#/month-end/${p.id}`}>
            Month-end note
          </a>
        );
      default:
        return null;
    }
  }
}

function Step({ s, children }: { s: StepView; children: React.ReactNode }) {
  const icon = s.state === 'done' ? '✓' : s.state === 'attention' ? '!' : s.state === 'na' ? '–' : String(s.n);
  return (
    <li className={`step step-${s.state}`}>
      <span className="step-n" aria-hidden>
        {icon}
      </span>
      <div className="step-body">
        <div className="step-title">
          <strong>{s.label}</strong>
          <span className="step-detail">{s.detail}</span>
        </div>
        {children && <div className="step-actions">{children}</div>}
      </div>
    </li>
  );
}

function Brief({ p }: { p: PatientView }) {
  const b = p.brief;
  return (
    <Card title="One-minute brief" className="brief">
      <dl className="brief-list">
        <dt>Last month</dt>
        <dd>{b.lastMonth ?? 'No call last month.'}</dd>
        <dt>This month</dt>
        <dd>{b.contact}</dd>
        {p.program === 'apcm' && (
          <>
            <dt>AI call</dt>
            <dd>
              {b.aiCall.length ? (
                <ul className="plain">
                  {b.aiCall.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              ) : (
                'No AI call yet this month.'
              )}
            </dd>
          </>
        )}
        <dt>Readings</dt>
        <dd>
          {b.readings.length ? (
            <table className="table compact">
              <tbody>
                {b.readings.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td className="mono">{r.value}</td>
                    <td className="muted">target {r.target}</td>
                    <td>
                      {r.status === 'in_range' ? <Badge tone="ok">in range</Badge> : <Badge tone="warn">{r.status === 'above' ? 'above target' : 'below target'}</Badge>}
                    </td>
                    <td className="muted small">{r.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            'None reported yet this month.'
          )}
        </dd>
        <dt>Flags</dt>
        <dd>
          {b.flags.length ? (
            <ul className="plain">
              {b.flags.map((f) => (
                <li key={f.id}>
                  <Badge tone={f.level === 'urgent' ? 'danger' : 'warn'}>{f.level}</Badge> {f.summary} <span className="muted small">({f.state})</span>
                </li>
              ))}
            </ul>
          ) : (
            'None.'
          )}
        </dd>
        <dt>Open tasks</dt>
        <dd>
          {b.openTasks.length ? (
            <ul className="plain">
              {b.openTasks.map((t) => (
                <li key={t.id}>
                  {t.title} <span className="muted small">due {fmtShort(t.due)}</span>
                </li>
              ))}
            </ul>
          ) : (
            'None.'
          )}
        </dd>
      </dl>
    </Card>
  );
}

function FlagActions({ flags }: { flags: Flag[] }) {
  const { role, act } = useStore();
  const [notes, setNotes] = useState<Record<number, string>>({});
  if (!flags.length) return null;
  return (
    <div className="stack tight">
      {flags.map((f) => (
        <div key={f.id} className={`flag-box flag-${f.level}`}>
          <div>
            <Badge tone={f.level === 'urgent' ? 'danger' : 'warn'}>{f.level}</Badge> {f.summary}
            <div className="muted small">
              Raised {fmtDateTime(f.raised_at)}
              {f.acknowledged_at ? ` · acknowledged ${fmtDateTime(f.acknowledged_at)}` : ''}
            </div>
          </div>
          <div className="row gap tight">
            {!f.acknowledged_at && (
              <button className="btn btn-small" disabled={role !== 'nurse'} onClick={() => act('acknowledgeFlag', { flagId: f.id })}>
                Acknowledge
              </button>
            )}
            <input
              className="input grow"
              placeholder="How was it resolved? e.g. called 911, taken to ER"
              value={notes[f.id] ?? ''}
              onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })}
            />
            <button
              className="btn btn-small btn-primary"
              disabled={role !== 'nurse' || !(notes[f.id] ?? '').trim()}
              onClick={() => act('resolveFlag', { flagId: f.id, note: notes[f.id] })}
            >
              Resolve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CallsCard({ p }: { p: PatientView }) {
  const { state } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const month = state.clock.month;
  const calls = p.calls.filter((c) => (c.started_at ?? c.scheduled_for ?? '').startsWith(month));
  return (
    <Card title="Calls this month">
      {!calls.length ? (
        <Empty>No calls this month.</Empty>
      ) : (
        <ul className="calls">
          {calls.map((c: CallView) => (
            <li key={c.id}>
              <div className="row between">
                <span>
                  <Badge tone={c.kind === 'ai' ? 'info' : 'neutral'}>{c.kind === 'ai' ? 'AI' : 'Nurse'}</Badge> {c.summary}
                  {c.status === 'done' && c.seconds > 0 && <span className="muted small"> · <Duration seconds={c.seconds} /></span>}
                </span>
                {c.transcript.length > 0 && c.status === 'done' && (
                  <button className="btn-link" onClick={() => setOpen(open === c.id ? null : c.id)}>
                    {open === c.id ? 'Hide transcript' : 'Transcript'}
                  </button>
                )}
              </div>
              {open === c.id && <Transcript lines={c.transcript} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TimerCard({ p }: { p: PatientView }) {
  const { state, role, act } = useStore();
  const real = useServerRealMs();
  const [outcome, setOutcome] = useState('');
  const [ehr, setEhr] = useState<ActivityKey>('ehr_chart_review');
  const [other, setOther] = useState<ActivityKey>('coordination');
  const t = state.timer;
  const nurse = role === 'nurse';
  const enrolled = ['active', 'opted_out', 'paused', 'consented'].includes(p.status);

  if (t && t.patientId === p.id) {
    const secs = ((real - t.startedRealMs) / 1000) * t.speed;
    const isCall = t.activity === 'nurse_call' || t.activity === 'consent_call';
    const outcomes = ACTIVITIES[t.activity].outcomes;
    return (
      <Card title={ACTIVITIES[t.activity].ehr ? 'Working in EHR' : 'Timer running'} className="timer-card on">
        <div className="timer-big">
          <span className="dot" /> <Duration seconds={secs} />
        </div>
        <p className="muted">
          {t.activityLabel} · started {fmtDateTime(t.startedAt)}
          {t.speed === 60 ? ' · demo speed (1 s = 1 min)' : ''}
        </p>
        {isCall ? (
          t.callId ? (
            <a className="btn btn-primary" href={`#/call/${t.callId}`}>
              Go to the call
            </a>
          ) : (
            <a className="btn btn-primary" href="#/enroll">
              Go to the consent script
            </a>
          )
        ) : (
          <div className="stack tight">
            <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">Outcome…</option>
              {outcomes.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <div className="row gap tight">
              <button
                className="btn btn-primary grow"
                disabled={!outcome || !nurse}
                onClick={async () => {
                  const r = await act('stopActivity', { outcome });
                  if (r.ok) setOutcome('');
                }}
              >
                Stop and save
              </button>
              <button className="btn" disabled={!nurse} onClick={() => act('discardTimer')}>
                Discard
              </button>
            </div>
          </div>
        )}
      </Card>
    );
  }
  return (
    <Card title="Log work">
      {t ? (
        <p className="muted">
          A timer is running for {t.patientName} ({t.activityLabel}). Stop it first.
        </p>
      ) : !enrolled ? (
        <p className="muted">Time is logged once the patient is enrolled.</p>
      ) : (
        <div className="stack tight">
          <label className="label">Working in EHR</label>
          <div className="row gap tight">
            <select className="input grow" value={ehr} onChange={(e) => setEhr(e.target.value as ActivityKey)}>
              {EHR.map((a) => (
                <option key={a} value={a}>
                  {ACTIVITIES[a].label.replace('EHR ', '')}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!nurse} onClick={() => act('startActivity', { patientId: p.id, activity: ehr })}>
              Start
            </button>
          </div>
          <label className="label">Other work</label>
          <div className="row gap tight">
            <select className="input grow" value={other} onChange={(e) => setOther(e.target.value as ActivityKey)}>
              {OTHER.map((a) => (
                <option key={a} value={a}>
                  {ACTIVITIES[a].label}
                </option>
              ))}
            </select>
            <button className="btn" disabled={!nurse} onClick={() => act('startActivity', { patientId: p.id, activity: other })}>
              Start
            </button>
          </div>
          <p className="hint">Time is captured from timers in exact seconds. There is no manual minute entry.</p>
        </div>
      )}
    </Card>
  );
}

function MinutesCard({ p }: { p: PatientView }) {
  return (
    <Card title="Minutes this month">
      <div className="minutes">
        <span className="big">{p.minutes}</span>
        <span className="muted">counted min ({p.countedSeconds} s)</span>
        {p.meets20 && <Badge tone="ok">Meets 20 minutes</Badge>}
      </div>
      {p.time.length > 0 && (
        <table className="table compact">
          <tbody>
            {p.time.map((t) => (
              <tr key={t.id}>
                <td className="small">{fmtShort(t.started_at)}</td>
                <td className="small">
                  {ACTIVITIES[t.activity].label}
                  {t.outcome && <div className="muted">{t.outcome}</div>}
                </td>
                <td className="right small">
                  <Duration seconds={t.seconds} />
                  {!t.counts && <div className="muted">not counted</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {p.program === 'apcm' && (
        <p className="hint">AI call time is shown in the note but never counted.</p>
      )}
    </Card>
  );
}

function TasksCard({ p }: { p: PatientView }) {
  const { role, act } = useStore();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const open = p.tasks.filter((t) => t.status === 'open');
  const done = p.tasks.filter((t) => t.status === 'done');
  const nurse = role === 'nurse';
  return (
    <Card title={`Tasks (${open.length} open)`}>
      {open.length ? (
        <ul className="tasks">
          {open.map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.title}</strong> <span className="muted small">due {fmtShort(t.due)}</span>
                <div className="muted small">{t.reason}</div>
              </div>
              <div className="row gap tight">
                {t.kind === 'call' && (
                  <button
                    className="btn btn-small btn-primary"
                    disabled={!nurse}
                    onClick={async () => {
                      const r = await act<{ id: number }>('startNurseCall', { patientId: p.id });
                      if (r.ok && r.result) go(`/call/${r.result.id}`);
                    }}
                  >
                    Call now
                  </button>
                )}
                <button className="btn btn-small" disabled={!(nurse || (role === 'physician' && t.kind === 'physician'))} onClick={() => act('closeTask', { taskId: t.id })}>
                  Close
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No open tasks.</Empty>
      )}
      {done.length > 0 && (
        <details className="done-tasks">
          <summary>{done.length} done</summary>
          <ul className="plain small">
            {done.map((t) => (
              <li key={t.id}>
                ✓ {t.title} <span className="muted">· {fmtShort(t.closed_at)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <form
        className="row gap tight add-task"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await act('addTask', { patientId: p.id, title, due });
          if (r.ok) {
            setTitle('');
            setDue('');
          }
        }}
      >
        <input className="input grow" placeholder="Add a task" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!nurse} />
        <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={!nurse} title="Due date (default next business day)" />
        <button className="btn btn-small" disabled={!nurse || !title.trim()}>
          Add
        </button>
      </form>
    </Card>
  );
}

function EscalateCard({ p }: { p: PatientView }) {
  const { role, act } = useStore();
  const [note, setNote] = useState('');
  if (!['active', 'opted_out'].includes(p.status)) return null;
  return (
    <Card title="Escalate to physician">
      <textarea className="input" rows={2} placeholder="What should Dr. Patel review?" value={note} onChange={(e) => setNote(e.target.value)} disabled={role !== 'nurse'} />
      <button
        className="btn btn-small"
        disabled={role !== 'nurse' || !note.trim()}
        onClick={async () => {
          const r = await act('escalate', { patientId: p.id, note });
          if (r.ok) setNote('');
        }}
      >
        Send to Dr. Patel
      </button>
    </Card>
  );
}
