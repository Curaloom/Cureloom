import express from 'express';
import type { AiInput } from '../shared/aiCall';
import type { Role } from '../shared/types';
import { fmtDateTime } from '../shared/time';
import { toCsv } from './roster';
import { Service, UserError } from './service';
import { buildState } from './views';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any;

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
    uploadSeedRoster: (r) => svc.uploadRoster(r, 'october-roster.csv', svc.rosterCsv()),
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

function sendCsv(res: express.Response, name: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(csv);
}

export function createApi(svc: Service): express.Router {
  const api = express.Router();
  const table = actions(svc);

  api.get('/api/state', (_req, res) => {
    res.json(buildState(svc));
  });

  api.get('/api/events', (req, res) => {
    const pid = req.query.patientId ? Number(req.query.patientId) : undefined;
    res.json(svc.events({ patientId: pid, prefix: req.query.prefix ? String(req.query.prefix) : undefined }));
  });

  api.get('/api/seed/:name', (req, res) => {
    const allowed = ['october-roster.csv', 'roster-with-errors.csv'];
    if (!allowed.includes(req.params.name)) return res.status(404).send('Not found');
    sendCsv(res, req.params.name, svc.rosterCsv(req.params.name));
  });

  api.get('/api/billing.csv', (_req, res) => {
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
    sendCsv(
      res,
      `billing-${s.clock.month}.csv`,
      toCsv([
        ['mrn', 'patient', 'program', 'code', 'amount', 'status', 'reason', 'counted_minutes'],
        ...rows,
        [],
        ['', `Total ready: ${s.billing.readyCount} patients`, '', '', s.billing.readyTotal.toFixed(2)],
      ]),
    );
  });

  api.get('/api/roster-errors.csv', (_req, res) => {
    const up = buildState(svc).roster;
    const bad = up?.rows.filter((r) => !r.accepted) ?? [];
    sendCsv(
      res,
      'roster-errors.csv',
      toCsv([
        ['row', 'mrn', 'name', 'errors', `uploaded ${up ? fmtDateTime(up.at) : ''}`],
        ...bad.map((r) => [r.row, r.mrn, r.name, r.errors.join('; ')]),
      ]),
    );
  });

  api.post('/api/action/:name', (req, res) => {
    const fn = table[req.params.name];
    if (!fn) return res.status(404).json({ error: `Unknown action ${req.params.name}` });
    const role = String(req.header('x-role') ?? '') as Role;
    try {
      const result = fn(role, req.body ?? {});
      res.json({ ok: true, result: result ?? null, state: buildState(svc) });
    } catch (e) {
      if (e instanceof UserError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  });

  return api;
}
