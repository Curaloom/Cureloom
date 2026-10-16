import { useState } from 'react';
import { ROLE_LABEL } from '../shared/constants';
import { addDays, dateOf, fmtDateTime, fmtDay, fmtTime, toIso } from '../shared/time';
import type { Role } from '../shared/types';
import { go, useRoute } from './router';
import { Attestation } from './screens/Attestation';
import { Billing } from './screens/Billing';
import { Enroll } from './screens/Enroll';
import { Events } from './screens/Events';
import { MonthEnd } from './screens/MonthEnd';
import { NurseCall } from './screens/NurseCall';
import { Outbox } from './screens/Outbox';
import { PatientMonth } from './screens/PatientMonth';
import { Patients } from './screens/Patients';
import { Queue } from './screens/Queue';
import { Roster } from './screens/Roster';
import { Simulator } from './screens/Simulator';
import { useDemoNowMs, useServerRealMs, useStore, useStoreMaybe, useTick } from './store';
import { ConfirmButton, Countdown, Duration, Modal } from './ui';
import { STANDALONE } from './transport';
import { RunSummary } from './screens/RunSummary';
import type { RunView } from '../shared/api';

const NAV: Record<Role, { to: string; label: string }[]> = {
  nurse: [
    { to: 'queue', label: 'Today queue' },
    { to: 'enroll', label: 'Enroll' },
    { to: 'patients', label: 'All patients' },
    { to: 'month-end', label: 'Month end' },
  ],
  physician: [
    { to: 'attestation', label: 'Attestation' },
    { to: 'patients', label: 'All patients' },
    { to: 'billing', label: 'Billing list' },
  ],
  manager: [
    { to: 'roster', label: 'Roster upload' },
    { to: 'enroll', label: 'Enroll' },
    { to: 'billing', label: 'Billing list' },
    { to: 'patients', label: 'All patients' },
  ],
};

const TESTER_NAV = [
  { to: 'simulator', label: 'AI call simulator' },
  { to: 'events', label: 'Audit trail' },
  { to: 'outbox', label: 'Outbox' },
];

const HOME: Record<Role, string> = { nurse: 'queue', physician: 'attestation', manager: 'roster' };

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
      body = <PatientMonth id={Number(rest[0])} />;
      break;
    case 'call':
      body = <NurseCall callId={Number(rest[0])} />;
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
      <nav className="nav">
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
              {n.to === 'outbox' && state.counts.outbox > 0 ? <span className="count">{state.counts.outbox}</span> : null}
            </a>
          ))}
        </div>
      </nav>
      <TimerPill hideFor={current === 'patient' ? Number(rest[0]) : current === 'call' ? -1 : null} />
      <main className="main">{body}</main>
      {toast && <div className={`toast toast-${toast.kind}`}>{toast.text}</div>}
    </div>
  );
}

