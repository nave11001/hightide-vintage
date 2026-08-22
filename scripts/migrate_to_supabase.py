# -*- coding: utf-8 -*-
"""One-time move of the Excel-era inventory into Supabase.

Reads the same two sources the site used to build from:
  - src/inventory_db.json   (name, size, price, drop date, sold)
  - assets/inventory/<folder>/*.jpeg  (the photos themselves)

and writes them to the `items` and `item_photos` tables plus the `inventory`
storage bucket. Photos keep their folder layout, so bordies/47.jpeg in the
repo becomes boardies/47.jpeg in the bucket.

Items whose folder has no category yet (all_clothes_79-128) are uploaded with
category = NULL. They sit in the database, invisible to the site, until you
give them a category in the Table Editor.

Safe to re-run: items that already exist are skipped, so a run that died
half way can simply be started again.

Setup:
  pip install supabase
  .env in the project root:
    SUPABASE_URL=https://xxxxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJhbGci...      <- service_role, never commit this

Usage:
  python scripts/migrate_to_supabase.py --dry-run
  python scripts/migrate_to_supabase.py
  python scripts/migrate_to_supabase.py --update-prices   # re-read prices only
"""
import io
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INV = os.path.join(ROOT, "assets", "inventory")
DB_JSON = os.path.join(ROOT, "src", "inventory_db.json")
BUCKET = "inventory"
IMAGE_EXT = (".jpeg", ".jpg", ".png", ".webp")

# Photos are compressed on the way up, never uploaded as they came off the
# camera.
#
# This is not housekeeping. Uploading originals — 517KB on average, some near
# 2MB — cost the shop its Supabase bandwidth allowance: 60MB of stored photos
# went out as 56GB in one month, eleven times the quota, and the project was
# restricted until it was paid for. A garment shown in a card 600px wide has no
# use for 3000px of detail.
#
# MAX_WIDTH is the widest the photo is ever displayed, doubled for retina
# screens, and it never upscales a smaller original.
MAX_WIDTH = 1200
QUALITY = 82
# A year. The photo for item #10 never changes, so a browser that has it should
# keep it. Supabase defaults to one hour, which means every returning customer
# downloads the whole shop again.
CACHE_CONTROL = "31536000"


def compress(path):
    """(bytes, mime, extension) ready to upload."""
    with Image.open(path) as im:
        im = im.convert("RGB")
        if im.width > MAX_WIDTH:
            height = round(im.height * MAX_WIDTH / im.width)
            im = im.resize((MAX_WIDTH, height), Image.LANCZOS)
        buffer = io.BytesIO()
        im.save(buffer, "WEBP", quality=QUALITY, method=6)
    return buffer.getvalue(), "image/webp", ".webp"

# Repo folder -> site category. None means "not sorted yet".
FOLDER_TO_CATEGORY = {
    "bordies": "boardies",
    "t-shirts": "shirts",
    "accessories": "accessories",
    "women": "women",
    "all_clothes_79-128": None,
}

DRY = "--dry-run" in sys.argv
# Re-read price / original_price from the sheets for items already uploaded.
# Without it an existing item is skipped entirely, so a sale added to the
# spreadsheet after the first run would never reach the site.
PRICES = "--update-prices" in sys.argv


def load_env():
    """Minimal .env reader — avoids a python-dotenv dependency."""
    path = os.path.join(ROOT, ".env")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def item_number(filename):
    """'47.jpeg' -> (47, ''), '47a.jpeg' -> (47, 'a'), '12 a.jpeg' -> (12, 'a')."""
    base = os.path.splitext(filename)[0].replace(" ", "").lower()
    m = re.match(r"^(\d+)([a-z]?)$", base)
    return (int(m.group(1)), m.group(2)) if m else (None, None)


# ── collect the photos, grouped the way the site groups them ────────────
def collect_photos():
    """{(category, num): [(suffix, abs_path, storage_path), ...]}"""
    groups = {}
    for folder in sorted(os.listdir(INV)):
        d = os.path.join(INV, folder)
        if not os.path.isdir(d):
            continue
        key = folder.lower()
        if key == "excel":
            continue  # the sheets themselves, not photos
        if key not in FOLDER_TO_CATEGORY:
            print(f"  ! skipping unknown folder '{folder}'")
            continue
        category = FOLDER_TO_CATEGORY[key]
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith(IMAGE_EXT):
                continue
            num, suffix = item_number(fn)
            if num is None:
                print(f"  ! skipping unrecognised filename '{folder}/{fn}'")
                continue
            # Always .webp: compress() re-encodes whatever came out of the
            # camera, and the bucket path has to name what actually lands there.
            storage_path = f"{category or 'unsorted'}/{num}{suffix}.webp"
            groups.setdefault((category, num), []).append(
                (suffix, os.path.join(d, fn), storage_path)
            )
    return groups


