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

# The masters. Kept out of git — they are 16MB of PNG and JPEG that no visitor
# ever sees, and only this script and make_logo.py read them. They live on disk
# (and in OneDrive) rather than in the repo.
ORIGINALS = os.path.join(ROOT, 'assets', '_originals')

# (path relative to assets/_originals/, max width in px, quality)
# Photographs take 82; flat artwork with hard edges takes 90, where ringing
# around the letterforms would show.
#
# The logo is not here: scripts/make_logo.py builds it and the icons together,
# because it has to cut the background away first.
JOBS = [
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


def make_og_cover() -> None:
    """The picture WhatsApp and Instagram show when the shop itself is shared.

    Separate from everything above, and deliberately a JPEG: the unfurlers that
    build link previews are much older than the pages they read, and several
    still will not decode WebP — a card with no picture is the failure this
    exists to prevent. 1200x630 is the size they all crop to.
    """
    src = os.path.join(ORIGINALS, 'homepage_photo.png')
    dst = os.path.join(ROOT, 'public', 'og-cover.jpg')
    width, height = 1200, 630

    im = Image.open(src).convert('RGB')
    scale = max(width / im.width, height / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left, top = (im.width - width) // 2, (im.height - height) // 2
    im.crop((left, top, left + width, top + height)).save(dst, 'JPEG', quality=86, optimize=True)

    print(f'{width}x{height} jpeg {os.path.getsize(dst) // 1024}KB  public/og-cover.jpg')


def main() -> None:
    total_before = total_after = 0

    for name, max_w, quality in JOBS:
        src = os.path.join(ORIGINALS, name)
        # Read from the masters, write into assets/ where the site imports from.
        dst = os.path.splitext(os.path.join(ROOT, 'assets', name))[0] + '.webp'

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

    make_og_cover()


if __name__ == '__main__':
    main()
