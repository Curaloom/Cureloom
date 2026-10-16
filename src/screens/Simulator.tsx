import { useState } from 'react';
import type { RunItem } from '../../shared/api';
import { aiAnswer, aiPrompt, aiStart, type AiContext, type AiInput, type AiState } from '../../shared/aiCall';
import { toIso } from '../../shared/time';
import { useDemoNowMs, usePatient, useStore } from '../store';
import { Badge, Card, Empty } from '../ui';
import { RunSummary } from './RunSummary';
import { Transcript } from './Transcript';

export function Simulator() {
  const { state, act, busy } = useStore();
  const nowMs = useDemoNowMs();
  const [practice, setPractice] = useState(state.live.code);
  const apcm = state.patients.filter((p) => p.program === 'apcm' && (p.status === 'active' || p.status === 'opted_out') && (!practice || p.practiceCode === practice));
  const [pid, setPid] = useState<number | null>(null);
  const [inputs, setInputs] = useState<AiInput[]>([]);
  const [sim, setSim] = useState<AiState | null>(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<RunItem | null>(null);
  const { p } = usePatient(pid);

  const [ctx, setCtx] = useState<AiContext | null>(null);

  function start() {
    if (!p || !p.setup) return;
    const c: AiContext = {
      firstName: p.first_name,
      lastName: p.last_name,
      phone: p.phone,
      practice: { name: p.practice.name, phone: p.practice.phone, physician: p.practice.physician },
      nurse: p.careManager,
      caregiverName: p.caregiver_name,
      readings: p.setup.readings,
      symptoms: p.setup.symptoms_to_watch,
      callAt: toIso(nowMs),
    };
    setCtx(c);
    setSim(aiStart(c));
    setInputs([]);
    setSaved(null);
  }

  async function answer(input: AiInput) {
    if (!sim || !ctx || !p) return;
    const next = aiAnswer(sim, ctx, input);
    const all = [...inputs, input];
    setSim(next);
    setInputs(all);
    setText('');
    if (next.done) {
      const r = await act<RunItem>('simulateAiCall', { patientId: p.id, inputs: all });
      if (r.ok && r.result) setSaved(r.result);
    }
  }

  const prompt = sim && ctx ? aiPrompt(sim, ctx) : null;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>AI call simulator</h1>
        <p className="muted">
          You play the patient. The AI calls in the practice's name, only asks scripted questions, discloses that it is automated and recorded, and routes concerns to the
          care manager. An urgent answer gets a 911 (or 988) instruction, and the AI stays on the line while it requests a live transfer to the on-duty nurse. Nothing is
          dialled.
        </p>
      </div>
      <div className="grid2">
        <Card title="Play one patient's call">
          <div className="row gap tight wrap">
            <select
              className="input"
              value={practice}
              aria-label="Practice"
              onChange={(e) => {
                setPractice(e.target.value);
                setPid(null);
                setSim(null);
                setSaved(null);
              }}
            >
              {state.practices.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name}
                </option>
              ))}
            </select>
            <select
              className="input grow"
              value={pid ?? ''}
              onChange={(e) => {
                setPid(e.target.value ? Number(e.target.value) : null);
                setSim(null);
                setSaved(null);
              }}
            >
              <option value="">Pick an APCM patient…</option>
              {apcm.map((x) => (
                <option key={x.id} value={x.id} disabled={!x.ai.ok}>
                  {x.name} ({x.mrn}){x.ai.ok ? '' : ` — ${x.ai.reason}`}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!p || p.id !== pid || !p.ai.ok || busy || (sim !== null && !sim.done)} onClick={start}>
              {sim?.done ? 'Call again' : 'Start call'}
            </button>
          </div>
          {!sim ? (
            <Empty>Pick a patient and start the call.</Empty>
          ) : (
            <>
              <Transcript lines={sim.transcript} live />
              {prompt && (
                <div className="sim-answer">
                  <div className="row gap tight wrap">
                    {prompt.options.map((o) => (
                      <button key={o.id} className="btn" onClick={() => answer({ choice: o.id })} title={o.say ?? ''}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {prompt.textPlaceholder && (
                    <form
                      className="row gap tight"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (text.trim()) answer({ text: text.trim() });
                      }}
                    >
                      <input className="input grow" placeholder={prompt.textPlaceholder} value={text} onChange={(e) => setText(e.target.value)} />
                      <button className="btn">Say it</button>
                    </form>
                  )}
                </div>
              )}
              {sim.done && (
                <div className="sim-done">
                  <Badge tone={sim.outcome === 'escalated' ? 'danger' : sim.outcome === 'completed' ? 'ok' : 'warn'}>{sim.outcome?.replace('_', ' ')}</Badge>{' '}
                  {saved ? (
                    <span>
                      Saved. {saved.detail} <a href={`#/patient/${saved.patientId}`}>Open patient</a>
                    </span>
                  ) : (
                    <span className="muted">Saving…</span>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
        <Card
          title="Run October AI check-ins"
          actions={
            <button className="btn btn-primary" disabled={busy || state.fastForwarded} onClick={() => act('runAiCalls')}>
              Run October AI check-ins
            </button>
          }
        >
          <p className="muted small">
            Places every scheduled APCM check-in for October across all practices, in time order. Westfield's patients follow their scripted October answers; the simulated practices
            get synthetic answers from a fixed seed, so every run is the same. The demo clock moves to the last call.
          </p>
          {state.lastRun ? <RunSummary run={state.lastRun} /> : <Empty>Not run yet.</Empty>}
        </Card>
      </div>
    </div>
  );
}
