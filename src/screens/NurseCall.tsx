import { useEffect, useMemo, useRef, useState } from 'react';
import type { CallView, PatientView } from '../../shared/api';
import type { Task } from '../../shared/model';
import { nurseSteps } from '../../shared/nurseScript';
import { emptyAnswers } from '../../shared/parse';
import { assess, evaluateReading, levelOf, READINGS, RULES } from '../../shared/rules';
import { fmtDateTime, fmtDuration } from '../../shared/time';
import type { Answers, Finding, FlagLevel } from '../../shared/types';
import { usePatientByCall, useServerRealMs, useStore } from '../store';
import { Badge, Card, Duration, Empty, Loading } from '../ui';
import { Transcript } from './Transcript';

interface EndResult {
  call: CallView;
  tasks: Task[];
  findings: Finding[];
  level: FlagLevel;
  entry: { seconds: number; counts: boolean };
}

const PACE_MS = 300;

export function NurseCall({ callId }: { callId: number }) {
  const { state, role, act } = useStore();
  const real = useServerRealMs();
  const { p, missing } = usePatientByCall(callId);
  const call = p?.calls.find((c) => c.id === callId);
  const [result, setResult] = useState<EndResult | null>(null);
  const [who, setWho] = useState<'patient' | 'caregiver'>('patient');
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<'completed' | 'no_answer' | 'declined'>('completed');
  const [nurseNote, setNurseNote] = useState('');
  const [playing, setPlaying] = useState(false);
  const stopPlay = useRef(false);

  const setupKey = p?.setup ? JSON.stringify([p.setup.readings, p.setup.symptoms_to_watch]) : '';
  const steps = useMemo(
    () =>
      p && p.setup
        ? nurseSteps(
            {
              firstName: p.first_name,
              readings: p.setup.readings,
              symptoms: p.setup.symptoms_to_watch,
              nurse: p.careManager,
              practice: { phone: p.practice.phone, physician: p.practice.physician },
            },
            p.script ?? undefined,
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p?.id, setupKey, !!p?.script],
  );
  const transcript = call?.transcript ?? [];
  const answered = new Set(transcript.filter((l) => l.who !== 'nurse').map((l) => l.step));
  const asked = new Set(transcript.filter((l) => l.who === 'nurse').map((l) => l.step));
  const idx = Math.max(0, steps.findIndex((s) => !answered.has(s.key)));
  const current = steps[idx];
  const allDone = steps.length > 0 && steps.every((s) => answered.has(s.key));

  useEffect(() => () => void (stopPlay.current = true), []);

  if (missing) return <Empty>Call not found.</Empty>;
  if (!p) return <Loading />;
  if (!call) return <Empty>Call not found.</Empty>;

  if (result || call.status === 'done') {
    return <CallResult p={p} call={call} result={result} />;
  }
  const t = state.timer;
  const secs = t && t.callId === callId ? ((real - t.startedRealMs) / 1000) * t.speed : 0;
  const nurse = role === 'nurse';

  async function line(lineWho: 'nurse' | 'patient' | 'caregiver', lineText: string, step: string) {
    return act('addNurseCallLine', { callId, who: lineWho, text: lineText, step });
  }

  async function ask(i: number) {
    const s = steps[i];
    if (!asked.has(s.key)) await line('nurse', s.question, s.key);
  }

  async function reply(replyText: string) {
    if (!current) return;
    if (!asked.has(current.key)) await line('nurse', current.question, current.key);
    await line(who, replyText, current.key);
    setText('');
  }

  async function play() {
    setPlaying(true);
    stopPlay.current = false;
    const wait = () => new Promise((r) => setTimeout(r, PACE_MS));
    for (let i = idx; i < steps.length; i++) {
      if (stopPlay.current) break;
      const s = steps[i];
      if (!asked.has(s.key)) {
        const r = await line('nurse', s.question, s.key);
        if (!r.ok) break;
        await wait();
      }
      if (stopPlay.current) break;
      const r = await line(who, s.reply, s.key);
      if (!r.ok) break;
      await wait();
    }
    setPlaying(false);
  }

  async function end() {
    stopPlay.current = true;
    const r = await act<EndResult>('endNurseCall', { callId, outcome, answeredBy: who, nurseNote });
    if (r.ok && r.result) setResult(r.result);
  }

  return (
    <div className="stack">
      <div className="call-head">
        <div>
          <h1>
            Nurse call · {p.name} <span className="muted">· {p.mrn}</span>
          </h1>
          <div className="meta">
            <span>{p.phone}</span>
            {p.caregiver_name && (
              <span>
                Caregiver: {p.caregiver_name}, {p.patient.caregiver_phone}
              </span>
            )}
            <span>{p.program?.toUpperCase()}</span>
            <span>{p.practice.name}</span>
            <a href={`#/patient/${p.id}`}>Patient month</a>
          </div>
        </div>
        <div className="timer-inline big">
          <span className="dot" /> <Duration seconds={secs} />
          <span className="muted small">{t?.speed === 60 ? '1 s = 1 min' : 'real time'}</span>
        </div>
      </div>

      <div className="call-grid">
        <Card title="Script" className="script-card">
          <ol className="script-steps">
            {steps.map((s, i) => (
              <li key={s.key} className={`${answered.has(s.key) ? 'done' : ''} ${i === idx && !allDone ? 'current' : ''}`}>
                <button className="btn-link" disabled={!nurse || answered.has(s.key)} onClick={() => ask(i)} title="Ask this question">
                  <span className="step-label">{s.label}</span>
                  <span className="q">{s.question}</span>
                </button>
              </li>
            ))}
          </ol>
        </Card>

        <div className="stack">
          <Card title="Live transcript" actions={<span className="muted small">simulated · nothing is dialled</span>}>
            {transcript.length ? <Transcript lines={transcript} live /> : <Empty>Ask the first question, or press “Play script”.</Empty>}
          </Card>
          <Card title={current && !allDone ? `Patient's answer: ${current.label}` : 'Script finished'}>
            <div className="row gap tight wrap">
              {p.caregiver_name && (
                <div className="seg-group" role="group" aria-label="Who is speaking">
                  <button className={`seg ${who === 'patient' ? 'on' : ''}`} onClick={() => setWho('patient')}>
                    Patient
                  </button>
                  <button className={`seg ${who === 'caregiver' ? 'on' : ''}`} onClick={() => setWho('caregiver')}>
                    Caregiver
                  </button>
                </div>
              )}
              <button className="btn btn-primary" disabled={!nurse || playing || allDone} onClick={play}>
                {playing ? 'Playing…' : idx === 0 ? 'Play script' : 'Play the rest'}
              </button>
              {playing && (
                <button className="btn" onClick={() => (stopPlay.current = true)}>
                  Pause
                </button>
              )}
            </div>
            {current && !allDone && (
              <div className="replies">
                <button className={`reply ${current.scripted ? 'scripted' : ''}`} disabled={!nurse || playing} onClick={() => reply(current.reply)}>
                  {current.scripted && <span className="tag">October script</span>}“{current.reply}”
                </button>
                {current.reply !== 'No.' && current.key.startsWith('symptom:') && (
                  <button className="reply" disabled={!nurse || playing} onClick={() => reply('No.')}>
                    “No.”
                  </button>
                )}
                <form
                  className="row gap tight"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (text.trim()) reply(text.trim());
                  }}
                >
                  <input className="input grow" placeholder={`Type what the ${who} says…`} value={text} onChange={(e) => setText(e.target.value)} disabled={!nurse || playing} />
                  <button className="btn" disabled={!nurse || playing || !text.trim()}>
                    Add
                  </button>
                </form>
              </div>
            )}
          </Card>
          <Card title="End call">
            <div className="row gap tight wrap">
              <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
                <option value="completed">Completed — reached the {who}</option>
                <option value="no_answer">No answer</option>
                <option value="declined">Reached, but declined the call</option>
              </select>
              <input className="input grow" placeholder="Nurse note (optional), e.g. called 911, taken to ER" value={nurseNote} onChange={(e) => setNurseNote(e.target.value)} />
              <button className="btn btn-primary" disabled={!nurse} onClick={end}>
                End call
              </button>
            </div>
            <p className="hint">Only a completed call counts toward minutes. Unanswered attempts are logged with 0 counted minutes.</p>
          </Card>
        </div>

        <AnswerFields p={p} answers={call.answers ?? emptyAnswers()} />
      </div>
    </div>
  );
}

