# Example: Tasko (a complete, tiny harness)

A small task-list web app and its video harness, made with this skill. Run it to see every step work in a minute.

```
cd examples/tasko/harness
node mocks/server.mjs &                    # the real app + fixed demo data on http://127.0.0.1:4890/
node scenes/01-sample-record.mjs probe     # screenshots in out/frames-check/ (look at them)
node scenes/01-sample-record.mjs           # record → captures/01 (marks: opened, adding, added, result)
node scenes/01-sample-compose.mjs          # videos/01-sample.mp4 (1920x1080) + videos/raw/01-sample-raw.mp4
python3 ../../../scripts/check-video.py videos/01-sample.mp4 --raw videos/raw/01-sample-raw.mp4
kill %1                                    # stop the demo server
```

What it shows (`PLAN.md`): the launch-week list opens, Riya adds "Book the chai tasting", then ticks off
"Print the new menu cards"; captions "Your team's week, one list", "Add a task in seconds", "Tick it off".

Files
- `app/index.html`: the product (stands in for your real app; it fetches `/api/tasks`).
- `harness/product.json`: settings (URL, window size, demo story).
- `harness/mocks/server.mjs`: serves the app and answers its API with demo data; logs unknown routes.
- `harness/scenes/01-sample-record.mjs`: the beats, with probe mode.
- `harness/scenes/01-sample-compose.mjs`: camera keyframes from marks, captions, raw export.
