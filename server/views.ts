// Builds the client state. GET /api/state carries slim summaries for every
// patient (about 300 in the operator demo) from one pass over each table;
// GET /api/patient/:id builds one patient in full. Everything derived lives
// here so the client only renders.

import type {
  AlertView,
  AppState,
  AttestationRecord,
  BillingView,
  BriefView,
  CallView,
  EligibilityRunView,
  EnrollBucket,
  NoteView,
  NurseRow,
  OpsView,
  PatientSummary,
  PatientView,
  PracticeRow,
  QueueCategory,
  QueueLane,
  QueueRow,
  RosterUploadView,
  RunView,
  StepView,
} from '../shared/api';
import { riskReviewNeeded } from '../shared/codes';
import { ACK_WINDOW_MINUTES, ACTIVITIES, CCM_MINUTES, FEES, HUMAN_TOUCH_DAYS, MONTH_END, OPERATOR_DEFAULT, PROGRAM_LABEL, STAFF, type PracticeInfo } from '../shared/constants';
import type { Call, CallSetup, Consent, Flag, MonthClose, Patient, Practice, Task, TimeEntry } from '../shared/model';
import type { PilotInputs, RoiInputs } from '../shared/roi';
import { READINGS } from '../shared/rules';
import { addDays, ageOn, dateOf, floorMinutes, fmtDate, fmtDateTime, fmtShort, inMonth, monthLabel, monthOf, toMs } from '../shared/time';
import { billingAll, billingFor, lastHumanTouchOf, touchCutoff } from './billing';
import { callFindings, callSeconds, callSummary, readingResults, reached } from './describe';
import { attestationText, buildNote } from './note';
import { fullName, isEnrolled, type Service } from './service';

export const QUEUE_ORDER: QueueCategory[] = ['urgent', 'concern', 'unreached', 'ccm_due', 'touch_due', 'tasks', 'review'];
const QUEUE_LABEL: Record<QueueCategory, string> = {
  urgent: 'Urgent',
  concern: 'Concern',
  unreached: 'Not reached',
  ccm_due: 'CCM call due',
  touch_due: 'Nurse touch due',
  tasks: 'Open tasks',
  review: 'Quick review',
};

/** The operator the demo is shown as: the name on the ROI page, or the default. */
const QUEUE_LANE: Record<QueueCategory, QueueLane> = {
  urgent: 'person',
  concern: 'person',
  unreached: 'person',
  touch_due: 'person',
  tasks: 'person',
  ccm_due: 'scheduled',
  review: 'review',
};

export function operatorName(svc: Service): string {
  return svc.kv<RoiInputs | null>('roi', null)?.operatorName?.trim() || OPERATOR_DEFAULT;
}

export function practiceInfo(pr: Practice): PracticeInfo {
  return {
    id: pr.id,
    code: pr.code,
    name: pr.name,
    city: pr.city,
    state: pr.state,
    phone: pr.phone,
    physician: pr.physician,
    careManager: pr.care_manager,
    simulated: pr.simulated,
  };
}

function enrollBucket(p: Patient): EnrollBucket | null {
  switch (p.status) {
    case 'eligible_unconfirmed':
      return 'awaiting_confirmation';
    case 'confirmed':
      return 'needs_consent';
    case 'consented':
      return 'needs_setup';
    case 'ineligible':
    case 'needs_visit':
      return 'not_eligible';
    case 'paused':
    case 'opted_out':
      return 'stopped';
    default:
      return null;
  }
}

function prevMonth(month: string): string {
  return monthOf(addDays(`${month}-01`, -1));
}

// ───────────────────────────── snapshot: every table once

interface Snap {
  month: string;
  patients: Patient[];
  consent: Map<number, Consent>;
  setup: Map<number, CallSetup>;
  calls: Map<number, Call[]>;
  tasks: Map<number, Task[]>;
  flags: Map<number, Flag[]>;
  time: Map<number, TimeEntry[]>;
  closes: Map<number, MonthClose>;
}

function group<T extends { patient_id: number }>(rows: T[]): Map<number, T[]> {
  const m = new Map<number, T[]>();
  for (const r of rows) {
    const list = m.get(r.patient_id);
    if (list) list.push(r);
    else m.set(r.patient_id, [r]);
  }
  return m;
}

