// Rendert Trailer oder Short Bild für Bild aus der echten App.
//   node render.mjs trailer            → out/raumplaner-trailer.mp4 (1920×1080, 30 fps)
//   node render.mjs short              → out/raumplaner-short.mp4   (1080×1920, 30 fps)
//   Optionen: --fps 30  --preview 15 (nur jedes 15. Bild als JPG in frames/)  --from 20 --to 30 (Sekunden)
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..');
const args = process.argv.slice(2), mode = args[0] === 'short' ? 'short' : 'trailer';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const fps = +opt('fps', 30), preview = +opt('preview', 0), from = +opt('from', 0), to = +opt('to', 1e9);
const chrome = opt('chrome', process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.txt': 'text/plain', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const portrait = mode === 'short';
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage();
await page.setViewport(portrait ? { width: 540, height: 960, deviceScaleFactor: 2 } : { width: 1920, height: 1080, deviceScaleFactor: 1 });
page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning' || t === 'warn') console.log('[seite]', t, m.text().slice(0, 300)); });
page.on('pageerror', e => console.log('[fehler]', e.message));
await page.evaluateOnNewDocument(fs.readFileSync(path.join(here, 'shim.js'), 'utf8'));
await page.goto(`http://127.0.0.1:${port}/video/stage.html?mode=${mode}&fps=${fps}${args.includes('--dbg') ? '&dbg' : ''}`, { waitUntil: 'load' });
for (let k = 0; k < 900; k++) { if (await page.evaluate('!!(window.stageReady || window.stageError)')) break; await new Promise(r => setTimeout(r, 200)); }
const err = await page.evaluate('window.stageError'); if (err) { console.error(err); process.exit(1); }
const frames = await page.evaluate('window.FRAMES');
console.log(`${mode}: ${frames} Bilder (${(frames / fps).toFixed(1)} s) …`);

fs.mkdirSync(path.join(here, 'out'), { recursive: true }); fs.mkdirSync(path.join(here, 'frames'), { recursive: true });
let ff = null;
if (!preview) {
  const out = path.join(here, 'out', `raumplaner-${mode}${from > 0 || to < 1e9 ? '-teil' : ''}.mp4`);
  ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'film', '-movflags', '+faststart', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  console.log('→', out);
}
const t0 = Date.now();
const last = Math.min(frames, Math.ceil((to + 0.5) * fps));
for (let i = 0; i < last; i++) {
  const t = await page.evaluate(i => window.__frame(i), i);
  const want = t >= from && t <= to && (!preview || i % preview === 0);
  if (!want) continue;
  const buf = await page.screenshot({ type: 'jpeg', quality: preview ? 80 : 95, optimizeForSpeed: true, captureBeyondViewport: false });
  if (preview) fs.writeFileSync(path.join(here, 'frames', `${mode}-${String(i).padStart(5, '0')}.jpg`), buf);
  else if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 60 === 0) { const el = (Date.now() - t0) / 1000; console.log(`  ${t.toFixed(1)} s · ${(el / Math.max(1, i + 1) * 1000).toFixed(0)} ms/Bild · ${el.toFixed(0)} s vergangen`); }
}
if (ff) { ff.stdin.end(); await new Promise(r => ff.on('close', r)); }
await browser.close(); server.close();
console.log('fertig in', ((Date.now() - t0) / 60000).toFixed(1), 'min');
