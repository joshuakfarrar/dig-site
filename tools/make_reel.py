"""
Makes the vertical reel (9:16, for phones) from what `promo.film("reel")` filmed into `capture/`:

1. `?promo` on the dev server, then `promo.film("reel")` in the console.
2. `python tools/make_reel.py`

Everything is cut to a 120 bpm tune written here (a beat is half a second, 15 frames):
- **Big words** pop in on the beat, sticker style: DIG! POUR! BUILD! WELCOME HOME!
- **The street** fills one house a beat, each with a rising chime.
- **A few plain truths**, then the card.

The music is made here too, from nothing, with numpy: plucked chords, a round bass, glockenspiel,
soft kick and claps, and little sounds on the cuts and pops. Writes `capture/dig-site-reel.mp4`.

Needs Pillow, numpy and imageio-ffmpeg.
"""
import json
import math
import shutil
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CAP = ROOT / "capture"
OUT = CAP / "reel"
BLACK = "C:/Windows/Fonts/seguibl.ttf"
BOLD = "C:/Windows/Fonts/segoeuib.ttf"
LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

FPS = 30
BEAT = 15  # frames
SR = 44100
SPB = 0.5  # seconds a beat
CARD_BEATS = 8

INK = (43, 49, 56)
COLOURS = [(255, 138, 31), (63, 185, 80), (74, 168, 255), (255, 93, 143), (242, 183, 5), (199, 125, 255)]

# What's said, shot by shot: (beat into the shot, words, colour). The words pop in on that beat.
WORDS = {
    "r_dig": [(0, "DIG!", 0)],
    "r_pour": [(0, "POUR!", 2)],
    "r_roof": [(0, "BUILD!", 3)],
    "r_home": [(0, "WELCOME\nHOME!", 1)],
    "r_street": [(1, "ONE HOUSE...", 4), (5, "...A WHOLE\nSTREET!", 0)],
    "r_dusk": [(0, "...A WHOLE\nTOWN!", 5)],
    "r_play": [(0, "WITH FRIENDS\nTO PLAY WITH", 3)],
    "r_roller": [(0, "NO ADS", 2)],
    "r_fork": [(0, "NO TIMERS", 1)],
    "r_sweep": [(0, "NO READING\nNEEDED", 3)],
    "r_harbour": [(0, "JUST\nBUILD.", 0)],
}


# ------------------------------------------------------------------ pictures

def font(path, size):
    return ImageFont.truetype(path, size)


def sticker(text, colour, width):
    """Big chunky words: white letters, a thick coloured outline and a soft shadow, tilted a touch."""
    size = 150
    while True:
        f = font(BLACK, size)
        d = ImageDraw.Draw(Image.new("RGB", (8, 8)))
        box = d.multiline_textbbox((0, 0), text, font=f, align="center", spacing=6, stroke_width=14)
        if box[2] - box[0] <= width or size <= 60:
            break
        size -= 6
    w, h = int(box[2] - box[0] + 60), int(box[3] - box[1] + 60)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    org = (int(30 - box[0]), int(30 - box[1]))
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).multiline_text((org[0], org[1] + 10), text, font=f, align="center", spacing=6,
                                          fill=(0, 0, 0, 90), stroke_width=14, stroke_fill=(0, 0, 0, 90))
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(8)))
    d.multiline_text(org, text, font=f, align="center", spacing=6, fill=(255, 255, 255), stroke_width=14, stroke_fill=colour)
    return im.rotate(3, resample=getattr(Image, "Resampling", Image).BICUBIC, expand=True)


def pop_scale(j):
    """Pops in: small, a little too big, then settles (frames since it appeared)."""
    if j < 0:
        return 0
    t = j / 7
    if t >= 1:
        return 1
    return 1 + 0.12 * math.sin(t * math.pi) - (1 - t) ** 3 * 0.6


def place(base, st, scale, cx, cy):
    if scale <= 0.02:
        return
    s = st.resize((max(1, int(st.width * scale)), max(1, int(st.height * scale))), LANCZOS)
    base.alpha_composite(s, (int(cx - s.width / 2), int(cy - s.height / 2)))