function AnswerFields({ p, answers: a }: { p: PatientView; answers: Answers }) {
  const setup = p.setup;
  const findings = setup ? assess(a, setup) : [];
  const level = levelOf(findings);
  return (
    <Card title="Answers" className="answers-card">
      <div className={`field-row ${a.meds ? 'filled' : ''}`}>
        <span className="k">Medications</span>
        <span className="v">{a.meds ? (a.meds.status === 'ok' ? 'Taking all as prescribed' : a.meds.detail) : '—'}</span>
      </div>
      {a.medChange && (
        <div className="field-row filled">
          <span className="k">Med change</span>
          <span className="v">{a.medChange}</span>
        </div>
      )}
      {setup?.symptoms_to_watch.map((r) => {
        const s = a.symptoms[r];
        return (
          <div key={r} className={`field-row ${s ? 'filled' : ''} ${s?.present ? 'hit' : ''}`}>
            <span className="k">{RULES[r].label}</span>
            <span className="v">{s ? (s.present ? `Yes${s.detail ? ` — ${s.detail}` : ''}` : 'No') : '—'}</span>
          </div>
        );
      })}
      <div className={`field-row ${a.erVisit ? 'filled' : ''} ${a.erVisit?.visited ? 'hit' : ''}`}>
        <span className="k">ER or hospital</span>
        <span className="v">{a.erVisit ? (a.erVisit.visited ? `Yes${a.erVisit.date ? `, ${a.erVisit.date}` : ''}` : 'No') : '—'}</span>
      </div>
      {setup?.readings.map((r) => {
        const res = evaluateReading(r, a, setup.targets);
        return (
          <div key={r} className={`field-row ${res ? 'filled' : ''} ${res && res.status !== 'in_range' ? 'hit' : ''}`}>
            <span className="k">{READINGS[r].label}</span>
            <span className="v">{res ? `${res.value} (target ${res.target})` : (a.readingNotes?.[r] ?? '—')}</span>
          </div>
        );
      })}
      <div className={`field-row ${a.requests.length ? 'filled' : ''}`}>
        <span className="k">Requests</span>
        <span className="v">{a.requests.length ? a.requests.map((r) => r.text).join('; ') : '—'}</span>
      </div>
      <div className="findings">
        {level === 'none' ? (
          <span className="muted small">No concerns so far.</span>
        ) : (
          <>
            <Badge tone={level === 'urgent' ? 'danger' : 'warn'}>{level}</Badge>
            <ul className="plain small">
              {findings
                .filter((f) => f.level !== 'info')
                .map((f, i) => (
                  <li key={i}>{f.text}</li>
                ))}
            </ul>
            {level === 'urgent' && <p className="danger-text small">Tell the patient to call 911 now (988 for thoughts of self-harm).</p>}
          </>
        )}
      </div>
    </Card>
  );
}

