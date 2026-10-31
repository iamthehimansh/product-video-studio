# Demo data for this product

The videos film the REAL app with FAKE data, so nothing private shows and every run looks the same.
Pick the lightest way that works for this product, and write down here which one you used:

1. **Demo account or seed script** the product already has: best if it exists (`npm run seed`, a demo login).
2. **Mock API server** (`mocks/server.mjs`): answers the app's API calls with fixed JSON. Point the app at it with
   its own API-URL setting (env var or config). Start it before recording; stop it after.
3. **Init script in the browser** (`openApp({ init })` in the record scene): replace `window.fetch` for a few routes,
   or put data in `localStorage` before the app loads. Good for small web apps.
4. **Desktop apps built on web tech** (Tauri, Electron): serve the app's web UI with its dev server and fake the
   native calls (`window.__TAURI__`, `window.electron`, IPC) in an init script.
5. **Phone apps**: run the real app in the iOS Simulator / Android emulator pointed at the mock API server; drive taps
   with Maestro flows; record with `xcrun simctl io <device> recordVideo`.

Rules: never change the product's tracked files (keep demo files in this harness or in a git-ignored folder);
use the same names, company and numbers in every video; no real emails, keys or customer data.
