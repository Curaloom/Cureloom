import { useState } from 'react';
import { defaultSetupFor, READING_ORDER, RULE_ORDER } from '../../shared/codes';
import { DEFAULT_TARGETS, READINGS, RULES } from '../../shared/rules';
import type { Program, ReadingType, RuleCode, Targets } from '../../shared/types';
import { useStore } from '../store';
import { Modal } from '../ui';

export function SetupModal({ patientId, onClose }: { patientId: number; onClose: () => void }) {
  const { state, act } = useStore();
  const p = state.patients.find((x) => x.id === patientId)!;
  const defaults = defaultSetupFor(p.qualifying_codes);
  const s = p.setup;
  const [program, setProgram] = useState<Program | null>(p.program);
  const [readings, setReadings] = useState<ReadingType[]>(s?.readings ?? defaults.readings);
  const [symptoms, setSymptoms] = useState<RuleCode[]>(s?.symptoms_to_watch ?? defaults.rules);
  const [targets, setTargets] = useState<Targets>(s?.targets ?? DEFAULT_TARGETS);
  const [planDate, setPlanDate] = useState(s?.ehr_plan_reviewed_on ?? p.last_visit_date ?? '');
  const autoOk = !!p.consent?.automated_calls_ok;

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const num = (v: string) => (v === '' ? null : Number(v));

  async function save() {
    if (!program) return;
    const r = await act('saveCallSetup', {
      patientId,
      program,
      readings: READING_ORDER.filter((x) => readings.includes(x)),
      symptoms: RULE_ORDER.filter((x) => symptoms.includes(x)),
      targets,
      ehrPlanReviewedOn: planDate || null,
    });
    if (r.ok) onClose();
  }

  return (
    <Modal title={`Call setup — ${p.name}`} onClose={onClose} wide>
      <p className="muted small">Prefilled from the qualifying conditions: {p.codes.map((c) => `${c.code} ${c.name}`).join('; ')}.</p>
      <fieldset className="field">
        <legend>Program</legend>
        <label className={`choice ${program === 'ccm' ? 'on' : ''}`}>
          <input type="radio" name="program" checked={program === 'ccm'} onChange={() => setProgram('ccm')} />
          <span>
            <strong>CCM (99490)</strong> — the nurse makes the monthly call; billed only with 20 real staff minutes in the month.
          </span>
        </label>
        <label className={`choice ${program === 'apcm' ? 'on' : ''}`}>
          <input type="radio" name="program" checked={program === 'apcm'} onChange={() => setProgram('apcm')} />
          <span>
            <strong>APCM ({p.is_qmb ? 'G0558, QMB' : 'G0557'})</strong> — the AI makes the monthly check-in call; no time rule, needs a completed contact.
            {!autoOk && <em className="warn-text"> This consent has no automated-call permission, so the monthly call will be a nurse task.</em>}
          </span>
        </label>
      </fieldset>
      <div className="grid2">
        <fieldset className="field">
          <legend>Readings to ask</legend>
          {(['bp', 'glucose', 'weight', 'oxygen'] as ReadingType[]).map((r) => (
            <label key={r} className="check">
              <input type="checkbox" checked={readings.includes(r)} onChange={() => toggle(readings, r, setReadings)} />
              {READINGS[r].label}
              {defaults.readings.includes(r) && <span className="muted small"> · matches a condition</span>}
            </label>
          ))}
          <div className="targets">
            {readings.includes('bp') && (
              <label>
                BP target below{' '}
                <input type="number" value={targets.bp.sysMax} onChange={(e) => setTargets({ ...targets, bp: { ...targets.bp, sysMax: Number(e.target.value) } })} />/
                <input type="number" value={targets.bp.diaMax} onChange={(e) => setTargets({ ...targets, bp: { ...targets.bp, diaMax: Number(e.target.value) } })} />
              </label>
            )}
            {readings.includes('glucose') && (
              <label>
                Fasting glucose{' '}
                <input type="number" value={targets.glucose.min} onChange={(e) => setTargets({ ...targets, glucose: { ...targets.glucose, min: Number(e.target.value) } })} />–
                <input type="number" value={targets.glucose.max} onChange={(e) => setTargets({ ...targets, glucose: { ...targets.glucose, max: Number(e.target.value) } })} />
              </label>
            )}
            {readings.includes('weight') && (
              <label>
                Dry weight (lb){' '}
                <input
                  type="number"
                  value={targets.weight.baseline ?? ''}
                  onChange={(e) => setTargets({ ...targets, weight: { ...targets.weight, baseline: num(e.target.value) } })}
                />{' '}
                flag a gain of{' '}
                <input type="number" value={targets.weight.maxGain} onChange={(e) => setTargets({ ...targets, weight: { ...targets.weight, maxGain: Number(e.target.value) } })} /> lb
              </label>
            )}
            {readings.includes('oxygen') && (
              <label>
                Oxygen at least <input type="number" value={targets.oxygen.min} onChange={(e) => setTargets({ ...targets, oxygen: { min: Number(e.target.value) } })} />%
              </label>
            )}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Symptoms to watch (red-flag rules)</legend>
          {RULE_ORDER.map((r) => (
            <label key={r} className="check">
              <input type="checkbox" checked={symptoms.includes(r)} onChange={() => toggle(symptoms, r, setSymptoms)} />
              {RULES[r].label}{' '}
              <span className={`small ${RULES[r].level === 'urgent' ? 'danger-text' : 'muted'}`}>
                {RULES[r].level === 'urgent' ? `urgent → ${RULES[r].escalation}` : 'concern → nurse'}
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <label className="field inline">
        Last EHR care plan review <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
      </label>
      <div className="row gap end">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!program} onClick={save}>
          {p.status === 'active' ? 'Save call setup' : 'Save and activate'}
        </button>
      </div>
    </Modal>
  );
}