def load_metadata():
    """{num: row} from the Excel-synced json."""
    if not os.path.exists(DB_JSON):
        print("  ! src/inventory_db.json not found — items get default name/price")
        return {}
    with open(DB_JSON, encoding="utf-8") as fh:
        return {row["num"]: row for row in json.load(fh)}


def main():
    load_env()
    db = None
    if not DRY:
        # --dry-run needs no credentials, so you can check the plan first.
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY missing — see the docstring above.")
        try:
            from supabase import create_client
        except ImportError:
            sys.exit("supabase client missing. Run: pip install supabase")
        db = create_client(url, key)

    groups = collect_photos()
    meta = load_metadata()
    print(f"found {len(groups)} items in {sum(len(v) for v in groups.values())} photos")
    print(f"metadata rows: {len(meta)}{'  (dry run)' if DRY else ''}\n")

    # Skip anything already migrated so a half-finished run can be resumed.
    existing = {}
    if not DRY:
        for row in db.table("items").select("id, category, num").execute().data:
            existing[(row["category"], row["num"])] = row["id"]
        if existing:
            verb = "re-priced from the sheet" if PRICES else "skipped"
            print(f"{len(existing)} items already in the database — they will be {verb}\n")

    created = uploaded = skipped = repriced = 0
    on_sale = []

    for (category, num) in sorted(groups, key=lambda k: (k[0] or "zz", k[1])):
        photos = sorted(groups[(category, num)], key=lambda p: p[0])  # '' first, then a, b…
        label = f"{category or 'unsorted'} #{num}"

        if (category, num) in existing and not PRICES:
            skipped += 1
            continue

        row = meta.get(num, {})
        # An Excel row only counts if its sheet covered this category.
        if category and category not in row.get("categories", []):
            row = {}

        item = {
            "num": num,
            "category": category,
            "name": row.get("name") or "HIGHTIDE",
            "size": row.get("size") or "ONE SIZE",
            "price": row.get("price") or 150,
            # Set only for items on sale — the shop strikes it through
            # beside the live price and shows the SALE stamp.
            "original_price": row.get("original_price"),
            "drop_date": row.get("date"),
            "sold": bool(row.get("sold", False)),
        }

        # Flagged SALE in the sheet but with no "מחיר לפני" filled in: the
        # item uploads at its normal price and shows no discount at all.
        if row.get("sale") and not row.get("original_price"):
            on_sale.append(f"#{num}")

        sale_note = ""
        if item["original_price"]:
            sale_note = f"  SALE {item['original_price']}₪ -> {item['price']}₪"
        elif row.get("sale"):
            sale_note = "  SALE (no old price)"
        print(f"{label:<22} {item['name']:<16} size {item['size']:<5} "
              f"{item['price']:>4}₪  {len(photos)} photo(s)"
              f"{'  SOLD' if item['sold'] else ''}{sale_note}")

        if DRY:
            created += 1
            uploaded += len(photos)
            continue

        # --update-prices touches only the two money columns, so anything you
        # changed in the Table Editor (sold, name, size…) is left alone.
        if (category, num) in existing:
            db.table("items").update(
                {"price": item["price"], "original_price": item["original_price"]}
            ).eq("id", existing[(category, num)]).execute()
            repriced += 1
            continue

        item_id = db.table("items").insert(item).execute().data[0]["id"]
        created += 1

        for position, (_suffix, local_path, storage_path) in enumerate(photos):
            content, mime, _ext = compress(local_path)
            db.storage.from_(BUCKET).upload(
                storage_path, content,
                {
                    "content-type": mime,
                    "upsert": "true",
                    "cache-control": CACHE_CONTROL,
                },
            )
            db.table("item_photos").insert(
                {"item_id": item_id, "path": storage_path, "position": position}
            ).execute()
            uploaded += 1

    print(f"\n{'[dry-run] would create' if DRY else 'created'} {created} items, "
          f"{uploaded} photos"
          + (f", skipped {skipped} already present" if skipped else "")
          + (f", re-priced {repriced} existing" if repriced else ""))

    unsorted = sum(1 for (c, _) in groups if c is None)
    if unsorted:
        print(f"\n{unsorted} items have no category and are hidden from the site.")
        print("Assign them in the Table Editor: items -> category column.")

    if on_sale:
        print(f"\n{len(on_sale)} items are flagged SALE but have no old price:")
        print("  " + " ".join(on_sale))
        print("They uploaded at their normal price and show no discount.")
        print("Add a 'מחיר לפני' column to the sheet and re-run, or fill")
        print("original_price in the Table Editor.")


if __name__ == "__main__":
    main()
