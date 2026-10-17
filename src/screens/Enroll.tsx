import { useState } from 'react';
import type { EnrollBucket, PatientView } from '../../shared/api';
import { fmtDate } from '../../shared/time';
import { useStore } from '../store';
import { Badge, Card, Empty, StatusBadge } from '../ui';
import { ConsentModal } from './ConsentModal';
import { SetupModal } from './SetupModal';

const SECTIONS: { bucket: EnrollBucket; title: string; help: string }[] = [
  {
    bucket: 'awaiting_confirmation',
    title: 'Eligible — awaiting Ops review',
    help: 'The roster determination proposes CCM or an APCM tier from the payer and the chronic ICD-10 codes. Ops approves, holds or rejects each row in the opportunity matrix.',
  },
  { bucket: 'needs_consent', title: 'Approved — no consent yet', help: 'Consent is usually taken at the office visit and arrives in the roster. Otherwise the nurse sends a consent link or calls with the script on screen.' },
  { bucket: 'needs_setup', title: 'Consented — no call setup yet', help: 'Pick the readings to ask, the symptoms to watch, the last EHR care plan review date, and the program. Saving compiles the care plan.' },
  { bucket: 'needs_care_plan', title: 'Call setup done — care plan awaiting physician approval', help: 'No calls are scheduled until the physician approves the care plan.' },
  { bucket: 'not_eligible', title: 'Not eligible', help: '' },
  { bucket: 'stopped', title: 'Paused or opted out', help: '' },
];

export function Enroll() {
  const { state, role } = useStore();
  const [consentFor, setConsentFor] = useState<number | null>(null);
  const [setupFor, setSetupFor] = useState<number | null>(null);
  const by = (b: EnrollBucket) => state.patients.filter((p) => p.enrollBucket === b);

  function action(p: PatientView) {
    switch (p.enrollBucket) {
      case 'awaiting_confirmation':
        return role === 'manager' ? (
          <a className="btn btn-primary btn-small" href="#/roster">
            Review in the matrix
          </a>
        ) : (
          <span className="hint">Ops reviews in the opportunity matrix</span>
        );
      case 'needs_care_plan':
        return role === 'physician' ? (
          <a className="btn btn-primary btn-small" href="#/physician">
            Review care plan
          </a>
        ) : (
          <span className="hint">{p.draftPlan ? `v${p.draftPlan.version} with the physician` : 'Returned: update the call setup'}</span>
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
      <div className="page-head">
        <h1>Enroll</h1>
        <p className="muted">New patients move through Ops review, consent, call setup and physician care plan approval. Active patients are on the Today queue.</p>
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
                    <th>Payer</th>
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
                          {p.mrn} · {p.age}
                        </div>
                      </td>
                      <td className="small">{p.codes.map((c) => c.code).join(', ') || '—'}</td>
                      <td className="small">
                        {p.payerLabel}
                        {p.is_qmb && !/QMB/.test(p.payerLabel) && <Badge tone="info">QMB</Badge>}
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
