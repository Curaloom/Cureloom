// Builds dist-standalone/cureloom.html: one self-contained page (no server)
// that can be opened from disk or published as a shared link.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = 'dist-standalone';
execSync('npx vite build --config vite.standalone.config.ts', { stdio: 'inherit' });
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const js = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
const css = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
const read = (p) => fs.readFileSync(path.join(out, p.replace(/^\.?\//, '')), 'utf8');
const scripts = js.map((p) => read(p).replace(/<\/script/gi, '<\\/script'));
const styles = css.map((p) => read(p));
const page = [
  '<title>Cureloom V1 Prototype</title>',
  `<style>\n${styles.join('\n')}\n</style>`,
  '<div id="root"></div>',
  `<script>\n${scripts.join('\n')}\n</script>`,
  '',
].join('\n');
fs.writeFileSync(path.join(out, 'cureloom.html'), page);
console.log(`Wrote ${out}/cureloom.html (${(page.length / 1024 / 1024).toFixed(2)} MB)`);
