// The API without a web framework, so the Express server and the
// browser-only build answer requests the same way.
import type { AiInput } from '../shared/aiCall';
import { fmtDateTime } from '../shared/time';
import type { Role } from '../shared/types';
import { toCsv } from './roster';
import { Service, UserError } from './service';
import { buildState } from './views';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any;

export interface ApiResponse {
  status: number;
  body: unknown;
}

export const SEED_FILES = ['october-roster.csv', 'roster-with-errors.csv'];

/** Every command the UI can send, keyed by name. The role comes from the demo bar's role switcher. */
function actions(svc: Service): Record<string, (role: Role, b: Body) => unknown> {
  return {
    reset: () => svc.reset(),
    advanceDay: () => svc.advanceDay(),
    setDate: (_r, b) => svc.setDate(b.date),
    jumpToMonthEnd: () => svc.jumpToMonthEnd(),
    setSpeed: (_r, b) => svc.setSpeed(Number(b.speed)),
    saveCheckpoint: () => svc.saveCheckpoint(),
    restoreCheckpoint: () => svc.restoreCheckpoint(),
    uploadRoster: (r, b) => svc.uploadRoster(r, b.filename, b.csv),
    uploadSeedRoster: (r, b) => {
      const name = SEED_FILES.includes(b.name) ? b.name : 'october-roster.csv';
      return svc.uploadRoster(r, name, svc.rosterCsv(name));
    },
    confirmEligibility: (r, b) => svc.confirmEligibility(r, b.patientId),
    startConsentCall: (r, b) => svc.startConsentCall(r, b.patientId),
    recordConsent: (r, b) => svc.recordConsent(r, b.patientId, b),
    saveCallSetup: (r, b) => svc.saveCallSetup(r, b.patientId, b),
    setPrefersHuman: (r, b) => svc.setPrefersHuman(r, b.patientId, !!b.value),
    startActivity: (r, b) => svc.startActivity(r, b.patientId, b.activity),
    stopActivity: (r, b) => svc.stopActivity(r, b.outcome),
    discardTimer: (r) => svc.discardTimer(r),
    startNurseCall: (r, b) => svc.startNurseCall(r, b.patientId),
    addNurseCallLine: (r, b) => svc.addNurseCallLine(r, b.callId, b),
    endNurseCall: (r, b) => svc.endNurseCall(r, b.callId, b),
    addTask: (r, b) => svc.addTask(r, b.patientId, b),
    closeTask: (r, b) => svc.closeTask(r, b.taskId, b.note),
    acknowledgeFlag: (r, b) => svc.acknowledgeFlag(r, b.flagId),
    resolveFlag: (r, b) => svc.resolveFlag(r, b.flagId, b.note),
    escalate: (r, b) => svc.escalateToPhysician(r, b.patientId, b.note),
    markCallReviewed: (r, b) => svc.markCallReviewed(r, b.callId),
    runAiCalls: () => svc.runAiCalls(),
    simulateAiCall: (_r, b) => svc.simulateAiCall(b.patientId, (b.inputs ?? []) as AiInput[]),
    saveNote: (r, b) => svc.saveNote(r, b.patientId, b.text),
    revertNote: (r, b) => svc.revertNote(r, b.patientId),
    noteCopied: (r, b) => svc.noteCopied(r, b.patientId),
    fileNote: (r, b) => svc.fileNote(r, b.patientId, b.text),
    signAttestation: (r, b) => svc.signAttestation(r, b.text),
  };
}

export function createHandlers(svc: Service) {
  const table = actions(svc);
  return {
    state: () => buildState(svc),

    events: (q: { patientId?: number; prefix?: string }) => svc.events(q),

    action(name: string, role: Role, body: Body): ApiResponse {
      const fn = table[name];
      if (!fn) return { status: 404, body: { error: `Unknown action ${name}` } };
      try {
        const result = fn(role, body ?? {});
        return { status: 200, body: { ok: true, result: result ?? null, state: buildState(svc) } };
      } catch (e) {
        if (e instanceof UserError) return { status: e.status, body: { error: e.message } };
        console.error(e);
        return { status: 500, body: { error: e instanceof Error ? e.message : 'Something went wrong.' } };
      }
    },

    /** CSV files the UI offers: the seed rosters, the billing list and the roster error list. */
    csv(name: string): { filename: string; text: string } | null {
      if (SEED_FILES.includes(name)) return { filename: name, text: svc.rosterCsv(name) };
      if (name === 'billing.csv') {
        const s = buildState(svc);
        const rows = s.billing.rows.map((r) => [
          r.mrn,
          r.name,
          r.program?.toUpperCase() ?? '',
          r.billing.code ?? '',
          r.billing.amount != null ? r.billing.amount.toFixed(2) : '',
          r.billing.status === 'not_enrolled' ? 'not enrolled' : r.billing.status,
          r.billing.reason ?? '',
          r.billing.minutes,
        ]);
        return {
          filename: `billing-${s.clock.month}.csv`,
          text: toCsv([
            ['mrn', 'patient', 'program', 'code', 'amount', 'status', 'reason', 'counted_minutes'],
            ...rows,
            [],
            ['', `Total ready: ${s.billing.readyCount} patients`, '', '', s.billing.readyTotal.toFixed(2)],
          ]),
        };
      }
      if (name === 'roster-errors.csv') {
        const up = buildState(svc).roster;
        const bad = up?.rows.filter((r) => !r.accepted) ?? [];
        return {
          filename: 'roster-errors.csv',
          text: toCsv([
            ['row', 'mrn', 'name', 'errors', `uploaded ${up ? fmtDateTime(up.at) : ''}`],
            ...bad.map((r) => [r.row, r.mrn, r.name, r.errors.join('; ')]),
          ]),
        };
      }
      return null;
    },
  };
}
