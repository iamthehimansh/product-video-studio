// Video 01, recording. Opens the real app with demo data, performs the story's steps like a person would,
// and saves frames + capture.json (with named marks) to captures/01.
// Usage:  node scenes/01-first-record.mjs probe     → screenshots only, nothing recorded (show these first)
//         node scenes/01-first-record.mjs           → the real recording
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, Rec, log, sleep } from '__SKILL_DIR__/scripts/lib/rec.mjs';

const H = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = JSON.parse(fs.readFileSync(path.join(H, 'product.json'), 'utf8'));
const WEB = P.surfaces.web;
const DIR = path.join(H, 'captures', '01');
const SHOTS = path.join(H, 'out', 'frames-check');
const PROBE = process.argv[2] === 'probe';
fs.mkdirSync(SHOTS, { recursive: true });
let n = 0; const N = 4;
const step = (m) => log(`[${++n}/${N}] ${m}`);

step(`open ${WEB.url}`);
const app = await openApp({ url: WEB.url, width: WEB.width, height: WEB.height, dsf: WEB.dsf, ready: 'body' });
const { page } = app;
await sleep(1200);
const rec = PROBE ? null : new Rec(app, DIR);
if (rec) await rec.start();
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `01-${name}.png`) });
// Click by visible text or CSS selector. In probe mode it clicks straight away; when recording it moves the mouse.
const click = async (target, ms = 700) => {
  if (rec) return rec.clickOn(target, ms);
  const sel = typeof target === 'string' ? target : `text=${target.text}`;
  await page.click(sel);
};
const waitText = (t, timeout = 15000) => page.waitForFunction((x) => document.body.innerText.includes(x), t, { timeout });

await sleep(800);
rec?.mark('opened');
await shot('opened');

step('first action of the story');
// TODO: replace with the story's steps, e.g.
// await click({ text: 'New project' });
// await waitText('Untitled project');
// rec?.mark('created');
await sleep(1500);
await shot('after-first-action');

step('show the result');
await sleep(1500);
rec?.mark('result');
await shot('result');

step('stop');
const errs = app.errors.slice(0, 5);
log('   page errors', JSON.stringify(errs));
if (rec) {
  const meta = await rec.stop();
  log('   marks', meta.marks.map((m) => `${m.name}=${(m.t - meta.t0).toFixed(2)}`).join(' '));
  log(`SUMMARY: capture in ${DIR} (${meta.frames.length} frames)`);
} else log(`SUMMARY: probe done, screenshots in ${SHOTS} — look at every one before recording`);
await app.browser.close();
process.exit(errs.length ? 1 : 0);
