// How the client reaches the app: over HTTP to the Node server, or, in the
// browser-only build, straight into the in-tab backend.
import type { AppState } from '../shared/api';
import type { EventRow } from '../shared/model';
import type { Role } from '../shared/types';

export const STANDALONE = import.meta.env.VITE_STANDALONE === '1';

type Backend = Awaited<ReturnType<typeof import('./standalone/backend').startBackend>>;
let backend: Promise<Backend> | null = null;

function local(): Promise<Backend> {
  if (!backend) backend = import('./standalone/backend').then((m) => m.startBackend());
  return backend;
}

export async function getState(): Promise<AppState> {
  if (STANDALONE) return (await local()).state();
  const r = await fetch('/api/state');
  if (!r.ok) throw new Error(`state ${r.status}`);
  return r.json();
}

export async function getEvents(q: { patientId?: number | null; prefix?: string }): Promise<EventRow[]> {
  if (STANDALONE) return (await local()).events({ patientId: q.patientId ?? undefined, prefix: q.prefix });
  const p = new URLSearchParams();
  if (q.patientId != null) p.set('patientId', String(q.patientId));
  if (q.prefix) p.set('prefix', q.prefix);
  const r = await fetch(`/api/events?${p}`);
  return r.json();
}

export async function postAction(name: string, role: Role, body: Record<string, unknown>): Promise<{ status: number; body: any }> {
  if (STANDALONE) return (await local()).action(name, role, body);
  const r = await fetch(`/api/action/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-role': role },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

export async function getCsv(name: string): Promise<{ filename: string; text: string } | null> {
  if (STANDALONE) return (await local()).csv(name);
  const r = await fetch(`/api/csv/${name}`);
  return r.ok ? { filename: name, text: await r.text() } : null;
}
