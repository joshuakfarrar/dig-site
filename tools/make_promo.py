"""
Makes the promo video from what `src/promo.ts` filmed into `capture/`:

1. `?promo` on the dev server, then `promo.music(42)` and `promo.film()` in the console.
2. `python tools/make_promo.py`

Each shot gets its line of the story at the bottom. Shots melt into one another, and it ends on
a card with the icon and the name. The game's own music goes under it, brought up to a normal
loudness and faded in and out. Writes
`capture/dig-site-promo.mp4` (capture/ is kept out of git).

Needs Pillow and imageio-ffmpeg (`pip install imageio-ffmpeg`, which brings its own ffmpeg).
"""
import json
import shutil
import subprocess
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CAP = ROOT / "capture"
OUT = CAP / "out"
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT = "C:/Windows/Fonts/segoeui.ttf"
LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

BLEND = 10  # frames each shot melts into the next over
CARD_SECONDS = 4.5
INK = (43, 49, 56)
SKY_TOP, SKY_BOTTOM = (122, 196, 250), (200, 233, 255)


def font(size, bold=True):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def caption(im, text, alpha):
    """A soft white pill along the bottom with the line of the story in it."""
    if alpha <= 0:
        return im
    W, H = im.size
    f = font(56)
    d = ImageDraw.Draw(im)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    tw, th = r - l, b - t
    pad_x, pad_y = 44, 24
    bw, bh = tw + pad_x * 2, th + pad_y * 2
    x0, y0 = (W - bw) // 2, H - bh - 70
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x0, y0 + 6, x0 + bw, y0 + bh + 6], radius=bh // 2, fill=(0, 0, 0, int(60 * alpha)))
    layer.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)))
    ld.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], radius=bh // 2, fill=(255, 255, 255, int(228 * alpha)))
    ld.text((x0 + pad_x - l, y0 + pad_y - t), text, font=f, fill=INK + (int(255 * alpha),))
    out = im.convert("RGBA")
    out.alpha_composite(layer)
    return out.convert("RGB")


def card(W, H):
    """The last card: sky, the icon, the name and a few words."""
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    for y in range(H):
        k = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(round(SKY_TOP[i] + (SKY_BOTTOM[i] - SKY_TOP[i]) * k) for i in range(3)))
    icon = Image.open(ROOT / "resources/icon-1024.png").convert("RGBA").resize((380, 380), LANCZOS)
    mask = Image.new("L", (380 * 4, 380 * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, mask.width - 1, mask.height - 1], radius=mask.width * 0.22, fill=255)
    icon.putalpha(mask.resize((380, 380), LANCZOS))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ix, iy = W // 2 - 190, 150
    ImageDraw.Draw(shadow).rounded_rectangle([ix, iy + 14, ix + 380, iy + 394], radius=84, fill=(0, 40, 80, 70))
    base = im.convert("RGBA")
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    base.alpha_composite(icon, (ix, iy))
    d = ImageDraw.Draw(base)

    def centred(text, f, y, fill):
        l, t, r, b = d.textbbox((0, 0), text, font=f)
        d.text(((W - (r - l)) // 2 - l, y - t), text, font=f, fill=fill)

    centred("Dig Site", font(110), 580, INK)
    centred("Build a town, one home at a time.", font(52), 730, INK)
    centred("A calm building game for little ones  ·  No ads  ·  No internet", font(36, False), 830, (70, 84, 98))
    centred("Coming soon to iPad, Android and Fire tablets", font(36, False), 885, (70, 84, 98))
    return base.convert("RGB")


def main():
    m = json.loads((CAP / "manifest.json").read_text())
    fps, W, H = m["fps"], m["width"], m["height"]
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    frame = lambda i: Image.open(CAP / "frames" / f"{i:04d}.jpg").convert("RGB")  # noqa: E731
    fade = int(0.35 * fps)
    n = 0

    def emit(im):
        nonlocal n
        im.save(OUT / f"{n:05d}.jpg", quality=93)
        n += 1

    shots = m["shots"]
    tail = []  # the last BLEND frames of the shot before, captioned, which this one melts in from
    for si, s in enumerate(shots):
        last = si == len(shots) - 1
        frames = s["frames"]
        keep = frames if last else frames - BLEND
        held = []
        for j in range(frames):
            # The caption fades in just after the cut, and (but for the last) out before the next.
            a = max(0, min(1, (j - BLEND * 0.6) / fade))
            if not last:
                a = min(a, max(0, (keep - j) / fade))
            im = caption(frame(s["from"] + j), s["caption"], a)
            if j < len(tail):
                im = Image.blend(tail[j], im, (j + 1) / (len(tail) + 1))
            if j < keep:
                emit(im)
            else:
                held.append(im)
        tail = held
    # The card, melting in from the last shot.
    end = card(W, H)
    last_shot = shots[-1]
    lastframe = caption(frame(last_shot["from"] + last_shot["frames"] - 1), last_shot["caption"], 1)
    melt = int(0.8 * fps)
    for j in range(melt):
        emit(Image.blend(lastframe, end, (j + 1) / melt))
    for _ in range(int(CARD_SECONDS * fps)):
        emit(end)

    seconds = n / fps
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    music = CAP / "music.webm"
    # Full HD, and a small 720p copy that's quick to send in a message.
    for name, size, crf in (("dig-site-promo.mp4", "1920:1080", "19"), ("dig-site-promo-720p.mp4", "1280:720", "24")):
        out = CAP / name
        cmd = [ff, "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(OUT / "%05d.jpg")]
        if music.exists():
            cmd += ["-i", str(music), "-map", "0:v", "-map", "1:a",
                    "-af", f"loudnorm=I=-19:TP=-2,afade=t=in:d=0.6,afade=t=out:st={seconds - 2.5:.2f}:d=2.5", "-ar", "48000", "-c:a", "aac", "-b:a", "160k"]
        cmd += ["-t", f"{seconds:.2f}", "-vf", f"scale={size}:in_range=pc:out_range=tv,format=yuv420p", "-c:v", "libx264",
                "-crf", crf, "-preset", "slow", "-movflags", "+faststart", str(out)]
        subprocess.run(cmd, check=True)
        print(f"{out} ({seconds:.1f} s, {out.stat().st_size / 1e6:.1f} MB){'' if music.exists() else ' (no music)'}")


if __name__ == "__main__":
    main()
