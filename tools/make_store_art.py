"""The pictures for the three stores' pages, into capture/store/ (not in git; remake them any time).

First render the screenshots on the dev server (`?promo&quality=high`, then in the console):

    const L = [["home",3],["crane",3.5],["dig",2.5],["s_square",0],["play",3],["pour",2],["neighbours",3],["s_harbour_low",0]];
    for (const [w, h, from] of [[2868,1320,300],[2752,2064,400],[1920,1080,500],[1920,1200,600]]) await promo.stills(L, w, h, from);

then run `python tools/make_store_art.py`. It writes:
- apple-iphone-6.9/   2868x1320, the App Store's iPhone set (6.9" display, landscape)
- apple-ipad-13/      2752x2064, the App Store's iPad set (13" display, landscape)
- android-16x9/       1920x1080, Google Play's phone set, and Amazon's
- android-16x10/      1920x1200, Google Play's 7" and 10" tablet sets, and Amazon's
- google-feature-graphic.png   1024x500
- icon-512.png, icon-114.png   Google Play's and Amazon's icons
Every PNG is RGB with no transparency, which all three stores want.
"""
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / "capture" / "frames"
OUT = ROOT / "capture" / "store"

# The order they appear in on each store: the first three are what most people see.
SHOTS = ["home", "crane", "dig", "square", "playground", "pour", "neighbours", "harbour"]
SETS = {
    "apple-iphone-6.9": (300, (2868, 1320)),
    "apple-ipad-13": (400, (2752, 2064)),
    "android-16x9": (500, (1920, 1080)),
    "android-16x10": (600, (1920, 1200)),
}
FONT = "C:/Windows/Fonts/seguibl.ttf"  # Segoe UI Black, as in the trailer and reel
INK = (43, 49, 56)


def screenshots() -> None:
    for name, (start, size) in SETS.items():
        d = OUT / name
        d.mkdir(parents=True, exist_ok=True)
        for i, shot in enumerate(SHOTS):
            src = FRAMES / f"{9000 + start + i}.jpg"
            im = Image.open(src).convert("RGB")
            assert im.size == size, (src, im.size, size)
            im.save(d / f"{i + 1:02d}-{shot}.png", optimize=True)


def feature_graphic() -> None:
    """Google's 1024x500 banner: the family moving in, the icon, and the name. Few words, big."""
    W, H = 1024, 500
    shot = Image.open(FRAMES / f"{9000 + 300}.jpg").convert("RGB")  # "home", wide
    # Fill the banner from the shot's middle, then shift the view right so the house sits clear of
    # the words on the left.
    scale = max(W / shot.width, H / shot.height) * 1.4
    shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.Resampling.LANCZOS)
    left = max(0, (shot.width - W) // 2 - 190)
    top = (shot.height - H) // 2
    im = shot.crop((left, top, left + W, top + H))
    # A soft white wash on the left, for the words.
    wash = Image.new("L", (W, H), 0)
    dw = ImageDraw.Draw(wash)
    solid, fade = W * 0.40, W * 0.22  # nearly white across the words, then easing out
    for x in range(W):
        k = 1.0 if x < solid else max(0.0, 1 - (x - solid) / fade)
        dw.line([(x, 0), (x, H)], fill=int(238 * k * k * (3 - 2 * k)))
    im = Image.composite(Image.new("RGB", (W, H), (255, 255, 255)), im, wash)

    icon = Image.open(ROOT / "resources" / "icon-1024.png").convert("RGBA").resize((150, 150), Image.Resampling.LANCZOS)
    mask = Image.new("L", (600, 600), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 599, 599], radius=132, fill=255)
    icon.putalpha(mask.resize((150, 150), Image.Resampling.LANCZOS))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([56, 72, 56 + 150, 72 + 150], radius=34, fill=(0, 0, 0, 70))
    im = Image.alpha_composite(im.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(10)))
    im.alpha_composite(icon, (50, 62))

    d = ImageDraw.Draw(im)
    d.text((50, 236), "Dig Site", font=ImageFont.truetype(FONT, 92), fill=INK)
    d.text((54, 352), "Build a town,\none home at a time.", font=ImageFont.truetype(FONT, 38), fill=(232, 112, 10), spacing=6)
    im.convert("RGB").save(OUT / "google-feature-graphic.png", optimize=True)


def icons() -> None:
    src = Image.open(ROOT / "resources" / "icon-1024.png").convert("RGB")
    for n in (512, 114):
        src.resize((n, n), Image.Resampling.LANCZOS).save(OUT / f"icon-{n}.png", optimize=True)


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    screenshots()
    feature_graphic()
    icons()
    n = sum(1 for _ in OUT.rglob("*.png"))
    print(f"{n} pictures in {OUT}")


if __name__ == "__main__":
    main()
