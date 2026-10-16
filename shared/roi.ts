// The operator ROI calculator. Pure functions, shared by the ROI screen, the
// pilot plan and the tests. Every default is an assumption the operator is
// expected to overwrite with their own numbers on the call.

import { FEES, FEES_2027_PROPOSED, OPERATOR_DEFAULT } from './constants';

export interface RoiInputs {
  operatorName: string;
  /** APCM patients the operator manages today. */
  apcmPatients: number;
  /** Share of APCM patients who are QMB (G0558). */
  qmbShare: number;
  ccmPatients: number;
  /** Base salary of a care-management nurse. */
  nurseSalary: number;
  /** Payroll tax, benefits, PTO cover, licences and equipment on top of salary. */
  loadFactor: number;
  /** Hours a nurse spends on patient work in a month, after PTO, meetings and idle time. */
  productiveHours: number;
  /** APCM patients one nurse covers today. */
  apcmPerNurseToday: number;
  /** CCM patients one nurse covers today. */
  ccmPerNurseToday: number;
  /** Nurse minutes per APCM patient-month with AI check-ins and the exception queue. */
  apcmMinutesWithCureloom: number;
  /** Uncounted CCM minutes saved per patient-month: scheduling, failed dials, call prep. */
  ccmMinutesSaved: number;
  /** Cureloom price per APCM patient per month. */
  priceApcm: number;
  /** Cureloom price per CCM patient per month. */
  priceCcm: number;
  /** National non-facility rates: 2026 final, or the CY2027 proposed rule. */
  rates: '2026' | '2027p';
}

export const ROI_DEFAULTS: RoiInputs = {
  operatorName: OPERATOR_DEFAULT,
  apcmPatients: 3000,
  qmbShare: 0.15,
  ccmPatients: 2000,
  nurseSalary: 90000,
  loadFactor: 1.27,
  productiveHours: 114.8,
  apcmPerNurseToday: 350,
  ccmPerNurseToday: 255,
  apcmMinutesWithCureloom: 10,
  ccmMinutesSaved: 3,
  priceApcm: 4,
  priceCcm: 2,
  rates: '2026',
};

/** Share of enrolled patient-months that end up billable (assumptions). */
export const BILLABLE_SHARE = { apcm: 0.95, ccm: 0.8 };

export interface ProgramRoi {
  minutesToday: number;
  minutesWith: number;
  caseloadToday: number;
  caseloadWith: number;
  /** Nurse cost per patient-month. */
  costToday: number;
  costWith: number;
  fee: number;
  /** Nurse cost plus Cureloom's fee. */
  totalWith: number;
  savingPerPatient: number;
}