function loadSnapshot(svc: Service, month: string, only?: number): Snap {
  const where = only != null ? 'WHERE patient_id = ?' : '';
  const args = only != null ? [only] : [];
  const patients = only != null ? [svc.patient(only)] : svc.patients();
  const consent = new Map<number, Consent>();
  for (const r of svc.db.prepare(`SELECT * FROM consent ${where} ORDER BY id`).all(...args) as any[]) {
    for (const k of ['explained_availability', 'explained_cost_sharing', 'explained_one_practitioner', 'explained_right_to_stop', 'automated_calls_ok', 'texts_ok']) r[k] = !!r[k];
    consent.set(r.patient_id, r);
  }
  const setup = new Map<number, CallSetup>();
  for (const r of svc.db.prepare(`SELECT * FROM call_setup ${where}`).all(...args) as any[]) {
    setup.set(r.patient_id, svc.setupOf(r.patient_id)!);
  }
  const calls = group(
    (
      svc.db
        .prepare(
          `SELECT id, patient_id, kind, status, scheduled_for, attempt, purpose, started_at, ended_at, outcome, answered_by,
                  answers, flag, nurse_note, reviewed_at
           FROM call ${where} ORDER BY COALESCE(started_at, scheduled_for), id`,
        )
        .all(...args) as any[]
    ).map((r) => ({ ...r, transcript: [], answers: r.answers && (inMonth(r.started_at, month) || inMonth(r.started_at, prevMonth(month))) ? JSON.parse(r.answers) : null }) as Call),
  );
  const tasks = group(svc.db.prepare(`SELECT * FROM task ${where} ORDER BY status DESC, due, id`).all(...args) as Task[]);
  const flags = group(svc.db.prepare(`SELECT * FROM flag ${where} ORDER BY id`).all(...args) as Flag[]);
  const time = group(
    (svc.db.prepare(`SELECT * FROM time_entry WHERE started_at LIKE ? ${only != null ? 'AND patient_id = ?' : ''} ORDER BY started_at, id`).all(`${month}%`, ...args) as any[]).map(
      (r) => ({ ...r, counts: !!r.counts }) as TimeEntry,
    ),
  );
  const closes = new Map<number, MonthClose>();
  for (const r of svc.db.prepare(`SELECT * FROM month_close WHERE month = ? ${only != null ? 'AND patient_id = ?' : ''}`).all(month, ...args) as MonthClose[]) closes.set(r.patient_id, r);
  return { month, patients, consent, setup, calls, tasks, flags, time, closes };
}

function aiAllowedFrom(p: Patient, consent: Consent | null, setup: CallSetup | null): { ok: boolean; reason: string | null } {
  if (p.status !== 'active') return { ok: false, reason: 'not active' };
  if (p.program !== 'apcm') return { ok: false, reason: 'CCM patients get a nurse call' };
  if (p.prefers_human) return { ok: false, reason: 'prefers a human: nurse calls only' };
  if (p.preferred_language !== 'English') return { ok: false, reason: `AI check-ins run in English only for now (prefers ${p.preferred_language})` };
  if (!consent || consent.revoked_at) return { ok: false, reason: 'no active consent' };
  if (!consent.automated_calls_ok) return { ok: false, reason: 'no automated-call permission in the consent' };
  if (!setup) return { ok: false, reason: 'no call setup' };
  return { ok: true, reason: null };
}

/** The one-line contact summary and the queue row: shared by summaries and the full view. */
function contactAndQueue(
  p: Patient,
  practice: Practice,
  snap: Snap,
  now: string,
  minutes: number,
  lastTouch: string | null,
): { contact: string; queue: QueueRow | null; contacts: Call[] } {
  const month = snap.month;
  const setup = snap.setup.get(p.id) ?? null;
  const calls = snap.calls.get(p.id) ?? [];
  const monthCalls = calls.filter((c) => c.status === 'done' && inMonth(c.started_at, month));
  const contacts = monthCalls.filter(reached);
  const scheduled = calls.filter((c) => c.status === 'scheduled' && inMonth(c.scheduled_for, month));
  const flags = snap.flags.get(p.id) ?? [];
  const tasks = snap.tasks.get(p.id) ?? [];
  const open = flags.filter((f) => !f.resolved_at);
  const openTasks = tasks.filter((t) => t.status === 'open');

  let contact: string;
  if (contacts.length) {
    const c = contacts[contacts.length - 1];
    contact = `Completed contact: ${c.kind === 'ai' ? 'AI check-in' : 'nurse call'} ${fmtShort(c.started_at)}${c.answered_by === 'caregiver' ? ' (caregiver answered)' : ''}.`;
  } else if (p.status !== 'active') {
    contact = `No monthly contact: ${p.status.replace(/_/g, ' ')}.`;
  } else {
    const tries = monthCalls.filter((c) => c.outcome === 'no_answer');
    const next = scheduled[0];
    contact = `No completed contact yet.${tries.length ? ` ${tries.length} unanswered ${tries.length === 1 ? 'try' : 'tries'} (${tries.map((c) => fmtShort(c.started_at)).join(', ')}).` : ''}${
      next ? ` ${next.kind === 'ai' ? `AI check-in scheduled ${fmtDateTime(next.scheduled_for)}` : 'Monthly nurse call due'}.` : ''
    }`;
  }

  let q: { category: QueueCategory; reason: string; ackDueAt: string | null; acknowledged: boolean } | null = null;
  if (p.status === 'active' || p.status === 'opted_out' || p.status === 'paused') {
    const urgent = open.find((f) => f.level === 'urgent');
    const concern = open.find((f) => f.level === 'concern');
    const unreached = openTasks.find((t) => t.kind === 'call' && t.title.startsWith('Not reached'));
    const ccmDue = p.program === 'ccm' && p.status === 'active' && calls.some((c) => c.kind === 'nurse' && c.status === 'scheduled' && c.scheduled_for! <= `${dateOf(now)}T23:59:59`);
    const nurseThisMonth = contacts.some((c) => c.kind === 'nurse');
    const touchDue = p.program === 'apcm' && p.status === 'active' && !nurseThisMonth && (!lastTouch || lastTouch < touchCutoff(month));
    const toReview = monthCalls.filter((c) => c.kind === 'ai' && reached(c) && c.flag === 'none' && !c.reviewed_at);
    if (urgent) {
      q = {
        category: 'urgent',
        reason: `${urgent.summary}${urgent.acknowledged_at ? ' — acknowledged, resolve when handled' : ''}`,
        ackDueAt: urgent.acknowledged_at ? null : urgent.ack_due_at,
        acknowledged: !!urgent.acknowledged_at,
      };
    } else if (concern) {
      const src = calls.find((c) => c.id === concern.call_id);
      q = {
        category: 'concern',
        reason: `${src ? `${src.kind === 'ai' ? 'AI call' : 'Nurse call'} ${fmtShort(src.started_at)}: ` : ''}${concern.summary}`,
        ackDueAt: null,
        acknowledged: !!concern.acknowledged_at,
      };
    } else if (unreached) {
      const tries = monthCalls.filter((c) => c.kind === 'ai' && c.outcome === 'no_answer');
      q = { category: 'unreached', reason: `Not reached after ${tries.length} tries (${tries.map((c) => fmtShort(c.started_at)).join(', ')})`, ackDueAt: null, acknowledged: false };
    } else if (ccmDue) {
      q = { category: 'ccm_due', reason: 'Monthly nurse call due', ackDueAt: null, acknowledged: false };
    } else if (touchDue) {
      q = {
        category: 'touch_due',
        reason: `No nurse contact since ${lastTouch ? fmtDate(lastTouch) : 'enrollment'} (policy: every ${HUMAN_TOUCH_DAYS} days)`,
        ackDueAt: null,
        acknowledged: false,
      };
    } else if (openTasks.length) {
      q = {
        category: 'tasks',
        reason: `${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}: ${openTasks.map((t) => t.title).join('; ')}`,
        ackDueAt: null,
        acknowledged: false,
      };
    } else if (toReview.length) {
      const c = toReview[toReview.length - 1];
      q = { category: 'review', reason: `${callSummary(c, setup)} Quick review.`, ackDueAt: null, acknowledged: false };
    }
  }
  const queue: QueueRow | null = q
    ? {
        patientId: p.id,
        name: fullName(p),
        mrn: p.mrn,
        practiceCode: practice.code,
        practiceName: practice.name,
        careManager: p.care_manager,
        program: p.program ? PROGRAM_LABEL[p.program] : '—',
        category: q.category,
        categoryLabel: QUEUE_LABEL[q.category],
        lane: QUEUE_LANE[q.category],
        reason: q.reason,
        minutes,
        ackDueAt: q.ackDueAt,
        acknowledged: q.acknowledged,
      }
    : null;
  return { contact, queue, contacts };
}

