# Product Video Studio

An agent skill (and a set of scripts) for making product demo videos of any app: it films the **real** product with
**fake demo data**, records real clicks and typing, and edits the recordings into polished 1920x1080 videos with a
gentle camera, cursor, tap ripples and short captions. Every video also comes with the untouched raw recording.

It works for web apps, desktop apps built on web tech (Tauri, Electron) and phone apps (iOS Simulator / Android
emulator), and it asks the person for approval before recording.

## Install
```
git clone https://github.com/iamthehimansh/product-video-studio.git ~/.cocreate/skills/product-video-studio
~/.cocreate/skills/product-video-studio/scripts/install.sh
```
Needs Node.js 18+, ffmpeg, Python 3 with Pillow, and Google Chrome. Phone videos also need Xcode (or the Android SDK)
and [Maestro](https://maestro.mobile.dev).

Any agent that reads skills (a folder with `SKILL.md`) can use it: point it at this folder. Otherwise follow
`SKILL.md` and the guides in `steps/` by hand.

## How it works
| Step | Guide |
|---|---|
| 1. Understand the product | `steps/01-understand.md` |
| 2. Build the harness (real app + demo data) | `steps/02-harness.md` |
| 3. Plan the videos | `steps/03-plan.md` |
| 4. Ask for approval (plan, then first test) | `steps/04-approve.md` |
| 5. Record | `steps/05-record.md` |
| 6. Edit | `steps/06-edit.md` |
| 7. Raw recordings | `steps/07-raw.md` |
| 8. Check | `steps/08-check.md` |
| 9. Keep it working after updates | `steps/09-maintain.md` |

Quick start for a web app:
```
PVS=~/.cocreate/skills/product-video-studio
$PVS/scripts/new-harness.sh ~/code/my-app ~/code/my-app-videos "My App"
cd ~/code/my-app-videos          # set surfaces.web.url in product.json, start your app
node scenes/01-first-record.mjs probe     # screenshots only: look at them
node scenes/01-first-record.mjs           # record
node scenes/01-first-compose.mjs          # videos/01-first.mp4 + videos/raw/01-first-raw.mp4
python3 $PVS/scripts/check-video.py videos/01-first.mp4 --raw videos/raw/01-first-raw.mp4
```

## What is inside
- `scripts/lib/rec.mjs`: drives the app in headless Chrome and captures every frame, the pointer, clicks and named marks.
- `scripts/lib/compose2.mjs`: the editor (window or phone frame, camera keyframes, cursor, ripples, captions, layers).
- `scripts/lib/retime.mjs`, `scripts/lib/raw.mjs`: speed up waits; export the untouched recording.
- `scripts/tc-sheet.py`, `scripts/tc-pick.py`, `scripts/check-video.py`: frame sheets and automatic checks.
- `templates/`: what a new harness starts from. `examples/`: a complete sample harness.

MIT licensed.
