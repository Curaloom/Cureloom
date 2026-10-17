import express from 'express';
import type { AiInput } from '../shared/aiCall';
import type { Role } from '../shared/types';
import { dateOf, fmtDateTime } from '../shared/time';
import { claimTable, exceptionsTable } from './cms1500';
import { claimsPreflight } from './ledger';
import { parseCsv, toCsv } from './roster';
import { Service, UserError } from './service';
import { buildState } from './views';
import { readXlsxTable, writeXlsxTable } from './xlsx';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any;

/** A dropped roster file: CSV as text, XLSX as base64. Parsed here because reading XLSX is async. */
async function tableOf(b: Body): Promise<string[][]> {
  if (typeof b.xlsxBase64 === 'string') {
    try {
      return await readXlsxTable(Buffer.from(b.xlsxBase64, 'base64'));
    } catch {
      throw new UserError('That file could not be read as an Excel workbook (.xlsx).');
    }
  }
  return parseCsv(String(b.csv ?? ''));
}

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
    previewRoster: async (r, b) => svc.previewRoster(r, b.filename, await tableOf(b)),
    previewSeedRoster: (r) => svc.previewRoster(r, 'october-roster.csv', parseCsv(svc.rosterCsv())),
    importRoster: (r, b) => svc.importRoster(r, b.mapping ?? undefined),
    cancelRosterPreview: (r) => svc.cancelRosterPreview(r),
    confirmEligibility: (r, b) => svc.confirmEligibility(r, b.patientId),
    opsDecide: (r, b) => svc.opsDecide(r, b.patientId, b.decision, b.program ?? null, b.note),
    opsApproveAll: (r, b) => svc.opsApproveAll(r, Number(b.minConfidence ?? 80)),
    saveBillingSettings: (r, b) => svc.saveBillingSettings(r, b.settings ?? {}),
    sendConsentLink: (r, b) => svc.sendConsentLink(r, b.patientId),
    simulateConsentSigned: (_r, b) => svc.simulateConsentSigned(b.patientId, b),
    approveCarePlan: (r, b) => svc.approveCarePlan(r, b.planId),
    returnCarePlan: (r, b) => svc.returnCarePlan(r, b.planId, b.note),
    openEscalation: (r, b) => svc.openEscalation(r, b.taskId),
    closeEscalation: (r, b) => svc.closeEscalation(r, b.taskId, b),
    discardPhysicianTimer: (r) => svc.discardPhysicianTimer(r),
    setComplexity: (r, b) => svc.setComplexity(r, b.patientId, b.complexity),
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

function sendXlsx(res: express.Response, name: string, buf: Buffer) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(buf);
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

  api.get('/api/seed/:name', async (req, res) => {
    const allowed = ['october-roster.csv', 'roster-with-errors.csv'];
    if (req.params.name === 'october-roster.xlsx') {
      return sendXlsx(res, 'october-roster.xlsx', await writeXlsxTable(parseCsv(svc.rosterCsv())));
    }
    if (!allowed.includes(req.params.name)) return res.status(404).send('Not found');
    sendCsv(res, req.params.name, svc.rosterCsv(req.params.name));
  });

  /** CMS-1500 flat file: only claims that pass pre-flight. 409 until the date of service. */
  api.get(['/api/cms1500.csv', '/api/cms1500.xlsx'], async (req, res) => {
    const month = svc.month();
    const r = claimsPreflight(svc, month, dateOf(svc.now()));
    if (!r.open) return res.status(409).type('text/plain').send(`The ${month} export opens on the date of service, ${r.dos}.`);
    const table = claimTable(r.clean);
    const name = `cms1500-${month}`;
    if (req.path.endsWith('.xlsx')) return sendXlsx(res, `${name}.xlsx`, await writeXlsxTable(table));
    sendCsv(res, `${name}.csv`, toCsv(table));
  });

  api.get('/api/cms1500-exceptions.csv', (_req, res) => {
    const month = svc.month();
    const r = claimsPreflight(svc, month, dateOf(svc.now()));
    sendCsv(res, `cms1500-exceptions-${month}.csv`, toCsv(exceptionsTable(r.excluded)));
  });

  api.get('/api/billing.csv', (_req, res) => {
    const s = buildState(svc);
    const rows = s.billing.rows.map((r) => [
      r.mrn,
      r.name,
      r.program?.toUpperCase() ?? '',
      r.billing.lines.length ? r.billing.lines.map((l) => (l.units > 1 ? `${l.code}x${l.units}` : l.code)).join(' ') : (r.billing.code ?? ''),
      r.billing.amount != null ? r.billing.amount.toFixed(2) : '',
      r.billing.status === 'not_enrolled' ? 'not enrolled' : r.billing.status,
      r.billing.reason ?? '',
      r.billing.minutes,
    ]);
    sendCsv(
      res,
      `billing-${s.clock.month}.csv`,
      toCsv([
        ['mrn', 'patient', 'program', 'codes', 'amount', 'status', 'reason', 'counted_minutes'],
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

  api.post('/api/action/:name', async (req, res) => {
    const fn = table[req.params.name];
    if (!fn) return res.status(404).json({ error: `Unknown action ${req.params.name}` });
    const role = String(req.header('x-role') ?? '') as Role;
    try {
      const result = await fn(role, req.body ?? {});
      res.json({ ok: true, result: result ?? null, state: buildState(svc) });
    } catch (e) {
      if (e instanceof UserError) return res.status(e.status).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  });

  return api;
}
