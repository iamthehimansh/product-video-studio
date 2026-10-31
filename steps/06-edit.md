# Step 6 — Edit

Goal: `videos/NN-name.mp4`, 1920x1080, 30 fps: the app in a window (or phone frame) on a soft background, a gentle
camera, the cursor and tap ripples, short captions. Copy `scenes/01-first-compose.mjs` to `scenes/NN-compose.mjs`.

## compose2 options (`scripts/lib/compose2.mjs`)
```js
await compose2({
  out, duration, fps: 30,
  bg: 'day',                     // day | night | sunrise | mint
  bgKeys: [{ t: 8, to: 'night' }],   // cross-fade the background at 8 s (time passing)
  fadeEnd: 0.7,                  // fade to black at the end (0 = none)
  layers: [ /* one per screen, see below */ ],
  captions: [{ text: 'Invite your team', from: 0.4, to: 3.2, pos: 'top' }],   // pos: top | bottom
  overlays: [{ text: '11:40 pm', x: 80, y: 80, from: 0, to: 4, dark: true }],  // small chips anywhere
});
```
A **layer**:
- `kind: 'capture', dir` (from the recorder) or `kind: 'video', file, taps: [{ t, nx, ny }]` (screen recordings; taps
  in 0..1 of the frame give tap ripples).
- `chrome: 'mac'` (window with buttons), `'phone'` (phone frame) or none.
- `boxAt: (x) => ({ x, y, w, h, opacity })` where the screen sits on the 1920x1080 stage at time x (move it to slide a
  second screen in).
- `camera: (ctx) => [{ t, cx, cy, z, ease }]` keyframes in capture pixels; `z` 1.0 to 1.3. `ctx.<layerId>.marks`
  and `.rects` give times and boxes from the recording.
- `cursor: true` draws the recorded pointer and clicks; `offset` starts the layer later; `hold` keeps the last frame.

## Layouts that work
- One web app: window `{ x: 160, y: 60, w: 1600, h: 1000 }`.
- Two windows side by side: `{ x: 40, y: 140, w: 900, h: 800 }` and `{ x: 980, y: 140, w: 900, h: 800 }`.
- Laptop + phone: window `{ x: 60, y: 90, w: 1260, h: 900 }`, phone `{ x: 1390, y: 90, w: 430, h: 900 }`.

## Pace
- Speed up waits with `retime(src, dst, [[from, to, speed], …])` from `scripts/lib/retime.mjs` before composing.
  Use speed 2 to 6 on loading or thinking; keep clicks and results at 1.
- Captions follow marks, e.g. `{ from: m.saved + 0.2, to: m.end - 0.2 }`.
- Zoom toward what changes, a moment before it changes; zoom back out before the next beat.
- **Keep the whole working area in view.** Measure the area the beat uses (button, form, list incl. its right-hand
  column) in capture pixels, then `z = captureWidth / (areaWidth + ~40 margin)` and centre `cx`/`cy` on that area.
  A zoom that cuts a button label, a name column or the sidebar text in half looks broken; check it on the frame sheet.

## Montage or hero film
Cut finished videos together with ffmpeg (`concat` filter with short cross-fades), or compose several `kind: 'video'`
layers with their own `boxAt` for a grid. For music, add an audio file at the end:
`ffmpeg -i film.mp4 -i music.wav -c:v copy -c:a aac -shortest out.mp4`.

Leave this step with: `videos/NN-name.mp4` for every video.
