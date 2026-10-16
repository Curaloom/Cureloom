import { useEffect, useState } from 'react';
import type { AuditPacket } from '../../shared/api';
import { fmtDate, fmtDateTime, fmtDuration } from '../../shared/time';
import { useStore } from '../store';
import { Badge, BillingBadge, CheckState, Empty, Loading, money } from '../ui';
import { Transcript } from './Transcript';

/** One patient-month's evidence, printable: what an auditor or the practice's biller would ask for. */
export function AuditPacketPage({ id }: { id: number }) {
  const { state } = useStore();
  const [a, setA] = useState<AuditPacket | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/audit/${id}`)
      .then(async (r) => {
        if (!live) return;
        if (r.ok) setA(await r.json());
        else setMissing(true);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [id, state.version]);
  if (missing) return <Empty>No such patient.</Empty>;
  if (!a) return <Loading />;
  const d = a.decision;
  const c = a.consent;
  const yes = (v: boolean) => (v ? '✓ yes' : '✕ no');

  return (
    <div className="stack">
      <div className="row gap tight no-print">
        <a className="btn" href={`#/patient/${a.patient.id}`}>
          Back to the patient
        </a>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>
      <article className="print-doc audit">
        <header className="doc-head">
          <div className="muted small">
            Audit packet · {a.monthLabel} · generated {fmtDateTime(a.generatedAt)} · synthetic demo data
          </div>
          <h1>
            {a.patient.name} <span className="muted">· {a.patient.mrn}</span>
          </h1>
          <p className="muted">
            {a.practice.name}, {a.practice.city} {a.practice.state} · billing practitioner {a.practice.physician} · care manager {a.patient.careManager} · care management by{' '}
            {a.operator}
          </p>
        </header>

        <section className={`decision decision-${d.status}`}>
          <div className="row gap wrap">
            <BillingBadge b={d} />
            {d.code ? (
              <span>
                <span className="mono">{d.code}</span> {d.codeLabel} · {d.status === 'ready' ? money(d.amount) : 'not billed'}
              </span>
            ) : (
              <span className="muted">No code</span>
            )}
            <span className="muted">· {d.minutes} counted minutes</span>
          </div>
          {d.reason && <p>Held: {d.reason}</p>}
        </section>

        <section>
          <h2>Pre-flight checks</h2>
          {d.checks.length ? (
            <table className="table compact">
              <tbody>
                {d.checks.map((k) => (
                  <tr key={k.key}>
                    <td className="nowrap">
                      <CheckState c={k} />
                    </td>
                    <td>
                      <strong>{k.label}</strong>
                      <div className="small">{k.detail}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Not enrolled: no checks run.</Empty>
          )}
        </section>

        <section className="two-col">
          <div>
            <h2>Patient and eligibility</h2>
            <table className="table compact">
              <tbody>
                <tr>
                  <td>Date of birth</td>
                  <td>
                    {fmtDate(a.patient.dob)} (age {a.patient.age})
                  </td>
                </tr>
                <tr>
                  <td>Coverage</td>
                  <td>
                    {a.patient.coverage}
                    {a.patient.qmb ? ', QMB' : ''} · verified {fmtDate(a.eligibility.coverageVerifiedOn)}
                    {a.patient.qmb && ` · QMB verified ${fmtDate(a.eligibility.qmbVerifiedOn)}`}
                  </td>
                </tr>
                <tr>
                  <td>Program</td>
                  <td>
                    {a.patient.program ?? '—'} · {a.patient.status}
                  </td>
                </tr>
                <tr>
                  <td>Qualifying conditions</td>
                  <td>
                    {a.eligibility.codes.map((x) => (
                      <div key={x.code}>
                        <span className="mono">{x.code}</span> {x.name}
                      </div>
                    ))}
                  </td>
                </tr>
                <tr>
                  <td>Risk basis</td>
                  <td>
                    {a.eligibility.riskNote
                      ? `${a.eligibility.riskNote} (${a.eligibility.riskNoteBy}, ${fmtDateTime(a.eligibility.riskNoteAt)})`
                      : a.eligibility.riskReviewNeeded
                        ? 'Needed (lower-acuity conditions only); not documented'
                        : 'Not needed: two or more higher-risk conditions'}
                  </td>
                </tr>
                <tr>
                  <td>Last visit</td>
                  <td>{fmtDate(a.eligibility.lastVisit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h2>Consent</h2>
            {c ? (
              <table className="table compact">
                <tbody>
                  <tr>
                    <td>How and when</td>
                    <td>
                      {c.method === 'at_visit' ? 'At the office visit' : 'Nurse phone call'}, {fmtDate(c.consent_date)}, by {c.captured_by}
                    </td>
                  </tr>
                  <tr>
                    <td>Availability explained</td>
                    <td>{yes(c.explained_availability)}</td>
                  </tr>
                  <tr>
                    <td>Cost sharing explained</td>
                    <td>{yes(c.explained_cost_sharing)}</td>
                  </tr>
                  <tr>
                    <td>One practitioner explained</td>
                    <td>{yes(c.explained_one_practitioner)}</td>
                  </tr>
                  <tr>
                    <td>Right to stop explained</td>
                    <td>{yes(c.explained_right_to_stop)}</td>
                  </tr>
                  <tr>
                    <td>Automated calls · texts</td>
                    <td>
                      {yes(c.automated_calls_ok)} · {yes(c.texts_ok)}
                    </td>
                  </tr>
                  {c.revoked_at && (
                    <tr>
                      <td>Revoked</td>
                      <td>{fmtDate(c.revoked_at)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <Empty>No consent on file.</Empty>
            )}
            <h2>Human contact</h2>
            <p className="small">
              {a.humanTouch.met ? '✓' : '!'} Last nurse contact {fmtDate(a.humanTouch.last)}; operator policy is every {a.humanTouch.policyDays} days ({a.humanTouch.met ? 'met' : 'not met'}).
            </p>
          </div>
        </section>

        <section>
          <h2>Contacts this month ({a.contacts.length})</h2>
          {!a.contacts.length ? (
            <Empty>No calls this month.</Empty>
          ) : (
            a.contacts.map((k, i) => (
              <div key={i} className="contact">
                <div className="row gap wrap">
                  <Badge tone={k.kind === 'ai' ? 'info' : 'neutral'}>{k.kind === 'ai' ? 'AI check-in' : 'Nurse call'}</Badge>
                  <strong>{fmtDateTime(k.at)}</strong>
                  <span className="muted small">
                    {k.outcome?.replace('_', ' ')}
                    {k.answeredBy ? `, answered by the ${k.answeredBy}` : ''} · {fmtDuration(k.seconds)} · {k.reached ? 'reached' : 'not reached'}
                    {k.reviewedAt ? ` · reviewed ${fmtDateTime(k.reviewedAt)}` : ''}
                  </span>
                </div>
                <p className="small">{k.summary}</p>
                {k.nurseNote && <p className="small">Nurse note: {k.nurseNote}</p>}
                {k.transcript.length > 0 && <Transcript lines={k.transcript} />}
              </div>
            ))
          )}
        </section>

        {a.flags.length > 0 && (
          <section>
            <h2>Flags</h2>
            <table className="table compact">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Summary</th>
                  <th>Raised</th>
                  <th>Acknowledged</th>
                  <th>Resolved</th>
                </tr>
              </thead>
              <tbody>
                {a.flags.map((f, i) => (
                  <tr key={i}>
                    <td>
                      <Badge tone={f.level === 'urgent' ? 'danger' : 'warn'}>{f.level}</Badge>
                    </td>
                    <td className="small">
                      {f.summary}
                      {f.escalation && ` · advised ${f.escalation}`}
                      {f.note && <div className="muted">Resolution: {f.note}</div>}
                    </td>
                    <td className="small nowrap">{fmtDateTime(f.raisedAt)}</td>
                    <td className="small nowrap">{fmtDateTime(f.acknowledgedAt)}</td>
                    <td className="small nowrap">{fmtDateTime(f.resolvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h2>Time ({a.countedMinutes} counted minutes)</h2>
          {!a.time.length ? (
            <Empty>No time logged this month.</Empty>
          ) : (
            <table className="table compact">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Activity</th>
                  <th>By</th>
                  <th className="right">Time</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {a.time.map((t, i) => (
                  <tr key={i}>
                    <td className="small nowrap">{fmtDateTime(t.at)}</td>
                    <td className="small">{t.activity}</td>
                    <td className="small">{t.by}</td>
                    <td className="right small tnum">
                      {fmtDuration(t.seconds)}
                      {!t.counted && <div className="muted">not counted</div>}
                    </td>
                    <td className="small">{t.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="hint">Time comes from timers in exact seconds; there is no manual minute entry. AI call time is never counted.</p>
        </section>

        {a.tasks.length > 0 && (
          <section>
            <h2>Tasks</h2>
            <ul className="plain small">
              {a.tasks.map((t, i) => (
                <li key={i}>
                  {t.status === 'done' ? '✓' : '○'} {t.title} · created {fmtDateTime(t.createdAt)}
                  {t.closedAt ? `, closed ${fmtDateTime(t.closedAt)}` : ' · open'}
                  {t.note ? ` · ${t.note}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2>Monthly note</h2>
          <p className="small">
            {a.note.filedAt ? `✓ Filed in the EHR ${fmtDateTime(a.note.filedAt)}` : '✕ Not filed'} ·{' '}
            {a.note.attestedAt ? `✓ attested ${fmtDateTime(a.note.attestedAt)} by ${a.note.attestedBy}` : `✕ not attested by ${a.note.attestedBy}`}
          </p>
          {a.note.text ? <pre className="note">{a.note.text}</pre> : <Empty>The note is drafted at month end.</Empty>}
        </section>

        <section>
          <h2>Event trail ({a.events.length})</h2>
          <table className="table compact events">
            <tbody>
              {a.events.map((e, i) => (
                <tr key={i}>
                  <td className="small nowrap">{fmtDateTime(e.at)}</td>
                  <td className="small">{e.actor}</td>
                  <td className="mono small">{e.type}</td>
                  <td className="small">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <footer className="doc-foot muted small">Synthetic demo data. Every name and number is fictional; nothing was dialled.</footer>
      </article>
    </div>
  );
}
