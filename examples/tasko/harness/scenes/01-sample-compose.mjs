// Video 01 (Tasko sample), edit. Turns captures/01 into videos/01-sample.mp4 (1920x1080: app in a window, gentle
// camera toward the task list, cursor, click ripples, 3 short captions) and videos/raw/01-sample-raw.mp4.
// Usage: node scenes/01-sample-compose.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compose2 } from '../../../../scripts/lib/compose2.mjs';
import { exportRaw } from '../../../../scripts/lib/raw.mjs';

const H = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(H, 'captures', '01');
const NAME = '01-sample';
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
    // Camera keyframes in capture pixels (the app is 1440x900): t (s), cx/cy (centre), z (zoom). The action area
    // is the main column (x 220..1420: header button, stats, list with assignees, y 0..470), so zoom = 1440/1200
    // and centre on it: nothing the viewer needs is cut off. Slow moves; back out at the end.
    camera: ({ app: { W, H: Ht } }) => [
      { t: 0, cx: W / 2, cy: Ht / 2, z: 1.0, ease: 0.6 },
      { t: m.adding - 0.3, cx: 820, cy: 375, z: 1.2, ease: 0.9 },
      { t: m.result + 0.4, cx: 820, cy: 375, z: 1.2, ease: 0.9 },
      { t: dur - 0.5, cx: W / 2, cy: Ht / 2, z: 1.0, ease: 0.8 },
    ],
  }],
  captions: [
    { text: "Your team's week, one list", from: 0.15, to: m.adding + 0.05, pos: 'top' },
    { text: 'Add a task in seconds', from: m.adding + 0.1, to: m.added + 1.2, pos: 'top' },
    { text: 'Tick it off', from: m.result - 0.2, to: dur - 0.2, pos: 'top' },
  ],
});
log('SUMMARY: compose2 exit', code, OUT);
process.exit(code === 0 ? 0 : 1);
