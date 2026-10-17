// Builds the whole client state in one pass. The dataset is fifteen
// patients, so recomputing everything per request is cheap and keeps the
// client a pure renderer.

import type {
  AlertView,
  AppState,
  AttestationRecord,
  BriefView,
  CallView,
  ClinicalProfile,
  EnrollBucket,
  NoteView,
  NurseQueueItem,
  NurseQueues,
  OpportunityBucket,
  OpportunityRow,
  OpsView,
  PatientView,
  PhysicianView,
  ProgramOption,
  QueueCategory,
  QueueRow,
  RosterUploadView,
  RunView,
  StepView,
  TimerView,
} from '../shared/api';
import { codeName, CONDITION_SETUP } from '../shared/codes';
import { ACTIVITIES, CARE_QUEUE_FROM_DAY, CCM_MINUTES, MONTH_END, PRACTICE, PROGRAM_LABEL, STAFF } from '../shared/constants';
import { distinctConditions, lookupChronic, type Condition } from '../shared/icd10';
import type { Patient } from '../shared/model';
import { baseCode, programBlock, tierLabel } from '../shared/program';
import { READINGS, RULES } from '../shared/rules';
import { ageOn, dateOf, floorMinutes, fmtDate, fmtDateTime, fmtShort, inMonth, monthLabel, monthOf, addDays } from '../shared/time';
import type { Program } from '../shared/types';
import { billingFor } from './billing';
import { setupGaps, verifyChain } from './carePlan';
import { callFindings, callSeconds, callSummary, readingResults, reached } from './describe';
import { preflightView, reconciliation } from './ledger';
import { buildNote, monthEndPatients } from './note';
import { classifyPayer } from './payer';
import { fullName, type Service, type TimerSlot } from './service';

export const QUEUE_ORDER: QueueCategory[] = ['urgent', 'concern', 'unreached', 'ccm_due', 'tasks', 'review'];
const QUEUE_LABEL: Record<QueueCategory, string> = {
  urgent: 'Urgent',
  concern: 'Concern',
  unreached: 'Not reached',
  ccm_due: 'CCM call due',
  tasks: 'Open tasks',
  review: 'Quick review',
};

export function attestationText(month: string): string {
  return (
    `I attest that, for ${monthLabel(month)}, the care management services documented in the notes filed for the patients listed ` +
    `were furnished by clinical staff of ${PRACTICE.name} under my general supervision and in line with each patient's care plan; ` +
    `that I am the one billing practitioner for these services this month; and that CCM time was counted from clinical staff activity ` +
    `only, with automated (AI) contact never counted.`
  );
}