function inMonthEndOf(p: Patient, snap: Snap): boolean {
  if (p.status === 'active') return true;
  if (p.status !== 'opted_out' && p.status !== 'paused') return false;
  const month = snap.month;
  return (
    (snap.calls.get(p.id) ?? []).some((c) => c.status === 'done' && inMonth(c.started_at, month)) ||
    (snap.time.get(p.id) ?? []).length > 0 ||
    (snap.tasks.get(p.id) ?? []).some((t) => inMonth(t.created_at, month))
  );
}

type Internal = PatientSummary & { lastTouch: string | null; queue: QueueRow | null };

function summarize(svc: Service, snap: Snap, p: Patient, billing: BillingView, now: string): Internal {
  const pr = svc.practiceOf(p);
  const consent = snap.consent.get(p.id) ?? null;
  const setup = snap.setup.get(p.id) ?? null;
  const time = snap.time.get(p.id) ?? [];
  const countedSeconds = time.filter((t) => t.counts).reduce((s, t) => s + t.seconds, 0);
  const minutes = floorMinutes(countedSeconds);
  const lastTouch = lastHumanTouchOf(snap.calls.get(p.id) ?? [], consent);
  const { contact, queue, contacts } = contactAndQueue(p, pr, snap, now, minutes, lastTouch);
  const mc = snap.closes.get(p.id) ?? null;
  return {
    id: p.id,
    mrn: p.mrn,
    name: fullName(p),
    first_name: p.first_name,
    last_name: p.last_name,
    dob: p.dob,
    age: ageOn(p.dob, now),
    phone: p.phone,
    practiceId: pr.id,
    practiceCode: pr.code,
    practiceName: pr.name,
    simulated: pr.simulated,
    careManager: p.care_manager,
    status: p.status,
    ineligible_reason: p.ineligible_reason,
    program: p.program,
    coverage: p.coverage,
    is_qmb: p.is_qmb,
    prefers_human: p.prefers_human,
    preferred_language: p.preferred_language,
    last_visit_date: p.last_visit_date,
    caregiver_name: p.caregiver_name,
    codes: p.qualifying_codes,
    consent: consent ? { method: consent.method, consent_date: consent.consent_date, automated_calls_ok: consent.automated_calls_ok, texts_ok: consent.texts_ok, revoked_at: consent.revoked_at } : null,
    hasSetup: !!setup,
    minutes,
    completedContact: contacts.length > 0,
    contact,
    // Lists only need what failed or warned; the full check list is in the patient view and the audit packet.
    billing: { ...billing, checks: billing.checks.filter((c) => c.status !== 'pass') },
    enrollBucket: enrollBucket(p),
    queue,
    inMonthEnd: inMonthEndOf(p, snap),
    note: mc ? { filedAt: mc.filed_at, attestedAt: mc.attested_at, edited: mc.note_text != null && !mc.filed_at } : null,
    ai: aiAllowedFrom(p, consent, setup),
    riskReview: isEnrolled(p) && riskReviewNeeded(p.qualifying_codes) && !p.risk_note,
    lastTouch,
  };
}

