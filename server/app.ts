import express from 'express';
import type { Role } from '../shared/types';
import { createHandlers } from './handlers';
import type { Service } from './service';

export function createApi(svc: Service): express.Router {
  const api = express.Router();
  const h = createHandlers(svc);

  api.get('/api/state', (_req, res) => {
    res.json(h.state());
  });

  api.get('/api/events', (req, res) => {
    res.json(
      h.events({
        patientId: req.query.patientId ? Number(req.query.patientId) : undefined,
        prefix: req.query.prefix ? String(req.query.prefix) : undefined,
      }),
    );
  });

  api.get('/api/csv/:name', (req, res) => {
    const f = h.csv(req.params.name);
    if (!f) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${f.filename}"`);
    res.send(f.text);
  });

  api.post('/api/action/:name', (req, res) => {
    const r = h.action(req.params.name, String(req.header('x-role') ?? '') as Role, req.body);
    res.status(r.status).json(r.body);
  });

  return api;
}
