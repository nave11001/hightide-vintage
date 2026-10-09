# -*- coding: utf-8 -*-
"""Put the garments from the Excel sheets into Cloudflare D1.

    python scripts/upload_drop.py --dry-run    # say what would happen
    python scripts/upload_drop.py              # do it, from the Excel sheets

    python scripts/upload_drop.py --from-photos [--dry-run]
        every photographed garment with no row yet goes in as a bare number,
        hidden from the shop, to be filled in by hand in Cloudflare
    python scripts/upload_drop.py --publish [--dry-run]
        gives every hidden garment its category — read from the folder its
        photograph is in — and so puts it in the shop

`npm run upload-drop` runs this in the middle of the chain, after
sync_inventory.py has rebuilt src/inventory_db.json from the sheets and before
make_catalog_snapshot.py rebuilds the shipped copy from the database.

Why this exists
---------------
This step was scripts/migrate_to_supabase.py, and it went with Supabase. What
was left behind was a circle with no way in: the only thing that could write to
the database was `d1_setup.py --load`, which reads src/catalog-snapshot.json —
and that file is itself built *from* the database. So everything a new drop
needed still worked, except the part that puts it in the shop: the photographs
compressed, the sitemap built, the link previews rendered, and the garments
never appeared. `npm run upload-drop` did not even reach those steps; it
stopped at the second one, on a file that is not in the project any more.

What it does
------------
Reads the sheets (through src/inventory_db.json) and the photograph folders,
and writes items and item_photos. Nothing else: the pictures are compressed by
make_inventory_web.py and the fallback is rebuilt by make_catalog_snapshot.py.

Which category a garment belongs to is decided by the folder its photographs
are in, not by the sheet. A sheet named רשימת_מכנסיים covers boardies *and*
women — the numbers do not collide between them — so the sheet narrows the
candidates and the folder settles it. A garment with no photograph is skipped
and named at the end: the shop has nothing to show for it.

Safe to re-run. Items are keyed on (category, num) and updated rather than
duplicated, and the fields a person sets in the database by hand — the sold
mark, the view count, the drop date once it has one — are left alone. It never
deletes: a garment removed from a sheet stays in the shop until the scheduled
reset or scripts/remove_items.py takes it out, which is where that decision
belongs.
"""
import argparse
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import d1

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INVENTORY = os.path.join(ROOT, "assets", "inventory")
DB_JSON = os.path.join(ROOT, "src", "inventory_db.json")

# Folder on disk -> the category the database uses. The same mapping as
# scripts/make_inventory_web.py; the two must agree or a photograph is
# compressed under one name and recorded under another.
FOLDER_TO_CATEGORY = {
    "bordies": "boardies",
    "t-shirts": "shirts",
    "women": "women",
    "accessories": "accessories",
}
IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp")


def item_number(stem):
    """('104 ', '') or ('92', 'a') from a filename stem, or (None, None)."""
    match = re.match(r"^(\d+)\s*([a-z]?)\s*$", stem.strip(), re.I)
    return (int(match.group(1)), match.group(2).lower()) if match else (None, None)


def photographs():
    """{(category, num): ['boardies/104 .jpg', ...]} straight off the disk.

    The stored path keeps the original extension and drops the stray spaces
    local filenames collect, which is the form already in the database:
    `boardies/104.jpg`, and `shirts/30a.jpeg` for a second angle. src/photos.ts
    turns that into the compressed file the site actually serves.
    """
    found = {}
    for folder in sorted(os.listdir(INVENTORY)):
        path = os.path.join(INVENTORY, folder)
        if not os.path.isdir(path) or folder.lower() == "excel":
            continue
        category = FOLDER_TO_CATEGORY.get(folder.lower())
        if not category:
            continue
        for name in sorted(os.listdir(path)):
            stem, ext = os.path.splitext(name)
            if ext.lower() not in IMAGE_EXT:
                continue
            num, letter = item_number(stem)
            if num is None:
                continue
            # Sorted by the letter, so the plain number comes first and is
            # position 0 — the shot the card shows.
            found.setdefault((category, num), []).append(
                (letter, "%s/%d%s%s" % (category, num, letter, ext.lower()))
            )
    return {key: [path for _, path in sorted(angles)] for key, angles in found.items()}