// ───────────────────────────── the whole state

export function buildState(svc: Service): AppState {
  svc.tick();
  const now = svc.now();
  const month = monthOf(now);
  const clockMs = svc.demoNowMs();
  const snap = loadSnapshot(svc, month);
  const billing = billingAll(svc, month);
  const full = snap.patients.map((p) => summarize(svc, snap, p, billing.get(p.id)!, now));
  const summaries: PatientSummary[] = full.map(({ lastTouch: _t, queue: _q, ...s }) => s);
  const byId = new Map(summaries.map((s) => [s.id, s]));
  const queue = full
    .map((v) => v.queue)
    .filter((q): q is QueueRow => !!q)
    .sort(
      (a, b) =>
        QUEUE_ORDER.indexOf(a.category) - QUEUE_ORDER.indexOf(b.category) ||
        (a.ackDueAt ?? '').localeCompare(b.ackDueAt ?? '') ||
        a.mrn.localeCompare(b.mrn),
    );
  const live = svc.livePractice();
  const allFlags = svc.allFlags();
  const alerts: AlertView[] = allFlags
    .filter((f) => f.level === 'urgent' && !f.resolved_at)
    .map((f) => {
      const p = byId.get(f.patient_id)!;
      return {
        flagId: f.id,
        patientId: p.id,
        name: p.name,
        mrn: p.mrn,
        practiceName: p.practiceName,
        live: !p.simulated,
        summary: f.summary,
        escalation: f.escalation,
        raisedAt: f.raised_at,
        ackDueAt: f.ack_due_at,
        acknowledgedAt: f.acknowledged_at,
      };
    });
  const t = svc.timer();
  const ready = summaries.filter((r) => r.billing.status === 'ready');
  const records = svc.kv<AttestationRecord[]>('attestations', []).filter((r) => r.month === month && r.practice === live.name);
  const liveSummaries = summaries.filter((s) => s.practiceId === live.id);
  const pending = liveSummaries.filter((v) => v.note?.filedAt && !v.note.attestedAt).map((v) => v.id);
  const counts = svc.db
    .prepare("SELECT COUNT(*) AS events, SUM(CASE WHEN type LIKE 'outbox.%' THEN 1 ELSE 0 END) AS outbox FROM event")
    .get() as { events: number; outbox: number | null };
  const roi = svc.kv<RoiInputs | null>('roi', null);
  const monthEndIds = summaries.filter((v) => v.inMonthEnd).map((v) => v.id);
  const liveIds = new Set(liveSummaries.map((s) => s.id));
  return {
    version: svc.version(),
    operator: operatorName(svc),
    practices: svc.practices().map(practiceInfo),
    live: practiceInfo(live),
    staff: STAFF,
    clock: {
      demoNow: now,
      demoNowMs: clockMs,
      serverRealMs: svc.realMs(),
      capMs: svc.capFor(clockMs),
      speed: svc.speed(),
      month,
      monthLabel: monthLabel(month),
      afterMonthEnd: now >= MONTH_END,
    },
    timer: t
      ? {
          patientId: t.patientId,
          patientName: fullName(svc.patient(t.patientId)),
          activity: t.activity,
          activityLabel: ACTIVITIES[t.activity].label,
          startedAt: t.startedAt,
          startedRealMs: t.startedReal,
          speed: t.speed,
          callId: t.callId,
        }
      : null,
    patients: summaries,
    queue,
    alerts,
    roster: svc.kv<RosterUploadView | null>('lastUpload', null),
    lastRun: svc.kv<RunView | null>('lastRun', null),
    lastEligibility: svc.kv<EligibilityRunView | null>('lastEligibility', null),
    aiScheduled: (svc.db.prepare("SELECT COUNT(*) AS n FROM call WHERE kind = 'ai' AND status = 'scheduled' AND scheduled_for LIKE ?").get(`${month}%`) as { n: number }).n,
    fastForwarded: svc.kv('fastForwarded', false),
    billing: {
      readyCount: ready.length,
      readyTotal: Math.round(ready.reduce((s, r) => s + (r.billing.amount ?? 0), 0) * 100) / 100,
      heldCount: summaries.filter((r) => r.billing.status === 'held').length,
    },
    monthEnd: {
      patientIds: monthEndIds,
      filed: summaries.filter((v) => v.inMonthEnd && v.note?.filedAt).length,
      total: monthEndIds.length,
    },
    attestation: {
      text: attestationText(month, live.name),
      records,
      pending,
      urgent: allFlags
        .filter((f) => f.level === 'urgent' && liveIds.has(f.patient_id) && inMonth(f.raised_at, month))
        .map((f) => ({ patientId: f.patient_id, name: byId.get(f.patient_id)!.name, summary: f.summary, note: f.note, raisedAt: f.raised_at, acknowledgedAt: f.acknowledged_at, resolvedAt: f.resolved_at })),
      escalations: [...liveIds].flatMap((id) =>
        (snap.tasks.get(id) ?? [])
          .filter((t) => t.kind === 'physician' && t.status === 'open')
          .map((t) => ({ taskId: t.id, patientId: id, name: byId.get(id)!.name, title: t.title, reason: t.reason })),
      ),
    },
    ops: buildOps(svc, snap, full, allFlags),
    settings: { roi, pilot: svc.kv<PilotInputs | null>('pilot', null) },
    checkpoint: svc.checkpointInfo(),
    counts: { events: counts.events, outbox: counts.outbox ?? 0 },
  };
}

