// Node-side seed files and checkpoint file. The browser-only build has its
// own versions of both in src/standalone/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CheckpointStore, Script, SeedSource, SeptemberSeed, Snapshot } from './service';

export const SEED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../seed');

export function fileSeed(dir = SEED_DIR): SeedSource {
  const read = (name: string) => fs.readFileSync(path.join(dir, name), 'utf8');
  return {
    rosterCsv: (name) => read(name),
    september: () => JSON.parse(read('september.json')) as SeptemberSeed,
    script: () => JSON.parse(read('october-script.json')) as Script,
  };
}

export function fileCheckpoints(file: string): CheckpointStore {
  let meta: { savedAt: string; demoAt: string } | null = null;
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot;
    meta = { savedAt: s.savedAt, demoAt: s.demoAt };
  } catch {
    /* no checkpoint yet */
  }
  return {
    save(s) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(s));
      meta = { savedAt: s.savedAt, demoAt: s.demoAt };
    },
    load() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot;
      } catch {
        return null;
      }
    },
    info: () => meta,
  };
}
