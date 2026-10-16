// Builds the whole client state in one pass. The dataset is fifteen
// patients, so recomputing everything per request is cheap and keeps the
// client a pure renderer.

import type {
  AlertView,
  AppState,
  AttestationRecord,
  BriefView,
  CallView,
  EnrollBucket,
  NoteView,
  PatientView,
  QueueCategory,
  QueueRow,
  RosterUploadView,
  RunView,
  StepView,
} from '../shared/api';
import { codeName } from '../shared/codes';
import { ACTIVITIES, CCM_MINUTES, MONTH_END, PRACTICE, PROGRAM_LABEL, STAFF } from '../shared/constants';
import type { Patient } from '../shared/model';
import { READINGS } from '../shared/rules';
import { ageOn, dateOf, floorMinutes, fmtDate, fmtDateTime, fmtShort, inMonth, monthLabel, monthOf, addDays } from '../shared/time';
import { billingFor } from './billing';
import { callFindings, callSeconds, callSummary, readingResults, reached } from './describe';
import { buildNote, monthEndPatients } from './note';
import { fullName, type Service } from './service';

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
  const t = svc.timer();
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
    patients: views,
    queue,
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

  return {
    ...p,
    name: fullName(p),
    age: ageOn(p.dob, now),
    codes: p.qualifying_codes.map((c) => ({ code: c, name: codeName(c) })),
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
