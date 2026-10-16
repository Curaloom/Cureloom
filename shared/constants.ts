import type { Role } from './types';

/**
 * The care-management operator the demo is shown as. The name is editable on
 * the ROI screen so a demo can be prepared for a specific prospect.
 */
export const OPERATOR_DEFAULT = 'Lakeside Care Partners';

/** A client practice of the operator. Every practice in the demo is fictional. */
export interface PracticeInfo {
  id: number;
  code: string;
  name: string;
  city: string;
  state: string;
  phone: string;
  /** The billing practitioner who supervises and attests. */
  physician: string;
  /** The operator's care manager who covers the practice. */
  careManager: string;
  /** Synthetic practices are run by the month simulation; the live practice is driven by hand. */
  simulated: boolean;
}

/** The live, hand-driven practice: the original fifteen scripted patients. */
export const PRACTICE: Omit<PracticeInfo, 'id'> = {
  code: 'WFM',
  name: 'Westfield Family Medicine',
  city: 'Round Rock',
  state: 'TX',
  phone: '+1 555 0100',
  physician: 'Dr. Anita Patel',
  careManager: 'Rachel Okafor, RN',
  simulated: false,
};

export const STAFF: Record<Role, { name: string; title: string; short: string }> = {
  nurse: { name: 'Rachel Okafor, RN', title: 'Care manager (RN)', short: 'Rachel' },
  physician: { name: 'Dr. Anita Patel', title: 'Physician, Westfield Family Medicine', short: 'Dr. Patel' },
  manager: { name: 'Dana Brooks', title: 'Operations lead', short: 'Dana' },
};

export const ROLE_LABEL: Record<Role, string> = {
  nurse: 'Nurse',
  physician: 'Physician',
  manager: 'Ops lead',
};

/** "Dr. Anita Patel" -> "Dr. Patel"; "Rachel Okafor, RN" -> "Rachel". */
export function shortPhysician(name: string): string {
  const parts = name.replace(/,.*$/, '').split(' ');
  return parts[0] === 'Dr.' ? `Dr. ${parts[parts.length - 1]}` : parts[parts.length - 1];
}

export function firstName(name: string): string {
  return name.replace(/^Dr\.\s+/, '').split(/[ ,]/)[0];
}

/** The one demo month this build simulates. */
export const DEMO_MONTH = '2026-10';
export const DEMO_START = '2026-10-05T09:00:00';
/** Month end lands on the last business day of October. */
export const MONTH_END = '2026-10-30T14:00:00';
export const DEMO_LAST_DATE = '2026-10-31';
/** Idle demo time stops ticking at this hour; "+1 day" starts the next day here. */
export const WORKDAY_START_HOUR = 9;
export const WORKDAY_END_HOUR = 18;

export const ACK_WINDOW_MINUTES = 30;
export const CCM_MINUTES = 20;
export const AI_MAX_ATTEMPTS = 3;
export const AI_RETRY_BUSINESS_DAYS = 2;
export const AI_CALL_HOUR = '10:00:00';

export type BillingCode = '99490' | 'G0557' | 'G0558';

export const FEES: Record<BillingCode, number> = {
  '99490': 66.13,
  G0557: 53.78,
  G0558: 117.24,
};

/** CY2027 proposed rule: conversion factor -1.68% (the one-year 2.5% bump for 2026 expires), relative values unchanged. */
export const FEES_2027_PROPOSED: Record<BillingCode, number> = {
  '99490': 65.02,
  G0557: 52.88,
  G0558: 115.27,
};

/** Operator policy: an APCM patient should have a human (nurse) contact at least this often. */
export const HUMAN_TOUCH_DAYS = 90;

export const CODE_LABEL: Record<BillingCode, string> = {
  '99490': 'CCM, first 20 min clinical staff',
  G0557: 'APCM, 2+ chronic conditions',
  G0558: 'APCM, QMB with 2+ chronic conditions',
};

export const PROGRAM_LABEL = { ccm: 'CCM', apcm: 'APCM' } as const;

export type ActivityKey =
  | 'consent_call'
  | 'nurse_call'
  | 'call_review'
  | 'ehr_chart_review'
  | 'ehr_med_review'
  | 'ehr_care_plan_review'
  | 'coordination'
  | 'education'
  | 'documentation'
  | 'practitioner_review';

export const ACTIVITIES: Record<
  ActivityKey,
  { label: string; ehr: boolean; counts: boolean; outcomes: string[]; manual: boolean }
> = {
  consent_call: {
    label: 'Consent call',
    ehr: false,
    counts: false,
    outcomes: ['Agreed', 'Declined', 'Call back later'],
    manual: false,
  },
  nurse_call: {
    label: 'Nurse call',
    ehr: false,
    counts: true,
    outcomes: ['Completed', 'No answer', 'Declined'],
    manual: false,
  },
  call_review: {
    label: 'AI call review',
    ehr: false,
    counts: true,
    outcomes: ['Reviewed, no action', 'Reviewed, follow-up created'],
    manual: true,
  },
  ehr_chart_review: {
    label: 'EHR chart review',
    ehr: true,
    counts: true,
    outcomes: ['No changes needed', 'Findings noted for care plan', 'Follow-up needed'],
    manual: true,
  },
  ehr_med_review: {
    label: 'EHR medication review',
    ehr: true,
    counts: true,
    outcomes: [
      'No discrepancies',
      'Discrepancy found, change requested',
      'Discrepancy found, resolved',
      'Medication list updated',
    ],
    manual: true,
  },
  ehr_care_plan_review: {
    label: 'EHR care plan review',
    ehr: true,
    counts: true,
    outcomes: ['Care plan current', 'Care plan updated', 'Update requested from physician'],
    manual: true,
  },
  coordination: {
    label: 'Care coordination',
    ehr: false,
    counts: true,
    outcomes: [
      'Pharmacy contacted',
      'Specialist office contacted',
      'Appointment arranged',
      'Home health or community service arranged',
      'Other coordination',
    ],
    manual: true,
  },
  education: {
    label: 'Patient education',
    ehr: false,
    counts: true,
    outcomes: ['Self-management education', 'Medication education', 'Caregiver education'],
    manual: true,
  },
  documentation: {
    label: 'Documentation',
    ehr: false,
    counts: true,
    outcomes: ['Documentation completed'],
    manual: true,
  },
  practitioner_review: {
    label: 'Practitioner review',
    ehr: false,
    counts: true,
    outcomes: ['Reviewed', 'Plan changed'],
    manual: true,
  },
};