def punch(im, j):
    """A little zoom-in that settles over the first frames after a cut."""
    if j >= 5:
        return im
    z = 1 + 0.07 * (1 - j / 5) ** 2
    W, H = im.size
    w, h = int(W / z), int(H / z)
    return im.crop(((W - w) // 2, (H - h) // 2, (W + w) // 2, (H + h) // 2)).resize((W, H), LANCZOS)


def card_frame(W, H, j, icon):
    """The end card, building up beat by beat, with confetti drifting down."""
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    for y in range(H):
        k = y / (H - 1)
        d.line([(0, y), (W, y)], fill=(round(122 + 78 * k), round(196 + 37 * k), 250 + round(5 * k)))
    rng = np.random.default_rng(7)
    for c in range(70):
        x = rng.uniform(0, W)
        speed = rng.uniform(4, 9)
        y = (rng.uniform(-H, 0) + j * speed) % (H + 80) - 40
        sz = rng.uniform(14, 26)
        col = COLOURS[c % len(COLOURS)]
        a = j * 0.08 + c
        dx, dy = math.cos(a) * sz / 2, math.sin(a) * sz / 2
        d.polygon([(x - dx, y - dy), (x + dy, y - dx), (x + dx, y + dy), (x - dy, y + dx)], fill=col)
    # The icon pops in on the first beat.
    s = pop_scale(j) * 1.0
    if s > 0.02:
        ic = icon.resize((int(560 * s), int(560 * s)), LANCZOS)
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([W / 2 - 280 * s, 470 - 280 * s + 18, W / 2 + 280 * s, 470 + 280 * s + 18], radius=120 * s, fill=(0, 40, 80, 80))
        im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(22)))
        im.alpha_composite(ic, (int(W / 2 - ic.width / 2), int(470 - ic.height / 2)))
    d = ImageDraw.Draw(im)

    def line(text, f, y, fill, at_beat, stroke=0, sfill=None):
        k = j - at_beat * BEAT
        if k < 0:
            return
        a = min(1, k / 6)
        off = int((1 - a) ** 2 * 40)
        l, t, r, b = d.textbbox((0, 0), text, font=f, stroke_width=stroke)
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text(((W - (r - l)) // 2 - l, y - t + off), text, font=f, fill=fill + (int(255 * a),),
                                   stroke_width=stroke, stroke_fill=(sfill or fill) + (int(255 * a),))
        im.alpha_composite(layer)

    line("Dig Site", font(BLACK, 150), 800, (255, 255, 255), 1, 12, (255, 138, 31))
    line("Build a town, one home at a time.", font(BOLD, 60), 1010, INK, 2)
    line("For little builders, ages 3 to 7", font(BOLD, 50), 1125, (70, 84, 98), 3)
    line("No ads  ·  No timers  ·  No internet", font(BOLD, 50), 1200, (70, 84, 98), 3)
    pill_k = j - 4 * BEAT
    if pill_k >= 0:
        a = min(1, pill_k / 6)
        f = font(BLACK, 54)
        text = "Coming soon to iPad, Android & Fire"
        l, t, r, b = d.textbbox((0, 0), text, font=f)
        pw, ph = r - l + 90, b - t + 56
        x0, y0 = (W - pw) // 2, 1390
        sc = pop_scale(pill_k)
        layer = Image.new("RGBA", (pw + 20, ph + 20), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.rounded_rectangle([10, 10, pw + 10, ph + 10], radius=ph // 2, fill=(255, 138, 31, int(255 * a)))
        ld.text((55 - l, 38 - t), text, font=f, fill=(255, 255, 255, int(255 * a)))
        place(im, layer, sc, W / 2, y0 + ph / 2)
    return im.convert("RGB")


# ------------------------------------------------------------------ sound

def env(n, attack, decay):
    t = np.arange(n) / SR
    a = np.minimum(1, t / max(attack, 1e-4))
    return a * np.exp(-t / decay)


def tone(freq, dur, partials=((1, 1),), attack=0.004, decay=0.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    w = sum(g * np.sin(2 * np.pi * freq * m * t) for m, g in partials)
    return w * env(n, attack, decay)


_ks = {}


def pluck(freq, dur=1.2):
    """A plucked string (Karplus-Strong), cached per pitch."""
    key = round(freq, 2)
    if key not in _ks:
        rng = np.random.default_rng(int(freq * 10))
        p = int(SR / freq)
        buf = rng.uniform(-1, 1, p)
        n = int(dur * SR)
        out = np.empty(n)
        for i in range(n):
            out[i] = buf[i % p]
            buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
        out *= np.minimum(1, np.arange(n) / (0.004 * SR))
        _ks[key] = out
    return _ks[key]


def noise(dur, seed=1):
    return np.random.default_rng(seed).uniform(-1, 1, int(dur * SR))


def lowpass(x, cut):
    a = math.exp(-2 * math.pi * cut / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def highpass(x, cut):
    return x - lowpass(x, cut)


NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(name):
    """'C4', 'A#3'..."""
    n = NOTE[name[0]] + (1 if "#" in name else 0)
    octave = int(name[-1])
    return 440 * 2 ** ((n + 12 * (octave + 1) - 69) / 12)


CHORDS = [("C3", ["C4", "E4", "G4", "C5"]), ("G2", ["G3", "B3", "D4", "G4"]), ("A2", ["A3", "C4", "E4", "A4"]), ("F2", ["F3", "A3", "C4", "F4"])]
MELODY = [  # (beat in the bar, note, beats long), two bars that repeat
    (0, "E5", 1), (1, "G5", 0.5), (1.5, "A5", 0.5), (2, "G5", 1), (3, "E5", 1),
    (4, "D5", 1), (5, "E5", 0.5), (5.5, "G5", 0.5), (6, "C5", 2),
]
RISE = ["C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6"]


def music(total_beats, cuts, pops, words, dusk_beat, card_beat):
    n = int((total_beats * SPB + 3) * SR)
    mix = {k: np.zeros(n) for k in ("pluck", "bass", "glock", "drums", "fx", "pad")}

    def add(track, sig, at):
        i = int(at * SR)
        j = min(n, i + len(sig))
        if i < n:
            mix[track][i:j] += sig[: j - i]

    kick = tone(1, 0.25, ((1, 1),), 0.001, 0.09)
    t = np.arange(len(kick)) / SR
    kick = np.sin(2 * np.pi * (55 * t + 60 * (1 - np.exp(-t * 30)) / 30)) * np.exp(-t / 0.12)
    clap = highpass(noise(0.18, 3), 900) * env(int(0.18 * SR), 0.001, 0.05)
    shaker = highpass(noise(0.08, 4), 5000) * env(int(0.08 * SR), 0.001, 0.02)

    for beat in range(card_beat + 1):
        bar, b = divmod(beat, 4)
        root, chord = CHORDS[bar % 4]
        at = beat * SPB
        last = beat >= card_beat
        # Plucked chords: a strum on each beat and a lighter one on the off-beat.
        for k, note in enumerate(chord):
            add("pluck", pluck(hz(note)) * 0.22, at + k * 0.012)
        if not last:
            for k, note in enumerate(chord[1:]):
                add("pluck", pluck(hz(note)) * 0.12, at + SPB / 2 + k * 0.01)
        # Round bass on 1 and 3, an octave hop on 4.
        if b in (0, 2) or last:
            add("bass", tone(hz(root), 0.6, ((1, 1), (2, 0.25)), 0.01, 0.35) * 0.55, at)
        elif b == 3:
            add("bass", tone(hz(root) * 2, 0.3, ((1, 1),), 0.01, 0.15) * 0.3, at)
        # Drums once it's going; a quieter patch over the playground.
        quiet = 31 <= beat < 39
        if 4 <= beat < card_beat:
            if b in (0, 2):
                add("drums", kick * (0.35 if quiet else 0.7), at)
            if beat >= 15 and b in (1, 3) and not quiet:
                add("drums", clap * 0.35, at)
            add("drums", shaker * (0.12 if quiet else 0.2), at + SPB / 2)
        # The glockenspiel tune (a two-bar phrase, round and round), from the second bar.
        if 4 <= beat < card_beat:
            p = beat % 8
            for off, note, _ in MELODY:
                if p <= off < p + 1:
                    add("glock", tone(hz(note), 1.2, ((1, 1), (2.76, 0.25), (5.4, 0.08)), 0.002, 0.45) * 0.26, at + (off - p) * SPB)

    # A warm swell under the dusk, and the ta-da on the card.
    for note in ("C4", "E4", "G4", "C5"):
        sw = tone(hz(note), 3.0, ((1, 1), (2, 0.3)), 1.2, 2.0) * 0.12
        add("pad", sw, dusk_beat * SPB - 0.6)
    for k, note in enumerate(("C5", "E5", "G5", "C6")):
        add("glock", tone(hz(note), 2.5, ((1, 1), (2.76, 0.3), (5.4, 0.1)), 0.002, 0.9) * 0.3, card_beat * SPB + k * 0.07)
    for note in ("C3", "G3", "C4", "E4", "G4"):
        add("pad", tone(hz(note), 4.0, ((1, 1), (2, 0.2)), 0.02, 1.6) * 0.14, card_beat * SPB)

    # Little sounds: a swish on each cut, a bloop for each word, a rising chime for each house.
    for c in cuts:
        sw = highpass(noise(0.22, 9), 1200) * np.sin(np.linspace(0, np.pi, int(0.22 * SR))) ** 2 * 0.18
        add("fx", sw, c * SPB - 0.11)
    for w in words:
        tt = np.arange(int(0.09 * SR)) / SR
        f = 420 + 900 * tt / 0.09
        add("fx", np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.05) * 0.22, w * SPB)
    for k, b in enumerate(pops):
        add("fx", tone(hz(RISE[k]), 1.0, ((1, 1), (2.76, 0.3), (5.4, 0.1)), 0.002, 0.5) * 0.32, b * SPB)
        tt = np.arange(int(0.06 * SR)) / SR
        add("fx", np.sin(2 * np.pi * (180 + 500 * tt / 0.06) * tt) * np.exp(-tt / 0.03) * 0.3, b * SPB)

    levels = {"pluck": 0.9, "bass": 0.8, "glock": 0.8, "drums": 0.7, "fx": 0.9, "pad": 0.9}
    out = sum(mix[k] * levels[k] for k in mix)
    # A touch of echo, for warmth.
    d = int(0.18 * SR)
    out[d:] += out[:-d] * 0.18
    out /= np.max(np.abs(out)) / 0.89
    return out


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    stereo = np.repeat(pcm[:, None], 2, axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(stereo.tobytes())


# ------------------------------------------------------------------ putting it together

def main():
    m = json.loads((CAP / "manifest.json").read_text())
    assert m.get("cut") == "reel", "film the reel first: promo.film(\"reel\")"
    W, H = m["width"], m["height"]
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    n = 0

    def emit(im):
        nonlocal n
        im.save(OUT / f"{n:05d}.jpg", quality=93)
        n += 1

    stickers = {}
    cuts, words, pops = [], [], []
    beat_at = 0
    for s in m["shots"]:
        start_beat = beat_at
        if start_beat > 0:
            cuts.append(start_beat)
        lines = WORDS.get(s["name"], [])
        for b, text, col in lines:
            words.append(start_beat + b)
            stickers[(s["name"], b)] = sticker(text, COLOURS[col], W - 140)
        if s["name"] == "r_street":
            pops = [start_beat + 1 + k for k in range(8)]
        for j in range(s["frames"]):
            im = Image.open(CAP / "frames" / f"{s['from'] + j:04d}.jpg").convert("RGB")
            im = punch(im, j).convert("RGBA")
            # The words: the latest that's appeared, popping in on its beat.
            shown = [(b, t) for (b, t, _) in lines if j >= b * BEAT]
            if shown:
                b, _ = shown[-1]
                place(im, stickers[(s["name"], b)], pop_scale(j - b * BEAT), W / 2, H * 0.2)
            emit(im.convert("RGB"))
        beat_at += s["frames"] // BEAT
    card_beat = beat_at
    # Where the dusk shot starts, for the swell.
    dusk_beat = None
    acc = 0
    for s in m["shots"]:
        if s["name"] == "r_dusk":
            dusk_beat = acc
        acc += s["frames"] // BEAT
    cuts.append(card_beat)
    words.append(card_beat)

    icon = Image.open(ROOT / "resources/icon-1024.png").convert("RGBA").resize((560, 560), LANCZOS)
    mask = Image.new("L", (560 * 4, 560 * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, mask.width - 1, mask.height - 1], radius=mask.width * 0.22, fill=255)
    icon.putalpha(mask.resize((560, 560), LANCZOS))
    for j in range(CARD_BEATS * BEAT):
        emit(card_frame(W, H, j, icon))

    total_beats = card_beat + CARD_BEATS
    audio = music(total_beats, cuts, pops, words, dusk_beat or 27, card_beat)
    seconds = n / FPS
    audio = audio[: int(seconds * SR)]
    fade = int(1.2 * SR)
    audio[-fade:] *= np.linspace(1, 0, fade)
    write_wav(CAP / "reel.wav", audio)

    ff = imageio_ffmpeg.get_ffmpeg_exe()
    out = CAP / "dig-site-reel.mp4"
    subprocess.run([ff, "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(OUT / "%05d.jpg"), "-i", str(CAP / "reel.wav"),
                    "-map", "0:v", "-map", "1:a", "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p", "-c:v", "libx264", "-crf", "20",
                    "-preset", "slow", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", f"{seconds:.2f}", str(out)], check=True)
    print(f"{out} ({seconds:.1f} s, {out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
