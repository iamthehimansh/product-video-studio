#!/usr/bin/env python3
"""Check the skill folder is complete, product-neutral and small enough to share as an org skill.
- Required files exist (SKILL.md with name/description front matter, every step guide, scripts, templates).
- Every file a step guide or SKILL.md names in backticks exists in the folder.
- No private paths, company names or secrets (it is published publicly).
- Fits Cana's org skill limits: at most 100 files, each 512 KB or less, 4 MB in total, text only.
- Every .mjs parses (node --check), every .py compiles, every .sh passes bash -n.
Usage: check-skill.py            exit 0 = ready to publish"""
import os, re, subprocess, sys, time

K = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T0 = time.time()
def log(m): print(f"[{time.strftime('%H:%M:%S')}] (+{time.time() - T0:.1f}s) {m}", flush=True)

REQUIRED = ['SKILL.md', 'README.md', 'LICENSE', 'scripts/install.sh', 'scripts/new-harness.sh', 'scripts/check-video.py',
            'scripts/check-skill.py', 'scripts/tc-sheet.py', 'scripts/tc-pick.py', 'scripts/lib/env.mjs', 'scripts/lib/rec.mjs',
            'scripts/lib/compose2.mjs', 'scripts/lib/retime.mjs', 'scripts/lib/raw.mjs', 'scripts/lib/slots.mjs',
            'templates/product.json', 'templates/PLAN.md', 'templates/scenes/01-first-record.mjs',
            'templates/scenes/01-first-compose.mjs', 'templates/mocks/README.md']
STEPS = ['01-understand.md', '02-harness.md', '03-plan.md', '04-approve.md', '05-record.md', '06-edit.md', '07-raw.md',
         '08-check.md', '09-maintain.md']
PRIVATE = [r'/Users/[A-Za-z]', r'colate', r'gitlab\.', r'cana\.build', r'downloads\.cana', r'aws-vault', r'\bAKIA[0-9A-Z]{16}',
           r'glpat-', r'gh[pousr]_[A-Za-z0-9]{20,}', r'sk-[A-Za-z0-9]{20,}', r'BEGIN (RSA|OPENSSH|EC) PRIVATE', r'703850320248']
TEXT = ('.md', '.mjs', '.js', '.py', '.sh', '.json', '.txt', '.yaml', '.yml', '.html', '.css', '')
SKIP_DIRS = {'.git', 'node_modules', '__pycache__'}

def walk():
    for root, dirs, files in os.walk(K):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for n in files:
            if n == '.DS_Store':
                continue
            yield os.path.relpath(os.path.join(root, n), K)

problems = []
log('[1/5] required files')
for f in REQUIRED + [f'steps/{s}' for s in STEPS]:
    if not os.path.isfile(os.path.join(K, f)):
        problems.append(f'missing {f}')
skill = open(os.path.join(K, 'SKILL.md'), encoding='utf-8').read() if os.path.isfile(os.path.join(K, 'SKILL.md')) else ''
if not re.match(r'^---\nname: [a-z0-9-]+\ndescription: .+?\n---\n', skill, re.S):
    problems.append('SKILL.md must start with front matter: name (lowercase-dashes) and description')
for s in STEPS:
    if f'steps/{s}' not in skill:
        problems.append(f'SKILL.md does not link steps/{s}')
log(f'   {len(REQUIRED) + len(STEPS)} required files checked')

log('[2/5] every file named in the guides exists')
named = 0
for f in ['SKILL.md'] + [f'steps/{s}' for s in STEPS]:
    p = os.path.join(K, f)
    if not os.path.isfile(p):
        continue
    for ref in re.findall(r'`((?:scripts|templates|steps|examples)/[A-Za-z0-9_./-]+)`', open(p, encoding='utf-8').read()):
        named += 1
        if not os.path.exists(os.path.join(K, ref.rstrip('/'))):
            problems.append(f'{f} names {ref}, which does not exist')
log(f'   {named} references checked')

log('[3/5] nothing private (this folder is published publicly)')
files = sorted(walk())
for f in files:
    if f == 'scripts/check-skill.py':
        continue
    try:
        text = open(os.path.join(K, f), encoding='utf-8').read()
    except UnicodeDecodeError:
        continue
    for pat in PRIVATE:
        m = re.search(pat, text, re.I)
        if m:
            line = text[:m.start()].count('\n') + 1
            problems.append(f'{f}:{line} contains "{m.group(0)}"')

log('[4/5] org skill limits (100 files, 512 KB each, 4 MB total, text only)')
total = 0
for f in files:
    b = os.path.getsize(os.path.join(K, f))
    total += b
    if b > 512 * 1024:
        problems.append(f'{f} is {b / 1024:.0f} KB (limit 512 KB)')
    if os.path.splitext(f)[1].lower() not in TEXT:
        problems.append(f'{f} is not a text file type the org upload keeps')
if len(files) > 100:
    problems.append(f'{len(files)} files (limit 100)')
if total > 4 * 1024 * 1024:
    problems.append(f'{total / 1048576:.1f} MB in total (limit 4 MB)')
log(f'   {len(files)} files, {total / 1024:.0f} KB in total')

log('[5/5] every script parses')
n = 0
for f in files:
    p = os.path.join(K, f)
    if f.endswith('.mjs') or f.endswith('.js'):
        cmd = ['node', '--check', p]
    elif f.endswith('.py'):
        cmd = [sys.executable, '-m', 'py_compile', p]
    elif f.endswith('.sh'):
        cmd = ['bash', '-n', p]
    else:
        continue
    n += 1
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        problems.append(f'{f} does not parse: {(r.stderr or r.stdout).strip()[-200:]}')
log(f'   {n} scripts checked')

for p in problems:
    log('   ✗ ' + p)
log('SUMMARY: ' + ('PASS: ready to share' if not problems else f'FAIL: {len(problems)} problem(s)'))
sys.exit(0 if not problems else 1)
