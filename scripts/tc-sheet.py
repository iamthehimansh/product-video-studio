#!/usr/bin/env python3
"""Timecoded contact sheet: frames of a video every STEP seconds, tiled, each labelled with its time.
Used to pick in/out points for the hero film. Usage: tc-sheet.py VIDEO OUT.jpg [STEP=1.5] [COLS=5] [WIDTH=384]"""
import os, subprocess, sys, tempfile, time
from PIL import Image, ImageDraw, ImageFont

def ts():
    return time.strftime('%H:%M:%S')

video, out = sys.argv[1], sys.argv[2]
step = float(sys.argv[3]) if len(sys.argv) > 3 else 1.5
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 5
width = int(sys.argv[5]) if len(sys.argv) > 5 else 384
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video],
                           capture_output=True, text=True).stdout.strip() or 0)
times = [round(i * step, 2) for i in range(int(dur / step) + 1) if i * step < dur - 0.05]
print(f'[{ts()}] [1/2] {os.path.basename(video)}: {dur:.2f}s, {len(times)} frames every {step}s')
tmp = tempfile.mkdtemp(prefix='tc-')
frames = []
for i, t in enumerate(times):
    p = os.path.join(tmp, f'{i:04d}.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-vf', f'scale={width}:-2', '-q:v', '3', p], check=True)
    frames.append((t, Image.open(p).convert('RGB')))
try:
    font = ImageFont.load_default(size=22)
except TypeError:
    font = ImageFont.load_default()
fw, fh = frames[0][1].size
rows = (len(frames) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (fw + 6) + 6, rows * (fh + 6) + 6), 'white')
d = ImageDraw.Draw(sheet)
for i, (t, im) in enumerate(frames):
    x, y = 6 + (i % cols) * (fw + 6), 6 + (i // cols) * (fh + 6)
    sheet.paste(im, (x, y))
    label = f'{t:.1f}s'
    d.rectangle([x, y, x + 74, y + 30], fill=(20, 16, 40))
    d.text((x + 7, y + 4), label, fill=(255, 255, 255), font=font)
sheet.save(out, quality=86)
print(f'[{ts()}] [2/2] saved {out} ({cols}x{rows} tiles)')
