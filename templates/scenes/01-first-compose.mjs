// Video 01, edit. Turns captures/01 into videos/01-first.mp4 (1920x1080: app in a window, gentle camera,
// cursor, tap ripples, short captions) and videos/raw/01-first-raw.mp4 (untouched recording).
// Usage: node scenes/01-first-compose.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compose2 } from '__SKILL_DIR__/scripts/lib/compose2.mjs';
import { exportRaw } from '__SKILL_DIR__/scripts/lib/raw.mjs';

const H = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(H, 'captures', '01');
const NAME = '01-first';
const OUT = path.join(H, 'videos', `${NAME}.mp4`);
const T = Date.now();
const log = (...a) => console.log(`[${new Date().toTimeString().slice(0, 8)}] (+${((Date.now() - T) / 1000).toFixed(1)}s)`, ...a);

log('[1/2] raw recording (untouched, no zoom or pan)');
fs.mkdirSync(path.join(H, 'videos', 'raw'), { recursive: true });
await exportRaw(SRC, path.join(H, 'videos', 'raw', `${NAME}-raw.mp4`));

const cap = JSON.parse(fs.readFileSync(path.join(SRC, 'capture.json'), 'utf8'));
const t0 = cap.frames[0].t;
const m = Object.fromEntries(cap.marks.map((x) => [x.name, x.t - t0]));   // named moments from the recording
const dur = m.end - 0.1;
log('   marks', JSON.stringify(m), 'length', dur.toFixed(2));

log(`[2/2] edit → ${OUT}`);
const BOX = { x: 160, y: 60, w: 1600, h: 1000 };   // where the app window sits on the 1920x1080 stage
const code = await compose2({
  out: OUT, duration: dur, bg: 'day', fadeEnd: 0.7,
  layers: [{
    id: 'app', kind: 'capture', dir: SRC, chrome: 'mac', cursor: true, hold: 2,
    boxAt: () => BOX,
    // Camera keyframes in capture pixels: t (s), cx/cy (centre), z (zoom 1.0 to 1.3). Keep moves slow.
    camera: ({ app: { W, H: Ht } }) => [
      { t: 0, cx: W / 2, cy: Ht / 2, z: 1.0, ease: 0.6 },
      { t: (m.result ?? dur * 0.6) - 0.3, cx: W / 2, cy: Ht / 2, z: 1.12, ease: 0.9 },
      { t: dur, cx: W / 2, cy: Ht / 2, z: 1.0, ease: 1.0 },
    ],
  }],
  captions: [
    { text: 'TODO first caption', from: 0.3, to: (m.result ?? dur * 0.6) - 0.3, pos: 'top' },
    { text: 'TODO second caption', from: m.result ?? dur * 0.6, to: dur - 0.1, pos: 'top' },
  ],
});
log('SUMMARY: compose2 exit', code, OUT);
process.exit(code === 0 ? 0 : 1);
