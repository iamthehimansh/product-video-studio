# Step 5 — Record

Goal: a clean capture per video with named moments ("marks") that the edit can cut and caption from.

## Web apps and web-tech desktop apps (Chrome)
Copy `scenes/01-first-record.mjs` to `scenes/NN-record.mjs` and write the beats with the recorder (`scripts/lib/rec.mjs`):
```js
const app = await openApp({ url, width: 1440, height: 900, dsf: 2, init, ready: '#app' });
const rec = new Rec(app, path.join(H, 'captures', 'NN'));
await rec.start();
await rec.clickOn({ text: 'New project' });       // eased mouse move + click, recorded for the cursor
await rec.type('Launch plan', 40);                 // real typing
await page.waitForFunction(() => document.body.innerText.includes('Saved'));
rec.mark('saved');                                 // name the moment the edit will use
await rec.rect('card', '.project-card');           // remember a box to zoom the camera to
await rec.stop();
```
- `probe` first (screenshots only), then the real run. Read the probe screenshots.
- Act like a person: move, pause ~0.6 s before clicking, let results show for 1 to 2 s.
- Mark every beat (`opened`, `typed`, `result`…). Marks are what the edit and captions use.
- Never `sleep` blindly for app work: wait for the text or element that proves it happened.
- Check `app.errors` at the end; a page error fails the run.

## Two screens at once (e.g. two users)
Open two apps, create two `Rec`s with `{ slot: false }` after taking the slots yourself, start both, act on each in
turn. Each capture is its own raw recording.

## Native desktop apps (not web tech)
Record the screen of the real app with ffmpeg (macOS: `ffmpeg -f avfoundation -i "1:none" -r 30 out.mov`), drive it
with the OS automation the product supports, and add it to the edit as a `kind: 'video'` layer.

## Phone apps
1. Boot a simulator, install the build, start the mock server.
2. Start recording: `xcrun simctl io <device> recordVideo --codec h264 captures/NN/sim.mp4` (send Ctrl-C to stop).
3. Drive taps with a Maestro flow (`maestro test flow.yaml`). Some rows cannot be tapped by text: tap by position
   (`point: 30%,87%`).
4. Note the time of each tap (from frame changes, not the Maestro log, which runs late) for tap ripples in the edit.
The simulator only writes frames when the screen changes: when cutting, put `fps=30` before `trim`.

Leave this step with: `captures/NN/` per video (frames + `capture.json`, or the screen recording), marks for every beat.
