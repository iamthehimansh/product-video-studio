#!/bin/bash
# One-time setup on a machine: checks the tools the skill needs and installs playwright-core next to the
# scripts (no browser download: it drives your installed Google Chrome). Safe to run again.
set -uo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
ts() { date +%H:%M:%S; }
ok=1
need() { # name, command to test, how to install
  if eval "$2" >/dev/null 2>&1; then echo "[$(ts)]   ✓ $1"; else echo "[$(ts)]   ✗ $1 missing: $3"; ok=0; fi
}
echo "[$(ts)] [1/3] tools"
need "Node.js 18+"   'node -e "process.exit(+process.versions.node.split(\".\")[0] >= 18 ? 0 : 1)"' "https://nodejs.org or 'brew install node'"
need "npm"           'command -v npm' "comes with Node.js"
need "ffmpeg"        'command -v ffmpeg && command -v ffprobe' "'brew install ffmpeg' (macOS) or 'apt install ffmpeg'"
need "Python 3"      'command -v python3' "https://www.python.org or 'brew install python'"
need "Pillow (PIL)"  'python3 -c "import PIL"' "'python3 -m pip install --user pillow'"
need "Google Chrome" '[ -n "${PVS_CHROME:-}" ] && [ -x "$PVS_CHROME" ] || [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ] || [ -x /Applications/Chromium.app/Contents/MacOS/Chromium ] || command -v google-chrome || command -v chromium' "install Google Chrome, or set PVS_CHROME"
echo "[$(ts)] [2/3] playwright-core (drives Chrome) in $SKILL/node_modules"
if [ -d "$SKILL/node_modules/playwright-core" ]; then
  echo "[$(ts)]   ✓ already installed ($(node -e "console.log(require('$SKILL/node_modules/playwright-core/package.json').version)"))"
else
  ( cd "$SKILL" && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save --no-audit --no-fund playwright-core@1 2>&1 | tail -2 )
  [ -d "$SKILL/node_modules/playwright-core" ] && echo "[$(ts)]   ✓ installed" || { echo "[$(ts)]   ✗ npm install failed"; ok=0; }
fi
echo "[$(ts)] [3/3] optional, for phone videos"
command -v xcrun >/dev/null && echo "[$(ts)]   ✓ Xcode tools (iOS Simulator)" || echo "[$(ts)]   - Xcode not found (only needed for iPhone videos)"
command -v maestro >/dev/null && echo "[$(ts)]   ✓ Maestro (taps in the simulator)" || echo "[$(ts)]   - Maestro not found (only needed for phone videos: https://maestro.mobile.dev)"
[ $ok -eq 1 ] && echo "[$(ts)] SUMMARY: ready. Next: scripts/new-harness.sh <product-folder> <harness-folder>" || { echo "[$(ts)] SUMMARY: install the missing tools above, then run this again"; exit 1; }
