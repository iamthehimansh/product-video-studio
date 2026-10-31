# Step 9 — Keep the harness working after the product changes

When the product updates, four things can break: the demo data, the app start, the scripts, the phone build.
Fix them in that order. Never edit the product's tracked files.

1. **See what changed**: `git -C <product> log --oneline -20 --stat` since the last recording. Note renamed screens,
   new API routes, new native calls, changed button labels.
2. **Demo data**: start the app with the harness and probe (`node scenes/NN-record.mjs probe`).
   - Blank page or crash: a new API route or native call is not faked. Add it to `mocks/` (the mock server logs
     unknown routes) or to the init script.
   - Wrong or missing data: the data shape changed; update the mock to the new types.
3. **App start**: dependency or config changes. Re-run the start command from `product.json`; fix the harness config.
4. **Scripts**: a click target was renamed. Find the new label in the product source (`grep -rn "Old label" src`) and
   update the scene. Prefer visible text or `data-*` attributes over CSS classes, which change often.
   Compose scripts read times from marks, so the cut follows automatically; only fixed timestamps need edits.
5. **Phone**: rebuild for the simulator, update the mock server for new calls, re-run each flow in probe.
6. **Prove it**: re-record the changed videos, read their frame sheets, run `check-video.py`.
7. Update `FEATURES.md` for features that appeared, moved or went away.