function enrollBucket(p: Patient): EnrollBucket | null {
  switch (p.status) {
    case 'eligible_unconfirmed':
      return 'awaiting_confirmation';
    case 'confirmed':
      return 'needs_consent';
    case 'consented':
      return 'needs_setup';
    case 'plan_review':
      return 'needs_care_plan';
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

export function buildState(svc: Service): AppState {
  svc.tick();
  const now = svc.now();
  const month = monthOf(now);
  const clockMs = svc.demoNowMs();
  const patients = svc.patients();
  const monthEnd = new Set(monthEndPatients(svc, month).map((p) => p.id));
  const views = patients.map((p) => patientView(svc, p, month, now, monthEnd.has(p.id)));
  const queue = views
    .map((v) => v.queue)
    .filter((q): q is QueueRow => !!q)
    .sort(
      (a, b) =>
        QUEUE_ORDER.indexOf(a.category) - QUEUE_ORDER.indexOf(b.category) ||
        (a.ackDueAt ?? '').localeCompare(b.ackDueAt ?? '') ||
        a.mrn.localeCompare(b.mrn),
    );
  const alerts: AlertView[] = svc
    .allFlags()
    .filter((f) => f.level === 'urgent' && !f.resolved_at)
    .map((f) => {
      const p = patients.find((x) => x.id === f.patient_id)!;
      return {
        flagId: f.id,
        patientId: p.id,
        name: fullName(p),
        mrn: p.mrn,
        summary: f.summary,
        escalation: f.escalation,
        raisedAt: f.raised_at,
        ackDueAt: f.ack_due_at,
        acknowledgedAt: f.acknowledged_at,
      };
    });
  const billingRows = views.map((v) => ({ patientId: v.id, mrn: v.mrn, name: v.name, program: v.program, billing: v.billing }));
  const ready = billingRows.filter((r) => r.billing.status === 'ready');
  const records = svc.kv<AttestationRecord[]>('attestations', []).filter((r) => r.month === month);
  const pending = views.filter((v) => v.monthClose?.filed_at && !v.monthClose.attested_at).map((v) => v.id);
  const counts = svc.db
    .prepare("SELECT COUNT(*) AS events, SUM(CASE WHEN type LIKE 'outbox.%' THEN 1 ELSE 0 END) AS outbox FROM event")
    .get() as { events: number; outbox: number | null };
  return {
    practice: PRACTICE,
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
    timer: timerView(svc, 'nurse'),
    physicianTimer: timerView(svc, 'physician'),
    patients: views,
    queue,
    queues: nurseQueues(svc, views, now, month),
    ops: opsView(svc, patients, now),
    physician: physicianView(svc, views, month),
    preflight: preflightView(svc),
    settings: svc.settings(),
    alerts,
    roster: svc.kv<RosterUploadView | null>('lastUpload', null),
    lastRun: svc.kv<RunView | null>('lastRun', null),
    billing: {
      rows: billingRows,
      readyCount: ready.length,
      readyTotal: Math.round(ready.reduce((s, r) => s + (r.billing.amount ?? 0), 0) * 100) / 100,
    },
    monthEnd: {
      patientIds: views.filter((v) => monthEnd.has(v.id)).map((v) => v.id),
      filed: views.filter((v) => monthEnd.has(v.id) && v.monthClose?.filed_at).length,
      total: monthEnd.size,
    },
    attestation: { text: attestationText(month), records, pending },
    checkpoint: svc.checkpointInfo(),
    counts: { events: counts.events, outbox: counts.outbox ?? 0 },
  };
}

function timerView(svc: Service, slot: TimerSlot): TimerView | null {
  const t = svc.timer(slot);
  if (!t) return null;
  return {
    patientId: t.patientId,
    patientName: fullName(svc.patient(t.patientId)),
    activity: t.activity,
    activityLabel: ACTIVITIES[t.activity].label,
    startedAt: t.startedAt,
    startedRealMs: t.startedReal,
    speed: t.speed,
    callId: t.callId,
    taskId: t.taskId ?? null,
  };
}

function programOptions(svc: Service, p: Patient): ProgramOption[] {
  const n = svc.conditionCount(p);
  const fees = svc.settings().fees;
  return (['ccm', 'apcm'] as Program[]).map((program) => {
    const code = baseCode(program, n, p.is_qmb);
    return { program, code, tier: tierLabel(code), fee: fees[code], block: programBlock(program, p.coverage, n) };
  });
}

function bucketOf(p: Patient): OpportunityBucket {
  switch (p.status) {
    case 'eligible_unconfirmed':
      return p.ops_decision === 'held' ? 'held' : 'review';
    case 'confirmed':
    case 'consented':
    case 'plan_review':
      return 'approved';
    case 'ineligible':
      return p.ops_decision === 'rejected' ? 'rejected' : 'not_eligible';
    case 'needs_visit':
      return 'not_eligible';
    default:
      return 'enrolled';
  }
}

export function opsView(svc: Service, patients: Patient[], now: string): OpsView {
  const settings = svc.settings();
  const matrix = svc.icdMatrix();
  const last = svc.kv<RosterUploadView | null>('lastUpload', null);
  const uploaded = new Set(last?.mrns ?? []);
  const rows: OpportunityRow[] = patients.map((p) => {
    const program = p.program ?? p.proposed_program;
    const n = distinctConditions(p.qualifying_codes, matrix).length;
    const code = program ? baseCode(program, n, p.is_qmb) : null;
    const payer = classifyPayer(p.insurance_name, settings.valueBasedPayers);
    return {
      patientId: p.id,
      mrn: p.mrn,
      name: fullName(p),
      dob: p.dob,
      age: ageOn(p.dob, now),
      sex: p.sex,
      insuranceName: p.insurance_name,
      insuranceId: p.insurance_id,
      payerLabel: payer.label,
      coverage: p.coverage,
      isQmb: p.is_qmb,
      codes: p.diagnosis_codes.map((c) => ({ code: c, name: codeName(c), chronic: !!lookupChronic(c, matrix) })),
      conditions: n,
      program,
      code,
      tier: tierLabel(code),
      confidence: p.confidence,
      reasons: p.confidence_reasons,
      monthly: code ? settings.fees[code] : 0,
      bucket: bucketOf(p),
      status: p.status,
      reason: p.ineligible_reason,
      decision: p.ops_decision,
      decidedAt: p.ops_decided_at,
      note: p.ops_note,
      options: programOptions(svc, p),
      inLastUpload: uploaded.has(p.mrn),
    };
  });
  const sum = (list: OpportunityRow[]) => Math.round(list.reduce((s, r) => s + r.monthly, 0) * 100) / 100;
  const approved = rows.filter((r) => r.bucket === 'approved' || (r.bucket === 'enrolled' && r.status === 'active'));
  const pending = rows.filter((r) => r.bucket === 'review' || r.bucket === 'held');
  return {
    preview: svc.rosterPreview(),
    matrix: rows,
    emrr: {
      approved: sum(approved),
      approvedCount: approved.length,
      pending: sum(pending),
      pendingCount: pending.length,
      rejectedCount: rows.filter((r) => r.bucket === 'rejected').length,
      notEligibleCount: rows.filter((r) => r.bucket === 'not_eligible').length,
    },
    icd: { groups: new Set(matrix.map((m) => m.condition)).size, prefixes: matrix.length },
  };
}

function physicianView(svc: Service, views: PatientView[], month: string): PhysicianView {
  const carePlans = views
    .filter((v) => v.draftPlan)
    .map((v) => ({
      plan: v.draftPlan!,
      patientId: v.id,
      name: v.name,
      mrn: v.mrn,
      status: v.status,
      previous: v.carePlan,
      gaps: setupGaps(svc, svc.patient(v.id)),
    }));
  const escalations = views.flatMap((v) =>
    v.tasks
      .filter((t) => t.kind === 'physician' && t.status === 'open')
      .map((t) => ({
        taskId: t.id,
        patientId: v.id,
        name: v.name,
        mrn: v.mrn,
        program: v.program,
        request: t.title.replace('Physician review requested: ', ''),
        from: t.reason,
        createdAt: t.created_at,
        minutes: v.minutes,
        complexity: v.billing.complexity,
        flags: v.brief.flags.map((f) => ({ level: f.level, summary: f.summary, state: f.state })),
        readings: v.brief.readings.map((r) => ({ label: r.label, value: r.value, target: r.target, status: r.status })),
        billing: v.billing.status === 'ready' ? `ready, ${v.billing.lines.map((l) => l.code).join(' + ')}` : (v.billing.reason ?? v.billing.status),
      })),
  );
  const closed = views
    .flatMap((v) =>
      v.tasks
        .filter((t) => t.kind === 'physician' && t.status === 'done' && inMonth(t.closed_at, month))
        .map((t) => ({ taskId: t.id, patientId: v.id, name: v.name, title: t.title.replace('Physician review requested: ', ''), note: t.close_note, closedAt: t.closed_at })),
    )
    .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
  const broken: PhysicianView['chain']['broken'] = [];
  let approvals = 0;
  for (const v of views) {
    const r = verifyChain(svc.carePlansOf(v.id));
    approvals += r.approvals;
    if (!r.ok) broken.push({ patientId: v.id, name: v.name, version: r.brokenAt! });
  }
  return { carePlans, escalations, closed, chain: { ok: !broken.length, approvals, broken } };
}

function nurseQueues(svc: Service, views: PatientView[], now: string, month: string): NurseQueues {
  const item = (v: PatientView, items: string[], extra: Partial<NurseQueueItem> = {}): NurseQueueItem => ({
    patientId: v.id,
    name: v.name,
    mrn: v.mrn,
    program: v.program ? PROGRAM_LABEL[v.program] : v.proposed_program ? `${PROGRAM_LABEL[v.proposed_program]} (proposed)` : '—',
    items,
    minutes: v.minutes,
    ...extra,
  });

  const consent = views
    .filter((v) => v.status === 'confirmed')
    .map((v) => {
      const last = svc.lastConsentAttempt(v.id);
      const linkSent = svc.events({ patientId: v.id, prefix: 'consent.link_sent' }).length > 0;
      return item(v, [last ? `Last attempt ${fmtDateTime(last.at)}: ${last.how}` : 'Not contacted yet'], { lastAttempt: last, linkSent });
    })
    .sort((a, b) => (a.lastAttempt?.at ?? '').localeCompare(b.lastAttempt?.at ?? '') || a.mrn.localeCompare(b.mrn));

  const careOpensOn = `${month}-${String(CARE_QUEUE_FROM_DAY).padStart(2, '0')}`;
  const care: NurseQueueItem[] = [];
  if (dateOf(now) >= careOpensOn) {
    for (const v of views.filter((x) => x.status === 'active')) {
      const missing: string[] = [];
      if (!v.completedContact) missing.push(v.program === 'ccm' ? 'No completed nurse contact this month' : 'No completed contact this month');
      if (v.program === 'ccm') {
        for (const s of v.steps.filter((x) => ['chart', 'meds', 'plan'].includes(x.key) && x.state === 'open')) missing.push(`${s.label} not done`);
        const open = v.tasks.filter((t) => t.status === 'open').length;
        if (open) missing.push(`${open} open task${open === 1 ? '' : 's'}`);
      }
      if (missing.length) care.push(item(v, missing, { level: 'info' }));
    }
    care.sort((a, b) => b.items.length - a.items.length || a.mrn.localeCompare(b.mrn));
  }

  const urgency: NurseQueueItem[] = [];
  for (const v of views) {
    const open = v.flags.filter((f) => !f.resolved_at);
    const urgent = open.find((f) => f.level === 'urgent');
    const concerns = open.filter((f) => f.level === 'concern');
    const unreached = v.tasks.find((t) => t.status === 'open' && t.kind === 'call' && t.title.startsWith('Not reached'));
    const items = [
      ...(urgent ? [`URGENT: ${urgent.summary}${urgent.acknowledged_at ? ' — acknowledged, resolve when handled' : ''}`] : []),
      ...concerns.map((f) => `Concern: ${f.summary}`),
      ...(unreached ? [unreached.title] : []),
    ];
    if (!items.length) continue;
    urgency.push(
      item(v, items, {
        level: urgent ? 'urgent' : concerns.length ? 'concern' : 'info',
        ackDueAt: urgent && !urgent.acknowledged_at ? urgent.ack_due_at : null,
        acknowledged: urgent ? !!urgent.acknowledged_at : undefined,
      }),
    );
  }
  const rank = { urgent: 0, concern: 1, info: 2 } as const;
  urgency.sort((a, b) => rank[a.level ?? 'info'] - rank[b.level ?? 'info'] || (a.ackDueAt ?? '').localeCompare(b.ackDueAt ?? '') || a.mrn.localeCompare(b.mrn));

  const pending: NurseQueueItem[] = [];
  const afterMonthEnd = now >= MONTH_END;
  for (const v of views) {
    const items: string[] = [];
    if (v.status === 'consented') items.push('Call setup not finished');
    if (v.status === 'plan_review') {
      items.push(v.draftPlan ? `Awaiting care plan approval from ${STAFF.physician.short} (v${v.draftPlan.version})` : 'Care plan returned: update the call setup');
    }
    if (v.status === 'paused' && v.tasks.some((t) => t.status === 'open' && t.title === 'Switch program to CCM')) items.push('Paused: switch program to CCM');
    const dueCall = v.program === 'ccm' && v.status === 'active' && v.calls.some((c) => c.kind === 'nurse' && c.status === 'scheduled' && c.scheduled_for! <= `${dateOf(now)}T23:59:59`);
    if (dueCall && !v.completedContact) items.push('Monthly nurse call due');
    for (const t of v.tasks.filter((t) => t.status === 'open' && !t.title.startsWith('Not reached') && t.kind !== 'physician' && t.title !== 'Switch program to CCM')) {
      items.push(`${t.title} (due ${fmtShort(t.due)})`);
    }
    const toReview = v.calls.filter((c) => c.kind === 'ai' && c.status === 'done' && inMonth(c.started_at, month) && reached(c) && c.flag === 'none' && !c.reviewed_at);
    if (toReview.length) items.push(`AI call ${fmtShort(toReview[toReview.length - 1].started_at)} to review`);
    if (afterMonthEnd && v.note) {
      if (!v.note.filedAt) items.push('Month-end note not filed');
      else if (!v.note.attestedAt) items.push('Note filed; awaiting physician attestation');
    }
    if (items.length) pending.push(item(v, items));
  }

  return { consent, care, urgency, pending, careOpensOn };
}

function clinicalProfile(svc: Service, p: Patient, calls: CallView[], conditions: PatientView['conditions']): ClinicalProfile {
  const setup = svc.setupOf(p.id);
  const done = calls.filter((c) => reached(c) && c.answers).sort((a, b) => (a.started_at ?? '').localeCompare(b.started_at ?? ''));
  const panels: ClinicalProfile['conditions'] = conditions.map((c) => {
    const def = CONDITION_SETUP[c.condition as Condition];
    const readings = def.readings
      .filter((r) => setup?.readings.includes(r))
      .map((r) => {
        const points = done
          .map((call) => ({ call, res: readingResults(call.answers!, setup).find((x) => x.type === r) }))
          .filter((x) => x.res)
          .map((x) => ({ when: fmtShort(x.call.started_at), value: x.res!.value, status: x.res!.status }));
        const target = done.map((call) => readingResults(call.answers!, setup).find((x) => x.type === r)?.target).find(Boolean) ?? '';
        return { label: READINGS[r].label, target, points };
      });
    const symptoms = def.rules
      .filter((r) => setup?.symptoms_to_watch.includes(r))
      .map((r) => ({
        label: RULES[r].label,
        level: RULES[r].level,
        history: done
          .filter((call) => call.answers!.symptoms[r])
          .map((call) => ({ when: fmtShort(call.started_at), present: !!call.answers!.symptoms[r]!.present, detail: call.answers!.symptoms[r]!.detail ?? null })),
      }));
    return { code: c.code, name: c.name, label: c.label, readings, symptoms };
  });

  const log: ClinicalProfile['log'] = [];
  for (const c of calls.filter((x) => x.status === 'done')) {
    log.push({ at: c.started_at!, kind: 'call', text: c.summary });
    if (c.nurse_note) log.push({ at: c.ended_at ?? c.started_at!, kind: 'note', text: `Nurse note: ${c.nurse_note}` });
    for (const f of c.findings.filter((x) => x.level !== 'info')) log.push({ at: c.ended_at ?? c.started_at!, kind: 'finding', text: `${f.level === 'urgent' ? 'Urgent' : 'Concern'}: ${f.text}` });
  }
  for (const f of svc.flagsOf(p.id)) {
    if (f.resolved_at) log.push({ at: f.resolved_at, kind: 'flag', text: `Flag resolved: ${f.note ?? f.summary}` });
  }
  for (const e of svc.events({ patientId: p.id }).filter((x) => /^(care_plan\.(approved|returned)|escalation\.closed|escalated$)/.test(x.type))) {
    log.push({ at: e.at, kind: e.type.startsWith('care_plan') ? 'plan' : 'escalation', text: e.detail });
  }
  log.sort((a, b) => b.at.localeCompare(a.at));

  const symptomLog: ClinicalProfile['symptomLog'] = [];
  for (const c of done) {
    for (const [rule, a] of Object.entries(c.answers!.symptoms)) {
      if (!a) continue;
      symptomLog.push({
        at: c.started_at!,
        label: RULES[rule as keyof typeof RULES]?.label ?? rule,
        present: a.present,
        detail: a.detail ?? null,
        source: c.kind === 'ai' ? 'AI check-in' : 'Nurse call',
      });
    }
  }
  symptomLog.sort((a, b) => b.at.localeCompare(a.at));
  return { conditions: panels, log, symptomLog };
}

function patientView(svc: Service, p: Patient, month: string, now: string, inMonthEnd: boolean): PatientView {
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
  const minutes = floorMinutes(countedSeconds);
  const monthCalls = calls.filter((c) => c.status === 'done' && inMonth(c.started_at, month));
  const contacts = monthCalls.filter(reached);
  const mc = svc.monthCloseOf(p.id, month);
  const billing = billingFor(svc, p, month);

  let note: NoteView | null = null;
  if (inMonthEnd && mc) {
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
  const scheduled = calls.filter((c) => c.status === 'scheduled' && inMonth(c.scheduled_for, month));

  // ── brief
  const prev = prevMonth(month);
  const last = [...calls].reverse().find((c) => c.status === 'done' && inMonth(c.started_at, prev));
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
  const readingsSeen = new Map<string, BriefView['readings'][number]>();
  for (const c of monthCalls.filter((c) => c.answers && reached(c))) {
    for (const r of readingResults(c.answers!, setup)) {
      readingsSeen.set(r.type, { label: READINGS[r.type].label, value: r.value, target: r.target, status: r.status, when: fmtShort(c.started_at) });
    }
  }
  const brief: BriefView = {
    lastMonth: last ? `${monthLabel(prev).split(' ')[0]}: ${last.summary}` : null,
    contact,
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
  const approvedPlan = svc.approvedPlan(p.id);
  const pendingPlan = svc.draftPlan(p.id);
  const did = (a: string) => time.filter((t) => t.activity === a);
  const stepFor = (key: string, label: string, entries: typeof time, extra = ''): Omit<StepView, 'n'> => ({
    key,
    label,
    state: entries.length ? 'done' : 'open',
    detail: entries.length
      ? `${entries.map((e) => `${fmtShort(e.started_at)}, ${floorMinutes(e.seconds)} min — ${e.outcome}`).join('; ')}`
      : extra || 'Not done this month',
  });
  const steps: Omit<StepView, 'n'>[] = [
    {
      key: 'consent',
      label: 'Eligibility and consent',
      state: consent && !consent.revoked_at ? 'done' : consent?.revoked_at ? 'attention' : 'open',
      detail: consent
        ? `${consent.method === 'at_visit' ? 'At visit' : 'Nurse phone'}, ${fmtDate(consent.consent_date)} · automated calls ${consent.automated_calls_ok ? 'OK' : 'not OK'}${consent.revoked_at ? ` · revoked ${fmtDate(consent.revoked_at)}` : ''}`
        : p.status === 'eligible_unconfirmed'
          ? 'Awaiting practice confirmation'
          : 'No consent yet',
    },
    {
      key: 'setup',
      label: 'Call setup and care plan',
      state: !setup ? 'open' : p.status === 'plan_review' || p.status === 'paused' ? 'attention' : 'done',
      detail: setup
        ? `${p.program ? PROGRAM_LABEL[p.program] : '—'} · ${setup.readings.map((r) => READINGS[r].label.toLowerCase()).join(', ') || 'no readings'} · ${setup.symptoms_to_watch.length} symptoms watched · ${
            approvedPlan ? `care plan v${approvedPlan.version} approved ${fmtShort(approvedPlan.approved_at)}` : 'care plan awaiting physician approval'
          }${approvedPlan && pendingPlan ? ` (v${pendingPlan.version} waiting)` : ''}`
        : 'Not filled',
    },
    {
      key: 'contact',
      label: 'Monthly contact',
      state: contacts.length ? 'done' : p.status === 'active' ? 'open' : 'na',
      detail: contact,
    },
    {
      key: 'flags',
      label: 'Flags',
      state: open.length ? 'attention' : flags.some((f) => inMonth(f.raised_at, month)) ? 'done' : 'na',
      detail: open.length
        ? `${open.length} open: ${open.map((f) => f.level).join(', ')}`
        : flags.some((f) => inMonth(f.raised_at, month))
          ? 'All resolved'
          : 'None this month',
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
      state: mc?.attested_at ? 'done' : mc?.filed_at ? 'open' : 'open',
      detail: mc?.attested_at
        ? `Filed ${fmtShort(mc.filed_at)}, attested ${fmtShort(mc.attested_at)}`
        : mc?.filed_at
          ? `Filed ${fmtShort(mc.filed_at)}; awaiting physician attestation`
          : 'At month end',
    },
  ];

  // ── queue row
  let q: { category: QueueCategory; reason: string; ackDueAt: string | null; acknowledged: boolean } | null = null;
  if (p.status === 'active' || p.status === 'opted_out' || p.status === 'paused') {
    const urgent = open.find((f) => f.level === 'urgent');
    const concern = open.find((f) => f.level === 'concern');
    const unreached = openTasks.find((t) => t.kind === 'call' && t.title.startsWith('Not reached'));
    const ccmDue = p.program === 'ccm' && p.status === 'active' && calls.some((c) => c.kind === 'nurse' && c.status === 'scheduled' && c.scheduled_for! <= `${dateOf(now)}T23:59:59`);
    const toReview = monthCalls.filter((c) => c.kind === 'ai' && reached(c) && c.flag === 'none' && !c.reviewed_at);
    if (urgent) {
      q = {
        category: 'urgent',
        reason: `${urgent.summary}${urgent.acknowledged_at ? ' — acknowledged, resolve when handled' : ''}`,
        ackDueAt: urgent.acknowledged_at ? null : urgent.ack_due_at,
        acknowledged: !!urgent.acknowledged_at,
      };
    } else if (concern) {
      const src = rawCalls.find((c) => c.id === concern.call_id);
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
    } else if (openTasks.length) {
      q = {
        category: 'tasks',
        reason: `${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}: ${openTasks.map((t) => t.title).join('; ')}`,
        ackDueAt: null,
        acknowledged: false,
      };
    } else if (toReview.length) {
      const c = toReview[toReview.length - 1];
      q = { category: 'review', reason: `${c.summary} Quick review.`, ackDueAt: null, acknowledged: false };
    }
  }
  const queue: QueueRow | null = q
    ? {
        patientId: p.id,
        name: fullName(p),
        mrn: p.mrn,
        program: p.program ? PROGRAM_LABEL[p.program] : '—',
        category: q.category,
        categoryLabel: QUEUE_LABEL[q.category],
        reason: q.reason,
        minutes,
        ackDueAt: q.ackDueAt,
        acknowledged: q.acknowledged,
      }
    : null;

  const matrix = svc.icdMatrix();
  const conditions = distinctConditions(p.qualifying_codes, matrix).map((m) => ({ code: m.code, name: codeName(m.code), label: m.label, condition: m.condition }));
  const plans = svc.carePlansOf(p.id);
  const draftPlan = svc.draftPlan(p.id);
  const latest = plans[plans.length - 1] ?? null;
  return {
    ...p,
    name: fullName(p),
    age: ageOn(p.dob, now),
    codes: p.qualifying_codes.map((c) => ({ code: c, name: codeName(c) })),
    payerLabel: classifyPayer(p.insurance_name, svc.settings().valueBasedPayers).label,
    conditions,
    programOptions: programOptions(svc, p),
    carePlan: svc.approvedPlan(p.id),
    draftPlan,
    returnedPlan: !draftPlan && latest?.status === 'returned' ? latest : null,
    profile: clinicalProfile(svc, p, calls, conditions),
    reconciliation: ['active', 'paused', 'opted_out', 'plan_review'].includes(p.status) ? reconciliation(svc, p, month) : null,
    consent,
    setup,
    calls,
    tasks,
    flags,
    time,
    countedSeconds,
    minutes,
    meets20: p.program === 'ccm' && minutes >= CCM_MINUTES,
    completedContact: contacts.length > 0,
    billing,
    enrollBucket: enrollBucket(p),
    brief,
    steps: steps.map((s, i) => ({ ...s, n: i + 1 })),
    note,
    queue,
    ai: svc.aiAllowed(p),
    monthClose: mc,
    script: svc.script().nurse[p.mrn] ?? null,
  };
}
