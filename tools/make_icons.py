"""
Draws Dig Site's app icon and splash screen, and writes every size Android needs, plus large
masters for the store listings. Run from anywhere:

    python tools/make_icons.py

The picture is the game's own yellow excavator, arm up with a bucketful of dirt, on a green hill
under a blue sky. Everything is drawn here with Pillow, at four times the size and then scaled
down, so there's no art file to keep in step.

Android's adaptive icon has two layers, each 108 units square: the sky and hill behind, and the
excavator in front, kept inside the middle 66 units, which every launcher's mask shows.
"""
from pathlib import Path

from PIL import Image, ImageDraw

LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
OUT = ROOT / "resources"

SS = 4  # supersampling

YELLOW = (242, 183, 5)
YELLOW_DARK = (205, 150, 0)
DARK = (38, 38, 38)
GREY = (139, 146, 154)
STEEL = (125, 133, 144)
GLASS = (159, 211, 255)
WHITE = (244, 244, 244)
ORANGE = (255, 138, 31)
EARTH = (140, 98, 57)
EARTH_LIGHT = (176, 128, 80)
BUCKET = (58, 63, 71)
SKY_TOP = (122, 196, 250)
SKY_BOTTOM = (200, 233, 255)
GRASS = (126, 200, 80)
GRASS_DARK = (100, 172, 64)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sky(w, h):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=lerp(SKY_TOP, SKY_BOTTOM, y / max(1, h - 1)))
    return im


def excavator(u):
    """The excavator on a transparent canvas, drawn in units of `u` pixels (about 110 x 70 units)."""
    W, H = 112 * u, 76 * u
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    P = lambda *xy: [v * u for v in xy]  # noqa: E731

    # Tracks, with rollers.
    d.rounded_rectangle(P(4, 58, 62, 74), radius=8 * u, fill=DARK)
    for x in (13, 23, 33, 43, 53):
        d.ellipse(P(x - 3.4, 62.6, x + 3.4, 69.4), fill=GREY)
    # The house: counterweight, deck with a white stripe and a darker underside.
    d.rounded_rectangle(P(2, 40, 12, 56), radius=3 * u, fill=STEEL)
    d.rounded_rectangle(P(7, 38, 60, 58), radius=4 * u, fill=YELLOW)
    d.rectangle(P(7, 52, 60, 58), fill=YELLOW_DARK)
    d.rectangle(P(10, 47, 40, 49.5), fill=WHITE)
    # Engine grille and exhaust.
    d.rectangle(P(12, 34, 26, 38), fill=STEEL)
    d.rectangle(P(15, 26, 18, 34), fill=DARK)
    # Cab: a flat roof (yellow rim, white panel), big window, beacon on top.
    d.rounded_rectangle(P(34, 14, 58, 40), radius=3 * u, fill=YELLOW)
    d.rectangle(P(34, 12, 58, 17), fill=YELLOW)
    d.rectangle(P(37, 13, 55, 16), fill=WHITE)
    d.rounded_rectangle(P(39, 20, 55, 34), radius=2 * u, fill=GLASS)
    d.rectangle(P(39, 20, 55, 23), fill=(205, 233, 255))
    d.rounded_rectangle(P(43, 5, 50, 12), radius=1.5 * u, fill=ORANGE)

    # Boom up and out, the stick down to the bucket: thick yellow limbs with round joints.
    def limb(a, b, w):
        d.line(P(*a, *b), fill=YELLOW, width=round(w * u))
        for p in (a, b):
            d.ellipse(P(p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2), fill=YELLOW)

    base, elbow, wrist = (58, 44), (80, 16), (92, 32)
    limb(base, elbow, 11)
    limb(elbow, wrist, 8)
    d.line(P(62, 50, 76, 28), fill=STEEL, width=round(3 * u))  # the ram under the boom
    d.ellipse(P(elbow[0] - 3, elbow[1] - 3, elbow[0] + 3, elbow[1] + 3), fill=STEEL)
    # The bucket, held level with its mouth up: a heap of dirt in it, teeth along the front lip.
    d.polygon(P(87, 34, 109, 34, 107, 44, 101, 50, 92, 50, 88, 44), fill=BUCKET)
    d.rectangle(P(87, 34, 109, 37), fill=(78, 84, 94))
    for x in (106, 109.5):
        d.polygon(P(x - 2, 34, x + 2.5, 31, x + 1, 36), fill=STEEL)
    d.polygon(P(87, 34.5, 89, 28, 94, 23, 99, 21.5, 104, 24, 107.5, 30, 108, 34.5), fill=EARTH)
    d.polygon(P(92, 27, 96, 23.5, 100, 23, 102, 26, 97, 28.5), fill=EARTH_LIGHT)
    for x, y in ((90, 31), (104, 31.5)):
        d.ellipse(P(x - 1.6, y - 1.6, x + 1.6, y + 1.6), fill=EARTH_LIGHT)
    d.ellipse(P(wrist[0] - 3, wrist[1] - 3, wrist[0] + 3, wrist[1] + 3), fill=STEEL)
    return im.crop(im.getbbox())


