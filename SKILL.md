---
name: product-video-studio
description: Make product demo videos of ANY app the way a studio would - build a harness that runs the real product (web, desktop or phone) with demo data, plan the videos, get the person's approval, record real interactions, then edit them into 1920x1080 videos with zoom, pan, cursor, tap ripples and short captions, plus the untouched raw recordings. Use when asked to make, record, plan or update product videos, demo videos, feature videos or a video harness for a product.
---

# Product Video Studio

Films the **real** product with **fake demo data**, records real clicks and typing, and edits the recordings into
polished 1920x1080 videos. Every video also ships as an **untouched raw recording** (no zoom or pan).

## 0. Get the scripts (do this first)
The scripts live in a public repo. If `scripts/install.sh` is not next to this file, clone it:
```
git clone https://github.com/iamthehimansh/product-video-studio.git ~/.cocreate/skills/product-video-studio
```
If that folder already exists, update it with `git -C ~/.cocreate/skills/product-video-studio pull`.
Then run `~/.cocreate/skills/product-video-studio/scripts/install.sh`: it checks Node 18+, ffmpeg, Python 3 with
Pillow, and Google Chrome, and installs `playwright-core` next to the scripts. Below, `$PVS` means that folder.

## The steps (open each guide when you reach it)
| # | Step | Guide | You leave it with |
|---|---|---|---|
| 1 | Understand the product | `steps/01-understand.md` | Feature list, surfaces, how it starts |
| 2 | Build the harness | `steps/02-harness.md` | The real app running with demo data, a probe screenshot |
| 3 | Plan the videos | `steps/03-plan.md` | `PLAN.md`: order, beats, captions |
| 4 | ⛔ **Ask for approval** | `steps/04-approve.md` | The person's yes to the plan, then to the first test |
| 5 | Record | `steps/05-record.md` | `captures/NN/` with named marks |
| 6 | Edit | `steps/06-edit.md` | `videos/NN-name.mp4` (1920x1080) |
| 7 | Raw recordings | `steps/07-raw.md` | `videos/raw/NN-name[-screen]-raw.mp4` |
| 8 | Check | `steps/08-check.md` | Frame sheet looked at, `check-video.py` passes |
| 9 | Keep it working | `steps/09-maintain.md` | Harness updated after the product changes |

Start a harness with `$PVS/scripts/new-harness.sh <product-repo> <harness-folder> "<Product name>"`. It never touches
the product's code; it creates `product.json` (settings), `PLAN.md`, `scenes/` (a first record + edit script),
`mocks/`, `captures/`, `videos/`.

## Rules that always apply
- **Ask before recording.** Never record until the person approves `PLAN.md`; then show the first probe screenshots and
  wait for a second yes. Write who approved and when into `PLAN.md`. This is the one place you stop and wait.
- **Real product only.** Film the actual app. Phone videos show the real phone app (simulator/emulator), never a web
  page squeezed into a phone frame.
- **Never edit the product's tracked files.** Demo setup lives in the harness or in git-ignored folders.
- **One demo story** across all videos: same customer, people, numbers. No real emails, keys or customer data.
- **Short captions**: 2 to 4 per video, at most 5 words each, never covering what the viewer must see.
- **Gentle camera**: zoom 1.0 to 1.3, slow moves, the cursor always visible on the thing it clicks.
- **Speed up waits, never cut steps** (`scripts/lib/retime.mjs`), so every step is still seen.
- **Look at every result**: read the frame sheet of every video before calling it done.
- **Show progress**: long commands print numbered, timestamped steps and a heartbeat every 10 to 15 s.

## What is in this folder
- `scripts/lib/rec.mjs` opens the app in headless Chrome and records every frame, the pointer, clicks and named marks.
- `scripts/lib/compose2.mjs` edits: window or phone frame, camera, cursor, ripples, captions, backgrounds, layers.
- `scripts/lib/retime.mjs` speeds up waits; `scripts/lib/raw.mjs` exports the untouched recording.
- `scripts/tc-sheet.py`, `scripts/tc-pick.py` make frame sheets to look at; `scripts/check-video.py` checks a video.
- `templates/` is what `new-harness.sh` copies.
- `examples/tasko/` is a complete tiny harness (app, demo server, record + edit scenes) that runs in a minute:
  read `examples/tasko/README.md` to see every step working before building your own.