function CallResult({ p, call, result }: { p: PatientView; call: CallView; result: EndResult | null }) {
  const draft = p.note?.draft ?? '';
  const lines = draft.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`- ${fmtDateTime(call.started_at)} · Nurse call`));
  const section: string[] = [];
  if (start >= 0) {
    section.push(lines[start]);
    for (let i = start + 1; i < lines.length && lines[i].startsWith('    '); i++) section.push(lines[i]);
  }
  const tasks = result?.tasks ?? p.tasks.filter((t) => t.call_id === call.id);
  const entry = p.time.find((t) => t.call_id === call.id);
  return (
    <div className="stack">
      <div className="page-head">
        <h1>
          Call ended · {p.name} <span className="muted">· {p.mrn}</span>
        </h1>
        <p className="muted">
          {call.outcome?.replace('_', ' ')} · {entry ? fmtDuration(entry.seconds) : '—'} · {entry?.counts ? 'counted' : '0 counted minutes'}
        </p>
      </div>
      <div className="grid2">
        <Card title="Drafted note section">
          {section.length ? <pre className="note">{section.join('\n')}</pre> : <Empty>The note draft appears once the patient is in this month's notes.</Empty>}
        </Card>
        <Card title="Tasks this call created">
          {tasks.length ? (
            <ul className="tasks">
              {tasks.map((t) => (
                <li key={t.id}>
                  <div>
                    <strong>{t.title}</strong> <span className="muted small">due {t.due}</span>
                    <div className="muted small">{t.reason}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No tasks.</Empty>
          )}
          {call.flag !== 'none' && (
            <p>
              <Badge tone={call.flag === 'urgent' ? 'danger' : 'warn'}>{call.flag}</Badge> {call.summary}
            </p>
          )}
        </Card>
      </div>
      <div className="row gap">
        <a className="btn btn-primary" href={`#/patient/${p.id}`}>
          Back to {p.first_name}'s month
        </a>
        <a className="btn" href="#/queue">
          Today queue
        </a>
      </div>
      <Card title="Transcript">
        <Transcript lines={call.transcript} />
      </Card>
    </div>
  );
}
