"""
Makes the store preview video from what `promo.film("preview", undefined, w, h)` filmed into
`capture/`. Footage only, no words: the App Store wants its previews made from the app itself.

1. `?promo&quality=high` on the dev server, then in the console, one size at a time, running this
   script after each (filming empties capture/frames):
       await promo.film("preview", undefined, 1920, 886)    // App Store, iPhone (6.9" and 6.5")
       await promo.film("preview", undefined, 1600, 1200)   // App Store, iPad (13")
       await promo.film("preview", undefined, 1920, 1080)   // YouTube for Google Play, and Amazon
   (`promo.music(42)` first, if capture/music.webm isn't there.)
2. `python tools/make_preview.py`

Shots melt slowly into one another, and the end fades softly to the sky. The game's own music goes
under it, quiet, faded in and out. Writes `capture/dig-site-preview-<w>x<h>.mp4`, to Apple's spec:
H.264 at 30 fps, 15 to 30 seconds, stereo AAC at 256 kbps and 48 kHz.

Needs Pillow and imageio-ffmpeg.
"""
import json
import shutil
import subprocess
from pathlib import Path

import imageio_ffmpeg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CAP = ROOT / "capture"
OUT = CAP / "preview"

BLEND = 15  # frames each shot melts into the next over (half a second)
END_FADE = 30  # frames of the last shot fading to the sky
SKY = (200, 233, 255)


def main():
    m = json.loads((CAP / "manifest.json").read_text())
    assert m["cut"] == "preview", f"capture/ holds the {m['cut']} cut; film the preview first"
    fps, W, H = m["fps"], m["width"], m["height"]
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    frame = lambda i: Image.open(CAP / "frames" / f"{i:04d}.jpg").convert("RGB")  # noqa: E731
    sky = Image.new("RGB", (W, H), SKY)
    n = 0

    def emit(im):
        nonlocal n
        im.save(OUT / f"{n:05d}.jpg", quality=95)
        n += 1

    shots = m["shots"]
    tail = []  # the last BLEND frames of the shot before, which this one melts in from
    for si, s in enumerate(shots):
        last = si == len(shots) - 1
        frames = s["frames"]
        keep = frames if last else frames - BLEND
        held = []
        for j in range(frames):
            im = frame(s["from"] + j)
            if j < len(tail):
                # Eased, so the melt starts and ends gently.
                k = (j + 1) / (len(tail) + 1)
                im = Image.blend(tail[j], im, k * k * (3 - 2 * k))
            if last and j >= frames - END_FADE:
                k = (j - (frames - END_FADE) + 1) / END_FADE
                im = Image.blend(im, sky, k * k * (3 - 2 * k))
            if j < keep:
                emit(im)
            else:
                held.append(im)
        tail = held

    seconds = n / fps
    assert 15 <= seconds <= 30, f"{seconds:.2f} s: the App Store takes 15 to 30"
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    music = CAP / "music.webm"
    out = CAP / f"dig-site-preview-{W}x{H}.mp4"
    cmd = [ff, "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(OUT / "%05d.jpg")]
    if music.exists():
        cmd += ["-i", str(music), "-map", "0:v", "-map", "1:a",
                "-af", f"loudnorm=I=-21:TP=-3,afade=t=in:d=1.2,afade=t=out:st={seconds - 3:.2f}:d=3",
                "-ac", "2", "-ar", "48000", "-c:a", "aac", "-b:a", "256k"]
    cmd += ["-t", f"{seconds:.3f}", "-r", str(fps), "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
            "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-preset", "slow",
            "-b:v", "11M", "-maxrate", "12M", "-bufsize", "24M", "-movflags", "+faststart", str(out)]
    subprocess.run(cmd, check=True)
    print(f"{out} ({seconds:.2f} s, {out.stat().st_size / 1e6:.1f} MB){'' if music.exists() else ' (no music)'}")


if __name__ == "__main__":
    main()
