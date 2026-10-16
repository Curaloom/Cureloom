import { useEffect, useState, type ReactNode } from 'react';
import { FEES, FEES_2027_PROPOSED } from '../../shared/constants';
import { BILLABLE_SHARE, computeRoi, ROI_DEFAULTS, type RoiInputs } from '../../shared/roi';
import { go } from '../router';
import { useStore } from '../store';
import { Card, CompareBars, Kpi, money, num, pct, usd } from '../ui';

type NumKey = { [K in keyof RoiInputs]: RoiInputs[K] extends number ? K : never }[keyof RoiInputs];

/** The operator's own numbers in, nurse cost and savings out. Every default is an assumption to overwrite on the call. */
export function Roi() {
  const { state, act, say } = useStore();
  const saved = state.settings.roi;
  const savedKey = JSON.stringify(saved);
  const [i, setI] = useState<RoiInputs>(saved ?? ROI_DEFAULTS);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setI(saved ?? ROI_DEFAULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);
  const r = computeRoi(i);
  const measured = state.ops.nurse.apcmPerPatient;
  const closed = state.fastForwarded || state.clock.afterMonthEnd;
  const fee = i.rates === '2027p' ? FEES_2027_PROPOSED : FEES;
  const set = <K extends keyof RoiInputs>(k: K, v: RoiInputs[K]) => {
    setI({ ...i, [k]: v });
    setDirty(true);
  };

  async function save(): Promise<boolean> {
    const res = await act('saveSettings', { key: 'roi', value: i });
    if (res.ok) {
      setDirty(false);
      say('ROI numbers saved for this prospect.', 'ok');
    }
    return res.ok;
  }

  const field = (k: NumKey, label: string, opts: { step?: number; prefix?: string; suffix?: string; pct?: boolean; help?: string } = {}) => (
    <label className="roi-field">
      <span className="roi-label">
        {label}
        {opts.help && <span className="muted small block">{opts.help}</span>}
      </span>
      <span className="roi-input">
        <span className="affix">{opts.prefix ?? ''}</span>
        <input
          className="input"
          type="number"
          step={opts.step ?? 1}
          min={0}
          value={opts.pct ? Math.round(i[k] * 1000) / 10 : i[k]}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) set(k, (opts.pct ? v / 100 : v) as never);
          }}
        />
        <span className="affix">{opts.suffix ?? ''}</span>
      </span>
    </label>
  );

  return (
    <div className="stack">
      <div className="page-head row between wrap">
        <div>
          <h1>ROI · {i.operatorName || 'your operation'}</h1>
          <p className="muted">Put in the operator's own numbers on the call. Everything recalculates as you type; save to keep them with the demo and the pilot plan.</p>
        </div>
        <div className="row gap tight wrap">
          {dirty && <span className="muted small">Unsaved changes</span>}
          <button
            className="btn"
            onClick={() => {
              setI({ ...ROI_DEFAULTS, operatorName: i.operatorName });
              setDirty(true);
            }}
          >
            Defaults
          </button>
          <button className="btn" disabled={!dirty} onClick={save}>
            Save
          </button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              if (!dirty || (await save())) go('/pilot');
            }}
          >
            Build the pilot plan
          </button>
        </div>
      </div>

      <div className="roi-grid">
        <div className="stack">
          <Card title="Your book">
            <label className="roi-field stacked">
              <span className="roi-label">Operator (shown across the demo)</span>
              <input className="input" value={i.operatorName} onChange={(e) => set('operatorName', e.target.value)} />
            </label>
            {field('apcmPatients', 'APCM patients')}
            {field('qmbShare', 'QMB share of APCM', { pct: true, suffix: '%', step: 1, help: 'Bill G0558 instead of G0557' })}
            {field('ccmPatients', 'CCM patients')}
          </Card>
          <Card title="Your nurses today">
            {field('nurseSalary', 'Nurse salary', { prefix: '$', step: 1000 })}
            {field('loadFactor', 'Load factor', { step: 0.01, help: 'Payroll tax, benefits, PTO cover, licences' })}
            {field('productiveHours', 'Patient-work hours a month', { step: 0.1, help: 'After PTO, meetings and admin' })}
            {field('apcmPerNurseToday', 'APCM patients per nurse')}
            {field('ccmPerNurseToday', 'CCM patients per nurse')}
          </Card>
          <Card title="With Cureloom">
            {field('apcmMinutesWithCureloom', 'Nurse minutes per APCM patient-month', {
              step: 0.5,
              help: 'Exceptions, AI call reviews, 90-day touches, care plan and documentation',
            })}
            {measured != null && (
              <p className="hint">
                This demo measured <strong>{num(measured, 1)} min</strong> {closed ? 'for October' : 'so far this month'} on synthetic data.{' '}
                <button className="btn-link" onClick={() => set('apcmMinutesWithCureloom', measured)}>
                  Use it
                </button>
              </p>
            )}
            {field('ccmMinutesSaved', 'Uncounted CCM minutes saved per patient-month', { step: 0.5, help: 'Scheduling, failed dials, call prep. Counted time stays at 20+.' })}
            {field('priceApcm', 'Price per APCM patient a month', { prefix: '$', step: 0.5 })}
            {field('priceCcm', 'Price per CCM patient a month', { prefix: '$', step: 0.5 })}
            <div className="roi-field stacked">
              <span className="roi-label">Medicare rates</span>
              <span className="seg-group" role="group" aria-label="Medicare rates">
                <button className={`seg ${i.rates === '2026' ? 'on' : ''}`} onClick={() => set('rates', '2026')}>
                  2026 final rule
                </button>
                <button className={`seg ${i.rates === '2027p' ? 'on' : ''}`} onClick={() => set('rates', '2027p')}>
                  2027 proposed rule
                </button>
              </span>
            </div>
          </Card>
        </div>

        <div className="stack">
          <div className="kpis kpis-3">
            <Kpi
              hero
              label="Net savings a year"
              value={usd(r.annualSavings)}
              sub={`after ${usd(r.monthly.fees * 12)} a year in Cureloom fees · ${num(r.roiMultiple, 1)}× the fee in nurse cost saved`}
              tone={r.annualSavings < 0 ? 'danger' : undefined}
            />
            <Kpi label="Nurses needed" value={`${num(r.fteToday, 1)} → ${num(r.fteWith, 1)}`} sub="full-time equivalents for this book" />
            <Kpi
              label="Break-even"
              value={`${num(r.breakEvenMinutesApcm, 1)} min`}
              sub={`saved per APCM patient-month pays the ${money(i.priceApcm)} fee`}
            />
          </div>

          <Card title="Cost per patient-month">
            <CompareBars
              rows={[
                {
                  label: 'APCM',
                  today: r.apcm.costToday,
                  with: r.apcm.totalWith,
                  fmt: (n) => money(n),
                  note: `${num(r.apcm.minutesToday, 1)} → ${num(r.apcm.minutesWith, 1)} nurse min, plus the ${money(i.priceApcm)} fee`,
                },
                {
                  label: 'CCM',
                  today: r.ccm.costToday,
                  with: r.ccm.totalWith,
                  fmt: (n) => money(n),
                  note: `${num(r.ccm.minutesToday, 1)} → ${num(r.ccm.minutesWith, 1)} nurse min, plus the ${money(i.priceCcm)} fee`,
                },
              ]}
              withLabel="With Cureloom (nurse time + fee)"
            />
          </Card>

          <Card title="Patients per nurse">
            <CompareBars
              rows={[
                { label: 'APCM caseload', today: r.apcm.caseloadToday, with: r.apcm.caseloadWith, fmt: (n) => num(n) },
                { label: 'CCM caseload', today: r.ccm.caseloadToday, with: r.ccm.caseloadWith, fmt: (n) => num(n), note: 'counted time stays at 20+ minutes' },
              ]}
            />
          </Card>

          <Card title="The math, line by line">
            <table className="table compact math">
              <tbody>
                <Row k="Loaded nurse cost a year" v={usd(r.loadedNurseYear)} how={`${usd(i.nurseSalary)} × ${num(i.loadFactor, 2)}`} />
                <Row k="Cost per nurse minute" v={money(r.costPerMinute)} how={`${usd(r.loadedNurseYear)} ÷ 12 ÷ (${num(i.productiveHours, 1)} h × 60)`} />
                <Row
                  k="APCM nurse minutes per patient-month"
                  v={`${num(r.apcm.minutesToday, 1)} → ${num(r.apcm.minutesWith, 1)}`}
                  how={`today: ${num(i.productiveHours * 60)} min ÷ ${num(i.apcmPerNurseToday)} patients`}
                />
                <Row
                  k="CCM nurse minutes per patient-month"
                  v={`${num(r.ccm.minutesToday, 1)} → ${num(r.ccm.minutesWith, 1)}`}
                  how={`today: ${num(i.productiveHours * 60)} min ÷ ${num(i.ccmPerNurseToday)} patients; never below 20`}
                />
                <Row k="Nurse cost a month, today" v={usd(r.monthly.nurseCostToday)} how={`${num(i.apcmPatients)} APCM × ${money(r.apcm.costToday)} + ${num(i.ccmPatients)} CCM × ${money(r.ccm.costToday)}`} />
                <Row k="Nurse cost a month, with Cureloom" v={usd(r.monthly.nurseCostWith)} how={`${money(r.apcm.costWith)} APCM and ${money(r.ccm.costWith)} CCM per patient`} />
                <Row k="Cureloom fees a month" v={usd(r.monthly.fees)} how={`${num(i.apcmPatients)} × ${money(i.priceApcm)} + ${num(i.ccmPatients)} × ${money(i.priceCcm)}`} />
                <Row k="Net savings a month" v={usd(r.monthly.savings)} how="today − with Cureloom − fees" strong />
              </tbody>
            </table>
          </Card>

          <Card title="Against Medicare revenue (context)">
            <table className="table compact math">
              <tbody>
                <Row
                  k="Care-management revenue a month"
                  v={usd(r.revenueMonthly)}
                  how={`G0557 ${money(fee.G0557)} / G0558 ${money(fee.G0558)} on ${pct(BILLABLE_SHARE.apcm)} of APCM months, 99490 ${money(fee['99490'])} on ${pct(BILLABLE_SHARE.ccm)} of CCM months`}
                />
                <Row k="Nurse cost as a share of revenue" v={`${pct(r.nurseShareToday)} → ${pct(r.nurseShareWith)}`} how="with Cureloom includes the fee" />
              </tbody>
            </table>
            <p className="hint">
              National non-facility rates{i.rates === '2027p' ? ' from the CY2027 proposed rule (conversion factor −1.68%)' : ' for 2026'}, before geographic adjustment and
              sequestration. Billable shares are assumptions.
            </p>
          </Card>
          <Card title="Where this can be wrong">
            <ul className="plain policy">
              <li>APCM has no time requirement, so nurse minutes per patient are where the savings are. If your nurses already run at {num(r.apcm.caseloadWith)}+ APCM patients each, the case is thinner.</li>
              <li>CCM is time-based: counted minutes never drop below 20. Only the uncounted work around them (scheduling, failed dials, prep) shrinks.</li>
              <li>The minutes with Cureloom are the number the pilot exists to measure. The demo's figure comes from synthetic patients.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, how, strong }: { k: string; v: ReactNode; how: string; strong?: boolean }) {
  return (
    <tr className={strong ? 'total' : ''}>
      <td>{k}</td>
      <td className="right tnum nowrap">{v}</td>
      <td className="muted small">{how}</td>
    </tr>
  );
}
