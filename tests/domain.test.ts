// Pure domain rules: ICD-10 matrix, payer classification, the column mapper,
// date parsing, program determination, billing lines, NPI and CMS-1500 rows.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_BILLING_SETTINGS } from '../shared/constants';
import { DEFAULT_MATRIX, distinctConditions, lookupChronic, normalizeIcd } from '../shared/icd10';
import { headerScore, missingRequired, suggestMapping, FIELDS } from '../shared/mapper';
import { npiValid } from '../shared/npi';
import { billingLines } from '../server/billing';
import { buildClaim, MULTI_MORBID_ERROR, preflight, sanitize } from '../server/cms1500';
import { determine } from '../server/determine';
import { classifyPayer } from '../server/payer';
import { parseDate } from '../server/roster';
import type { Patient } from '../shared/model';

const fees = DEFAULT_BILLING_SETTINGS.fees;

test('ICD-10 codes are normalised and matched by longest category prefix', () => {
  assert.deepEqual(normalizeIcd('e119'), { code: 'E11.9', repaired: true });
  assert.deepEqual(normalizeIcd('I10'), { code: 'I10', repaired: false });
  assert.equal(normalizeIcd('DIABETES'), null);
  assert.equal(lookupChronic('E11.9')?.match, 'exact');
  assert.equal(lookupChronic('E11.22')?.condition, 'diabetes');
  assert.equal(lookupChronic('E11.22')?.match, 'category');
  assert.equal(lookupChronic('F41.1')?.condition, 'anxiety');
  assert.equal(lookupChronic('F41.9'), null, 'only generalized anxiety (F41.1) is in the matrix');
  assert.equal(lookupChronic('J06.9'), null, 'an acute code is not chronic');
  // Two diabetes codes are one condition.
  assert.equal(distinctConditions(['E11.9', 'E11.65', 'I10']).length, 2);
});

test('payer names are classified with a confidence', () => {
  const c = (n: string) => classifyPayer(n, ['Westfield ACO REACH']);
  assert.deepEqual([c('Medicare Part B').coverage, c('Medicare Part B').confidence], ['traditional', 'high']);
  assert.equal(c('Humana Gold Plus HMO').coverage, 'advantage');
  assert.equal(c('Aetna Medicare Advantage PPO').coverage, 'advantage');
  const qmb = c('Medicare / Texas Medicaid (QMB)');
  assert.deepEqual([qmb.coverage, qmb.dual, qmb.qmb], ['traditional', true, true]);
  assert.equal(c('UHC Dual Complete D-SNP').coverage, 'advantage');
  assert.equal(c('Westfield ACO REACH').coverage, 'vbc');
  assert.equal(c('BCBS PPO').coverage, 'other');
  assert.equal(c('medicaid').coverage, 'other');
});

test('the mapper maps messy EHR headers one-to-one and reports missing required fields', () => {
  const headers = ['Pt ID', 'Patient First Name', 'Surname', 'Birth Date', 'Payer', 'Subscriber ID', 'ICD10 Codes', 'Home Phone', 'Gender', 'Last Seen'];
  const m = suggestMapping(headers);
  const col = (k: keyof typeof m) => (m[k].column == null ? null : headers[m[k].column!]);
  assert.equal(col('patient_id'), 'Pt ID');
  assert.equal(col('first_name'), 'Patient First Name');
  assert.equal(col('last_name'), 'Surname');
  assert.equal(col('dob'), 'Birth Date');
  assert.equal(col('insurance_name'), 'Payer');
  assert.equal(col('insurance_id'), 'Subscriber ID');
  assert.equal(col('diagnosis_codes'), 'ICD10 Codes');
  assert.equal(col('phone'), 'Home Phone');
  assert.equal(col('sex'), 'Gender');
  assert.equal(col('last_visit_date'), 'Last Seen');
  assert.deepEqual(missingRequired(m), []);
  const used = Object.values(m).map((x) => x.column).filter((x) => x != null);
  assert.equal(new Set(used).size, used.length, 'no column is used twice');
  // Typos still match; a prefix does not.
  const first = FIELDS.find((f) => f.key === 'first_name')!;
  assert.ok(headerScore('Fist Name', first) >= 0.82);
  assert.ok(headerScore('Last Visit', FIELDS.find((f) => f.key === 'last_name')!) < 0.82);
  assert.deepEqual(missingRequired(suggestMapping(['MRN', 'First', 'Last'])).includes('dob'), true);
});

