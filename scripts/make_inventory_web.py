"""Builds assets/inventory-web/ — the product photos the site actually ships.

    python scripts/make_inventory_web.py

Run it whenever photos are added to assets/inventory/. `npm run upload-drop`
already does.

Why this exists
---------------
The photos used to be served from Supabase Storage, one download per shopper
per hour. In August 2026 that put 56GB through a 5GB allowance — eleven times
over — and Supabase restricted the project until it was paid for. The shop went
down: no catalogue, no pictures.

Serving them from the site itself removes that meter completely. Netlify serves
them from the same place as the rest of the site, under a name that changes only
when the picture does, so a browser that has one keeps it.

What it produces
----------------
Originals in assets/inventory/ are the masters and are never modified. This
writes a compressed copy of each, renamed to the path the database knows it by:

    assets/inventory/bordies/104 .jpg  ->  assets/inventory-web/boardies/104.webp

The renaming matters. Local filenames carry stray spaces and mixed extensions,
while the database stores a tidy `boardies/104.jpg`. Both sides are matched on
the item number and its optional letter — never on the filename — which is how
all 116 paths in the database were resolved to local files.

Measured over the whole library: 81.1MB becomes 8.4MB, a 90% reduction.
"""

import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "inventory")
DST = os.path.join(ROOT, "assets", "inventory-web")

# Repo folder -> the category the database uses. Mirrors FOLDER_TO_CATEGORY in
# migrate_to_supabase.py; the two must agree or the lookup misses.
FOLDER_TO_CATEGORY = {
    "bordies": "boardies",
    "t-shirts": "shirts",
    "women": "women",
    "accessories": "accessories",
}

IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp")
QUALITY = 82

# Three widths, because one width cannot serve both a thumbnail and the page a
# customer decides on. Measured on an iPhone: a card in the grid is 164 CSS
# pixels wide, which on that screen means 328 real ones — and it was being sent
# 1170, about twelve times the pixels it could show. A category page cost 3.45MB
# of photographs for that reason alone.
#
#   480  a card on a phone, and on a plain desktop screen
#   800  a card on a sharp desktop screen, and the homepage rail
#  1200  the item's own page, where the buyer is actually looking
#
# The browser picks: srcset offers all three and it takes the smallest that
# still covers its screen. Nobody downloads more than one.
WIDTHS = (480, 800, 1200)
# 1200 keeps the plain name, so every path already stored in the database and
# the snapshot still resolves without being rewritten.
FULL_WIDTH = 1200


def item_number(stem):
    """('104 ', '') or ('92', 'a') from a filename stem, or (None, None)."""
    m = re.match(r"^(\d+)\s*([a-z]?)\s*$", stem.strip(), re.I)
    return (int(m.group(1)), m.group(2).lower()) if m else (None, None)


def main() -> None:
    before = after = full = count = 0
    skipped = []

    # Cleared, not merged. Every file below is rewritten from the masters on
    # each run, and a leftover is worse than missing: a variant this run decided
    # not to write — because the master was already smaller — would survive as a
    # stale copy, and the site's srcset would go on offering it as a size it is
    # not. Nothing here is a source; assets/inventory/ is.
    if os.path.isdir(DST):
        for folder, _, names in os.walk(DST):
            for name in names:
                if name.lower().endswith(".webp"):
                    os.remove(os.path.join(folder, name))

    for folder in sorted(os.listdir(SRC)):
        source_dir = os.path.join(SRC, folder)
        if not os.path.isdir(source_dir) or folder.lower() == "excel":
            continue

        category = FOLDER_TO_CATEGORY.get(folder.lower())
        if not category:
            skipped.append(f"unknown folder '{folder}'")
            continue

        out_dir = os.path.join(DST, category)
        os.makedirs(out_dir, exist_ok=True)

        for filename in sorted(os.listdir(source_dir)):
            stem, ext = os.path.splitext(filename)
            if ext.lower() not in IMAGE_EXT:
                continue

            num, suffix = item_number(stem)
            if num is None:
                skipped.append(f"unreadable name '{folder}/{filename}'")
                continue

            source = os.path.join(source_dir, filename)

            with Image.open(source) as original:
                original = original.convert("RGB")
                for width in WIDTHS:
                    # Nothing to shrink: some masters are already narrower than
                    # a variant, and writing one anyway produces a byte-for-byte
                    # copy under a name that claims a width it does not have.
                    # The site reads what exists, so skipping is also what stops
                    # srcset advertising three sizes of the same file.
                    if width != FULL_WIDTH and original.width <= width:
                        continue

                    stem_out = f"{num}{suffix}" + ("" if width == FULL_WIDTH else f"-{width}")
                    target = os.path.join(out_dir, f"{stem_out}.webp")

                    im = original
                    if original.width > width:
                        height = round(original.height * width / original.width)
                        im = original.resize((width, height), Image.LANCZOS)
                    im.save(target, "WEBP", quality=QUALITY, method=6)

                    after += os.path.getsize(target)
                    if width == FULL_WIDTH:
                        full += os.path.getsize(target)

            before += os.path.getsize(source)
            count += 1

    print(f"{count} photos, {len(WIDTHS)} widths each")
    print(f"  {before / 1024 / 1024:6.1f} MB  ->  {after / 1024 / 1024:.1f} MB on disk"
          f"   ({100 - after * 100 // before}% lighter)")
    # What a visitor downloads is one width, not the set — and on a phone it is
    # the smallest. Disk is the wrong number to judge this by.
    print(f"  a phone loads the {WIDTHS[0]}px copy: "
          f"{sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(DST) for f in fs if f.endswith(f'-{WIDTHS[0]}.webp')) / count / 1024:.0f} KB "
          f"per photo, against {full / count / 1024:.0f} KB at {FULL_WIDTH}px")
    print(f"  written to assets/inventory-web/")

    for note in skipped:
        print(f"  ! skipped {note}")
    if not count:
        sys.exit("nothing produced — check assets/inventory/")


if __name__ == "__main__":
    main()
