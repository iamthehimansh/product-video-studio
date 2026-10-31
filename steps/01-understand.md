# Step 1 — Understand the product

Goal: know what the product does, where it runs and how to start it, before writing any script.

1. **Read the product, not just its marketing.** Open the repo's README, package files and the folders for pages or
   screens. Note the framework (React, Next.js, Vue, Tauri, Electron, React Native, Swift, Flutter…).
2. **List the surfaces** you can film:
   - Web app → its URL in a dev server (`npm run dev`).
   - Desktop app → if it is built on web tech (Tauri, Electron), its UI can run in Chrome; otherwise record the
     screen of the real app (see step 5).
   - Phone app → iOS Simulator or Android emulator.
3. **Make a feature list** with where each lives in the code (`path:line`). Ten to thirty lines is enough:
   ```
   - Create a project — src/pages/projects/new.tsx:12
   - Invite a teammate — src/components/InviteDialog.tsx:40
   ```
   Save it as `FEATURES.md` in the harness. Mark what each feature needs to look alive (data, a second user, a phone…).
4. **Find how the app gets data**: API base URL setting, auth, local storage, a seed script, a demo mode.
   This decides step 2. Search for `fetch(`, `axios`, `baseURL`, `API_URL`, `supabase`, `firebase`.
5. **Start it once as a normal developer would** and note every error. Do not fix the product; note what the harness
   must provide instead (a fake API, a fake login).

Leave this step with: `FEATURES.md`, the list of surfaces, the start command and the data plan.
Then run `$PVS/scripts/new-harness.sh <product-repo> <harness-folder> "<Product name>"` and fill `product.json`.
