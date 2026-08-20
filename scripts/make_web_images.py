"""Builds the WebP the shop actually ships, next to each source image.

    python scripts/make_web_images.py

The originals are the masters and stay where they are; this writes a sibling
.webp and the components import that instead.

Why it exists: the artwork was saved at print sizes and in formats that cannot
compress photographs. The header logo was 1,291KB on every single page load, the
hero 1,906KB, and one category tile was a 3022x3844 photograph shown in a box a
few hundred pixels wide. Roughly six megabytes of images arrived before the shop
could look finished, which is the reason the loading screen had anything to
cover in the first place. A loading screen hides the wait; this removes it.

MAX_W is the widest the image is ever displayed, doubled for retina, and never
larger than the source — upscaling would only invent pixels.
"""

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (path relative to assets/, max width in px, quality)
# Photographs take 82; flat artwork with hard edges takes 90, where ringing
# around the letterforms would show.
JOBS = [
    ('logo.png', 700, 90),
    ('font_homepage.png', 1200, 90),
    ('homepage_photo.png', 1600, 82),
    ('photos/boardshorts.jpg', 1170, 82),
    ('photos/T-shirts.jpg', 1170, 82),
    ('photos/accessories.jpeg', 1170, 82),
    ('photos/Women (1).jpeg', 1170, 82),
    ('photos/all products.jpg', 1170, 82),
    ('photos/sold_stamp.png', 620, 90),
    ('photos/sale_stamp.png', 360, 90),
]


def main() -> None:
    total_before = total_after = 0

    for name, max_w, quality in JOBS:
        src = os.path.join(ROOT, 'assets', name)
        dst = os.path.splitext(src)[0] + '.webp'

        im = Image.open(src)
        # Alpha is kept where it exists: these sit on the page as cut-outs, and
        # flattening them onto white would put a box around them.
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')

        if im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)

        im.save(dst, 'WEBP', quality=quality, method=6)

        before, after = os.path.getsize(src), os.path.getsize(dst)
        total_before += before
        total_after += after
        print(f'{before // 1024:>6}KB -> {after // 1024:>5}KB  {im.width}x{im.height}  {name}')

    print(f'\n{total_before // 1024:,}KB -> {total_after // 1024:,}KB'
          f'  ({100 - total_after * 100 // total_before}% lighter)')


if __name__ == '__main__':
    main()
