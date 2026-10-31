// compose2: turns recordings into the finished 1920x1080 video.
// Layers are either captures of the real UI (capture.json + frames from rec.mjs) or
// already-recorded videos (e.g. the phone simulator's screen recording, decoded once to frames).
// Each layer gets a box on the stage, optional mac-window or phone chrome, its own camera
// (zoom/pan keyframes), cursor and tap ripples. Captions, chips and a background that can
// cross-fade between looks (day → night). See steps/06-edit.md for every option.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import { acquire } from './slots.mjs';
import { chromium, CHROME } from './env.mjs';
const T0 = Date.now();
const log = (...a) => console.log(`[${new Date().toTimeString().slice(0, 8)}] (+${((Date.now() - T0) / 1000).toFixed(1)}s)`, ...a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const BG = {
  day: 'radial-gradient(1200px 800px at 12% 18%, #ffd9b8 0%, transparent 60%), radial-gradient(1100px 900px at 88% 82%, #c9c3ff 0%, transparent 62%), radial-gradient(900px 700px at 80% 10%, #ffe9c7 0%, transparent 60%), linear-gradient(135deg, #fbe7d6 0%, #efe3ff 55%, #dfe6ff 100%)',
  night: 'radial-gradient(1100px 800px at 15% 20%, #3b2a7a 0%, transparent 60%), radial-gradient(1000px 800px at 85% 85%, #0f4c75 0%, transparent 60%), linear-gradient(135deg, #0b1026 0%, #151a3d 60%, #0d1b33 100%)',
  sunrise: 'radial-gradient(1200px 700px at 50% 110%, #ffb36b 0%, transparent 65%), radial-gradient(900px 600px at 15% 15%, #ffd6e0 0%, transparent 60%), linear-gradient(180deg, #8fb8ff 0%, #ffd9c2 70%, #ffe8c9 100%)',
  mint: 'radial-gradient(1100px 800px at 15% 20%, #c8f5e4 0%, transparent 60%), radial-gradient(1000px 800px at 85% 80%, #d8dcff 0%, transparent 60%), linear-gradient(135deg, #eafaf3 0%, #eef0ff 100%)',
};

// Smoothly interpolate a list of {t, ...numbers} keyframes (each key eases from the previous state).
export function keyed(keys, x, base) {
  let cur = { ...base };
  for (const k of keys) {
    if (x < k.t) break;
    const from = { ...cur };
    const kk = ease(clamp((x - k.t) / (k.ease ?? 0.9), 0, 1));
    for (const [name, v] of Object.entries(k)) {
      if (name === 't' || name === 'ease' || typeof v !== 'number') continue;
      const a = from[name] ?? v;
      cur[name] = name === 'z' ? Math.exp(Math.log(a) + (Math.log(v) - Math.log(a)) * kk) : a + (v - a) * kk;
    }
  }
  return cur;
}

function loadCapture(layer) {
  const meta = JSON.parse(fs.readFileSync(path.join(layer.dir, 'capture.json'), 'utf8'));
  // Screencast frames can arrive out of order under load; their timestamps are the true order.
  meta.frames.sort((a, b) => a.t - b.t);
  const t0 = meta.frames[0].t;
  const rel = (t) => t - t0;
  return {
    W: meta.width, H: meta.height, meta,
    marks: Object.fromEntries(meta.marks.map((m) => [m.name, rel(m.t)])),
    rects: meta.rects,
    end: rel(meta.frames[meta.frames.length - 1].t),
    frameFile(x) {
      const fr = meta.frames; const t = t0 + x;
      if (t <= fr[0].t) return path.join(layer.dir, 'frames', fr[0].file);
      let lo = 0, hi = fr.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (fr[mid].t <= t) lo = mid; else hi = mid; }
      return path.join(layer.dir, 'frames', (fr[hi].t <= t ? fr[hi] : fr[lo]).file);
    },
    ptr: meta.ptr.map((p) => ({ t: rel(p.t), x: p.x, y: p.y })),
    clicks: meta.clicks.map((c) => ({ t: rel(c.t), x: c.x, y: c.y })),
  };
}

