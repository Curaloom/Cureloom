import { useState } from 'react';
import type { FastForwardView, RunView } from '../shared/api';
import { ROLE_LABEL } from '../shared/constants';
import { addDays, dateOf, fmtDateTime, fmtDay, fmtTime, toIso } from '../shared/time';
import type { Role } from '../shared/types';
import { go, useRoute } from './router';
import { Attestation } from './screens/Attestation';
import { AuditPacketPage } from './screens/AuditPacket';
import { Billing } from './screens/Billing';
import { Enroll } from './screens/Enroll';
import { Events } from './screens/Events';
import { MonthEnd } from './screens/MonthEnd';
import { NurseCall } from './screens/NurseCall';
import { Ops } from './screens/Ops';
import { Outbox } from './screens/Outbox';
import { PatientMonth } from './screens/PatientMonth';
import { Patients } from './screens/Patients';
import { Pilot } from './screens/Pilot';
import { Queue } from './screens/Queue';
import { Roi } from './screens/Roi';
import { Roster } from './screens/Roster';
import { RunSummary } from './screens/RunSummary';
import { Simulator } from './screens/Simulator';
import { useDemoNowMs, useServerRealMs, useStore, useStoreMaybe, useTick } from './store';
import { Countdown, Duration, Modal, num } from './ui';

const NAV: Record<Role, { to: string; label: string }[]> = {
  nurse: [
    { to: 'queue', label: 'Today queue' },
    { to: 'enroll', label: 'Enroll' },
    { to: 'patients', label: 'Patients' },
    { to: 'month-end', label: 'Month end' },
  ],
  physician: [
    { to: 'attestation', label: 'Attestation' },
    { to: 'patients', label: 'Patients' },
    { to: 'billing', label: 'Billing pre-flight' },
  ],
  manager: [
    { to: 'ops', label: 'Dashboard' },
    { to: 'billing', label: 'Billing pre-flight' },
    { to: 'roi', label: 'ROI' },
    { to: 'pilot', label: 'Pilot plan' },
    { to: 'roster', label: 'Roster' },
    { to: 'enroll', label: 'Enroll' },
    { to: 'patients', label: 'Patients' },
  ],
};

const TESTER_NAV = [
  { to: 'simulator', label: 'AI call simulator' },
  { to: 'events', label: 'Audit trail' },
  { to: 'outbox', label: 'Outbox' },
];

const HOME: Record<Role, string> = { nurse: 'queue', physician: 'attestation', manager: 'ops' };

export function App() {
  const store = useStoreMaybe();
  if (!store?.state) return <div className="loading">Loading the demo…</div>;
  return <Shell />;
}

