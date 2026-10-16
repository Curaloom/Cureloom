import { useState } from 'react';
import { shortPhysician } from '../../shared/constants';
import { usePatient, useServerRealMs, useStore } from '../store';
import { Duration, Modal } from '../ui';

export function ConsentModal({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const { state, act } = useStore();
  const real = useServerRealMs();
  const { p: view } = usePatient(patientId);
  const p = view ?? state.patients.find((x) => x.id === patientId)!;
  const practice = view?.practice ?? state.practices.find((x) => x.id === p.practiceId)!;
  const doc = shortPhysician(practice.physician);
  const t = state.timer;
  const running = t && t.patientId === patientId && t.activity === 'consent_call';
  const [x, setX] = useState({
    explainedAvailability: false,
    explainedCostSharing: false,
    explainedOnePractitioner: false,
    explainedRightToStop: false,
    automatedCallsOk: false,
    textsOk: false,
  });
  const four = x.explainedAvailability && x.explainedCostSharing && x.explainedOnePractitioner && x.explainedRightToStop;
  const tick = (k: keyof typeof x) => setX({ ...x, [k]: !x[k] });

  async function record(outcome: 'agreed' | 'declined' | 'call_back') {
    const r = await act('recordConsent', { patientId, outcome, ...x });
    if (r.ok) onClose();
  }

  const Item = ({ k, title, say }: { k: keyof typeof x; title: string; say: string }) => (
    <label className={`script-item ${x[k] ? 'ticked' : ''}`}>
      <input type="checkbox" checked={x[k]} onChange={() => tick(k)} />
      <span>
        <strong>{title}</strong>
        <span className="say">“{say}”</span>
      </span>
    </label>
  );

  return (
    <Modal title={`Consent call — ${p.name}`} onClose={onClose} wide>
      <div className="row between">
        <p className="muted">
          Call {p.phone}. Read the script; tick each item as you explain it. The consent call is logged but <strong>not counted</strong> toward care
          management time.
        </p>
        {running ? (
          <span className="timer-inline">
            <span className="dot" /> Consent call <Duration seconds={((real - t!.startedRealMs) / 1000) * t!.speed} />
          </span>
        ) : (
          <button className="btn btn-primary" disabled={!!t} onClick={() => act('startConsentCall', { patientId })}>
            Start consent call
          </button>
        )}
      </div>
      <div className="script">
        <p className="say">
          “Hi {p.first_name}, this is {p.careManager.replace(/, RN$/, '')}, a nurse with {practice.name}, {doc}'s office. {doc} would like to offer you our care management
          program: a monthly check-in on your health between visits, and help with medicines, appointments and follow-up.”
        </p>
        <Item k="explainedAvailability" title="1. Availability" say="You can reach the practice any time, day or night, through our after-hours line, and we check in with you every month." />
        <Item
          k="explainedCostSharing"
          title="2. Cost sharing"
          say="Medicare covers this service, but like other services a coinsurance or deductible may apply, usually about 20% of the monthly fee. Supplemental insurance may cover it."
        />
        <Item k="explainedOnePractitioner" title="3. One practitioner" say={`Only one practitioner can bill for this service each month, so ${doc}'s office will be the one providing it.`} />
        <Item k="explainedRightToStop" title="4. Right to stop" say="You can stop at any time by telling us. Stopping takes effect at the end of the month." />
        <Item
          k="automatedCallsOk"
          title="Automated calls (number, purpose, how to stop)"
          say={`Each month we may check in with an automated, recorded call from ${practice.phone}. It asks a few questions about your health. You can ask for a nurse at any time, or say "stop calling me" to end these calls. Is that OK?`}
        />
        <Item k="textsOk" title="Texts" say={`May we also send you text reminders at ${p.phone}? Reply STOP to end them.`} />
        <p className="say">“Do you agree to join?”</p>
      </div>
      <div className="row gap end">
        <button className="btn" onClick={() => record('call_back')} disabled={!running}>
          Call back later
        </button>
        <button className="btn" onClick={() => record('declined')} disabled={!running}>
          Patient declines
        </button>
        <button className="btn btn-primary" onClick={() => record('agreed')} disabled={!running || !four} title={!four ? 'Tick the four explained items first' : ''}>
          Patient agrees — record consent
        </button>
      </div>
    </Modal>
  );
}
