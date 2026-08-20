"""Builds assets/logo-loader.webp, the texture the loading veil samples.

Run after changing assets/logo.png:

    python scripts/make_loader_texture.py

Two things make the source file unusable as a shader texture.

Its transparent region stores a grey checkerboard in the colour channels — the
pattern a design tool paints to *show* transparency, baked in. A shader reading
.rgb renders the checkerboard. Flattening onto white deletes the channel the
bug lives in, rather than teaching every reader to respect alpha.

And the artwork is 866x906 while the shader maps it onto a circle in a square
viewport, so it arrives stretched. Padding to square keeps the logo round.

The 512px result is also 32x lighter than the source, which matters when the
image's whole job is to appear before the site does.
"""

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'logo.png')
DST = os.path.join(ROOT, 'assets', 'logo-loader.webp')
SIZE = 512

def main() -> None:
    im = Image.open(SRC).convert('RGBA')
    w, h = im.size

    side = max(w, h)
    square = Image.new('RGBA', (side, side), (255, 255, 255, 0))
    square.paste(im, ((side - w) // 2, (side - h) // 2))

    flat = Image.new('RGB', (side, side), (255, 255, 255))
    flat.paste(square, mask=square.getchannel('A'))
    flat.resize((SIZE, SIZE), Image.LANCZOS).save(DST, 'WEBP', quality=88, method=6)

    print(f'{w}x{h} rgba {os.path.getsize(SRC):,}B'
          f' -> {SIZE}x{SIZE} rgb {os.path.getsize(DST):,}B')

if __name__ == '__main__':
    main()
