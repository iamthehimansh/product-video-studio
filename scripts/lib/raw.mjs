// Export the untouched recording of a capture: every frame exactly as the real UI painted it,
// at native resolution and real timing (no camera, cursor, captions or background).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { acquire } from './slots.mjs';
const log = (...a) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...a);
export async function exportRaw(dir, out, { fps = 30 } = {}) {
  // ffmpeg's concat list resolves relative file paths against the list's own folder, so use absolute paths.
  dir = path.resolve(dir);
  out = path.resolve(out);
  const releaseSlot = await acquire('compose', { slots: 2, label: out });
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'capture.json'), 'utf8'));
  // Screencast frames can arrive out of order under load; their timestamps are the true order.
  const fr = meta.frames.sort((a, b) => a.t - b.t);
  const lines = [];
  for (let i = 0; i < fr.length; i++) {
    lines.push(`file '${path.join(dir, 'frames', fr[i].file)}'`);
    const d = i + 1 < fr.length ? Math.max(0.001, fr[i + 1].t - fr[i].t) : 0.5;
    lines.push(`duration ${d.toFixed(6)}`);
  }
  lines.push(`file '${path.join(dir, 'frames', fr[fr.length - 1].file)}'`);
  const list = path.join(dir, 'raw-concat.txt');
  fs.writeFileSync(list, lines.join('\n') + '\n');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const total = fr[fr.length - 1].t - fr[0].t + 0.5;
  log(`raw export: ${fr.length} frames, ${total.toFixed(1)}s, untouched frames at capture resolution → ${path.basename(out)}`);
  const args = ['-y', '-v', 'error', '-stats_period', '10', '-progress', 'pipe:1', '-f', 'concat', '-safe', '0', '-i', list,
    '-fps_mode', 'cfr', '-r', String(fps), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out];
  const code = await new Promise((resolve) => {
    const p = spawn('nice', ['-n', '10', 'ffmpeg', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
    let last = Date.now();
    p.stdout.on('data', (b) => {
      const m = String(b).match(/out_time_ms=(\d+)/g);
      if (m && Date.now() - last > 10000) { last = Date.now(); const t = Number(m[m.length - 1].split('=')[1]) / 1e6; log(`…raw heartbeat: ${t.toFixed(1)}s of ${total.toFixed(1)}s encoded`); }
    });
    p.on('close', resolve);
  });
  releaseSlot();
  log(`raw export finished (ffmpeg exit ${code}): ${out}`);
  return code;
}
if (process.argv[1] && process.argv[1].endsWith('raw.mjs') && process.argv[2]) {
  const code = await exportRaw(process.argv[2], process.argv[3]);
  process.exit(code === 0 ? 0 : 1);
}
