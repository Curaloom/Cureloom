// The whole app in one browser tab: the server's Service on an in-memory
// SQLite (sql.js, pure-JS build). The database is saved to this browser's
// storage after every change, so a reload keeps the demo where it was.
import initSqlJs from 'sql.js/dist/sql-asm.js';
import errorsCsv from '../../seed/roster-with-errors.csv?raw';
import rosterCsv from '../../seed/october-roster.csv?raw';
import script from '../../seed/october-script.json';
import september from '../../seed/september.json';
import { createHandlers } from '../../server/handlers';
import { SCHEMA } from '../../server/schema';
import { Service, type CheckpointStore, type Script, type SeptemberSeed, type Snapshot } from '../../server/service';
import { wrapSqlJs } from './sqljs';

const DB_KEY = 'cureloom.v1.db';
const CP_KEY = 'cureloom.v1.checkpoint';

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked: the demo keeps working, it just won't survive a reload */
  }
}

const checkpoints: CheckpointStore = {
  save: (s) => write(CP_KEY, JSON.stringify(s)),
  load() {
    const raw = read(CP_KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  },
  info() {
    const s = this.load();
    return s ? { savedAt: s.savedAt, demoAt: s.demoAt } : null;
  },
};

export async function startBackend() {
  const SQL = await initSqlJs();
  let raw: Database | null = null;
  const saved = read(DB_KEY);
  if (saved) {
    try {
      raw = new SQL.Database(fromB64(saved));
    } catch {
      raw = null;
    }
  }
  if (!raw) raw = new SQL.Database();
  raw.exec(SCHEMA);
  const db = raw;
  const svc = new Service({
    db: wrapSqlJs(db),
    seed: {
      rosterCsv: (name) => (name === 'roster-with-errors.csv' ? errorsCsv : rosterCsv),
      september: () => september as unknown as SeptemberSeed,
      script: () => script as unknown as Script,
    },
    checkpoints,
  });
  if (svc.isEmpty()) svc.reset();
  const h = createHandlers(svc);
  const persist = () => write(DB_KEY, toB64(db.export()));
  persist();
  return {
    state: h.state,
    events: h.events,
    csv: h.csv,
    action(name: string, role: Parameters<typeof h.action>[1], body: unknown) {
      const r = h.action(name, role, body);
      if (r.status === 200) persist();
      return r;
    },
  };
}

type Database = InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>;
