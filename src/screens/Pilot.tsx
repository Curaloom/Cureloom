import { useEffect, useState } from 'react';
import { computeRoi, pilotDefaults, ROI_DEFAULTS, type PilotInputs } from '../../shared/roi';
import { addDays, fmtDate } from '../../shared/time';
import { useStore } from '../store';
import { Card, money, num, pct, possessive, usd } from '../ui';

type NumKey = { [K in keyof PilotInputs]: PilotInputs[K] extends number ? K : never }[keyof PilotInputs];
type TargetKey = keyof PilotInputs['targets'];

/** A printable pilot proposal with a non-binding letter of intent, built from the ROI numbers. */
export function Pilot() {
  const { state, act, say } = useStore();
  const roiInputs = state.settings.roi ?? ROI_DEFAULTS;
  const saved = state.settings.pilot;
  const savedKey = JSON.stringify([saved, roiInputs.operatorName]);
  const [p, setP] = useState<PilotInputs>(saved ?? pilotDefaults(roiInputs));
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setP(saved ?? pilotDefaults(roiInputs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);
  const set = <K extends keyof PilotInputs>(k: K, v: PilotInputs[K]) => {
    setP({ ...p, [k]: v });
    setDirty(true);
  };
  const setTarget = (k: TargetKey, v: number) => {
    setP({ ...p, targets: { ...p.targets, [k]: v } });
    setDirty(true);
  };

  const roi = computeRoi(roiInputs);
  const months = Math.round((p.days / 30) * 10) / 10;
  const pilotFees = p.cohort * p.pilotPrice * months;
  const targetMinutes = Math.round(p.baselineMinutes * (1 - p.targets.minutesReduction) * 10) / 10;
  const savedPerMonth = p.cohort * (p.baselineMinutes - targetMinutes) * roi.costPerMinute;
  const acv = p.expandTo * p.conversionPrice * 12;
  const end = addDays(p.startDate, p.days - 1);
  const setupEnd = addDays(p.startDate, 13);
  const liveEnd = addDays(p.startDate, Math.max(14, p.days - 22));
  const operator = p.operatorName || state.operator;

  const numField = (k: NumKey, label: string, opts: { prefix?: string; step?: number } = {}) => (
    <label className="roi-field">
      <span className="roi-label">{label}</span>
      <span className="roi-input">
        <span className="affix">{opts.prefix ?? ''}</span>
        <input className="input" type="number" min={0} step={opts.step ?? 1} value={p[k]} onChange={(e) => set(k, Number(e.target.value) as never)} />
        <span className="affix" />
      </span>
    </label>
  );
  const pctField = (k: TargetKey, label: string) => (
    <label className="roi-field">
      <span className="roi-label">{label}</span>
      <span className="roi-input">
        <span className="affix" />
        <input className="input" type="number" min={0} max={100} step={1} value={Math.round(p.targets[k] * 100)} onChange={(e) => setTarget(k, Number(e.target.value) / 100)} />
        <span className="affix">%</span>
      </span>
    </label>
  );

  return (
    <div className="pilot-grid">
      <div className="stack no-print">
        <div className="page-head">
          <h1>Pilot plan</h1>
          <p className="muted">Fill this in with the prospect, print it or save it as a PDF, and send it with the LOI.</p>
        </div>
        <div className="row gap tight wrap">
          <button className="btn btn-primary" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <button
            className="btn"
            disabled={!dirty}
            onClick={async () => {
              const r = await act('saveSettings', { key: 'pilot', value: p });
              if (r.ok) {
                setDirty(false);
                say('Pilot plan saved.', 'ok');
              }
            }}
          >
            Save
          </button>
          <button
            className="btn"
            onClick={() => {
              setP(pilotDefaults(roiInputs));
              setDirty(true);
            }}
          >
            From the ROI numbers
          </button>
        </div>
        <Card title="Who it's for">
          <label className="roi-field stacked">
            <span className="roi-label">Operator</span>
            <input className="input" value={p.operatorName} onChange={(e) => set('operatorName', e.target.value)} />
          </label>
          <label className="roi-field stacked">
            <span className="roi-label">Sponsor</span>
            <input className="input" placeholder="Name" value={p.contactName} onChange={(e) => set('contactName', e.target.value)} />
          </label>
          <label className="roi-field stacked">
            <span className="roi-label">Sponsor's title</span>
            <input className="input" value={p.contactTitle} onChange={(e) => set('contactTitle', e.target.value)} />
          </label>
        </Card>
        <Card title="Scope">
          {numField('cohort', 'APCM patients in the pilot')}
          <label className="roi-field stacked">
            <span className="roi-label">Practices</span>
            <input className="input" value={p.practices} onChange={(e) => set('practices', e.target.value)} />
          </label>
          <label className="roi-field">
            <span className="roi-label">Start</span>
            <input className="input" type="date" value={p.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </label>
          {numField('days', 'Length in days')}
          {numField('baselineMinutes', 'Baseline nurse minutes per APCM patient-month', { step: 0.5 })}
        </Card>
        <Card title="Targets">
          {pctField('aiCompletion', 'AI check-in completion at least')}
          {pctField('minutesReduction', 'Fewer nurse minutes than baseline by at least')}
          {pctField('aiOptOutMax', 'Asking to stop AI calls at most')}
          {pctField('ackWithinSla', 'Urgent acknowledged within 30 min')}
          {pctField('auditComplete', 'Billed months with a full audit packet')}
        </Card>
        <Card title="Commercials">
          {numField('pilotPrice', 'Pilot price per APCM patient a month', { prefix: '$', step: 0.5 })}
          {numField('conversionPrice', 'Price after a successful pilot', { prefix: '$', step: 0.5 })}
          {numField('expandTo', 'APCM patients after conversion')}
        </Card>
        <Card title="Before you ask for the LOI">
          <ul className="plain checklist">
            <li>☐ A named sponsor who can approve the pilot spend</li>
            <li>☐ The cohort and the 2–3 practices picked, with each practice's physician on board</li>
            <li>☐ How the baseline minutes will be measured, agreed</li>
            <li>☐ The five targets agreed, and what happens if one is missed</li>
            <li>☐ Pilot price and conversion terms agreed</li>
            <li>☐ BAA path: their paper or ours, and who reviews it</li>
            <li>☐ Who owns their security questionnaire</li>
            <li>☐ A start date and the person who signs</li>
          </ul>
        </Card>
      </div>

      <article className="print-doc">
        <header className="doc-head">
          <div className="muted small">Pilot proposal · draft for discussion · {fmtDate(state.clock.demoNow)}</div>
          <h1>
            AI check-ins and the exception workflow for {operator}
          </h1>
          <p className="muted">
            Prepared for {p.contactName || '[sponsor]'}, {p.contactTitle} · by Cureloom
          </p>
        </header>

        <section>
          <h2>Why</h2>
          <p>
            APCM pays a flat monthly amount with no time requirement, so its margin is nurse time per patient. Today a care manager covers about {num(roiInputs.apcmPerNurseToday)}{' '}
            APCM patients, about {num(p.baselineMinutes, 1)} nurse minutes per patient-month. Cureloom places each month's check-in by phone in the practice's name and hands
            your nurses only the patients who need a person. Your nurses stay; they work the exceptions.
          </p>
        </section>

        <section>
          <h2>What we'll run</h2>
          <ol>
            <li>
              {num(p.cohort)} APCM patients at {p.practices}, for {p.days} days from {fmtDate(p.startDate)} to {fmtDate(end)}.
            </li>
            <li>A monthly AI check-in for every consented patient: medications, symptoms the care plan watches, ER visits, readings, and what they need.</li>
            <li>Concerns go to the patient's care manager; urgent symptoms get 911 or 988 advice, a live transfer to the on-duty nurse and an alert to the practice.</li>
            <li>A billing pre-flight each month end, with an audit packet for every billed patient-month.</li>
          </ol>
        </section>

        <section>
          <h2>Timeline</h2>
          <table className="table compact">
            <tbody>
              <tr>
                <td className="nowrap">
                  {fmtDate(p.startDate)} – {fmtDate(setupEnd)}
                </td>
                <td>
                  <strong>Set-up and baseline.</strong> BAA signed; roster export; your compliance team approves the scripts, consent language and calling number; baseline nurse
                  minutes measured on today's workflow.
                </td>
              </tr>
              <tr>
                <td className="nowrap">
                  {fmtDate(addDays(setupEnd, 1))} – {fmtDate(liveEnd)}
                </td>
                <td>
                  <strong>Live.</strong> Check-ins for the cohort, exceptions to your nurses, a 30-minute metrics review every week, the pre-flight at each month end.
                </td>
              </tr>
              <tr>
                <td className="nowrap">
                  {fmtDate(addDays(liveEnd, 1))} – {fmtDate(end)}
                </td>
                <td>
                  <strong>Read-out.</strong> Results against every target, the audit packets, and a decision on conversion.
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Success criteria</h2>
          <table className="table compact">
            <thead>
              <tr>
                <th>Measure</th>
                <th>Target</th>
                <th>How it's measured</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>AI check-in completion</td>
                <td className="nowrap">≥ {pct(p.targets.aiCompletion)}</td>
                <td>AI-eligible pilot patients reached within 3 tries each month</td>
              </tr>
              <tr>
                <td>Nurse minutes per APCM patient-month</td>
                <td className="nowrap">
                  ≤ {num(targetMinutes, 1)} min ({pct(p.targets.minutesReduction)} below {num(p.baselineMinutes, 1)})
                </td>
                <td>Timers on every nurse activity, against the set-up baseline</td>
              </tr>
              <tr>
                <td>Patients who ask to stop AI calls or switch to a person</td>
                <td className="nowrap">≤ {pct(p.targets.aiOptOutMax)}</td>
                <td>Opt-out and “asked for a person” records</td>
              </tr>
              <tr>
                <td>Urgent escalations acknowledged within 30 minutes</td>
                <td className="nowrap">{pct(p.targets.ackWithinSla)}</td>
                <td>Raised and acknowledged times on every urgent flag</td>
              </tr>
              <tr>
                <td>Billed months with a complete audit packet</td>
                <td className="nowrap">{pct(p.targets.auditComplete)}</td>
                <td>Consent, eligibility, contacts, time, note and attestation for each</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Commercials (proposed)</h2>
          <ul>
            <li>
              Pilot: {num(p.cohort)} patients × {money(p.pilotPrice)} per patient a month × {num(months, Number.isInteger(months) ? 0 : 1)} months ={' '}
              <strong>{usd(pilotFees)}</strong>.
            </li>
            <li>
              If every target is met: {money(p.conversionPrice)} per APCM patient a month, expanding to {num(p.expandTo)} patients, <strong>{usd(acv)} a year</strong>.
            </li>
            <li>
              At the minutes target, the nurse time saved across the cohort is worth about {usd(savedPerMonth)} a month at {money(roi.costPerMinute)} per loaded nurse minute.
            </li>
            <li>Either side can end the pilot with 14 days' notice.</li>
          </ul>
        </section>

        <section className="two-col">
          <div>
            <h2>Cureloom provides</h2>
            <ul>
              <li>Check-in calls in each practice's name, with its number</li>
              <li>The exception queue and nurse call workflow</li>
              <li>The monthly billing pre-flight and audit packets</li>
              <li>A weekly metrics review and a named implementation lead</li>
              <li>A BAA and answers to your security questionnaire</li>
            </ul>
          </div>
          <div>
            <h2>{operator} provides</h2>
            <ul>
              <li>A sponsor and 1–2 care managers for the cohort</li>
              <li>A monthly roster export (CSV)</li>
              <li>Compliance sign-off on scripts, consent language and the calling number</li>
              <li>A physician champion at each pilot practice</li>
              <li>30 minutes a week for the review</li>
            </ul>
          </div>
        </section>

        <section>
          <h2>Not in scope</h2>
          <p>
            EHR integration (the roster comes in as a CSV; the monthly note goes out as text). Claim submission: each practice bills under its own NPI through its own biller.
            Clinical decisions: the AI asks scripted questions and routes; beyond 911 or 988 it gives no advice. Check-ins in languages other than English: those patients get a
            nurse call.
          </p>
        </section>

        <section className="loi">
          <h2>Letter of intent (non-binding)</h2>
          <p>
            {operator} intends to run the pilot described above with Cureloom, starting on or about {fmtDate(p.startDate)}, subject to a business associate agreement and a final
            pilot agreement. This letter records intent only. It is not a binding commitment by either party, and either party may decline to proceed.
          </p>
          <div className="sign-grid">
            {[
              { org: operator, name: p.contactName, title: p.contactTitle },
              { org: 'Cureloom', name: '', title: '' },
            ].map((s) => (
              <div key={s.org} className="sign">
                <strong>For {s.org}</strong>
                <div className="sign-line">Name: {s.name}</div>
                <div className="sign-line">Title: {s.title}</div>
                <div className="sign-line">Signature:</div>
                <div className="sign-line">Date:</div>
              </div>
            ))}
          </div>
        </section>
        <footer className="doc-foot muted small">
          Figures come from {possessive(operator)} own numbers where given and labelled assumptions otherwise; the demo that accompanies this proposal runs on synthetic data. This is not
          legal advice: have counsel review this letter, the BAA and the pilot agreement before signing.
        </footer>
      </article>
    </div>
  );
}
