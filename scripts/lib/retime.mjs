// Retime a capture (trim waits, speed ramps) without touching the source capture.
// Writes <out>/capture.json with every timestamp remapped and links <out>/frames to the source frames.
// segs: [[fromSec, toSec, speed], ...] in seconds from the first frame; frames outside segs are dropped.
// Speed up waits (speed 2-6) rather than cutting steps out, so the viewer still sees every step happen.
// Frames are sorted by timestamp first (screencast frames can arrive out of order under load).
import fs from 'node:fs';
import path from 'node:path';

export function segMapper(segs) {
  const offs = [];
  let acc = 0;
  for (const [a, b, sp] of segs) { offs.push(acc); acc += (b - a) / sp; }
  return {
    duration: acc,
    // source seconds → output seconds (null if the moment was cut)
    map(x) {
      for (let i = 0; i < segs.length; i++) { const [a, b, sp] = segs[i]; if (x >= a && x <= b) return offs[i] + (x - a) / sp; }
      return null;
    },
    // like map, but clamps cut moments to the nearest kept time
    mapClamp(x) {
      for (let i = 0; i < segs.length; i++) { const [a, b, sp] = segs[i]; if (x >= a && x <= b) return offs[i] + (x - a) / sp; if (x < a) return offs[i]; }
      return acc;
    },
  };
}

export function retime(src, out, segs) {
  const meta = JSON.parse(fs.readFileSync(path.join(src, 'capture.json'), 'utf8'));
  meta.frames.sort((a, b) => a.t - b.t);
  const t0 = meta.frames[0].t;
  const sm = segMapper(segs);
  const inside = (t) => sm.map(t - t0) !== null;
  const mapT = (t) => t0 + sm.mapClamp(t - t0);
  const frames = meta.frames.filter((f) => inside(f.t)).map((f) => ({ ...f, t: mapT(f.t) }));
  const kept = [];
  for (const f of frames) if (!kept.length || f.t > kept[kept.length - 1].t + 1e-4) kept.push(f);
  kept[0].t = t0;
  const res = {
    ...meta, frames: kept, t0,
    marks: meta.marks.map((m) => ({ ...m, t: mapT(m.t) })),
    ptr: meta.ptr.filter((p) => inside(p.t)).map((p) => ({ ...p, t: mapT(p.t) })),
    clicks: meta.clicks.filter((c) => inside(c.t)).map((c) => ({ ...c, t: mapT(c.t) })),
    rects: Object.fromEntries(Object.entries(meta.rects || {}).map(([k, r]) => [k, { ...r, t: mapT(r.t) }])),
  };
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.symlinkSync(path.join(path.resolve(src), 'frames'), path.join(out, 'frames'));
  fs.writeFileSync(path.join(out, 'capture.json'), JSON.stringify(res));
  return { duration: sm.duration, marks: Object.fromEntries(res.marks.map((m) => [m.name, +(m.t - t0).toFixed(3)])) };
}
