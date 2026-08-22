"""Builds public/og/<num>.jpg — the picture a shared link shows.

    python scripts/make_og_images.py

Why one per garment
-------------------
Every link to the shop unfurled with the same generic cover, because the share
tag pointed at the bucket and the bucket stopped answering. Even when it did
answer it was the wrong thing to point at: an unfurler pulled the full
half-megabyte upload to draw a thumbnail, from the store that is metered.

The shop's whole sales channel is Instagram DMs, so the picture on a link is not
decoration — it is the shop window. Now each garment gets its own.

Why not just crop the photo
---------------------------
A garment photograph is 4:5 and a share card is 1.91:1. Cropping to that takes
the top and bottom off a pair of shorts, which is most of the shorts. Instead
the photo is set at full height in the middle, and the space either side is
filled with a blurred, dimmed copy of itself — so the card is the right shape
and the garment is whole.

Named by item number under a fixed path, not a content hash, so
netlify/functions/product-meta.mjs can build the URL without knowing the build.
"""

import json
import os
import shutil

from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAPSHOT = os.path.join(ROOT, 'src', 'catalog-snapshot.json')
PHOTOS = os.path.join(ROOT, 'assets', 'inventory-web')
OUT = os.path.join(ROOT, 'public', 'og')

WIDTH, HEIGHT = 1200, 630   # what every unfurler crops to
PADDING = 28
QUALITY = 82


def source_photo(path: str) -> str:
    """assets/inventory-web path for a stored path like 'boardies/66.jpeg'."""
    return os.path.join(PHOTOS, os.path.splitext(path)[0] + '.webp')


def backdrop(photo: Image.Image):
    """The photo's own background colour, when it has an even one.

    Most of these were shot against a plain wall or sheet, and filling the card
    with that colour makes the garment sit on the card rather than on a
    rectangle laid over one. Returns None when the corners disagree — a
    lifestyle shot with sky in one corner and sand in another — and the blurred
    bed handles that case instead.
    """
    w, h = photo.size
    box = max(8, min(w, h) // 20)
    corners = [
        photo.crop((0, 0, box, box)),
        photo.crop((w - box, 0, w, box)),
        photo.crop((0, h - box, box, h)),
        photo.crop((w - box, h - box, w, h)),
    ]
    # Averaging a patch down to a single pixel is the resampler's own job.
    means = [c.resize((1, 1), Image.BOX).getpixel((0, 0)) for c in corners]

    spread = max(
        abs(a[i] - b[i]) for a in means for b in means for i in range(3)
    )
    if spread > 26:
        return None
    return tuple(sum(m[i] for m in means) // len(means) for i in range(3))


def card(photo: Image.Image) -> Image.Image:
    """The garment whole and uncropped, centred on a card the right shape."""
    flat = backdrop(photo)
    if flat is not None:
        bed = Image.new('RGB', (WIDTH, HEIGHT), flat)
    else:
        # No even backdrop to borrow: cover the canvas with the photo, blur it
        # past recognition and dim it, so the sharp copy in front stays the
        # thing being looked at.
        scale = max(WIDTH / photo.width, HEIGHT / photo.height)
        bed = photo.resize((round(photo.width * scale), round(photo.height * scale)), Image.LANCZOS)
        left, top = (bed.width - WIDTH) // 2, (bed.height - HEIGHT) // 2
        bed = bed.crop((left, top, left + WIDTH, top + HEIGHT))
        bed = bed.filter(ImageFilter.GaussianBlur(28))
        bed = ImageEnhance.Brightness(bed).enhance(0.72)

    # Front: full height, nothing cropped.
    height = HEIGHT - PADDING * 2
    width = round(photo.width * height / photo.height)
    front = photo.resize((width, height), Image.LANCZOS)
    bed.paste(front, ((WIDTH - width) // 2, PADDING))
    return bed


def main() -> None:
    with open(SNAPSHOT, encoding='utf-8') as f:
        items = json.load(f).get('items', [])

    # Cleared, so a garment that has left the catalogue stops being served.
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)

    made = 0
    total = 0
    missing = []
    for row in items:
        paths = row.get('ph') or []
        if not paths:
            missing.append(f"#{row['n']} has no photo")
            continue
        src = source_photo(paths[0])
        if not os.path.exists(src):
            missing.append(f"#{row['n']} {paths[0]}")
            continue

        with Image.open(src) as im:
            out = os.path.join(OUT, f"{row['n']}.jpg")
            card(im.convert('RGB')).save(out, 'JPEG', quality=QUALITY, optimize=True)
            total += os.path.getsize(out)
            made += 1

    print(f'{made} share cards  {WIDTH}x{HEIGHT}'
          f'  {total / 1024 / 1024:.1f} MB total, {total / max(made, 1) / 1024:.0f} KB each')
    print('  written to public/og/')
    for note in missing:
        print(f'  ! skipped {note}')


if __name__ == '__main__':
    main()
