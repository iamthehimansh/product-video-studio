# Step 2 — Build the harness

Goal: the REAL app running with FAKE demo data, the same every time, started by one command.

## Pick the demo-data method (lightest first)
See `templates/mocks/README.md` for all five. In short:
1. The product's own demo account or seed script.
2. A mock API server in `mocks/server.mjs` (Node `http`, fixed JSON per route) and point the app at it with its own
   API-URL setting. Log every request it does not know, so missing routes are obvious.
3. An init script passed to `openApp({ init })` that replaces `window.fetch` for a few routes or fills
   `localStorage` before the app loads.
4. Desktop apps on web tech: run the UI with its dev server, fake the native bridge (`window.__TAURI__`,
   `window.electron`, `ipcRenderer`) in an init script, returning what each call's code expects.
5. Phone apps: build the real app for the simulator, point it at the mock server, drive it with Maestro.

## Write the demo story once
In `product.json` → `demo`: one customer, two or three people, believable numbers and dates. Every screen and video uses
them. No real emails, keys, faces or customer data.

## Prove it runs
1. Start the app (and the mock server). Put the commands in `product.json` → `surfaces.<name>.start`.
2. Set `surfaces.web.url`, then run `node scenes/01-first-record.mjs probe`. It opens the app headless and saves
   screenshots to `out/frames-check/` without recording.
3. READ every screenshot. Fix blank pages, spinners, error toasts and "sign in" screens in the harness (never in the
   product's tracked files), then probe again.

Tips
- Freeze time-dependent text: fixed dates in the mocks ("2 h ago" should not change between takes).
- Hide dev-only overlays (React Query devtools, Next.js error badge) with an init script that adds CSS.
- Use a window size of 1440x900 at 2x pixel density (`width`, `height`, `dsf`) for sharp frames.

Leave this step with: one command per surface that starts the app with demo data, and clean probe screenshots.
