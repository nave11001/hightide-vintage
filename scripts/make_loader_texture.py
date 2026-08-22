"""Builds public/logo-loader.webp, the still logo the loading screen shows.

    python scripts/make_loader_texture.py

Two things read this one file, which is the point:

  * the splash in index.html, plain HTML that renders before any JavaScript,
    which is the first thing a visitor sees;
  * the liquid veil's shader, which samples it as a texture and refracts it.

They share the URL so they share the download, and — more importantly — so the
handover between them is invisible. Two different images here would flip in
front of the customer at the exact moment the water starts.

The source is flattened onto white because the shader reads .rgb: an alpha
channel it ignores would leave the transparent region as whatever colour was
stored underneath. It is padded to a square because the shader maps it onto a
circle in a square viewport, and anything else arrives stretched.

The artwork is scaled to the same 94% of the frame the previous texture used, so
the veil's geometry — and the splash CSS that mirrors it — is unchanged.
"""

import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', '_originals', 'final logo.png')
DST = os.path.join(ROOT, 'public', 'logo-loader.webp')
SIZE = 512
# How much of the frame the sphere covers. Measured off the texture this
# replaces, so nothing downstream has to move.
FILL = 0.941


def cut_background(im):
    """Transparent where the white outside the sphere reaches. See make_logo.py."""
    w, h = im.size
    work = im.convert('RGB')
    key = (255, 0, 255)
    for corner in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(work, corner, key, thresh=22)
    px = work.load()
    mask = Image.new('L', (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            mp[x, y] = 0 if px[x, y] == key else 255
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA')
    out.putalpha(mask)
    return out.crop(out.getbbox())


def main() -> None:
    art = cut_background(Image.open(SRC).convert('RGBA'))

    target = round(SIZE * FILL)
    art.thumbnail((target, target), Image.LANCZOS)

    flat = Image.new('RGB', (SIZE, SIZE), (255, 255, 255))
    flat.paste(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2),
               mask=art.getchannel('A'))
    flat.save(DST, 'WEBP', quality=88, method=6)

    print(f'{os.path.basename(SRC)} -> {SIZE}x{SIZE} rgb'
          f'  artwork {art.width}x{art.height}'
          f'  {os.path.getsize(DST):,}B  public/logo-loader.webp')


if __name__ == '__main__':
    main()
