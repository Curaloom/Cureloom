import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApi } from './app';
import { openDb } from './db';
import { Service } from './service';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const prod = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? 'localhost';

fs.mkdirSync(DATA, { recursive: true });
const db = openDb(path.join(DATA, 'cureloom.db'));
const svc = new Service({ db, checkpointPath: path.join(DATA, 'checkpoint.db') });
if (svc.isEmpty()) svc.reset();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(createApi(svc));

if (prod) {
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('No build found. Run "npm run build" first, or use "npm start".');
    process.exit(1);
  }
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(port, host, () => {
  console.log(`Cureloom prototype running at http://${host}:${port}`);
});