test('dates in common EHR formats are read as YYYY-MM-DD', () => {
  assert.equal(parseDate('02/17/1948'), '1948-02-17');
  assert.equal(parseDate('1948-02-17'), '1948-02-17');
  assert.equal(parseDate('19480217'), '1948-02-17');
  assert.equal(parseDate('2/7/48'), '1948-02-07');
  assert.equal(parseDate('46302'), '2026-10-07', 'Excel serial day number');
  assert.equal(parseDate('1950-13-40'), null);
});

test('determination proposes the program, tier and confidence', () => {
  const today = '2026-10-05';
  const run = (insurance: string, codes: string[], opts: { qmb?: boolean; repaired?: number; lastVisit?: string; settings?: typeof DEFAULT_BILLING_SETTINGS } = {}) => {
    const settings = opts.settings ?? DEFAULT_BILLING_SETTINGS;
    return determine(
      { codes, repaired: opts.repaired ?? 0, payer: classifyPayer(insurance, settings.valueBasedPayers), isQmb: !!opts.qmb, lastVisit: opts.lastVisit ?? '2026-09-01' },
      today,
      settings,
      DEFAULT_MATRIX,
    );
  };
  const brief = (d: ReturnType<typeof run>) => [d.status, d.program, d.code];
  assert.deepEqual(brief(run('Medicare Part B', ['I10'])), ['eligible_unconfirmed', 'apcm', 'G0556']);
  assert.deepEqual(brief(run('Medicare Part B', ['I10', 'E11.9'])), ['eligible_unconfirmed', 'ccm', '99490']);
  assert.deepEqual(brief(run('Medicare / Medicaid (QMB)', ['I10', 'E11.9'], { qmb: true })), ['eligible_unconfirmed', 'apcm', 'G0558']);
  assert.deepEqual(brief(run('Humana Gold Plus HMO', ['I10', 'E78.5'])), ['eligible_unconfirmed', 'ccm', '99490']);
  assert.deepEqual(brief(run('Humana Gold Plus HMO', ['I10'])), ['ineligible', null, null]);
  assert.deepEqual(brief(run('Westfield ACO REACH', ['I10', 'E11.9'])), ['eligible_unconfirmed', 'apcm', 'G0557']);
  assert.deepEqual(brief(run('BCBS PPO', ['I10', 'E11.9'])), ['ineligible', null, null]);
  // The practice setting decides traditional Medicare, 2+ conditions, not QMB.
  assert.equal(run('Medicare', ['I10', 'E11.9'], { settings: { ...DEFAULT_BILLING_SETTINGS, twoPlusDefault: 'apcm' } }).code, 'G0557');
  // Confidence: a known payer name and exact codes score 100; a keyword payer, category codes and repairs score lower.
  assert.equal(run('Medicare', ['I10', 'E11.9']).confidence, 100);
  const low = run('Medicare / Medicaid', ['I11.9', 'E11.22'], { repaired: 1 });
  assert.ok(low.confidence < 70, `got ${low.confidence}`);
  assert.equal(run('Medicare', ['I10'], { lastVisit: '2025-01-01' }).status, 'needs_visit');
});

test('billing lines: 99439 add-ons, complex CCM only with the physician mark, APCM tiers', () => {
  const ccm = (minutes: number, complexity: 'standard' | 'complex' = 'standard') =>
    billingLines({ program: 'ccm', minutes, complexity, conditions: 2, qmb: false }, fees).map((l) => `${l.code}x${l.units}`);
  assert.deepEqual(ccm(19), []);
  assert.deepEqual(ccm(20), ['99490x1']);
  assert.deepEqual(ccm(39), ['99490x1']);
  assert.deepEqual(ccm(41), ['99490x1', '99439x1']);
  assert.deepEqual(ccm(95), ['99490x1', '99439x2'], '99439 is capped at two units');
  assert.deepEqual(ccm(59, 'complex'), ['99490x1', '99439x1'], 'complex CCM needs 60 minutes');
  assert.deepEqual(ccm(60, 'complex'), ['99487x1']);
  assert.deepEqual(ccm(95, 'complex'), ['99487x1', '99489x1']);
  assert.deepEqual(ccm(120, 'complex'), ['99487x1', '99489x2']);
  assert.deepEqual(ccm(70), ['99490x1', '99439x2'], 'without the mark, 60+ minutes stays standard CCM');
  const apcm = (conditions: number, qmb: boolean) => billingLines({ program: 'apcm', minutes: 0, complexity: 'standard', conditions, qmb }, fees)[0].code;
  assert.equal(apcm(1, false), 'G0556');
  assert.equal(apcm(1, true), 'G0556');
  assert.equal(apcm(2, false), 'G0557');
  assert.equal(apcm(3, true), 'G0558');
  const two = billingLines({ program: 'ccm', minutes: 45, complexity: 'standard', conditions: 2, qmb: false }, fees);
  assert.equal(two[1].amount, fees['99439']);
});

