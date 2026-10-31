# Step 7 — Raw recordings

Every video also ships as the untouched recording: no zoom, no pan, no captions, real timing. People use these to
re-edit in other styles.

- Chrome captures: `await exportRaw('captures/NN', 'videos/raw/NN-name-raw.mp4')` from `scripts/lib/raw.mjs`
  (the starter compose script already does this). Frames are kept at their real timing, 30 fps, full resolution.
- Screen recordings (phone, native desktop): re-save at a steady 30 fps without cropping:
  `ffmpeg -i captures/NN/sim.mp4 -vf fps=30 -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart videos/raw/NN-name-phone-raw.mp4`
- One raw file per screen: `NN-name-desktop-raw.mp4`, `NN-name-phone-raw.mp4`, `NN-name-host-raw.mp4`…
- Keep the whole recording (not just the part used in the edit).

Leave this step with: at least one `videos/raw/NN-name*-raw.mp4` per video.