function Shell() {
  const { state, role, toast } = useStore();
  const route = useRoute();
  const [screen, ...rest] = route.path;
  const current = screen ?? HOME[role];
  let body;
  switch (current) {
    case 'ops':
      body = <Ops />;
      break;
    case 'roi':
      body = <Roi />;
      break;
    case 'pilot':
      body = <Pilot />;
      break;
    case 'queue':
      body = <Queue />;
      break;
    case 'roster':
      body = <Roster />;
      break;
    case 'enroll':
      body = <Enroll />;
      break;
    case 'patients':
      body = <Patients />;
      break;
    case 'patient':
      body = <PatientMonth key={rest[0]} id={Number(rest[0])} />;
      break;
    case 'audit':
      body = <AuditPacketPage key={rest[0]} id={Number(rest[0])} />;
      break;
    case 'call':
      body = <NurseCall key={rest[0]} callId={Number(rest[0])} />;
      break;
    case 'simulator':
      body = <Simulator />;
      break;
    case 'month-end':
      body = <MonthEnd selected={rest[0] ? Number(rest[0]) : null} />;
      break;
    case 'attestation':
      body = <Attestation />;
      break;
    case 'billing':
      body = <Billing />;
      break;
    case 'events':
      body = <Events patientId={route.query.get('patient') ? Number(route.query.get('patient')) : null} />;
      break;
    case 'outbox':
      body = <Outbox />;
      break;
    default:
      body = <p className="empty">Unknown screen.</p>;
  }
  return (
    <div className="app">
      <DemoBar />
      <AlertBanner />
      <nav className="nav no-print">
        <div className="nav-main">
          {NAV[role].map((n) => (
            <a key={n.to} href={`#/${n.to}`} className={current === n.to ? 'active' : ''}>
              {n.label}
            </a>
          ))}
        </div>
        <div className="nav-tester">
          <span className="nav-label">Tester</span>
          {TESTER_NAV.map((n) => (
            <a key={n.to} href={`#/${n.to}`} className={current === n.to ? 'active' : ''}>
              {n.label}
              {n.to === 'outbox' && state.counts.outbox > 0 ? <span className="count">{num(state.counts.outbox)}</span> : null}
            </a>
          ))}
        </div>
      </nav>
      <TimerPill hideFor={current === 'patient' ? Number(rest[0]) : current === 'call' ? -1 : null} />
      <main className="main">{body}</main>
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}

function DemoBar() {
  const { state, role, setRole, act, busy, say } = useStore();
  const nowMs = useDemoNowMs();
  const now = toIso(nowMs);
  const [run, setRun] = useState<RunView | null>(null);
  const [ff, setFf] = useState<FastForwardView | null>(null);
  const [pickDate, setPickDate] = useState(false);
  const c = state.clock;
  const nextDays = Array.from({ length: 31 }, (_, i) => addDays(dateOf(now), i + 1)).filter((d) => d <= '2026-10-31');
  const aiLabel = state.aiScheduled === 0 ? 'AI check-ins done' : state.lastRun ? 'Run remaining AI check-ins' : 'Run October AI check-ins';
  const liveUnacked = state.alerts.filter((a) => a.live && !a.acknowledgedAt);

  return (
    <header className="demobar no-print">
      <div className="brand">
        <span className="logo" aria-hidden>
          +
        </span>
        <div>
          <strong>Cureloom</strong>
          <small>
            for {state.operator} · {state.practices.length} client practices
          </small>
        </div>
      </div>
      <span className="synthetic-pill" title="Every practice, patient and phone number is fictional. No call is dialled and no text is sent.">
        Synthetic data · nothing is dialled
      </span>
      <div className="demo-group" role="group" aria-label="Role">
        {(['manager', 'nurse', 'physician'] as Role[]).map((r) => (
          <button
            key={r}
            className={`seg ${role === r ? 'on' : ''}`}
            onClick={() => {
              setRole(r);
              go(`/${HOME[r]}`);
            }}
            title={`${state.staff[r].name}, ${state.staff[r].title}`}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      <div className="demo-group clock">
        <span className="clock-read" title="Demo date and time">
          {fmtDay(now)} 2026 · {fmtTime(now)}
        </span>
        <button className="btn-demo" disabled={busy || c.afterMonthEnd} onClick={() => act('advanceDay')}>
          +1 day
        </button>
      </div>
      <div className="demo-group">
        <button
          className="btn-demo strong"
          disabled={busy || state.fastForwarded || state.aiScheduled === 0}
          title="Place every scheduled AI check-in for October, across all practices, in time order"
          onClick={async () => {
            const r = await act<RunView>('runAiCalls');
            if (r.ok && r.result) setRun(r.result);
          }}
        >
          {aiLabel}
        </button>
        <button
          className="btn-demo strong"
          disabled={busy || state.fastForwarded}
          title="The simulated care team works the rest of October at the four simulated practices, then closes the month. Westfield stays in your hands."
          onClick={async () => {
            const warn = liveUnacked.length
              ? `\n\n${liveUnacked.map((a) => a.name).join(', ')}'s urgent alert at ${state.live.name} is not acknowledged yet. Fast-forwarding moves the clock to month end, so it will show as overdue. Cancel, switch to the Nurse role and acknowledge it first if you want the SLA met.`
              : '';
            if (!window.confirm(`Fast-forward October? The simulated care team works the month at the four simulated practices and closes it. ${state.live.name} is left for you to drive by hand.${warn}`)) return;
            const r = await act<FastForwardView>('fastForwardMonth');
            if (r.ok && r.result) setFf(r.result);
          }}
        >
          Fast-forward October
        </button>
        <details className="demo-menu">
          <summary className="btn-demo">More</summary>
          <div className="demo-menu-body">
            <button className="btn-demo" disabled={busy || c.afterMonthEnd} onClick={() => setPickDate(true)}>
              Go to date…
            </button>
            <button className="btn-demo" disabled={busy || c.afterMonthEnd} onClick={() => act('jumpToMonthEnd')}>
              Jump to month end
            </button>
            <label className="speed" title="While a timer runs, 1 real second records 1 minute">
              <input type="checkbox" checked={c.speed === 60} onChange={(e) => act('setSpeed', { speed: e.target.checked ? 60 : 1 })} />1 s = 1 min
            </label>
            <button
              className="btn-demo"
              disabled={busy}
              title="Save the whole demo state so you can come back to it"
              onClick={async () => {
                const r = await act('saveCheckpoint');
                if (r.ok) say('Checkpoint saved.', 'ok');
              }}
            >
              Save checkpoint
            </button>
            <button
              className="btn-demo"
              disabled={busy || !state.checkpoint.savedAt}
              title={state.checkpoint.demoAt ? `Saved at demo time ${fmtDateTime(state.checkpoint.demoAt)}` : 'No checkpoint yet'}
              onClick={async () => {
                if (!window.confirm('Restore the saved checkpoint? Everything since then is discarded.')) return;
                const r = await act('restoreCheckpoint');
                if (r.ok) say('Checkpoint restored.', 'ok');
              }}
            >
              Restore checkpoint
            </button>
            <button
              className="btn-demo danger"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('Reset to seed? This clears everything done in the demo.')) return;
                const r = await act('reset');
                if (r.ok) {
                  setRun(null);
                  setFf(null);
                  go(`/${HOME[role]}`);
                  say('Reset to seed: Monday 5 Oct 2026.', 'ok');
                }
              }}
            >
              Reset to seed
            </button>
          </div>
        </details>
      </div>
      {pickDate && (
        <Modal title="Move the demo date forward" onClose={() => setPickDate(false)}>
          <p className="muted">The demo clock only moves forward. Each new day starts at 09:00.</p>
          <div className="date-grid">
            {nextDays.map((d) => (
              <button
                key={d}
                className="btn"
                onClick={async () => {
                  const r = await act('setDate', { date: d });
                  if (r.ok) setPickDate(false);
                }}
              >
                {fmtDay(d)}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {run && (
        <Modal title="October AI check-ins" onClose={() => setRun(null)} wide>
          <RunSummary run={run} />
        </Modal>
      )}
      {ff && (
        <Modal title="October, fast-forwarded" onClose={() => setFf(null)} wide>
          <FastForwardSummary ff={ff} onDone={() => setFf(null)} />
        </Modal>
      )}
    </header>
  );
}

function FastForwardSummary({ ff, onDone }: { ff: FastForwardView; onDone: () => void }) {
  const { state } = useStore();
  const items: [string, number][] = [
    ['Nurse calls (CCM monthly calls, exceptions, 90-day touches)', ff.nurseCalls],
    ['AI calls reviewed by a nurse', ff.reviews],
    ['Flags resolved', ff.flagsResolved],
    ['Tasks closed', ff.tasksClosed],
    ['Nurse minutes logged', ff.minutes],
    ['Risk bases documented', ff.riskReviewed],
    ['Patients paused: risk standard not met', ff.riskNotMet],
    ['Notes filed in the EHR', ff.filed],
    ['Notes attested by the physician', ff.attested],
  ];
  return (
    <div className="stack tight">
      <p className="muted">
        {ff.aiRun ? 'The remaining AI check-ins ran first; then the' : 'The'} simulated care team worked the rest of October at the four simulated practices and closed the month.{' '}
        {state.live.name} is untouched: drive it by hand as the nurse and physician.
      </p>
      <table className="table compact">
        <tbody>
          {items.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td className="right tnum">{num(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(ff.unfiled > 0 || ff.unattested > 0) && (
        <p className="warn-text small">
          Left open on purpose, as in a real month: {ff.unfiled} note{ff.unfiled === 1 ? '' : 's'} not filed and {ff.unattested} not attested. The billing pre-flight holds those claims.
        </p>
      )}
      <div className="row gap end">
        <a
          className="btn"
          href="#/billing"
          onClick={onDone}
        >
          Billing pre-flight
        </a>
        <a className="btn btn-primary" href="#/ops" onClick={onDone}>
          See {state.clock.monthLabel} on the dashboard
        </a>
      </div>
    </div>
  );
}

function AlertBanner() {
  const { state, role, act } = useStore();
  const nowMs = useDemoNowMs();
  if (!state.alerts.length) return null;
  const open = state.alerts.filter((a) => !a.acknowledgedAt);
  const acked = state.alerts.filter((a) => a.acknowledgedAt);
  return (
    <div className="alerts no-print">
      {open.map((a) => (
        <div key={a.flagId} className="alert alert-urgent" role="alert">
          <strong>URGENT</strong>
          <span>
            {a.name} ({a.mrn}, {a.practiceName}) · {a.summary} · {a.escalation === '988' ? 'Told to call or text 988' : 'Told to call 911'}; live transfer to the nurse requested
          </span>
          {a.ackDueAt && (
            <span className="alert-state">
              Acknowledge within 30 min: <Countdown dueMs={Date.parse(`${a.ackDueAt}Z`)} nowMs={nowMs} />
            </span>
          )}
          <span className="alert-actions">
            {role === 'nurse' ? (
              <button className="btn btn-small btn-light" onClick={() => act('acknowledgeFlag', { flagId: a.flagId })}>
                Acknowledge
              </button>
            ) : (
              <span className="muted-light">The nurse acknowledges</span>
            )}
            <a className="btn btn-small btn-ghost-light" href={`#/patient/${a.patientId}`}>
              Open patient
            </a>
          </span>
        </div>
      ))}
      {acked.length > 0 && (
        <div className="alert alert-ack">
          <strong>
            {acked.length} urgent escalation{acked.length === 1 ? '' : 's'} acknowledged, not yet resolved:
          </strong>
          <span className="alert-list">
            {acked.map((a, i) => (
              <span key={a.flagId}>
                {i > 0 && ' · '}
                <a href={`#/patient/${a.patientId}`}>
                  {a.name} ({a.practiceName})
                </a>{' '}
                acknowledged {fmtTime(a.acknowledgedAt)}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function TimerPill({ hideFor }: { hideFor: number | null }) {
  const { state } = useStore();
  const real = useServerRealMs();
  useTick(250);
  const t = state.timer;
  if (!t || hideFor === t.patientId || (hideFor === -1 && t.callId)) return null;
  const secs = Math.max(0, ((real - t.startedRealMs) / 1000) * t.speed);
  const href = t.callId && t.activity === 'nurse_call' ? `#/call/${t.callId}` : t.activity === 'consent_call' ? '#/enroll' : `#/patient/${t.patientId}`;
  return (
    <a className="timer-pill no-print" href={href}>
      <span className="dot" /> {t.activityLabel} · {t.patientName} · <Duration seconds={secs} />
    </a>
  );
}
