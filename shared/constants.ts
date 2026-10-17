import type { Program, Role } from './types';

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
/** CCM add-on 99439: each further full 20 minutes, at most two a month. */
export const CCM_ADDON_MINUTES = 20;
export const CCM_ADDON_MAX = 2;
/** Complex CCM 99487 needs 60 minutes; add-on 99489 for each further full 30. */
export const COMPLEX_MINUTES = 60;
export const COMPLEX_ADDON_MINUTES = 30;
export const AI_MAX_ATTEMPTS = 3;
export const AI_RETRY_BUSINESS_DAYS = 2;
export const AI_CALL_HOUR = '10:00:00';
/** The "care not yet delivered" queue opens on this day of the month. */
export const CARE_QUEUE_FROM_DAY = 20;

export type BillingCode = '99490' | '99439' | '99487' | '99489' | 'G0556' | 'G0557' | 'G0558';

export const BILLING_CODES: BillingCode[] = ['99490', '99439', '99487', '99489', 'G0556', 'G0557', 'G0558'];
export const ADD_ON_CODES: BillingCode[] = ['99439', '99489'];

/**
 * The practice's fee schedule. 99490, G0557 and G0558 are the V1 figures;
 * the other four are placeholders to verify against the CY2026 physician fee
 * schedule. Ops edits all of them in billing settings.
 */
export const DEFAULT_FEES: Record<BillingCode, number> = {
  '99490': 66.13,
  '99439': 51.71,
  '99487': 143.92,
  '99489': 77.09,
  G0556: 17.36,
  G0557: 53.78,
  G0558: 117.24,
};

export const PLACEHOLDER_FEES: BillingCode[] = ['99439', '99487', '99489', 'G0556'];

export const CODE_LABEL: Record<BillingCode, string> = {
  '99490': 'CCM, first 20 min clinical staff',
  '99439': 'CCM, each additional 20 min',
  '99487': 'Complex CCM, first 60 min',
  '99489': 'Complex CCM, each additional 30 min',
  G0556: 'APCM Level 1, one condition or fewer',
  G0557: 'APCM Level 2, 2+ chronic conditions',
  G0558: 'APCM Level 3, QMB with 2+ chronic conditions',
};

export interface BillingSettings {
  fees: Record<BillingCode, number>;
  /** Box 24J: the supervising physician who renders the service. */
  renderingNpi: string;
  /** Box 33a: the practice's group NPI. */
  billingNpi: string;
  /** Box 24B: 11 office, 12 home. */
  placeOfService: '11' | '12';
  /** Box 24D modifier, empty unless a payer asks for one. */
  modifier: string;
  /** What the matrix proposes for traditional Medicare, 2+ conditions, not QMB. */
  twoPlusDefault: Program;
  /** Payer names that count as participating value-based payers (APCM-eligible). */
  valueBasedPayers: string[];
}

/** Fictional NPIs that pass the Luhn check. */
export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  fees: DEFAULT_FEES,
  renderingNpi: '1543210987',
  billingNpi: '1765432103',
  placeOfService: '11',
  modifier: '',
  twoPlusDefault: 'ccm',
  valueBasedPayers: ['Westfield ACO REACH'],
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
    label: 'Physician review',
    ehr: false,
    counts: true,
    outcomes: ['Reviewed', 'Plan changed', 'Directive issued', 'Orders updated'],
    manual: true,
  },
};
