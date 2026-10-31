// Recorder for the REAL product UI (web app, or a desktop app's web UI) running with demo data.
// Drives the app in headless Chrome and captures every painted frame (CDP screencast) together with the
// pointer path, clicks, named moments ("marks") and element boxes, so compose2 can add the camera, cursor
// and tap ripples afterwards. Output: <dir>/frames/*.jpg + <dir>/capture.json.
import fs from 'node:fs';
import path from 'node:path';
import { acquire } from './slots.mjs';
import { chromium, CHROME } from './env.mjs';
export { CHROME };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
export const log = (...a) => console.log(`[${new Date().toTimeString().slice(0, 8)}] (+${((Date.now() - T0) / 1000).toFixed(1)}s)`, ...a);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// Open the app in headless Chrome.
//   url      where the demo app runs
//   width/height/dsf  the window size in CSS pixels and the pixel density (2 = Retina-sharp frames)
//   init     a function or script string run before the page loads (e.g. set window.__DEMO = {...})
//   ready    a function evaluated in the page that returns true once the app has loaded its demo data,
//            or a CSS selector to wait for; false = don't wait
export async function openApp({ url, width = 1440, height = 900, dsf = 2, init = null, initArg = undefined, ready = 'body' } = {}) {
  if (!url) throw new Error('openApp: url is required');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', `--force-device-scale-factor=${dsf}`] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf });
  if (init) await context.addInitScript(init, initArg);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (typeof ready === 'function') await page.waitForFunction(ready, null, { timeout: 120000 });
  else if (typeof ready === 'string') await page.waitForSelector(ready, { timeout: 120000 });
  return { browser, context, page, errors, width, height, dsf };
}

export class Rec {
  // opts.slot === false: the scene already holds its 'record' slots (two screens recorded at once).
  constructor(app, dir, opts = {}) {
    Object.assign(this, { app, page: app.page, dir, opts });
    this.frames = []; this.marks = []; this.ptr = []; this.clicks = []; this.rects = {};
    this.pos = { x: app.width * 0.62, y: app.height * 0.78 };
    this.n = 0;
  }
  now() { return Date.now() / 1000; }
  async start() {
    // At most 2 live recordings machine-wide, so every capture keeps a smooth frame rate.
    if (this.opts.slot !== false) this.releaseSlot = await acquire('record', { slots: 2, label: this.dir });
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(this.dir, 'frames'), { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', (f) => {
      const file = `f${String(this.n++).padStart(5, '0')}.jpg`;
      fs.writeFileSync(path.join(this.dir, 'frames', file), Buffer.from(f.data, 'base64'));
      this.frames.push({ file, t: f.metadata.timestamp });
      this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    const { width, height, dsf } = this.app;
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: width * dsf, maxHeight: height * dsf, everyNthFrame: 1 });
    this.t0 = this.now();
    this.ptr.push({ t: this.t0, ...this.pos });
    this.mark('start');
  }
  // A named moment (e.g. 'opened', 'saved'); compose scripts cut and place captions from these.
  mark(name, extra = {}) { this.marks.push({ name, t: this.now(), ...extra }); }
  // Remember an element's box (CSS selector, or { text: 'Starts with…' }) so the camera can zoom to it.
  async rect(name, fnOrSel) {
    const r = await this.page.evaluate((arg) => {
      let el = null;
      if (arg.sel) el = document.querySelector(arg.sel);
      if (!el && arg.text) {
        const all = [...document.querySelectorAll('body *')].filter((n) => n.children.length === 0 && (n.textContent || '').trim().startsWith(arg.text));
        el = all.find((n) => n.getBoundingClientRect().width > 0) || null;
      }
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height };
    }, typeof fnOrSel === 'string' ? { sel: fnOrSel } : fnOrSel);
    if (r) this.rects[name] = { ...r, t: this.now() };
    return r;
  }
  // Box of an element by selector or visible text, waiting up to `timeout` ms. Throws with a clear message.
  async box(target, timeout = 10000) {
    const until = Date.now() + timeout;
    for (;;) {
      const r = await this.rect('_last', target);
      if (r && r.w > 0) return r;
      if (Date.now() > until) throw new Error(`not found on screen: ${JSON.stringify(target)}`);
      await sleep(150);
    }
  }
  // Human-looking mouse movement (eased, ~60 steps per second), recorded for the cursor in the edit.
  async moveTo(x, y, dur = 700) {
    const from = { ...this.pos };
    const N = Math.max(2, Math.round(dur / 16));
    for (let i = 1; i <= N; i++) {
      const k = easeInOut(i / N);
      const p = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k };
      await this.page.mouse.move(p.x, p.y);
      this.ptr.push({ t: this.now(), ...p });
      await sleep(dur / N);
    }
    this.pos = { x, y };
  }
  async click(x, y, dur = 700) {
    await this.moveTo(x, y, dur);
    this.clicks.push({ t: this.now(), x, y });
    await this.page.mouse.down(); await sleep(70); await this.page.mouse.up();
  }
  async clickBox(box, dur = 700, fx = 0.5, fy = 0.5) { await this.click(box.x + box.w * fx, box.y + box.h * fy, dur); }
  // Move to an element (selector or { text }) and click its centre.
  async clickOn(target, dur = 700) { const b = await this.box(target); await this.clickBox(b, dur); return b; }
  async type(text, delay = 32) { await this.page.keyboard.type(text, { delay }); }
  async press(key) { await this.page.keyboard.press(key); }
  async stop() {
    this.mark('end');
    await sleep(300);
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await sleep(200);
    if (this.releaseSlot) this.releaseSlot();
    // Screencast frames can arrive out of order under load; store them in true (timestamp) order.
    this.frames.sort((a, b) => a.t - b.t);
    const meta = { width: this.app.width, height: this.app.height, dsf: this.app.dsf, t0: this.t0, frames: this.frames, marks: this.marks, ptr: this.ptr, clicks: this.clicks, rects: this.rects };
    fs.writeFileSync(path.join(this.dir, 'capture.json'), JSON.stringify(meta));
    const dur = this.frames.length ? this.frames[this.frames.length - 1].t - this.frames[0].t : 0;
    log(`captured ${this.frames.length} frames over ${dur.toFixed(1)}s (${(this.frames.length / Math.max(dur, 0.001)).toFixed(1)} fps avg)`);
    return meta;
  }
}
