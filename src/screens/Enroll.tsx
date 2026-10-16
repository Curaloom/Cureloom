import { useState } from 'react';
import type { EnrollBucket, PatientSummary } from '../../shared/api';
import { codeName } from '../../shared/codes';
import { fmtDate } from '../../shared/time';
import { useStore } from '../store';
import { Badge, Card, Empty, StatusBadge } from '../ui';
import { ConsentModal } from './ConsentModal';
import { SetupModal } from './SetupModal';

const SECTIONS: { bucket: EnrollBucket; title: string; help: string }[] = [
  { bucket: 'awaiting_confirmation', title: 'Flagged eligible — awaiting practice confirmation', help: 'The system flags 2+ qualifying codes, traditional Medicare, and a visit in the last 12 months. The practice confirms with a click.' },
  { bucket: 'needs_consent', title: 'Confirmed — no consent yet', help: 'Consent is usually taken at the office visit and arrives in the roster. Otherwise the nurse calls with the script on screen.' },
  { bucket: 'needs_setup', title: 'Consented — no call setup yet', help: 'Pick the readings to ask, the symptoms to watch, the last EHR care plan review date, and the program.' },
  { bucket: 'not_eligible', title: 'Not eligible', help: '' },
  { bucket: 'stopped', title: 'Paused or opted out', help: '' },
];

export function Enroll() {
  const { state, role, act } = useStore();
  const [consentFor, setConsentFor] = useState<number | null>(null);
  const [setupFor, setSetupFor] = useState<number | null>(null);
  const [practice, setPractice] = useState('');
  const by = (b: EnrollBucket) => state.patients.filter((p) => p.enrollBucket === b && (!practice || p.practiceCode === practice));

  function action(p: PatientSummary) {
    switch (p.enrollBucket) {
      case 'awaiting_confirmation':
        return role === 'manager' ? (
          <button className="btn btn-primary btn-small" onClick={() => act('confirmEligibility', { patientId: p.id })}>
            Confirm eligibility
          </button>
        ) : (
          <span className="hint">The ops lead confirms</span>
        );
      case 'needs_consent':
        return (
          <button className="btn btn-primary btn-small" disabled={role !== 'nurse'} onClick={() => setConsentFor(p.id)}>
            Open consent script
          </button>
        );
      case 'needs_setup':
        return (
          <button className="btn btn-primary btn-small" disabled={role !== 'nurse'} onClick={() => setSetupFor(p.id)}>
            Fill call setup
          </button>
        );
      default:
        return <span className="muted">{p.ineligible_reason ?? (p.status === 'opted_out' ? 'opted out' : '')}</span>;
    }
  }

  return (
    <div className="stack">
      <div className="page-head row between wrap">
        <div>
          <h1>Enroll</h1>
          <p className="muted">New patients move through confirmation, consent and call setup. Active patients are on the Today queue.</p>
        </div>
        <select className="input" value={practice} onChange={(e) => setPractice(e.target.value)} aria-label="Practice">
          <option value="">All practices</option>
          {state.practices.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {SECTIONS.map((s) => {
        const list = by(s.bucket);
        return (
          <Card key={s.bucket} title={`${s.title} (${list.length})`}>
            {s.help && <p className="muted small">{s.help}</p>}
            {!list.length ? (
              <Empty>Nobody here.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Conditions</th>
                    <th>Coverage</th>
                    <th>Last visit</th>
                    <th>{s.bucket === 'needs_setup' ? 'Consent' : 'Status'}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <a href={`#/patient/${p.id}`}>{p.name}</a>
                        <div className="muted small">
                          {p.mrn} · {p.age} · {p.practiceCode}
                        </div>
                      </td>
                      <td className="small" title={p.codes.map(codeName).join('; ')}>
                        {p.codes.join(', ') || '—'}
                      </td>
                      <td>
                        {p.coverage === 'traditional' ? 'Traditional' : 'Medicare Advantage'}
                        {p.is_qmb && <Badge tone="info">QMB</Badge>}
                      </td>
                      <td>{fmtDate(p.last_visit_date)}</td>
                      <td className="small">
                        {s.bucket === 'needs_setup' && p.consent ? (
                          <>
                            {p.consent.method === 'at_visit' ? 'At visit' : 'Nurse phone'}, {fmtDate(p.consent.consent_date)}
                            <div className="muted">Automated calls {p.consent.automated_calls_ok ? 'OK' : 'not OK'}</div>
                          </>
                        ) : (
                          <StatusBadge status={p.status} />
                        )}
                      </td>
                      <td className="right">{action(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        );
      })}
      {consentFor != null && <ConsentModal patientId={consentFor} onClose={() => setConsentFor(null)} />}
      {setupFor != null && <SetupModal patientId={setupFor} onClose={() => setSetupFor(null)} />}
    </div>
  );
}
