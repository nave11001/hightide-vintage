# -*- coding: utf-8 -*-
"""Scheduled inventory reset — runs on the 1st and the 15th of every month.

Everything marked sold is written to assets/inventory/excel/sold_log.csv (the
permanent sales record, committed to the repo), then removed from D1: the item
row and its item_photos rows. The photograph files themselves are listed rather
than deleted: they live in this repository now, not in a bucket, and a
scheduled job that removes a shop's photographs on its own is one bad query
away from being unrecoverable. Delete them by hand once the reset looks right.

The sales history is never lost — only the listing is.

Setup (same .env as the migration script):
  CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN

Usage:
  python scripts/reset_inventory.py --dry-run
  python scripts/reset_inventory.py
  python scripts/reset_inventory.py --keep-sale   # leave sold sale items up

--keep-sale spares anything with an original_price. A sale that still shows the
pieces that went is a sale that looks like it is working, so there is a reason
to hold them back for a round; the scheduled job does not pass it, and takes
them on its next run.
"""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import d1
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOLD_LOG = os.path.join(ROOT, "assets", "inventory", "excel", "sold_log.csv")
FIELDS = ["removed_on", "num", "category", "name", "size", "price", "sold_at"]

DRY = "--dry-run" in sys.argv
KEEP_SALE = "--keep-sale" in sys.argv


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


def append_to_log(rows):
    os.makedirs(os.path.dirname(SOLD_LOG), exist_ok=True)
    is_new = not os.path.exists(SOLD_LOG)
    with open(SOLD_LOG, "a", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDS)
        if is_new:
            writer.writeheader()
        writer.writerows(rows)


def main():
    load_env()
    d1.credentials()

    where = "sold = 1"
    if KEEP_SALE:
        where += " AND original_price IS NULL"
    sold = d1.query(
        "SELECT id, num, category, name, size, price, sold_at FROM items "
        "WHERE %s ORDER BY num" % where
    )
    photos_by_item = {}
    for photo in d1.query("SELECT item_id, path FROM item_photos"):
        photos_by_item.setdefault(photo["item_id"], []).append(photo["path"])
    for row in sold:
        row["item_photos"] = [{"path": p} for p in photos_by_item.get(row["id"], [])]

    if KEEP_SALE:
        spared = d1.query("SELECT COUNT(*) AS c FROM items "
                          "WHERE sold = 1 AND original_price IS NOT NULL")[0]["c"]
        print("--keep-sale: %d sold sale item(s) stay up\n" % spared)

    if not sold:
        print("nothing to remove — inventory unchanged")
        return

    today = date.today().isoformat()
    print(f"{len(sold)} sold item(s){' (dry run)' if DRY else ''}:\n")

    log_rows, photo_paths, item_ids = [], [], []
    for row in sold:
        paths = [p["path"] for p in row.get("item_photos", [])]
        print(f"  #{row['num']:<4} {row['name']:<18} {row['category'] or '-':<12} "
              f"size {row['size']:<5} {row['price']:>4}  {len(paths)} photo(s)")
        log_rows.append({
            "removed_on": today,
            "num": row["num"],
            "category": row["category"] or "",
            "name": row["name"],
            "size": row["size"],
            "price": row["price"],
            "sold_at": (row.get("sold_at") or "")[:10],
        })
        photo_paths.extend(paths)
        item_ids.append(row["id"])

    if DRY:
        print(f"\n[dry-run] would log {len(log_rows)} sales and remove "
              f"{len(item_ids)} items with {len(photo_paths)} photo row(s)")
        return

    # Record the sale first — if anything below fails, the history still exists.
    append_to_log(log_rows)
    print(f"\nlogged {len(log_rows)} sales to {os.path.relpath(SOLD_LOG, ROOT)}")

    # item_photos has ON DELETE CASCADE, but delete it explicitly: the count
    # comes back, so the run says how many rows actually went rather than
    # trusting a constraint to have been enforced.
    marks = ",".join("?" * len(item_ids))
    gone_photos = d1.execute(
        f"DELETE FROM item_photos WHERE item_id IN ({marks})", item_ids)
    gone_items = d1.execute(f"DELETE FROM items WHERE id IN ({marks})", item_ids)
    print(f"removed {gone_items} items and {gone_photos} photo rows from the catalogue")

    remaining = d1.query("SELECT COUNT(*) AS c FROM items")[0]["c"]
    print(f"\n{remaining} items remain in stock")

    # The files themselves stay. They are under assets/inventory/, they are the
    # only copies there are, and this job is not the thing that should decide a
    # photograph is finished with.
    if photo_paths:
        print(f"\n{len(photo_paths)} photo file(s) are now unreferenced. They are "
              f"NOT deleted — remove them by hand if you want the space:")
        for path in photo_paths:
            print(f"  {path}")


if __name__ == "__main__":
    main()