function DemoBar() {
  const { state, role, setRole, act, busy, say } = useStore();
  const nowMs = useDemoNowMs();
  const now = toIso(nowMs);
  const [run, setRun] = useState<RunView | null>(null);
  const [pickDate, setPickDate] = useState(false);
  const c = state.clock;
  const nextDays = Array.from({ length: 31 }, (_, i) => addDays(dateOf(now), i + 1)).filter((d) => d <= '2026-10-31');

  return (
    <header className="demobar">
      <div className="brand">
        <span className="logo" aria-hidden>
          +
        </span>
        <div>
          <strong>Cureloom</strong>
          <small>
            Prototype · {state.practice.name}
            {STANDALONE ? ' · runs and saves in this browser' : ''}
          </small>
        </div>
      </div>
      <div className="demo-group" role="group" aria-label="Role">
        {(['nurse', 'physician', 'manager'] as Role[]).map((r) => (
          <button
            key={r}
            className={`seg ${role === r ? 'on' : ''}`}
            onClick={() => {
              setRole(r);
              go(`/${HOME[r]}`);
            }}
            title={state.staff[r].name}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      <div className="demo-group clock">
        <span className="clock-read" title="Demo date and time">
          {fmtDay(now)} 2026 · {fmtTime(now)}
        </span>
        <button className="btn-demo" disabled={busy} onClick={() => act('advanceDay')}>
          +1 day
        </button>
        <button className="btn-demo" disabled={busy} onClick={() => setPickDate((v) => !v)}>
          Go to date…
        </button>
        <button className="btn-demo" disabled={busy || c.afterMonthEnd} onClick={() => act('jumpToMonthEnd')}>
          Jump to month end
        </button>
        <label className="speed" title="While a timer runs, 1 real second records 1 minute">
          <input type="checkbox" checked={c.speed === 60} onChange={(e) => act('setSpeed', { speed: e.target.checked ? 60 : 1 })} />
          1 s = 1 min
        </label>
      </div>
      <div className="demo-group">
        <button
          className="btn-demo strong"
          disabled={busy}
          onClick={async () => {
            const r = await act<RunView>('runAiCalls');
            if (r.ok && r.result) setRun(r.result);
          }}
        >
          Run October AI calls
        </button>
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
        <ConfirmButton
          className="btn-demo"
          disabled={busy || !state.checkpoint.savedAt}
          title={state.checkpoint.demoAt ? `Saved at demo time ${fmtDateTime(state.checkpoint.demoAt)}` : 'No checkpoint yet'}
          confirmLabel="Click again: discard work since then"
          onConfirm={async () => {
            const r = await act('restoreCheckpoint');
            if (r.ok) say('Checkpoint restored.', 'ok');
          }}
        >
          Restore checkpoint
        </ConfirmButton>
        <ConfirmButton
          className="btn-demo danger"
          disabled={busy}
          confirmLabel="Click again to reset everything"
          onConfirm={async () => {
            const r = await act('reset');
            if (r.ok) {
              setRun(null);
              go(`/${HOME[role]}`);
              say('Reset to seed: Monday 5 Oct 2026.', 'ok');
            }
          }}
        >
          Reset to seed
        </ConfirmButton>
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
        <Modal title="October AI calls" onClose={() => setRun(null)} wide>
          <RunSummary run={run} />
        </Modal>
      )}
    </header>
  );
}

function AlertBanner() {
  const { state, role, act } = useStore();
  const nowMs = useDemoNowMs();
  if (!state.alerts.length) return null;
  return (
    <div className="alerts">
      {state.alerts.map((a) => (
        <div key={a.flagId} className={`alert ${a.acknowledgedAt ? 'alert-ack' : 'alert-urgent'}`} role="alert">
          <strong>URGENT</strong>
          <span>
            {a.name} ({a.mrn}) · {a.summary} · {a.escalation === '988' ? 'Told to call or text 988' : 'Told to call 911'}
          </span>
          {a.acknowledgedAt ? (
            <span className="alert-state">Acknowledged {fmtTime(a.acknowledgedAt)} — resolve when handled</span>
          ) : a.ackDueAt ? (
            <span className="alert-state">
              Acknowledge within 30 min: <Countdown dueMs={Date.parse(`${a.ackDueAt}Z`)} nowMs={nowMs} />
            </span>
          ) : null}
          <span className="alert-actions">
            {!a.acknowledgedAt &&
              (role === 'nurse' ? (
                <button className="btn btn-small btn-light" onClick={() => act('acknowledgeFlag', { flagId: a.flagId })}>
                  Acknowledge
                </button>
              ) : (
                <span className="muted-light">Nurse acknowledges</span>
              ))}
            <a className="btn btn-small btn-ghost-light" href={`#/patient/${a.patientId}`}>
              Open patient
            </a>
          </span>
        </div>
      ))}
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
    <a className="timer-pill" href={href}>
      <span className="dot" /> {t.activityLabel} · {t.patientName} · <Duration seconds={secs} />
    </a>
  );
}
