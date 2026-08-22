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
# The widest the photo is ever shown, doubled for sharp screens.
MAX_WIDTH = 1200
QUALITY = 82


def item_number(stem):
    """('104 ', '') or ('92', 'a') from a filename stem, or (None, None)."""
    m = re.match(r"^(\d+)\s*([a-z]?)\s*$", stem.strip(), re.I)
    return (int(m.group(1)), m.group(2).lower()) if m else (None, None)


def main() -> None:
    before = after = count = 0
    skipped = []

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
            target = os.path.join(out_dir, f"{num}{suffix}.webp")

            with Image.open(source) as im:
                im = im.convert("RGB")
                if im.width > MAX_WIDTH:
                    height = round(im.height * MAX_WIDTH / im.width)
                    im = im.resize((MAX_WIDTH, height), Image.LANCZOS)
                im.save(target, "WEBP", quality=QUALITY, method=6)

            before += os.path.getsize(source)
            after += os.path.getsize(target)
            count += 1

    print(f"{count} photos")
    print(f"  {before / 1024 / 1024:6.1f} MB  ->  {after / 1024 / 1024:.1f} MB"
          f"   ({100 - after * 100 // before}% lighter)")
    print(f"  written to assets/inventory-web/")

    for note in skipped:
        print(f"  ! skipped {note}")
    if not count:
        sys.exit("nothing produced — check assets/inventory/")


if __name__ == "__main__":
    main()