def hill(d, w, h, top):
    """A green hill across the bottom, its top at `top` (pixels)."""
    d.ellipse([-w * 0.35, top, w * 1.35, top + h * 1.6], fill=GRASS_DARK)
    d.ellipse([-w * 0.3, top + h * 0.012, w * 1.3, top + h * 1.6], fill=GRASS)


def place(canvas, art, width, cx, bottom):
    """Pastes `art` scaled to `width` pixels wide, centred on `cx`, with its foot at `bottom`."""
    a = art.resize((round(width), round(art.height * width / art.width)), LANCZOS)
    canvas.alpha_composite(a, (round(cx - a.width / 2), round(bottom - a.height)))


ART = excavator(16 * SS)


def background(px):
    """The adaptive icon's back layer: sky and hill, full bleed."""
    S = px * SS
    im = sky(S, S).convert("RGBA")
    hill(ImageDraw.Draw(im), S, S, S * 70 / 108)
    return im.resize((px, px), LANCZOS)


def foreground(px):
    """The adaptive icon's front layer: the excavator inside the middle of the 108 units."""
    S = px * SS
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # The tracks sit just into the hill (whose top is at 70 of 108).
    place(im, ART, S * 60 / 108, S * 55 / 108, S * 76 / 108)
    return im.resize((px, px), LANCZOS)


def flat(px, crop=72):
    """The whole icon as one square picture, showing the middle `crop` of the 108 units."""
    big = 432
    both = background(big)
    both.alpha_composite(foreground(big))
    m = (108 - crop) / 2 * big / 108
    return both.crop((round(m), round(m), round(big - m), round(big - m))).resize((px, px), LANCZOS)


def rounded(im, radius_frac):
    mask = Image.new("L", (im.width * SS, im.height * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, mask.width - 1, mask.height - 1], radius=mask.width * radius_frac, fill=255)
    out = im.copy()
    out.putalpha(mask.resize(im.size, LANCZOS))
    return out


def splash(w, h):
    """The launch screen: sky, a hill along the bottom, the excavator in the middle."""
    W, H = w * 2, h * 2
    im = sky(W, H).convert("RGBA")
    top = H * 0.66
    hill(ImageDraw.Draw(im), W, H, top)
    size = min(W, H) * 0.42
    place(im, ART, size, W / 2, top + size * 0.07)
    return im.resize((w, h), LANCZOS).convert("RGB")


def main():
    densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for name, k in densities.items():
        d = RES / f"mipmap-{name}"
        d.mkdir(parents=True, exist_ok=True)
        legacy = round(48 * k)
        rounded(flat(legacy, 76), 0.2).save(d / "ic_launcher.png")
        rounded(flat(legacy, 76), 0.5).save(d / "ic_launcher_round.png")
        layer = round(108 * k)
        foreground(layer).save(d / "ic_launcher_foreground.png")
        background(layer).save(d / "ic_launcher_background.png")

    # The launch picture, in every size Capacitor made, turned either way.
    for f in sorted(RES.glob("drawable*/splash.png")):
        w, h = Image.open(f).size
        splash(w, h).save(f)

    # Masters for the stores: Google Play wants 512, Apple 1024 (both mask the corners themselves).
    OUT.mkdir(exist_ok=True)
    flat(1024, 74).convert("RGB").save(OUT / "icon-1024.png")
    flat(512, 74).convert("RGB").save(OUT / "icon-512.png")
    splash(2732, 2732).save(OUT / "splash-2732.png")
    print("icons and splash written")


if __name__ == "__main__":
    main()
