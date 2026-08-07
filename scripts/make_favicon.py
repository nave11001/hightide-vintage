# -*- coding: utf-8 -*-
"""Rebuild the tab icons in public/ from assets/logo.png.

Run this after the logo changes:
  pip install pillow
  python scripts/make_favicon.py

Two things the raw logo cannot do as a tab icon:

  * it sits in a wide transparent margin, so scaled to 16px the sphere becomes
    a dot — hence the crop to the artwork's bounding box;
  * earlier background removal left transparent holes inside the sphere, which
    read as white bites on a light tab strip and black ones on a dark strip —
    hence the opaque disc behind it, tinted with the logo's own average colour.

If the tint changes, update theme_color in public/site.webmanifest and the
theme-color meta tag in index.html to match.
"""
import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Pillow missing. Run: pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "logo.png")
OUT = os.path.join(ROOT, "public")

SIZES = [
    ("favicon-16.png", 16),
    ("favicon-32.png", 32),
    ("favicon-48.png", 48),
    ("apple-touch-icon.png", 180),
    ("icon-192.png", 192),
    ("icon-512.png", 512),
]


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
    os.makedirs(OUT, exist_ok=True)
    logo = Image.open(SRC).convert("RGBA")
    logo = logo.crop(logo.getbbox())
    print(f"artwork: {logo.width}x{logo.height}")

    tint = average_colour(logo)
    print(f"disc colour: rgb{tint[:3]}")

    side = max(logo.size)
    disc = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ImageDraw.Draw(disc).ellipse([1, 1, side - 2, side - 2], fill=tint)

    layer = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    layer.paste(logo, ((side - logo.width) // 2, (side - logo.height) // 2))
    canvas = Image.alpha_composite(disc, layer)

    for name, size in SIZES:
        path = os.path.join(OUT, name)
        canvas.resize((size, size), Image.LANCZOS).save(path, optimize=True)
        print(f"  {name:<22} {size}x{size}")

    ico = os.path.join(OUT, "favicon.ico")
    canvas.resize((48, 48), Image.LANCZOS).save(ico, sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  {'favicon.ico':<22} 16/32/48")


if __name__ == "__main__":
    main()
