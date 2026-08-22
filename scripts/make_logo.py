# -*- coding: utf-8 -*-
"""Rebuild every logo the site uses from assets/_originals/final logo.png.

    python scripts/make_logo.py

Produces:
    assets/logo.webp        the sphere in the header, transparent
    public/favicon-*.png    tab icons
    public/favicon.ico      tab icon, older browsers
    public/apple-touch-icon.png
    public/icon-192.png     home screen
    public/icon-512.png     home screen, install prompt

Not produced: public/logo-loader.webp. The loading screen reads that file as a
WebGL texture and refracts it through liquid, and its look is tuned to that
image. Rebuild it deliberately with scripts/make_loader_texture.py, not as a
side effect of a new logo.

Two things the master cannot do as-is
------------------------------------
It is opaque: the sphere sits on solid white out to the edge of a square. In the
header that reads as a white tile rather than a logo, so the white *outside* the
sphere is flooded away from the four corners. Flooding rather than keying by
colour is the point — the highlights on the sphere and the lettering are also
near-white, and a colour key would eat them.

As a tab icon the sphere is fine but small, so an opaque disc goes behind it,
tinted with the artwork's own average colour, and everything is cropped to the
artwork first. If that tint changes, update theme_color in
public/site.webmanifest and the theme-color meta tag in index.html to match.
"""
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    sys.exit("Pillow missing. Run: pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "_originals", "final logo.png")
PUBLIC = os.path.join(ROOT, "public")

# The header never draws it larger than this, and it is retina-doubled already.
HEADER_WIDTH = 700
HEADER_QUALITY = 88

SIZES = [
    ("favicon-16.png", 16),
    ("favicon-32.png", 32),
    ("favicon-48.png", 48),
    ("apple-touch-icon.png", 180),
    ("icon-192.png", 192),
    ("icon-512.png", 512),
]

# Icons are flat artwork, not photographs. A palette is the difference between a
# 384KB icon-512.png and roughly 40KB, and at these sizes there is nothing to see
# between them.
#
# FASTOCTREE specifically: it is the only quantizer here that carries alpha
# through. MEDIANCUT needs RGB, and converting to RGB composites the corners
# outside the disc onto black — which is a black square with a sphere in it.
ICON_COLOURS = 255


def cut_background(im):
    """Transparent everywhere the white outside the sphere reaches."""
    w, h = im.size
    work = im.convert("RGB")
    key = (255, 0, 255)
    for corner in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(work, corner, key, thresh=22)

    px = work.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            mp[x, y] = 0 if px[x, y] == key else 255

    # One pixel of softening, so the rim is not stair-stepped.
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out.crop(out.getbbox())


def average_colour(im):
    """Mean of the solid pixels, so the disc feels like part of the artwork."""
    px = im.load()
    r = g = b = n = 0
    for y in range(0, im.height, 4):
        for x in range(0, im.width, 4):
            pr, pg, pb, pa = px[x, y]
            if pa > 200:
                r, g, b, n = r + pr, g + pg, b + pb, n + 1
    return (r // n, g // n, b // n, 255)


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC}")

    master = cut_background(Image.open(SRC).convert("RGBA"))
    print(f"artwork: {master.width}x{master.height} (background cut)")

    header = os.path.join(ROOT, "assets", "logo.webp")
    scaled = master.copy()
    if scaled.width > HEADER_WIDTH:
        scaled.thumbnail((HEADER_WIDTH, HEADER_WIDTH * 4), Image.LANCZOS)
    scaled.save(header, "WEBP", quality=HEADER_QUALITY, method=6)
    print(f"  {'assets/logo.webp':<28} {scaled.width}x{scaled.height}"
          f"  {os.path.getsize(header) // 1024} KB")

    tint = average_colour(master)
    print(f"disc colour: rgb{tint[:3]}")

    side = max(master.size)
    disc = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ImageDraw.Draw(disc).ellipse([1, 1, side - 2, side - 2], fill=tint)
    layer = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    layer.paste(master, ((side - master.width) // 2, (side - master.height) // 2))
    canvas = Image.alpha_composite(disc, layer)

    total = 0
    for name, size in SIZES:
        path = os.path.join(PUBLIC, name)
        icon = canvas.resize((size, size), Image.LANCZOS)
        icon.quantize(colors=ICON_COLOURS, method=Image.FASTOCTREE).save(path, optimize=True)
        total += os.path.getsize(path)
        print(f"  {('public/' + name):<28} {size}x{size}  {os.path.getsize(path) // 1024} KB")

    ico = os.path.join(PUBLIC, "favicon.ico")
    canvas.resize((48, 48), Image.LANCZOS).save(ico, sizes=[(16, 16), (32, 32), (48, 48)])
    total += os.path.getsize(ico)
    print(f"  {'public/favicon.ico':<28} 16/32/48  {os.path.getsize(ico) // 1024} KB")
    print(f"icons total: {total // 1024} KB")


if __name__ == "__main__":
    main()
