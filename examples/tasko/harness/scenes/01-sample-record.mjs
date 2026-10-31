// Video 01 (Tasko sample), recording: open the launch-week list, add "Book the chai tasting", tick off
// "Print the new menu cards". Saves frames + capture.json (marks: opened, adding, added, result) to captures/01.
// Usage:  node scenes/01-sample-record.mjs probe     → screenshots only, nothing recorded
//         node scenes/01-sample-record.mjs           → the real recording
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, Rec, log, sleep } from '../../../../scripts/lib/rec.mjs';

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

step('add a task: New task → type → Enter');
await waitText('Print the new menu cards');
await click('#new');
await page.waitForSelector('#add.open');
rec?.mark('adding');
await sleep(400);
if (rec) await rec.type('Book the chai tasting', 45); else await page.keyboard.type('Book the chai tasting');
await sleep(500);
await page.keyboard.press('Enter');
await waitText('Task added');
rec?.mark('added');
await sleep(1600);
await shot('after-first-action');

step('tick a task off');
await rec?.rect('row', { text: 'Print the new menu cards' });
// the check circle sits left of the title: click it precisely
const box = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.row')].find((r) => r.textContent.includes('Print the new menu cards'));
  const b = row.querySelector('.check').getBoundingClientRect();
  return { x: b.left, y: b.top, w: b.width, h: b.height };
});
if (rec) await rec.clickBox(box, 700); else await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2);
await waitText('Nice, one less to do');
rec?.mark('result');
await sleep(2000);
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