test('NPI check digit (Luhn over 80840 + first nine digits)', () => {
  assert.ok(npiValid(DEFAULT_BILLING_SETTINGS.renderingNpi));
  assert.ok(npiValid(DEFAULT_BILLING_SETTINGS.billingNpi));
  assert.ok(!npiValid('1487654321'), 'the example in the spec does not pass the check');
  assert.ok(npiValid('1487654323'));
  assert.ok(!npiValid('12345'));
});

function patient(over: Partial<Patient> = {}): Patient {
  return {
    id: 1,
    mrn: 'PT-88301A',
    first_name: 'Eleanor',
    last_name: 'Smith',
    dob: '1951-11-14',
    phone: '+1 555 0101',
    state: 'TX',
    coverage: 'traditional',
    is_qmb: false,
    qualifying_codes: ['I10', 'E11.9'],
    sex: 'F',
    insurance_name: 'Medicare',
    insurance_id: '3EG4-XB1-WH88',
    diagnosis_codes: ['I10', 'E11.9'],
    proposed_program: 'ccm',
    confidence: 100,
    confidence_reasons: [],
    ops_decision: 'approved',
    ops_note: null,
    ops_decided_at: null,
    last_visit_date: '2026-09-01',
    caregiver_name: null,
    caregiver_phone: null,
    preferred_language: 'English',
    prefers_human: false,
    status: 'active',
    ineligible_reason: null,
    program: 'ccm',
    ...over,
  };
}

test('CMS-1500 rows follow the spec format, and pre-flight excludes bad claims', () => {
  const s = DEFAULT_BILLING_SETTINGS;
  const lines = billingLines({ program: 'ccm', minutes: 45, complexity: 'standard', conditions: 2, qmb: false }, fees);
  const claim = buildClaim({ patient: patient(), lines, diagnosis: ['I10', 'E11.9'] }, '2026-10', s, (c) => distinctConditions(c));
  const r = claim.rows[0];
  assert.equal(r.PATIENT_ID, 'PT-88301A');
  assert.equal(r.PATIENT_INS_ID, '3EG4XB1WH88');
  assert.equal(r.PATIENT_DOB, '19511114');
  assert.equal(r.PATIENT_GENDER, 'F');
  assert.equal(r.DATE_OF_SERVICE, '20261031');
  assert.equal(r.PLACE_OF_SERVICE, '11');
  assert.deepEqual([r.DIAG_CODE_A, r.DIAG_CODE_B, r.DIAG_POINTER_1, r.DIAG_POINTER_2], ['I10', 'E119', 'A', 'B']);
  assert.deepEqual(claim.rows.map((x) => [x.PROCEDURE_CODE, x.UNITS, x.CHARGE_AMOUNT]), [
    ['99490', '1', fees['99490'].toFixed(2)],
    ['99439', '1', fees['99439'].toFixed(2)],
  ]);

  // Before the date of service the export is closed; on it, the clean claim passes.
  assert.equal(preflight([claim], '2026-10', '2026-10-30').excluded.length, 1);
  const onDos = preflight([claim], '2026-10', '2026-10-31');
  assert.equal(onDos.open, true);
  assert.equal(onDos.clean.length, 1);

  // One chronic condition on a CCM claim breaks the multi-morbid rule.
  const single = buildClaim({ patient: patient({ qualifying_codes: ['I10'] }), lines, diagnosis: ['I10'] }, '2026-10', s, (c) => distinctConditions(c));
  assert.ok(preflight([single], '2026-10', '2026-10-31').excluded[0].errors.includes(MULTI_MORBID_ERROR));

  // Sanitising strips characters that shift CSV columns; a bad member ID and NPI exclude the claim.
  assert.equal(sanitize('Smith, "Jr";\tx'), 'Smith Jrx');
  const messy = buildClaim({ patient: patient({ last_name: "O'Neil, Jr", insurance_id: '8EM1/WX2' }), lines, diagnosis: ['I10', 'E11.9'] }, '2026-10', { ...s, renderingNpi: '1487654321' }, (c) => distinctConditions(c));
  assert.equal(messy.rows[0].PATIENT_LAST, 'ONeil Jr');
  assert.ok(messy.sanitized.length > 0);
  const errs = preflight([messy], '2026-10', '2026-10-31').excluded[0].errors.join(' ');
  assert.match(errs, /PATIENT_INS_ID/);
  assert.match(errs, /RENDERING_PROV_NPI/);
});
