import { useState } from 'react';
import type { NurseQueueItem } from '../../shared/api';
import { fmtDay, toIso } from '../../shared/time';
import { go } from '../router';
import { useDemoNowMs, useStore } from '../store';
import { Badge, Card, Countdown, Empty } from '../ui';
import { ConsentModal } from './ConsentModal';

type Key = 'consent' | 'care' | 'urgency' | 'pending';

const TABS: { key: Key; label: string; help: string }[] = [
  {
    key: 'consent',
    label: 'Consent pending',
    help: 'Approved by Ops, no consent yet. Oldest contact attempt first. Send the consent link, or call with the script on screen (nothing is dialled).',
  },
  {
    key: 'care',
    label: 'Care not yet delivered',
    help: "Active patients whose monthly care is not complete as the month end nears: no completed contact, monthly reviews not done, open tasks. Minutes are shown as logged; the queue never counts down to a threshold.",
  },
  { key: 'urgency', label: 'Clinical urgency', help: 'Urgent and concern flags from check-in calls, and patients not reached after three tries.' },
  { key: 'pending', label: 'Pending steps', help: 'Missing workflow steps: call setup, care plan approval, calls due, tasks, AI calls to review, month-end notes.' },
];

export function Queue() {
  const { state } = useStore();
  const nowMs = useDemoNowMs();
  const q = state.queues;
  const [tab, setTab] = useState<Key>(() => (q.urgency.length ? 'urgency' : (TABS.find((t) => q[t.key].length)?.key ?? 'urgency')));
  const [consentFor, setConsentFor] = useState<number | null>(null);
  const current = TABS.find((t) => t.key === tab)!;
  const list = q[tab] as NurseQueueItem[];
  return (
    <div className="stack">
      <div className="page-head">
        <h1>Today · {fmtDay(toIso(nowMs))}</h1>
        <p className="muted">Four queues. A patient can sit in more than one.</p>
      </div>
      <Card>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              <span className={`badge count ${t.key === 'urgency' && q.urgency.some((x) => x.level === 'urgent') ? 'badge-danger' : ''}`}>{q[t.key].length}</span>
            </button>
          ))}
        </div>
        <p className="muted small">{current.help}</p>
        {!list.length ? (
          <Empty>{tab === 'care' && toIso(nowMs).slice(0, 10) < q.careOpensOn ? `This list opens on ${fmtDay(q.careOpensOn)}.` : 'Nobody here right now.'}</Empty>
        ) : (
          <QueueTable tab={tab} list={list} nowMs={nowMs} onConsent={setConsentFor} />
        )}
      </Card>
      {consentFor != null && <ConsentModal patientId={consentFor} onClose={() => setConsentFor(null)} />}
    </div>
  );
}

function QueueTable({ tab, list, nowMs, onConsent }: { tab: Key; list: NurseQueueItem[]; nowMs: number; onConsent: (id: number) => void }) {
  const { role, act, say } = useStore();
  const nurse = role === 'nurse';
  return (
    <table className="table queue">
      <thead>
        <tr>
          <th>Patient</th>
          <th>Program</th>
          <th>Why</th>
          <th className="right">Minutes logged</th>
          {tab === 'consent' && <th />}
        </tr>
      </thead>
      <tbody>
        {list.map((r) => (
          <tr key={r.patientId} className={`clickable ${r.level === 'urgent' ? 'row-urgent' : ''}`} onClick={() => go(`/patient/${r.patientId}`)}>
            <td>
              {r.level && r.level !== 'info' && <Badge tone={r.level === 'urgent' ? 'danger' : 'warn'}>{r.level}</Badge>}
              <a href={`#/patient/${r.patientId}`} onClick={(e) => e.stopPropagation()}>
                {r.name}
              </a>
              <div className="muted small">{r.mrn}</div>
            </td>
            <td>{r.program}</td>
            <td>
              <ul className="queue-items">
                {r.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              {r.ackDueAt && (
                <div className="small">
                  Acknowledge within 30 min: <Countdown dueMs={Date.parse(`${r.ackDueAt}Z`)} nowMs={nowMs} />
                </div>
              )}
            </td>
            <td className="right mono">{r.minutes}</td>
            {tab === 'consent' && (
              <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                <div className="row gap tight end">
                  <button
                    className="btn btn-small"
                    disabled={!nurse}
                    onClick={async () => {
                      const res = await act('sendConsentLink', { patientId: r.patientId });
                      if (res.ok) say('Consent link sent (see the outbox).', 'ok');
                    }}
                  >
                    {r.linkSent ? 'Resend link' : 'Send consent link'}
                  </button>
                  <button className="btn btn-small btn-primary" disabled={!nurse} onClick={() => onConsent(r.patientId)}>
                    Call
                  </button>
                  {r.linkSent && (
                    <button
                      className="btn btn-small"
                      title="Tester: play the patient opening the link and signing"
                      onClick={() => act('simulateConsentSigned', { patientId: r.patientId, automatedCallsOk: true, textsOk: true })}
                    >
                      Tester: patient signs
                    </button>
                  )}
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
