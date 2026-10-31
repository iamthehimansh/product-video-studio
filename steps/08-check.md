# Step 8 — Check

A video is done only after you have looked at it and the checks pass.

1. **Frame sheet**: `python3 $PVS/scripts/tc-sheet.py videos/NN-name.mp4 out/frames-check/NN-sheet.jpg 1.0 8 300`,
   then READ the image. For exact moments: `tc-pick.py VIDEO OUT.jpg COLS WIDTH t1 t2 …`.
2. Look for, in every frame:
   - captions readable, short, not covering what matters, on screen long enough to read (about 1.5 s minimum);
   - no blank, loading, error, "sign in" or dev-overlay frames;
   - the cursor on the thing being clicked; tap ripples where the finger would be;
   - nothing cut off at the window edge that matters; the window's buttons inside the window;
   - demo data consistent with the story; no real personal data.
3. **Automatic check**: `python3 $PVS/scripts/check-video.py videos/NN-name.mp4 --raw videos/raw/NN-name-raw.mp4`
   (1920x1080, H.264, 25+ fps, starts playing before fully downloaded, not mostly blank). Must exit 0.
4. Fix in the record or compose script and run again. Never call it done from the log alone.

When all videos pass, tell the person what was made: each video's path, length and what it shows, plus anything
that could not be done.
