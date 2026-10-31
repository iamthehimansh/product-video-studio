#!/usr/bin/env python3
"""Check a finished video (and its raw recording) before anyone sees it.
Edited video: 1920x1080, H.264, at least 25 fps, 3 s or longer, starts playing before fully downloaded
(index at the front), and not mostly blank (frames sampled across the video must show real picture).
Raw (optional): readable, same kind of checks without the size rule.
Usage: check-video.py EDITED.mp4 [--raw RAW.mp4 ...] [--min-seconds 3]      exit 0 = all good"""
import json, struct, subprocess, sys, tempfile, os, time

T0 = time.time()
def log(m): print(f"[{time.strftime('%H:%M:%S')}] (+{time.time() - T0:.1f}s) {m}", flush=True)

def probe(f):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                        'stream=codec_name,width,height,avg_frame_rate:format=duration', '-of', 'json', f],
                       capture_output=True, text=True)
    if r.returncode:
        return None
    j = json.loads(r.stdout)
    s = (j.get('streams') or [{}])[0]
    num, _, den = (s.get('avg_frame_rate') or '0/1').partition('/')
    fps = float(num) / float(den or 1) if float(den or 1) else 0
    return {'codec': s.get('codec_name'), 'w': s.get('width'), 'h': s.get('height'), 'fps': fps,
            'seconds': float((j.get('format') or {}).get('duration') or 0)}

def faststart(f):
    order, size = [], os.path.getsize(f)
    with open(f, 'rb') as fh:
        pos = 0
        while pos < size and len(order) < 64:
            fh.seek(pos)
            h = fh.read(16)
            if len(h) < 8:
                break
            n, t = struct.unpack('>I4s', h[:8])
            if n == 1:
                n = struct.unpack('>Q', h[8:16])[0]
            elif n == 0:
                n = size - pos
            if n < 8:
                break
            order.append(t.decode('latin-1'))
            pos += n
    return 'moov' in order and 'mdat' in order and order.index('moov') < order.index('mdat')

def blank_share(f, seconds, samples=8):
    """share of sampled frames that are one flat colour (black/white screens, failed loads)"""
    from PIL import Image, ImageStat
    flat = 0
    with tempfile.TemporaryDirectory() as d:
        for i in range(samples):
            t = seconds * (i + 0.5) / samples
            p = os.path.join(d, f'{i}.png')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.2f}', '-i', f, '-frames:v', '1', '-vf', 'scale=320:-2', p])
            if os.path.exists(p):
                st = ImageStat.Stat(Image.open(p).convert('L'))
                if st.stddev[0] < 4:
                    flat += 1
    return flat / samples

def check(f, edited, min_s):
    problems = []
    if not os.path.isfile(f):
        return [f'{f}: file not found']
    p = probe(f)
    if not p:
        return [f'{f}: not a readable video']
    if edited and (p['w'], p['h']) != (1920, 1080):
        problems.append(f"size {p['w']}x{p['h']}, the edited video must be 1920x1080")
    if p['codec'] != 'h264':
        problems.append(f"codec {p['codec']}, expected h264 (plays everywhere)")
    if p['fps'] < 25:
        problems.append(f"{p['fps']:.1f} fps, expected 25 or more")
    if p['seconds'] < min_s:
        problems.append(f"only {p['seconds']:.1f} s long")
    if not faststart(f):
        problems.append('the index is at the end: re-save with ffmpeg -i IN -c copy -movflags +faststart OUT')
    b = blank_share(f, p['seconds'])
    if b > 0.25:
        problems.append(f'{b:.0%} of sampled frames are blank (one flat colour)')
    log(f"   {os.path.basename(f)}: {p['w']}x{p['h']} {p['codec']} {p['fps']:.0f} fps {p['seconds']:.1f}s, "
        f"{os.path.getsize(f) / 1048576:.1f} MB, blank frames {b:.0%} " + ('✓' if not problems else '✗'))
    return [f'{os.path.basename(f)}: {x}' for x in problems]

def main():
    a = sys.argv[1:]
    if not a or a[0].startswith('-'):
        print(__doc__)
        return 2
    min_s = float(a[a.index('--min-seconds') + 1]) if '--min-seconds' in a else 3
    raws = [a[i + 1] for i, x in enumerate(a) if x == '--raw' and i + 1 < len(a)]
    log(f'[1/2] edited video {a[0]}')
    problems = check(a[0], True, min_s)
    log(f'[2/2] raw recordings: {len(raws)}')
    for r in raws:
        problems += check(r, False, min_s)
    for p in problems:
        log('   ✗ ' + p)
    log('SUMMARY: ' + ('PASS' if not problems else f'FAIL: {len(problems)} problem(s)'))
    return 0 if not problems else 1

if __name__ == '__main__':
    sys.exit(main())
