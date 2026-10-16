import type { Role } from './types';

export const PRACTICE = {
  name: 'Westfield Family Medicine',
  state: 'TX',
  phone: '+1 555 0100',
};

export const STAFF: Record<Role, { name: string; title: string; short: string }> = {
  nurse: { name: 'Rachel Okafor, RN', title: 'Nurse', short: 'Rachel' },
  physician: { name: 'Dr. Anita Patel', title: 'Physician', short: 'Dr. Patel' },
  manager: { name: 'Dana Brooks', title: 'Practice manager', short: 'Dana' },
};

export const ROLE_LABEL: Record<Role, string> = {
  nurse: 'Nurse',
  physician: 'Physician',
  manager: 'Practice manager',
};

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

export const CODE_LABEL: Record<BillingCode, string> = {
  '99490': 'CCM, first 20 min clinical staff',
  G0557: 'APCM, 2+ chronic conditions',
  G0558: 'APCM, QMB with 2+ chronic conditions',
};

export const PROGRAM_LABEL = { ccm: 'CCM', apcm: 'APCM' } as const;

export type ActivityKey =
  | 'consent_call'
  | 'nurse_call'
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
