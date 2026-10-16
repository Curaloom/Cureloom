import type { NurseRow, PracticeRow } from '../../shared/api';
import { computeRoi, ROI_DEFAULTS } from '../../shared/roi';
import { fmtDay } from '../../shared/time';
import { useStore } from '../store';
import { Badge, BarList, Card, Empty, Kpi, money, num, pct, SyntheticNote } from '../ui';

/** The operator's month across every client practice. */
export function Ops() {
  const { state } = useStore();
  const o = state.ops;
  const roi = computeRoi(state.settings.roi ?? ROI_DEFAULTS);
  const baseline = roi.apcm.minutesToday;
  const perNurse = (state.settings.roi ?? ROI_DEFAULTS).apcmPerNurseToday;
  const closed = state.fastForwarded || state.clock.afterMonthEnd;
  const apcmCount = o.enrolled.apcm;
  const logged = o.nurse.totalMinutes > 0;
  const mins = logged ? o.nurse.apcmPerPatient : null;
  const cut = mins != null && baseline ? 1 - mins / baseline : null;
  const checked = !!state.lastEligibility;

  return (
    <div className="stack">
      <div className="page-head row between wrap">
        <div>
          <h1>
            {state.operator} · {state.clock.monthLabel}
          </h1>
          <p className="muted">
            {state.practices.length} client practices · {num(o.enrolled.total)} active patients ({num(o.enrolled.apcm)} APCM, {num(o.enrolled.ccm)} CCM) · {num(o.pipeline.awaiting + o.pipeline.consent + o.pipeline.setup)} in
            enrollment · {closed ? 'month closed' : `month to date, ${fmtDay(state.clock.demoNow)}`}
          </p>
        </div>
        <div className="row gap tight wrap no-print">
          <a className="btn" href="#/billing">
            Billing pre-flight
          </a>
          <a className="btn" href="#/roi">
            ROI
          </a>
          <a className="btn btn-primary" href="#/pilot">
            Pilot plan
          </a>
        </div>
      </div>

      <NextStep />

      <div className="kpis">
        <Kpi
          hero
          label="Nurse minutes per APCM patient-month"
          value={mins == null ? '—' : `${num(mins, 1)} min`}
          sub={
            <>
              {!logged && 'No nurse time logged yet this month. '}
              Against {num(baseline, 1)} min today at {num(perNurse)} patients per nurse (the ROI page's number)
              {cut != null && cut > 0 && closed ? `: ${pct(cut)} less nurse time` : ''}
              {logged && !closed && ' · month to date'}
            </>
          }
        />
        <Kpi
          label="AI check-ins completed"
          value={o.ai.placed ? pct(o.ai.completionRate) : '—'}
          sub={o.ai.placed ? `${num(o.ai.reachedPatients)} of ${num(o.ai.eligible)} AI-eligible APCM patients, within 3 tries` : `Not run yet: ${num(o.ai.eligible)} APCM patients are AI-eligible`}
        />
        <Kpi
          label="APCM patients who needed a nurse"
          value={pct(o.exceptions.share)}
          sub={`${num(o.exceptions.patients)} of ${num(apcmCount)}; ${num(o.exceptions.fromCalls)} routed by the calls, the rest 90-day touches and patients without AI calls`}
        />
        <Kpi
          label="Urgent acknowledged within 30 min"
          value={o.escalations.urgent ? `${o.escalations.withinSla} of ${o.escalations.urgent}` : '—'}
          sub={o.escalations.avgAckMinutes != null ? `average ${num(o.escalations.avgAckMinutes, 1)} min to acknowledge` : 'No urgent escalations yet'}
          tone={o.escalations.urgent > o.escalations.acknowledged ? 'danger' : undefined}
        />
        <Kpi label="Ready to bill" value={money(o.billing.readyAmount)} sub={`${num(o.billing.ready)} ready · ${num(o.billing.held)} held, each with a reason`} />
      </div>

      <div className="grid2">
        <Card title="Where nurse time went">
          <BarList
            label="Activity"
            unit="minutes"
            rows={o.nurse.byActivity.map((a) => ({ label: a.label, value: a.minutes }))}
            empty="No nurse time logged yet this month."
          />
          <p className="hint">
            {num(o.nurse.totalMinutes)} nurse minutes this month. CCM: {o.nurse.ccmPerPatient != null ? `${num(o.nurse.ccmPerPatient, 1)} min per patient` : '—'},{' '}
            {num(o.nurse.ccmMeets20)} of {num(o.enrolled.ccm)} at 20 minutes ({pct(o.nurse.ccmMeets20Share)}). AI call time is never counted.
          </p>
        </Card>
        <Card title="Why APCM patients needed a nurse">
          <BarList
            label="Reason"
            unit="patients"
            rows={o.exceptions.byKind.map((k) => ({ label: k.kind, value: k.count }))}
            empty="Run the AI check-ins to see the exception queue."
          />
          <p className="hint">A patient can appear under more than one reason. Everyone else had their monthly contact from the AI check-in.</p>
        </Card>
      </div>

      <div className="grid2">
        <Card title="AI check-ins">
          {!o.ai.placed ? (
            <Empty>Not run yet. Use “Run October AI check-ins” in the demo bar.</Empty>
          ) : (
            <table className="table compact">
              <tbody>
                <Line k="AI-eligible APCM patients" v={o.ai.eligible} />
                <Line k="Calls placed (up to 3 tries, 2 business days apart)" v={o.ai.placed} />
                <Line k="Patients reached" v={o.ai.reachedPatients} sub={pct(o.ai.completionRate)} />
                <Line k="Answered by a caregiver" v={o.ai.caregiver} />
                <Line k="Not reached after 3 tries → nurse call" v={o.ai.unreached} />
                <Line k="Asked for a person → nurse call" v={o.ai.askedForPerson} />
                <Line k="Opted out of AI calls" v={o.ai.optedOut} />
                <Line k="Concerns routed to the care manager" v={o.ai.concerns} />
                <Line k="Urgent: 911/988 advised, live transfer requested" v={o.ai.urgent} />
              </tbody>
            </table>
          )}
        </Card>
        <Card
          title="Program integrity"
          actions={
            <a className="btn btn-small" href="#/billing">
              Pre-flight
            </a>
          }
        >
          <ul className="checks">
            <Integrity n={o.integrity.coverageUnverified} label="coverage not verified this month" fix="Run the eligibility check" />
            <Integrity n={o.integrity.maSwitches} label="moved to Medicare Advantage: caught, not billed" caught pending={!checked} />
            <Integrity n={o.integrity.qmbEnded} label="QMB ended: billed G0557, not G0558" caught pending={!checked} />
            <Integrity n={o.integrity.duplicates} label="enrolled at two client practices: later one held" caught />
            <Integrity n={o.integrity.riskPending} label="lower-acuity conditions only, risk basis not documented yet" fix="A clinician documents it" />
            <Integrity n={o.integrity.riskNotMet} label="taken off the program: risk standard not met" caught />
            <Integrity n={o.integrity.touchOverdue} label="no nurse contact in 90 days (operator policy, a warning)" fix="Nurse touch queued" warn />
          </ul>
          <p className="small">
            <strong>{money(o.integrity.avoided)}</strong> in claims that would have been denied or recouped, caught before submission.
          </p>
        </Card>
      </div>

      <Card title="Client practices">
        <PracticeTable rows={o.practices} aiRun={o.ai.placed > 0} closed={closed} />
      </Card>

      <Card title="Care managers">
        <NurseTable rows={o.nurses} />
      </Card>

      <div className="grid2">
        <Card title="Policies and protocols">
          <ul className="plain policy">
            <li>
              <strong>Urgent symptoms:</strong> the AI tells the patient to call 911 (988 for thoughts of self-harm), stays on the line and requests a live transfer to the on-duty
              nurse, and alerts the practice. A nurse acknowledges within 30 minutes; the SLA is tracked.
            </li>
            <li>
              <strong>Concerns</strong> go to the patient's care manager the next business day. The AI never gives clinical advice.
            </li>
            <li>
              <strong>Three tries,</strong> two business days apart, then a nurse call. Anyone can ask for a person; “stop calling me” ends AI calls and a nurse confirms.
            </li>
            <li>
              <strong>A nurse contact every 90 days</strong> for every APCM patient, whatever the AI does (operator policy, shown as a pre-flight warning).
            </li>
            <li>
              <strong>Calls go out in the practice's name,</strong> from the practice's number, and say they are automated and recorded.
            </li>
            <li>
              <strong>English only for now.</strong> Patients who prefer another language get a nurse call.
            </li>
            <li>
              <strong>Before every claim:</strong> coverage and QMB verified this month, no duplicate enrollment, risk basis documented for lower-acuity-only patients, note filed,
              physician attested.
            </li>
          </ul>
        </Card>
        <Card title="What's simulated here">
          <ul className="plain policy">
            <li>
              Four practices ({state.practices.filter((p) => p.simulated).map((p) => p.code).join(', ')}) are generated from a fixed seed, so every run is the same. Westfield (
              {state.live.code}) is driven by hand.
            </li>
            <li>Answer rates, symptoms, caregiver answers and nurse-task durations are assumptions, not measurements. The pilot measures them on your patients.</li>
            <li>The eligibility check is simulated; a real one queries Medicare eligibility through your clearinghouse.</li>
            <li>No EHR connection: the roster comes in as a CSV and the monthly note goes out as text to paste.</li>
            <li>Nothing is dialled or sent. Every name and phone number is fictional.</li>
          </ul>
        </Card>
      </div>
      <SyntheticNote>Rates are 2026 national non-facility amounts before geographic adjustment and sequestration.</SyntheticNote>
    </div>
  );
}

function NextStep() {
  const { state, role } = useStore();
  if (state.fastForwarded) {
    return (
      <div className="callout">
        <strong>October is closed at the simulated practices.</strong> Open the <a href="#/billing">billing pre-flight</a> for what's ready and why the rest is held, or take your numbers
        to the <a href="#/roi">ROI page</a>. Westfield is still yours to finish by hand
        {role !== 'nurse' ? ' (switch to the Nurse role)' : ''}.
      </div>
    );
  }
  if (state.lastRun) {
    return (
      <div className="callout">
        <strong>The AI check-ins ran.</strong> Switch to the Nurse role to work the exception queue, run the eligibility check on the <a href="#/billing">pre-flight</a>, then use{' '}
        <strong>Fast-forward October</strong> to see the closed month.
      </div>
    );
  }
  return (
    <div className="callout">
      <strong>Start of the month.</strong> Press <strong>Run October AI check-ins</strong> in the demo bar: every APCM patient gets a check-in call in their practice's name, and only
      the ones who need a person land in the nurses' queue.
    </div>
  );
}

function Line({ k, v, sub }: { k: string; v: number; sub?: string }) {
  return (
    <tr>
      <td>{k}</td>
      <td className="right tnum">
        {num(v)}
        {sub && <span className="muted small"> · {sub}</span>}
      </td>
    </tr>
  );
}

function Integrity({ n, label, caught, fix, warn, pending }: { n: number; label: string; caught?: boolean; fix?: string; warn?: boolean; pending?: boolean }) {
  const badge = pending ? (
    <Badge>Not checked yet</Badge>
  ) : n === 0 ? (
    <Badge tone="ok">✓ 0</Badge>
  ) : caught ? (
    <Badge tone="warn">Caught {num(n)}</Badge>
  ) : warn ? (
    <Badge tone="info">! {num(n)}</Badge>
  ) : (
    <Badge tone="danger">✕ {num(n)}</Badge>
  );
  return (
    <li>
      {badge}
      <span>
        {label}
        {n > 0 && fix && <span className="muted small"> · {fix}</span>}
      </span>
    </li>
  );
}

function PracticeTable({ rows, aiRun, closed }: { rows: PracticeRow[]; aiRun: boolean; closed: boolean }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Practice</th>
          <th>Care manager</th>
          <th className="right">Active</th>
          <th className="right">APCM · CCM</th>
          <th className="right">AI reached</th>
          <th className="right">Needed a nurse</th>
          <th className="right">APCM min/pt</th>
          <th className="right">CCM at 20 min</th>
          <th className="right">Ready</th>
          <th>{closed ? 'Held' : 'Held so far'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.code}>
            <td>
              <strong>{r.name}</strong>
              <div className="muted small">
                {r.physician} · {r.simulated ? 'simulated' : 'hand-driven'}
              </div>
            </td>
            <td className="small">{r.careManager}</td>
            <td className="right tnum">{num(r.enrolled)}</td>
            <td className="right tnum">
              {num(r.apcm)} · {num(r.ccm)}
            </td>
            <td className="right tnum">{aiRun ? pct(r.aiReached) : '—'}</td>
            <td className="right tnum">{num(r.exceptions)}</td>
            <td className="right tnum">{r.apcmMinutesPerPatient ? num(r.apcmMinutesPerPatient, 1) : '—'}</td>
            <td className="right tnum">{r.ccmMeets20 ? pct(r.ccmMeets20) : '—'}</td>
            <td className="right tnum">
              {num(r.ready)}
              <div className="muted small">{money(r.readyAmount)}</div>
            </td>
            <td className="small">
              <strong className="tnum">{num(r.held)}</strong>
              {closed && r.notFiled > 0 && <div>! {r.notFiled} notes not filed</div>}
              {closed && r.awaitingAttestation > 0 && <div>! {r.awaitingAttestation} awaiting signature</div>}
              {!closed && r.held > 0 && <div className="muted">mostly month not finished yet</div>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NurseTable({ rows }: { rows: NurseRow[] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Care manager</th>
          <th>Practices</th>
          <th className="right">Patients</th>
          <th className="right">Minutes logged</th>
          <th className="right">APCM min/pt</th>
          <th className="right">CCM min/pt</th>
          <th className="right">Need a person now</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((n) => (
          <tr key={n.name}>
            <td>
              <strong>{n.name}</strong>
            </td>
            <td className="small">{n.practices.join(', ')}</td>
            <td className="right tnum">{num(n.patients)}</td>
            <td className="right tnum">{num(n.minutes)}</td>
            <td className="right tnum">{n.apcmMinutesPerPatient == null ? '—' : num(n.apcmMinutesPerPatient, 1)}</td>
            <td className="right tnum">{n.ccmMinutesPerPatient == null ? '—' : num(n.ccmMinutesPerPatient, 1)}</td>
            <td className="right tnum">{num(n.openQueue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