function loadVideo(layer, fps, tmp) {
  const dir = path.join(tmp, layer.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', layer.file], { encoding: 'utf8' });
  const [vw, vh] = probe.stdout.trim().split(',').map(Number);
  const maxW = layer.decodeWidth || Math.min(vw, 1600);
  log(`decoding video layer ${layer.id} (${vw}x${vh}) → ${maxW}px frames`);
  const r = spawnSync('nice', ['-n', '10', 'ffmpeg', '-v', 'error', '-y', '-i', layer.file, '-vf', `fps=${fps},scale=${maxW}:-2`, '-q:v', '3', path.join(dir, '%05d.jpg')], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg decode failed for ' + layer.file);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort();
  const H = Math.round((vh * maxW) / vw);
  return {
    // taps: [{ t, nx, ny }] in seconds from the video start and 0..1 of the frame → tap ripples
    W: maxW, H, marks: {}, rects: {}, end: files.length / fps, ptr: [], clicks: (layer.taps || []).map((k) => ({ t: k.t, x: k.nx * maxW, y: k.ny * H })),
    frameFile(x) { const i = clamp(Math.floor(x * fps), 0, files.length - 1); return path.join(dir, files[i]); },
  };
}

function ptrAt(ptr, x) {
  if (!ptr.length) return null;
  if (x <= ptr[0].t) return ptr[0];
  const n = ptr.length - 1;
  if (x >= ptr[n].t) return ptr[n];
  let lo = 0, hi = n;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ptr[mid].t <= x) lo = mid; else hi = mid; }
  const a = ptr[lo], b = ptr[hi], k = (x - a.t) / Math.max(1e-6, b.t - a.t);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

export async function compose2(o) {
  const { out, fps = 30, duration, bg = 'day', layers = [], captions = [], overlays = [], fadeEnd = 0.7, bgKeys = [] } = o;
  const releaseSlot = await acquire('compose', { slots: 2, label: out });
  const SW = 1920, SH = 1080;
  const tmp = path.join(path.dirname(out), '.compose2-' + path.basename(out, '.mp4'));
  fs.mkdirSync(tmp, { recursive: true });
  const L = layers.map((ly) => ({ ...ly, src: ly.kind === 'video' ? loadVideo(ly, fps, tmp) : loadCapture(ly) }));
  const ctx = Object.fromEntries(L.map((l) => [l.id, l.src]));
  for (const l of L) l.cams = (l.camera ? l.camera(ctx) : []).filter(Boolean).sort((a, b) => a.t - b.t);
  const caps = (typeof captions === 'function' ? captions(ctx) : captions).filter(Boolean);
  const chips = (typeof overlays === 'function' ? overlays(ctx) : overlays).filter(Boolean);
  const dur = duration ?? Math.max(...L.map((l) => (l.offset || 0) + l.src.end));
  const bgNames = [...new Set([bg, ...bgKeys.map((k) => k.to)])];

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${SW}px;height:${SH}px;overflow:hidden;background:#000}
  .bg{position:absolute;inset:0}
  .layer{position:absolute;transform-origin:0 0}
  .layer .clip{position:absolute;overflow:hidden}
  .layer img.f{position:absolute;left:0;top:0;transform-origin:0 0}
  .mac .clip{border-radius:12px;box-shadow:0 40px 90px -20px rgba(40,20,80,.45),0 0 0 1px rgba(0,0,0,.08)}
  .tl{position:absolute;border-radius:50%;box-shadow:inset 0 0 0 .5px rgba(0,0,0,.18)}
  .phone .bezel{position:absolute;background:#0b0b0f;box-shadow:0 50px 100px -25px rgba(20,10,60,.55),0 0 0 2px #2a2a33}
  .phone .clip{background:#000}
  .phone .island{position:absolute;background:#000;border-radius:999px}
  .cur{position:absolute;left:0;top:0;width:26px;height:26px;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transform-origin:0 0}
  .rip{position:absolute;border-radius:50%;border:3px solid rgba(124,92,255,.85);background:rgba(124,92,255,.18)}
  .cap{position:absolute;left:50%;transform:translateX(-50%);padding:11px 22px;border-radius:999px;background:rgba(20,16,40,.80);color:#fff;
       font:600 26px/1.2 -apple-system,"SF Pro Display",system-ui,sans-serif;letter-spacing:-.2px;white-space:nowrap;box-shadow:0 10px 30px -10px rgba(0,0,0,.35)}
  .chip{position:absolute;padding:10px 18px;border-radius:14px;background:rgba(255,255,255,.88);color:#1d1840;font:700 30px/1 -apple-system,"SF Pro Display",system-ui;letter-spacing:-.5px;box-shadow:0 10px 30px -12px rgba(0,0,0,.35)}
  .chip.dark{background:rgba(15,12,35,.72);color:#fff}
  #fade{position:absolute;inset:0;width:100%;height:100%;opacity:0}
  </style></head><body>
  ${bgNames.map((n, i) => `<div class="bg" id="bg-${n}" style="background:${BG[n] || BG.day};opacity:${i === 0 ? 1 : 0}"></div>`).join('')}
  ${L.map((l) => `<div class="layer ${l.chrome || 'none'}" id="L-${l.id}">
     ${l.chrome === 'phone' ? '<div class="bezel"></div>' : ''}
     <div class="clip"><img class="f">${l.chrome === 'mac' ? '<div class="tl" style="background:#ff5f57"></div><div class="tl" style="background:#febc2e"></div><div class="tl" style="background:#28c840"></div>' : ''}${l.chrome === 'phone' ? '<div class="island"></div>' : ''}<div class="rips"></div><svg class="cur" viewBox="0 0 24 24"><path d="M5 2.6 L5 19.2 L9.2 15.3 L12.1 21.7 L14.9 20.5 L12.1 14.2 L17.9 14.2 Z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
   </div>`).join('')}
  <div id="chips">${chips.map((c, i) => `<div class="chip ${c.dark ? 'dark' : ''}" id="chip-${i}" style="left:${c.x}px;top:${c.y}px;opacity:0">${c.text}</div>`).join('')}</div>
  <div id="caps">${caps.map((c, i) => `<div class="cap" id="cap-${i}" style="${c.pos === 'top' ? 'top:34px' : 'bottom:46px'};opacity:0">${c.text}</div>`).join('')}</div>
  <img id="fade"></body></html>`;
  const pagePath = path.join(tmp, 'stage.html');
  fs.writeFileSync(pagePath, html);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
  // Renders run at low priority so live recordings in other looms keep a smooth frame rate.
  try { os.setPriority(browser.process().pid, 10); } catch (e) {}
  const page = await browser.newPage({ viewport: { width: SW, height: SH }, deviceScaleFactor: 1 });
  await page.goto('file://' + pagePath);
  const cdp = await page.context().newCDPSession(page);
  const ff = spawn('nice', ['-n', '10', 'ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((r) => ff.on('close', r));
  const total = Math.round(dur * fps);
  log(`compose2: ${L.length} layer(s), ${total} frames (${dur.toFixed(1)}s) → ${path.basename(out)}`);
  const lastSrc = {};
  let firstShot = null, lastBeat = Date.now();

  for (let i = 0; i < total; i++) {
    const x = i / fps;
    const st = { layers: [], bg: {}, caps: [], chips: [], fade: 0 };
    // background cross-fades
    const bgState = Object.fromEntries(bgNames.map((n, j) => [n, j === 0 ? 1 : 0]));
    let curBg = bg;
    for (const k of bgKeys) {
      const kk = clamp((x - k.t) / (k.dur || 1.5), 0, 1);
      if (x >= k.t) { for (const n of bgNames) bgState[n] = n === k.to ? Math.max(bgState[n], kk) : bgState[n] * (n === curBg ? 1 - kk : 1); if (kk >= 1) { for (const n of bgNames) bgState[n] = n === k.to ? 1 : 0; curBg = k.to; } }
    }
    st.bg = bgState;
    for (const l of L) {
      const lx = x - (l.offset || 0);
      const box = l.boxAt ? l.boxAt(x, ctx) : { x: 0, y: 0, w: SW, h: SH, opacity: 1 };
      const op = box.opacity ?? 1;
      const vis = op > 0.001 && lx >= -0.5 && lx <= l.src.end + 0.5 + (l.hold || 0);
      const S = l.src;
      // inner screen box inside the layer box (phone has a bezel)
      const pad = l.chrome === 'phone' ? Math.round(box.w * 0.035) : 0;
      const inner = { x: pad, y: pad, w: box.w - 2 * pad, h: box.h - 2 * pad };
      // camera: base scale fits the source into the inner box (cover for phone, contain for others)
      const sx = inner.w / S.W, sy = inner.h / S.H;
      const s0 = l.chrome === 'phone' ? Math.max(sx, sy) : Math.min(sx, sy);
      const c = keyed(l.cams, lx, { cx: S.W / 2, cy: S.H / 2, z: 1 });
      const s = s0 * c.z;
      const vw = inner.w / s, vh = inner.h / s;
      const cx = vw >= S.W ? S.W / 2 : clamp(c.cx, vw / 2, S.W - vw / 2);
      const cy = vh >= S.H ? S.H / 2 : clamp(c.cy, vh / 2, S.H - vh / 2);
      const X = inner.w / 2 - cx * s, Y = inner.h / 2 - cy * s;
      const p = l.cursor ? ptrAt(S.ptr, clamp(lx, 0, S.end)) : null;
      let ca = 0;
      if (p) for (const [a, b] of (l.cursorRanges ? l.cursorRanges(S) : [[0, S.end]])) ca = Math.max(ca, clamp((lx - a) / 0.25, 0, 1) * clamp((b - lx) / 0.25, 0, 1));
      const file = vis ? S.frameFile(clamp(lx, 0, S.end)) : null;
      // Window buttons, cursor and tap ripples live inside the clip (the window's screen area), so a zoom or pan
      // cuts them at the window edge like the rest of the screen and they never float onto the background.
      const tl = l.chrome === 'mac' ? [21, 41, 61].map((tx) => ({ l: X + (tx - 6) * s, t: Y + 13 * s, d: 12 * s })) : null;
      const cur = p ? { x: X + p.x * s, y: Y + p.y * s, sc: 1.1 * Math.pow(s / s0, 0.5) * Math.max(0.75, Math.min(1.2, box.w / 1500)), a: ca } : null;
      const rips = S.clicks.filter((k) => lx >= k.t && lx - k.t < 0.5).map((k) => { const kk = (lx - k.t) / 0.5; return { x: X + k.x * s, y: Y + k.y * s, r: (10 + 34 * ease(kk)) * Math.max(0.6, s / s0 * 0.8), a: 1 - kk }; });
      st.layers.push({
        id: l.id, vis, op,
        box: { x: box.x, y: box.y, w: box.w, h: box.h, r: l.chrome === 'phone' ? Math.round(box.w * 0.15) : 12 },
        inner: { x: inner.x, y: inner.y, w: inner.w, h: inner.h, r: l.chrome === 'phone' ? Math.round(box.w * 0.12) : 12 },
        img: { src: file && file !== lastSrc[l.id] ? 'file://' + file : null, X, Y, w: S.W * s, h: S.H * s },
        tl,
        // the island sits inside the clip too (clip-local), under the taps and cursor as before
        island: l.chrome === 'phone' ? { l: box.w / 2 - box.w * 0.15 - pad, t: box.w * 0.03, w: box.w * 0.3, h: box.w * 0.085 } : null,
        cur, rips,
      });
      if (file) lastSrc[l.id] = file;
    }
    st.caps = caps.map((c) => clamp((x - c.from) / 0.3, 0, 1) * clamp((c.to - x) / 0.3, 0, 1));
    st.chips = chips.map((c) => clamp((x - c.from) / 0.25, 0, 1) * clamp((c.to - x) / 0.25, 0, 1));
    st.fade = firstShot && fadeEnd > 0 ? clamp((x - (dur - fadeEnd)) / fadeEnd, 0, 1) : 0;
    await page.evaluate(async (st) => {
      for (const [n, v] of Object.entries(st.bg)) { const e = document.getElementById('bg-' + n); if (e) e.style.opacity = String(v); }
      const waits = [];
      for (const l of st.layers) {
        const el = document.getElementById('L-' + l.id);
        el.style.display = l.vis ? 'block' : 'none';
        if (!l.vis) continue;
        Object.assign(el.style, { left: l.box.x + 'px', top: l.box.y + 'px', width: l.box.w + 'px', height: l.box.h + 'px', opacity: String(l.op) });
        const bez = el.querySelector('.bezel');
        if (bez) Object.assign(bez.style, { left: '0px', top: '0px', width: l.box.w + 'px', height: l.box.h + 'px', borderRadius: l.box.r + 'px' });
        const clip = el.querySelector('.clip');
        Object.assign(clip.style, { left: l.inner.x + 'px', top: l.inner.y + 'px', width: l.inner.w + 'px', height: l.inner.h + 'px', borderRadius: l.inner.r + 'px' });
        const img = el.querySelector('img.f');
        if (l.img.src) { img.src = l.img.src; waits.push(img.decode().catch(() => {})); }
        Object.assign(img.style, { left: l.img.X + 'px', top: l.img.Y + 'px', width: l.img.w + 'px', height: l.img.h + 'px' });
        if (l.tl) [...el.querySelectorAll('.tl')].forEach((d, i) => Object.assign(d.style, { left: l.tl[i].l + 'px', top: l.tl[i].t + 'px', width: l.tl[i].d + 'px', height: l.tl[i].d + 'px' }));
        const isl = el.querySelector('.island');
        if (isl && l.island) Object.assign(isl.style, { left: l.island.l + 'px', top: l.island.t + 'px', width: l.island.w + 'px', height: l.island.h + 'px' });
        const cur = el.querySelector('.cur');
        if (l.cur) { cur.style.display = 'block'; cur.style.transform = `translate(${l.cur.x - 5 * l.cur.sc}px, ${l.cur.y - 2.6 * l.cur.sc}px) scale(${l.cur.sc})`; cur.style.opacity = String(l.cur.a); } else cur.style.display = 'none';
        el.querySelector('.rips').innerHTML = l.rips.map((r) => `<div class="rip" style="left:${r.x - r.r}px;top:${r.y - r.r}px;width:${2 * r.r}px;height:${2 * r.r}px;opacity:${r.a}"></div>`).join('');
      }
      st.caps.forEach((v, i) => { document.getElementById('cap-' + i).style.opacity = String(v); });
      st.chips.forEach((v, i) => { document.getElementById('chip-' + i).style.opacity = String(v); });
      document.getElementById('fade').style.opacity = String(st.fade);
      await Promise.all(waits);
    }, st);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, optimizeForSpeed: true });
    const buf = Buffer.from(shot.data, 'base64');
    if (i === 0 && fadeEnd > 0) {
      firstShot = path.join(tmp, 'first.jpg');
      fs.writeFileSync(firstShot, buf);
      await page.evaluate((src) => { const f = document.getElementById('fade'); f.src = src; return f.decode().catch(() => {}); }, 'file://' + firstShot);
    }
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (Date.now() - lastBeat > 10000) { lastBeat = Date.now(); log(`…heartbeat: frame ${i + 1}/${total} (${Math.round(((i + 1) / total) * 100)}%)`); }
  }
  ff.stdin.end();
  const code = await ffDone;
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  releaseSlot();
  log(`ffmpeg exited ${code}; wrote ${out}`);
  return code;
}