// ───────────────────────────── the operator dashboard

const ACTIVITY_GROUP: Record<string, string> = {
  nurse_call: 'Nurse calls',
  call_review: 'AI call review',
  ehr_chart_review: 'EHR reviews',
  ehr_med_review: 'EHR reviews',
  ehr_care_plan_review: 'Care plan reviews',
  coordination: 'Coordination',
  education: 'Education',
  documentation: 'Documentation',
  practitioner_review: 'Practitioner review',
  consent_call: 'Consent calls',
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const share = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 1000 : null);

function buildOps(svc: Service, snap: Snap, summaries: Internal[], allFlags: Flag[]): OpsView {
  const month = snap.month;
  const sById = new Map(summaries.map((s) => [s.id, s]));
  const monthEnd = summaries.filter((s) => s.inMonthEnd && s.program);
  const apcm = monthEnd.filter((s) => s.program === 'apcm');
  const ccm = monthEnd.filter((s) => s.program === 'ccm');
  const active = summaries.filter((s) => s.status === 'active');

  // AI check-ins.
  let placed = 0;
  let caregiver = 0;
  let askedForPerson = 0;
  let optedOut = 0;
  let concerns = 0;
  let urgent = 0;
  const attempted = new Set<number>();
  const reachedSet = new Set<number>();
  for (const s of apcm) {
    for (const c of snap.calls.get(s.id) ?? []) {
      if (c.kind !== 'ai' || c.status !== 'done' || !inMonth(c.started_at, month)) continue;
      placed += 1;
      attempted.add(s.id);
      if (reached(c)) reachedSet.add(s.id);
      if (c.answered_by === 'caregiver') caregiver += 1;
      if (c.outcome === 'declined' && c.answers?.wantsHuman) askedForPerson += 1;
      if (c.outcome === 'opted_out') optedOut += 1;
      if (c.flag === 'concern') concerns += 1;
      if (c.flag === 'urgent') urgent += 1;
    }
  }
  const eligible = new Set([...attempted, ...apcm.filter((s) => s.ai.ok).map((s) => s.id)]);
  const unreached = apcm.filter((s) => (snap.tasks.get(s.id) ?? []).some((t) => t.title.startsWith('Not reached') && inMonth(t.created_at, month))).length;

  // Patients who needed a person this month.
  const kinds = new Map<string, Set<number>>();
  const mark = (kind: string, id: number) => kinds.set(kind, (kinds.get(kind) ?? new Set()).add(id));
  for (const s of apcm) {
    const flags = (snap.flags.get(s.id) ?? []).filter((f) => inMonth(f.raised_at, month));
    if (flags.some((f) => f.level === 'urgent')) mark('Urgent symptom', s.id);
    else if (flags.length) mark('Concern from a check-in', s.id);
    const tasks = (snap.tasks.get(s.id) ?? []).filter((t) => inMonth(t.created_at, month));
    if (tasks.some((t) => t.title.startsWith('Not reached'))) mark('Not reached after 3 AI tries', s.id);
    if (tasks.some((t) => t.title === 'Nurse call requested')) mark('Asked for a person', s.id);
    if (tasks.some((t) => t.title === 'Nurse check-in call')) mark('No AI call (permission, preference, language)', s.id);
    if (tasks.some((t) => t.kind === 'optout')) mark('Opted out of AI calls', s.id);
    const touch = (snap.calls.get(s.id) ?? []).some((c) => c.purpose === 'Nurse touch (90-day policy)' && inMonth(c.started_at, month));
    if (touch || s.queue?.category === 'touch_due') mark('Nurse touch due (90-day policy)', s.id);
  }
  const exceptionIds = new Set([...kinds.values()].flatMap((x) => [...x]));
  const CALL_KINDS = ['Urgent symptom', 'Concern from a check-in', 'Not reached after 3 AI tries', 'Asked for a person', 'Opted out of AI calls'];
  const fromCalls = new Set(CALL_KINDS.flatMap((k) => [...(kinds.get(k) ?? [])]));

  // Nurse time.
  let apcmSecs = 0;
  let ccmSecs = 0;
  let totalSecs = 0;
  const byActivity = new Map<string, number>();
  const perNurse = new Map<string, { secs: number; apcm: number; ccm: number; patients: Set<number> }>();
  for (const [pid, entries] of snap.time) {
    const s = sById.get(pid);
    for (const e of entries) {
      totalSecs += e.seconds;
      if (s?.program === 'apcm') apcmSecs += e.seconds;
      if (s?.program === 'ccm') ccmSecs += e.seconds;
      const g = e.activity === 'nurse_call' ? (s?.program === 'ccm' ? 'CCM nurse calls' : 'APCM nurse calls (exceptions)') : ACTIVITY_GROUP[e.activity] ?? e.activity;
      byActivity.set(g, (byActivity.get(g) ?? 0) + e.seconds);
      const n = perNurse.get(e.user) ?? { secs: 0, apcm: 0, ccm: 0, patients: new Set<number>() };
      n.secs += e.seconds;
      if (s?.program === 'apcm') n.apcm += e.seconds;
      if (s?.program === 'ccm') n.ccm += e.seconds;
      perNurse.set(e.user, n);
    }
  }
  const ccmMeets20 = ccm.filter((s) => s.minutes >= CCM_MINUTES).length;

  // Billing and integrity.
  const enrolled = summaries.filter((s) => s.billing.status !== 'not_enrolled');
  const readyRows = enrolled.filter((s) => s.billing.status === 'ready');
  const reasons = new Map<string, number>();
  for (const s of enrolled.filter((x) => x.billing.status === 'held')) {
    const r = (s.billing.reason ?? '').replace(/ \(\d+\)$/, '').replace(/: also enrolled at .*/, '').replace(/ for [A-Z][a-z]+ \d{4}$/, '');
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }
  const elig = svc.kv<EligibilityRunView | null>('lastEligibility', null);
  const dupRows = enrolled.filter((s) => s.billing.checks.some((c) => c.key === 'duplicate' && c.status === 'fail'));
  const avoided =
    (elig ? [...elig.maSwitches, ...elig.qmbEnded].reduce((a, x) => a + x.avoided, 0) : 0) + dupRows.reduce((a, s) => a + (s.billing.code ? FEES[s.billing.code] : 0), 0);

  // Escalations.
  // The 30-minute window runs from when the alert reached the nurse: the raise, or the redelivery
  // after a compressed demo run (ack_due_at always sits 30 minutes after the delivery).
  const urgentFlags = allFlags.filter((f) => f.level === 'urgent' && inMonth(f.raised_at, month));
  const acked = urgentFlags.filter((f) => f.acknowledged_at);
  const delivered = (f: Flag) => (f.ack_due_at ? toMs(f.ack_due_at) - ACK_WINDOW_MINUTES * 60000 : toMs(f.raised_at));
  const ackMins = acked.map((f) => (toMs(f.acknowledged_at!) - delivered(f)) / 60000);

  // Per practice.
  const practices: PracticeRow[] = svc.practices().map((pr) => {
    const mine = monthEnd.filter((s) => s.practiceId === pr.id);
    const mApcm = mine.filter((s) => s.program === 'apcm');
    const mCcm = mine.filter((s) => s.program === 'ccm');
    const mEligible = mApcm.filter((s) => eligible.has(s.id));
    const mins = (ids: { id: number }[]) => ids.reduce((a, s) => a + (snap.time.get(s.id) ?? []).reduce((b, e) => b + e.seconds, 0), 0) / 60;
    const all = summaries.filter((s) => s.practiceId === pr.id && s.billing.status !== 'not_enrolled');
    return {
      id: pr.id,
      code: pr.code,
      name: pr.name,
      physician: pr.physician,
      careManager: pr.care_manager,
      simulated: pr.simulated,
      enrolled: mine.filter((s) => s.status === 'active').length,
      apcm: mApcm.length,
      ccm: mCcm.length,
      aiReached: share(mEligible.filter((s) => reachedSet.has(s.id)).length, mEligible.length),
      exceptions: mApcm.filter((s) => exceptionIds.has(s.id)).length,
      apcmMinutesPerPatient: mApcm.length ? round1(mins(mApcm) / mApcm.length) : null,
      ccmMeets20: share(mCcm.filter((s) => s.minutes >= CCM_MINUTES).length, mCcm.length),
      ready: all.filter((s) => s.billing.status === 'ready').length,
      readyAmount: Math.round(all.filter((s) => s.billing.status === 'ready').reduce((a, s) => a + (s.billing.amount ?? 0), 0) * 100) / 100,
      held: all.filter((s) => s.billing.status === 'held').length,
      awaitingAttestation: all.filter((s) => s.billing.awaitingAttestation).length,
      notFiled: all.filter((s) => s.billing.reason === 'note not filed in EHR').length,
    };
  });

  // Per nurse.
  const nurseNames = [...new Set(svc.practices().map((p) => p.care_manager))];
  const nurses: NurseRow[] = nurseNames.map((name) => {
    const mine = monthEnd.filter((s) => s.careManager === name);
    const t = perNurse.get(name);
    const a = mine.filter((s) => s.program === 'apcm').length;
    const c = mine.filter((s) => s.program === 'ccm').length;
    return {
      name,
      practices: svc.practices().filter((p) => p.care_manager === name).map((p) => p.name),
      patients: mine.length,
      minutes: Math.round((t?.secs ?? 0) / 60),
      apcmMinutesPerPatient: a ? round1((t?.apcm ?? 0) / 60 / a) : null,
      ccmMinutesPerPatient: c ? round1((t?.ccm ?? 0) / 60 / c) : null,
      openQueue: summaries.filter((s) => s.careManager === name && s.queue?.lane === 'person').length,
    };
  });

  return {
    enrolled: { total: active.length, apcm: active.filter((s) => s.program === 'apcm').length, ccm: active.filter((s) => s.program === 'ccm').length },
    pipeline: {
      awaiting: summaries.filter((s) => s.enrollBucket === 'awaiting_confirmation').length,
      consent: summaries.filter((s) => s.enrollBucket === 'needs_consent').length,
      setup: summaries.filter((s) => s.enrollBucket === 'needs_setup').length,
    },
    ai: {
      eligible: eligible.size,
      placed,
      reachedPatients: reachedSet.size,
      completionRate: share(reachedSet.size, eligible.size),
      caregiver,
      unreached,
      askedForPerson,
      optedOut,
      concerns,
      urgent,
    },
    exceptions: {
      patients: exceptionIds.size,
      share: share(exceptionIds.size, apcm.length),
      fromCalls: fromCalls.size,
      byKind: [...kinds.entries()].map(([kind, ids]) => ({ kind, count: ids.size })).sort((a, b) => b.count - a.count),
    },
    nurse: {
      totalMinutes: Math.round(totalSecs / 60),
      apcmMinutes: Math.round(apcmSecs / 60),
      ccmMinutes: Math.round(ccmSecs / 60),
      apcmPerPatient: apcm.length ? round1(apcmSecs / 60 / apcm.length) : null,
      ccmPerPatient: ccm.length ? round1(ccmSecs / 60 / ccm.length) : null,
      ccmMeets20,
      ccmMeets20Share: share(ccmMeets20, ccm.length),
      byActivity: [...byActivity.entries()].map(([label, secs]) => ({ label, minutes: Math.round(secs / 60) })).sort((a, b) => b.minutes - a.minutes),
    },
    billing: {
      ready: readyRows.length,
      readyAmount: Math.round(readyRows.reduce((a, s) => a + (s.billing.amount ?? 0), 0) * 100) / 100,
      held: enrolled.filter((s) => s.billing.status === 'held').length,
      byReason: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    },
    integrity: {
      coverageUnverified: enrolled.filter((s) => s.billing.checks.some((c) => c.key === 'coverage' && c.status === 'fail')).length,
      maSwitches: elig?.maSwitches.length ?? 0,
      qmbEnded: elig?.qmbEnded.length ?? 0,
      duplicates: dupRows.length,
      riskPending: summaries.filter((s) => s.riskReview && s.status === 'active').length,
      riskDocumented: snap.patients.filter((p) => p.risk_note).length,
      riskNotMet: snap.patients.filter((p) => p.status === 'paused' && (p.ineligible_reason ?? '').includes('risk standard')).length,
      touchOverdue: apcm.filter((s) => s.status === 'active' && s.billing.checks.some((c) => c.key === 'human_touch' && c.status === 'warn')).length,
      avoided: Math.round(avoided * 100) / 100,
    },
    escalations: {
      urgent: urgentFlags.length,
      acknowledged: acked.length,
      withinSla: ackMins.filter((m) => m <= ACK_WINDOW_MINUTES).length,
      avgAckMinutes: ackMins.length ? round1(ackMins.reduce((a, b) => a + b, 0) / ackMins.length) : null,
    },
    practices,
    nurses,
  };
}

