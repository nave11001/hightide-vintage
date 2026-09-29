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

# (path relative to assets/_originals/, max width in px, quality, variants)
#
# Photographs take 82; flat artwork with hard edges takes 90, where ringing
# around the letterforms would show.
#
# The widths are measured, not guessed — every one of these was checked against
# what the browser actually draws, at 375px and at 1440px. Two kinds:
#
#   fixed size, no variants
#     Drawn at one small size whatever the screen. The stamps are the extreme
#     case: sold_stamp shipped at 620px to fill 54, which is 106KB spent on a
#     badge, and it was the single heaviest file on a category page after the
#     garments themselves.
#
#   variants, for srcset
#     The hero and the category tiles really are full-width on a desktop — 1432
#     and 1246 — and a phone draws them at 375 and 341. One size cannot serve
#     both, so they ship at three and the browser picks, exactly as the garment
#     photographs do.
#
# The logo is not here: scripts/make_logo.py builds it and the icons together,
# because it has to cut the background away first.
VARIANTS = (480, 800)

# Pixels to take off a master before anything else, as (left, top, right, bottom).
#
# This is for defects in the frame, not for composition. boardshorts.jpg carries
# a black wedge down its left edge — part of the photograph, not something the
# page adds — and because the tile fills its width there is no CSS that can hide
# it: object-position only slides an image where there is slack, and there is
# none across the width. So it comes off the master.
#
# 270 is measured, not judged: scripts saw every row of the image and the last
# black column was 270 at its worst, 217 at its narrowest. 280 clears it with a
# margin, because a wedge left one pixel short is still a black line on the tile.
CROPS = {
    'photos/boardshorts.jpg': (280, 0, 0, 0),

    # women is not cropped here. The first version of it was a tall portrait
    # carrying rows no layout could reach, and 196 came off each end; the
    # replacement is already cut close — 1208x1302, where the widest slice any
    # supported width asks for is 1289 rows at a 768px tablet. Thirteen rows
    # spare is not a saving, it is a margin, and taking it would start cutting
    # into what a tablet shows.
}

# The category tiles were all 1170 and two of them should not have been. The
# container is max-w-7xl (1280) inside px-4, so it is 1248 wide; the grid is two
# columns with a 24px gap. That makes a half tile 612 CSS pixels and the wide
# "all products" tile 1248 — and 1248 drawn from a 1170 file is an image being
# stretched past its own size on every desktop, before retina is even asked for.
#
# So each tile is now twice the widest box it is drawn in, capped by the source:
#   half tiles   612 x 2 = 1224   (sources are 2048 wide, so this is a downscale)
#   all products 1248 x 2 = 2496, and the source is 2048 — so 2048, whole.
# The script never upscales, so a number above the source is simply the source.
JOBS = [
    # name                        width  q   variants
    ('font_homepage.png',          320,  90, False),  # drawn at 102px, always
    ('photos/sold_stamp.png',      180,  90, False),  # drawn at 54px
    ('photos/sale_stamp.png',      140,  90, False),  # drawn at 42px
    # 1536 wide, so it ships whole: the 1600 is the ceiling, not the size.
    ('homepage_photo.webp',       1600,  82, True),   # 375 on a phone, 1432 wide
    ('photos/boardshorts.jpg',    1224,  82, True),   # 341 on a phone, 612 wide
    ('photos/T-shirts.jpg',       1224,  82, True),
    ('photos/accessories.jpg',    1224,  82, True),
    # A PNG this time, and 1208 wide — just under the 1224 the tiles are built
    # at. The script never upscales, so it ships at 1208: 1.3% short of the
    # target, which is nothing a viewer can see.
    ('photos/women.png',          1224,  82, True),
    ('photos/all products.jpg',   2048,  82, True),   # 1248 on a desktop
]


def make_og_cover() -> None:
    """The picture WhatsApp and Instagram show when the shop itself is shared.

    Separate from everything above, and deliberately a JPEG: the unfurlers that
    build link previews are much older than the pages they read, and several
    still will not decode WebP — a card with no picture is the failure this
    exists to prevent. 1200x630 is the size they all crop to.
    """
    src = os.path.join(ORIGINALS, 'homepage_photo.webp')
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

    for name, max_w, quality, wants_variants in JOBS:
        src = os.path.join(ORIGINALS, name)
        # Read from the masters, write into assets/ where the site imports from.
        stem = os.path.splitext(os.path.join(ROOT, 'assets', name))[0]

        master = Image.open(src)
        # Alpha is kept where it exists: these sit on the page as cut-outs, and
        # flattening them onto white would put a box around them.
        master = master.convert('RGBA' if master.mode in ('RGBA', 'LA', 'P') else 'RGB')

        crop = CROPS.get(name)
        if crop:
            left, top, right, bottom = crop
            master = master.crop((left, top, master.width - right, master.height - bottom))

        widths = [max_w] + ([w for w in VARIANTS if w < max_w] if wants_variants else [])
        after = 0
        for width in widths:
            im = master
            if master.width > width:
                im = master.resize((width, round(master.height * width / master.width)),
                                   Image.LANCZOS)
            suffix = '' if width == max_w else f'-{width}'
            path = f'{stem}{suffix}.webp'
            im.save(path, 'WEBP', quality=quality, method=6)
            after += os.path.getsize(path)

        before = os.path.getsize(src)
        total_before += before
        total_after += after
        note = f'  + {len(widths) - 1} smaller' if len(widths) > 1 else ''
        print(f'{before // 1024:>6}KB -> {after // 1024:>5}KB  {min(master.width, max_w)}px  {name}{note}')

    print(f'\n{total_before // 1024:,}KB -> {total_after // 1024:,}KB'
          f'  ({100 - total_after * 100 // total_before}% lighter)')

    make_og_cover()


if __name__ == '__main__':
    main()
