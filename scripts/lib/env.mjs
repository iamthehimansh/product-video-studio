// Where the tools live on this machine. Every lib imports from here, so nothing has a hard-coded path.
//   PVS_PLAYWRIGHT  folder of a playwright-core install   (default: <skill>/node_modules/playwright-core,
//                   created by scripts/install.sh; else any playwright-core Node can resolve)
//   PVS_CHROME      Chrome/Chromium executable             (default: Google Chrome, then Chromium, on macOS/Linux)
//   PVS_HARNESS     the product's harness folder           (default: the current working directory)
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const HARNESS = path.resolve(process.env.PVS_HARNESS || process.cwd());

function loadPlaywright() {
  const tries = [process.env.PVS_PLAYWRIGHT, path.join(SKILL_DIR, 'node_modules', 'playwright-core'), 'playwright-core', 'playwright'].filter(Boolean);
  for (const t of tries) {
    try { return require(t); } catch (e) { /* try the next one */ }
  }
  throw new Error(`playwright-core not found. Run ${path.join(SKILL_DIR, 'scripts', 'install.sh')} or set PVS_PLAYWRIGHT.`);
}
export const { chromium } = loadPlaywright();

const CHROMES = [
  process.env.PVS_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
export const CHROME = CHROMES.find((p) => fs.existsSync(p));
if (!CHROME) throw new Error('Chrome not found. Install Google Chrome or set PVS_CHROME to a Chrome/Chromium executable.');