// ───────────────────────────── one patient in full

export function patientDetail(svc: Service, id: number): PatientView {
  const now = svc.now();
  const month = monthOf(now);
  const p = svc.patient(id);
  const snap = loadSnapshot(svc, month, id);
  const fullBilling = billingFor(svc, p, month);
  const { lastTouch, queue: _q, ...slim } = summarize(svc, snap, p, fullBilling, now);
  const summary = { ...slim, billing: fullBilling };
  const consent = svc.consentOf(p.id);
  const setup = svc.setupOf(p.id);
  const rawCalls = svc.callsOf(p.id);
  const calls: CallView[] = rawCalls.map((c) => ({
    ...c,
    findings: callFindings(c, setup),
    summary: callSummary(c, setup),
    seconds: callSeconds(c),
  }));
  const tasks = svc.tasksOf(p.id);
  const flags = svc.flagsOf(p.id);
  const time = svc.timeOf(p.id, month);
  const countedSeconds = time.filter((t) => t.counts).reduce((s, t) => s + t.seconds, 0);
  const monthCalls = calls.filter((c) => c.status === 'done' && inMonth(c.started_at, month));
  const contacts = monthCalls.filter(reached);
  const mc = svc.monthCloseOf(p.id, month);

  let note: NoteView | null = null;
  if (summary.inMonthEnd && mc) {
    const draft = buildNote(svc, p, month);
    const changedSinceFiled =
      !!mc.filed_at &&
      !!svc.db
        .prepare(
          "SELECT 1 FROM event WHERE patient_id = ? AND at > ? AND (type LIKE 'time.%' OR type LIKE 'call.%' OR type LIKE 'task.%' OR type LIKE 'flag.%')",
        )
        .get(p.id, mc.filed_at);
    note = {
      draft,
      text: mc.note_text ?? draft,
      edited: mc.note_text != null && !mc.filed_at,
      filedAt: mc.filed_at,
      attestedAt: mc.attested_at,
      changedSinceFiled,
    };
  }

  const open = flags.filter((f) => !f.resolved_at);
  const openTasks = tasks.filter((t) => t.status === 'open');

  // ── brief
  const prev = prevMonth(month);
  const last = [...calls].reverse().find((c) => c.status === 'done' && inMonth(c.started_at, prev));
  const readingsSeen = new Map<string, BriefView['readings'][number]>();
  for (const c of monthCalls.filter((c) => c.answers && reached(c))) {
    for (const r of readingResults(c.answers!, setup)) {
      readingsSeen.set(r.type, { label: READINGS[r.type].label, value: r.value, target: r.target, status: r.status, when: fmtShort(c.started_at) });
    }
  }
  const brief: BriefView = {
    lastMonth: last ? `${monthLabel(prev).split(' ')[0]}: ${last.summary}` : null,
    contact: summary.contact,
    aiCall: p.program === 'apcm' ? monthCalls.filter((c) => c.kind === 'ai').map((c) => c.summary) : [],
    readings: [...readingsSeen.values()],
    openTasks: openTasks.map((t) => ({ id: t.id, title: t.title, due: t.due })),
    flags: flags
      .filter((f) => inMonth(f.raised_at, month) || !f.resolved_at)
      .map((f) => ({
        id: f.id,
        level: f.level,
        summary: f.summary,
        state: f.resolved_at ? `resolved ${fmtDateTime(f.resolved_at)}` : f.acknowledged_at ? 'acknowledged, not resolved' : 'not acknowledged',
      })),
  };

  // ── stepper
  const did = (a: string) => time.filter((t) => t.activity === a);
  const stepFor = (key: string, label: string, entries: typeof time, extra = ''): Omit<StepView, 'n'> => ({
    key,
    label,
    state: entries.length ? 'done' : 'open',
    detail: entries.length ? `${entries.map((e) => `${fmtShort(e.started_at)}, ${floorMinutes(e.seconds)} min — ${e.outcome}`).join('; ')}` : extra || 'Not done this month',
  });
  const steps: Omit<StepView, 'n'>[] = [
    {
      key: 'consent',
      label: 'Eligibility and consent',
      state: summary.riskReview ? 'attention' : consent && !consent.revoked_at ? 'done' : consent?.revoked_at ? 'attention' : 'open',
      detail: consent
        ? `${consent.method === 'at_visit' ? 'At visit' : 'Nurse phone'}, ${fmtDate(consent.consent_date)} · automated calls ${consent.automated_calls_ok ? 'OK' : 'not OK'}${consent.revoked_at ? ` · revoked ${fmtDate(consent.revoked_at)}` : ''}${summary.riskReview ? ' · risk basis not documented' : ''}`
        : p.status === 'eligible_unconfirmed'
          ? 'Awaiting practice confirmation'
          : 'No consent yet',
    },
    {
      key: 'setup',
      label: 'Call setup',
      state: setup ? 'done' : 'open',
      detail: setup
        ? `${p.program ? PROGRAM_LABEL[p.program] : '—'} · ${setup.readings.map((r) => READINGS[r].label.toLowerCase()).join(', ') || 'no readings'} · ${setup.symptoms_to_watch.length} symptoms watched`
        : 'Not filled',
    },
    {
      key: 'contact',
      label: 'Monthly contact',
      state: contacts.length ? 'done' : p.status === 'active' ? 'open' : 'na',
      detail: summary.contact,
    },
    {
      key: 'flags',
      label: 'Flags',
      state: open.length ? 'attention' : flags.some((f) => inMonth(f.raised_at, month)) ? 'done' : 'na',
      detail: open.length ? `${open.length} open: ${open.map((f) => f.level).join(', ')}` : flags.some((f) => inMonth(f.raised_at, month)) ? 'All resolved' : 'None this month',
    },
    stepFor('chart', 'EHR chart review', did('ehr_chart_review')),
    stepFor('meds', 'EHR medication review', did('ehr_med_review')),
    stepFor('plan', 'EHR care plan review', did('ehr_care_plan_review'), setup?.ehr_plan_reviewed_on ? `Last EHR care plan review ${fmtDate(setup.ehr_plan_reviewed_on)}` : ''),
    {
      key: 'tasks',
      label: 'Tasks and coordination',
      state: openTasks.length ? 'open' : 'done',
      detail: openTasks.length
        ? `${openTasks.length} open${did('coordination').length ? ` · ${did('coordination').length} coordination entr${did('coordination').length === 1 ? 'y' : 'ies'}` : ''}`
        : `No open tasks${did('coordination').length ? ` · ${floorMinutes(did('coordination').reduce((s, e) => s + e.seconds, 0))} min coordination` : ''}`,
    },
    {
      key: 'note',
      label: 'Note filed and attested',
      state: mc?.attested_at ? 'done' : 'open',
      detail: mc?.attested_at ? `Filed ${fmtShort(mc.filed_at)}, attested ${fmtShort(mc.attested_at)}` : mc?.filed_at ? `Filed ${fmtShort(mc.filed_at)}; awaiting physician attestation` : 'At month end',
    },
  ];

  return {
    ...summary,
    patient: p,
    practice: practiceInfo(svc.practiceOf(p)),
    consent,
    setup,
    calls,
    tasks,
    flags,
    time,
    countedSeconds,
    meets20: p.program === 'ccm' && summary.minutes >= CCM_MINUTES,
    brief,
    steps: steps.map((s, i) => ({ ...s, n: i + 1 })),
    note,
    monthClose: mc,
    lastHumanTouch: lastTouch,
    script: svc.practiceOf(p).simulated ? null : (svc.script().nurse[p.mrn] ?? null),
  };
}

export function patientIdOfCall(svc: Service, callId: number): number {
  return svc.call(callId).patient_id;
}
