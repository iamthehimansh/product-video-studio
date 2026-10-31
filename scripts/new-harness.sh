#!/bin/bash
# Start a video harness for a product: a folder with the product's settings, a first record + compose scene,
# demo-data notes and the place videos land. Never touches the product's own code.
#   scripts/new-harness.sh <product-repo-folder> <harness-folder> [product-name]
# Then: fill product.json, make the app run with demo data (steps/02), write the plan (steps/03).
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
[ $# -ge 2 ] || { echo "usage: $0 <product-repo-folder> <harness-folder> [product-name]"; exit 2; }
PRODUCT="$(cd "$1" && pwd)"
H="$2"
NAME="${3:-$(basename "$PRODUCT")}"
ts() { date +%H:%M:%S; }
[ -e "$H/product.json" ] && { echo "[$(ts)] $H already has a harness (product.json); nothing changed"; exit 1; }
echo "[$(ts)] [1/4] folders in $H"
mkdir -p "$H"/{scenes,mocks,captures,videos/raw,out/frames-check}
H="$(cd "$H" && pwd)"
echo "[$(ts)] [2/4] product.json (settings for $NAME)"
sed -e "s#__NAME__#$NAME#g" -e "s#__PRODUCT_DIR__#$PRODUCT#g" -e "s#__HARNESS_DIR__#$H#g" -e "s#__SKILL_DIR__#$SKILL#g" \
  "$SKILL/templates/product.json" > "$H/product.json"
echo "[$(ts)] [3/4] starter scene (scenes/01-first-record.mjs + 01-first-compose.mjs), PLAN.md, mocks notes"
for f in 01-first-record.mjs 01-first-compose.mjs; do
  sed -e "s#__SKILL_DIR__#$SKILL#g" "$SKILL/templates/scenes/$f" > "$H/scenes/$f"
done
sed -e "s#__NAME__#$NAME#g" "$SKILL/templates/PLAN.md" > "$H/PLAN.md"
cp "$SKILL/templates/mocks/README.md" "$H/mocks/README.md"
printf 'captures/\nout/\nvideos/\nlocks/\nnode_modules/\n.DS_Store\n' > "$H/.gitignore"
echo "[$(ts)] [4/4] what the product is made of (for steps/01)"
for f in package.json tauri.conf.json src-tauri/tauri.conf.json electron-builder.yml app.json ios android pubspec.yaml next.config.js vite.config.ts vite.config.js; do
  [ -e "$PRODUCT/$f" ] && echo "   found $f"
done
echo "[$(ts)] SUMMARY: harness ready at $H. Next: steps/01-understand.md, then fill product.json"