export interface RoiResult {
  costPerMinute: number;
  loadedNurseYear: number;
  apcm: ProgramRoi;
  ccm: ProgramRoi;
  monthly: { nurseCostToday: number; nurseCostWith: number; fees: number; savings: number };
  annualSavings: number;
  fteToday: number;
  fteWith: number;
  /** Nurse minutes per APCM patient-month Cureloom must save to pay for itself. */
  breakEvenMinutesApcm: number;
  /** Medicare revenue a month at the chosen rates (context only). */
  revenueMonthly: number;
  nurseShareToday: number;
  nurseShareWith: number;
  /** Return on the fee: savings divided by fees. */
  roiMultiple: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function program(minutesToday: number, minutesWith: number, perMinute: number, productiveMinutes: number, fee: number): ProgramRoi {
  const costToday = minutesToday * perMinute;
  const costWith = minutesWith * perMinute;
  return {
    minutesToday: r2(minutesToday),
    minutesWith: r2(minutesWith),
    caseloadToday: Math.round(productiveMinutes / minutesToday),
    caseloadWith: Math.round(productiveMinutes / minutesWith),
    costToday: r2(costToday),
    costWith: r2(costWith),
    fee,
    totalWith: r2(costWith + fee),
    savingPerPatient: r2(costToday - costWith - fee),
  };
}

export function computeRoi(i: RoiInputs): RoiResult {
  const loadedNurseYear = i.nurseSalary * i.loadFactor;
  const productiveMinutes = i.productiveHours * 60;
  const perMinute = loadedNurseYear / 12 / productiveMinutes;
  const apcmToday = productiveMinutes / Math.max(1, i.apcmPerNurseToday);
  const ccmToday = productiveMinutes / Math.max(1, i.ccmPerNurseToday);
  const apcm = program(apcmToday, Math.max(0.5, Math.min(i.apcmMinutesWithCureloom, apcmToday)), perMinute, productiveMinutes, i.priceApcm);
  const ccm = program(ccmToday, Math.max(20, ccmToday - i.ccmMinutesSaved), perMinute, productiveMinutes, i.priceCcm);
  const nurseCostToday = apcm.costToday * i.apcmPatients + ccm.costToday * i.ccmPatients;
  const nurseCostWith = apcm.costWith * i.apcmPatients + ccm.costWith * i.ccmPatients;
  const fees = i.priceApcm * i.apcmPatients + i.priceCcm * i.ccmPatients;
  const savings = nurseCostToday - nurseCostWith - fees;
  const fee = i.rates === '2027p' ? FEES_2027_PROPOSED : FEES;
  const apcmRate = (1 - i.qmbShare) * fee.G0557 + i.qmbShare * fee.G0558;
  const revenueMonthly = apcmRate * BILLABLE_SHARE.apcm * i.apcmPatients + fee['99490'] * BILLABLE_SHARE.ccm * i.ccmPatients;
  const nurseMonth = loadedNurseYear / 12;
  return {
    costPerMinute: r2(perMinute),
    loadedNurseYear: Math.round(loadedNurseYear),
    apcm,
    ccm,
    monthly: { nurseCostToday: Math.round(nurseCostToday), nurseCostWith: Math.round(nurseCostWith), fees: Math.round(fees), savings: Math.round(savings) },
    annualSavings: Math.round(savings * 12),
    fteToday: Math.round((nurseCostToday / nurseMonth) * 10) / 10,
    fteWith: Math.round((nurseCostWith / nurseMonth) * 10) / 10,
    breakEvenMinutesApcm: Math.round((i.priceApcm / perMinute) * 10) / 10,
    revenueMonthly: Math.round(revenueMonthly),
    nurseShareToday: revenueMonthly ? r2(nurseCostToday / revenueMonthly) : 0,
    nurseShareWith: revenueMonthly ? r2((nurseCostWith + fees) / revenueMonthly) : 0,
    roiMultiple: fees ? Math.round(((nurseCostToday - nurseCostWith) / fees) * 10) / 10 : 0,
  };
}

/** What the pilot proposal says. Defaults come from the ROI inputs. */
export interface PilotInputs {
  operatorName: string;
  contactName: string;
  contactTitle: string;
  /** APCM patients in the pilot. */
  cohort: number;
  practices: string;
  startDate: string;
  days: number;
  /** Price per APCM patient per month during the pilot. */
  pilotPrice: number;
  /** Price after the pilot, if it meets its targets. */
  conversionPrice: number;
  /** Patients the operator expands to if the pilot meets its targets. */
  expandTo: number;
  /** Today's nurse minutes per APCM patient-month, measured in weeks 1–2. */
  baselineMinutes: number;
  targets: {
    /** Share of AI-eligible patients who complete a check-in within 3 attempts. */
    aiCompletion: number;
    /** Reduction in nurse minutes per APCM patient-month against the baseline. */
    minutesReduction: number;
    /** Most patients who may ask to stop AI calls or switch to a person. */
    aiOptOutMax: number;
    /** Urgent escalations acknowledged within 30 minutes. */
    ackWithinSla: number;
    /** Billed months with a complete audit packet. */
    auditComplete: number;
  };
}

export function pilotDefaults(roi: RoiInputs): PilotInputs {
  return {
    operatorName: roi.operatorName,
    contactName: '',
    contactTitle: 'VP, Care Operations',
    cohort: Math.min(500, roi.apcmPatients),
    practices: 'two or three client practices',
    startDate: '2026-11-16',
    days: 90,
    pilotPrice: Math.max(1, Math.round(roi.priceApcm / 2)),
    conversionPrice: roi.priceApcm,
    expandTo: roi.apcmPatients,
    baselineMinutes: Math.round((roi.productiveHours * 60) / Math.max(1, roi.apcmPerNurseToday)),
    targets: { aiCompletion: 0.6, minutesReduction: 0.3, aiOptOutMax: 0.15, ackWithinSla: 1, auditComplete: 1 },
  };
}
