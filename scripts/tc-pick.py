#!/usr/bin/env python3
"""Timecoded contact sheet of chosen moments of a video.
Usage: tc-pick.py VIDEO OUT.jpg COLS WIDTH t1 t2 t3 ...   (times in seconds)"""
import os, subprocess, sys, tempfile, time
from PIL import Image, ImageDraw, ImageFont

def ts():
    return time.strftime('%H:%M:%S')

video, out, cols, width = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
times = [float(t) for t in sys.argv[5:]]
print(f'[{ts()}] [1/2] {os.path.basename(video)}: {len(times)} moments')
tmp = tempfile.mkdtemp(prefix='tcp-')
frames = []
last = time.time()
for i, t in enumerate(times):
    p = os.path.join(tmp, f'{i:04d}.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-vf', f'scale={width}:-2', '-q:v', '3', p], check=True)
    frames.append((t, Image.open(p).convert('RGB')))
    if time.time() - last > 10:
        last = time.time()
        print(f'[{ts()}]   …{i + 1}/{len(times)} frames extracted')
try:
    font = ImageFont.load_default(size=20)
except TypeError:
    font = ImageFont.load_default()
fw = max(im.width for _, im in frames)
fh = max(im.height for _, im in frames)
rows = (len(frames) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (fw + 6) + 6, rows * (fh + 6) + 6), 'white')
d = ImageDraw.Draw(sheet)
for i, (t, im) in enumerate(frames):
    x, y = 6 + (i % cols) * (fw + 6), 6 + (i // cols) * (fh + 6)
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 78, y + 26], fill=(20, 16, 40))
    d.text((x + 6, y + 3), f'{t:.1f}s', fill=(255, 255, 255), font=font)
sheet.save(out, quality=86)
print(f'[{ts()}] [2/2] saved {out} ({cols}x{rows})')