def from_photos(dry_run, only=None):
    """Bare rows for every photographed garment the database does not know.

    A number, its photographs, and nothing else. The category is left empty on
    purpose, and that is what keeps the row off the shop: the catalogue is read
    with WHERE category IS NOT NULL, and the fallback copy skips a row with no
    category the same way. The name, size and price columns cannot be empty, so
    they carry their defaults — HIGHTIDE, ONE SIZE, 150 — until they are typed
    over. With a category set they would be on the live shop at those values
    the moment the row was written.

    Which folder a garment belongs to is not lost by leaving the category out:
    it is the first part of the photograph's path, which is written here too,
    and --publish reads it from there.

    Re-running is safe, and it has to be checked rather than assumed: the table
    is UNIQUE on (category, num), and SQLite counts two empty categories as
    different, so a second run would happily add the same garment again.
    Matching on the photograph's path is what stops that.
    """
    photos = photographs()
    known_paths = {row["path"] for row in d1.query("SELECT path FROM item_photos")}
    shop = {(row["category"], row["num"]) for row in d1.query(
        "SELECT category, num FROM items WHERE category IS NOT NULL")}

    todo, already = [], 0
    for (category, num), paths in sorted(photos.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        # --only 140-147: nothing outside the range is looked at. Without it a
        # garment whose row was deleted on purpose — a duplicate, say — but
        # whose photographs are still in the folder would be put straight back.
        if only and not (only[0] <= num <= only[1]):
            continue
        if (category, num) in shop or any(path in known_paths for path in paths):
            already += 1
            continue
        todo.append((category, num, paths))

    for category in sorted({c for c, _, _ in todo}):
        nums = [n for c, n, _ in todo if c == category]
        print("  %-12s %3d garments: %s" % (category, len(nums), nums))
    print("%s%d garments to add, hidden; %d already in the database"
          % ("would be: " if dry_run else "", len(todo), already))
    if dry_run:
        return 0

    for category, num, paths in todo:
        # RETURNING, because the id is needed to attach the photographs and
        # there is no category to look the row up by.
        item_id = d1.query("INSERT INTO items (num) VALUES (?) RETURNING id", [num])[0]["id"]
        for position, path in enumerate(paths):
            d1.execute("INSERT INTO item_photos (item_id, path, position) VALUES (?,?,?)",
                       [item_id, path, position])
    print("added. They are not in the shop until --publish.")
    return 0


def publish(dry_run):
    """File every hidden garment under the folder its photograph came from."""
    rows = d1.query(
        "SELECT i.id, i.num, i.name, i.size, i.price, "
        "(SELECT path FROM item_photos p WHERE p.item_id = i.id ORDER BY position LIMIT 1) AS path "
        "FROM items i WHERE i.category IS NULL ORDER BY i.num")
    taken = {(row["category"], row["num"]) for row in d1.query(
        "SELECT category, num FROM items WHERE category IS NOT NULL")}

    go, stuck = [], []
    for row in rows:
        category = (row["path"] or "").split("/")[0]
        if category not in FOLDER_TO_CATEGORY.values():
            stuck.append("#%s — no photograph to read a category from" % row["num"])
        elif (category, row["num"]) in taken:
            stuck.append("#%s — %s #%s is already in the shop" % (row["num"], category, row["num"]))
        else:
            go.append((row, category))

    # The defaults still on a row are the sign it has not been filled in.
    # Not a reason to refuse — the owner may want a garment at 150 — but worth
    # saying, because publishing it puts those values in front of customers.
    unfilled = [r["num"] for r, _ in go
                if r["name"] == "HIGHTIDE" or r["size"] == "ONE SIZE" or r["price"] == 150]
    print("%s%d garments to put in the shop" % ("would be: " if dry_run else "", len(go)))
    if unfilled:
        print("  of them still carrying a default name, size or price of 150: %d" % len(unfilled))
        print("   %s" % unfilled)
    for line in stuck:
        print("  ! skipped: %s" % line)
    if dry_run:
        return 0

    for row, category in go:
        d1.execute("UPDATE items SET category = ? WHERE id = ?", [category, row["id"]])
    print("done. Run make_catalog_snapshot.py, and deploy so the photographs ship.")
    return 0


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                        help="print what would be written and change nothing")
    parser.add_argument("--from-photos", action="store_true",
                        help="add every photographed garment as a hidden, bare row")
    parser.add_argument("--only", metavar="A-B",
                        help="with --from-photos: only the garments numbered A to B")
    parser.add_argument("--publish", action="store_true",
                        help="put every hidden garment in the shop, by its photograph's folder")
    args = parser.parse_args(argv)

    only = None
    if args.only:
        match = re.match(r"^(\d+)-(\d+)$", args.only.strip())
        if not match:
            sys.exit("--only wants a range like 140-147")
        only = (int(match.group(1)), int(match.group(2)))

    if args.from_photos:
        return from_photos(args.dry_run, only)
    if args.publish:
        return publish(args.dry_run)

    if not os.path.exists(DB_JSON):
        sys.exit("src/inventory_db.json is missing — run scripts/sync_inventory.py first")
    sheets = json.load(io.open(DB_JSON, encoding="utf-8"))
    photos = photographs()

    existing = {(row["category"], row["num"]): row["id"]
                for row in d1.query("SELECT id, category, num FROM items")}

    added, updated, skipped = [], [], []

    for row in sheets:
        num = row["num"]
        # The sheet says which categories it could be; the photographs say
        # which one it is. A garment photographed in two folders under the same
        # number is two garments, and is treated as two.
        wheres = [category for category in row.get("categories", [])
                  if (category, num) in photos]
        if not wheres:
            skipped.append("#%s %s — no photograph in %s"
                           % (num, row.get("name") or "", "/".join(row.get("categories", [])) or "any folder"))
            continue

        for category in wheres:
            key = (category, num)
            is_new = key not in existing
            (added if is_new else updated).append("%s #%s %s" % (category, num, row.get("name") or ""))
            if args.dry_run:
                continue

            d1.execute(
                "INSERT INTO items (num, category, name, size, price, original_price, drop_date) "
                "VALUES (?,?,?,?,?,?,?) "
                "ON CONFLICT (category, num) DO UPDATE SET "
                "name = excluded.name, size = excluded.size, price = excluded.price, "
                "original_price = excluded.original_price, "
                # Only ever fill a blank. The date in a sheet is the date the
                # row was typed; once the database holds a real one it is the
                # one the NEW badge is drawn from, and a re-run must not move it.
                "drop_date = COALESCE(items.drop_date, excluded.drop_date)",
                [num, category, row.get("name") or "HIGHTIDE", row.get("size") or "ONE SIZE",
                 row.get("price") or 150, row.get("original_price"), row.get("date")],
            )
            item_id = d1.query(
                "SELECT id FROM items WHERE category = ? AND num = ?", [category, num]
            )[0]["id"]
            for position, path in enumerate(photos[key]):
                d1.execute(
                    "INSERT INTO item_photos (item_id, path, position) VALUES (?,?,?) "
                    "ON CONFLICT (item_id, path) DO UPDATE SET position = excluded.position",
                    [item_id, path, position],
                )

    print("%s%d new, %d updated, %d skipped"
          % ("would be: " if args.dry_run else "", len(added), len(updated), len(skipped)))
    for line in added:
        print("  + %s" % line)
    if skipped:
        print("\nnot uploaded — a garment with no photograph has nothing to show:")
        for line in skipped:
            print("  ! %s" % line)

    # Photographs with no row in any sheet. Not an error and not deleted: this
    # is what a batch that has been shot but not yet typed up looks like, and
    # saying so is the whole reason it does not sit unnoticed for a month.
    typed = {(category, row["num"])
             for row in sheets for category in row.get("categories", [])}
    unlisted = sorted(key for key in photos if key not in typed and key not in existing)
    if unlisted:
        print("\nphotographed but in no sheet, so not in the shop:")
        for category in sorted({c for c, _ in unlisted}):
            nums = [n for c, n in unlisted if c == category]
            print("  %-12s %d garments: %s" % (category, len(nums), nums))

    if not args.dry_run and (added or updated):
        print("\nnow: python scripts/make_inventory_web.py && python scripts/make_catalog_snapshot.py")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
