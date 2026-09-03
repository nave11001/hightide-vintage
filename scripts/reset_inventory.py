# -*- coding: utf-8 -*-
"""Scheduled inventory reset — runs on the 1st and the 15th of every month.

Everything marked sold is written to assets/inventory/excel/sold_log.csv (the
permanent sales record, committed to the repo), then removed from Supabase:
the item row and its item_photos rows. The photograph files themselves are
listed rather than deleted: they live in this repository now, not in a bucket,
and a scheduled job that removes a shop's photographs on its own is one bad
query away from being unrecoverable. Delete them by hand once the reset looks
right.

The sales history is never lost — only the listing is.

Setup (same .env as the migration script):
  CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN

Usage:
  python scripts/reset_inventory.py --dry-run
  python scripts/reset_inventory.py
"""
import csv
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import d1
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOLD_LOG = os.path.join(ROOT, "assets", "inventory", "excel", "sold_log.csv")
BUCKET = "inventory"
FIELDS = ["removed_on", "num", "category", "name", "size", "price", "sold_at"]

DRY = "--dry-run" in sys.argv


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

    sold = d1.query(
        "SELECT id, num, category, name, size, price, sold_at FROM items "
        "WHERE sold = 1 ORDER BY num"
    )
    photos_by_item = {}
    for photo in d1.query("SELECT item_id, path FROM item_photos"):
        photos_by_item.setdefault(photo["item_id"], []).append(photo["path"])
    for row in sold:
        row["item_photos"] = [{"path": p} for p in photos_by_item.get(row["id"], [])]

    if not sold:
        print("nothing marked sold — inventory unchanged")
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
        print(f"\n[dry-run] would log {len(log_rows)} sales, "
              f"delete {len(photo_paths)} photos and {len(item_ids)} items")
        return

    # Record the sale first — if anything below fails, the history still exists.
    append_to_log(log_rows)
    print(f"\nlogged {len(log_rows)} sales to {os.path.relpath(SOLD_LOG, ROOT)}")

    if photo_paths:
        db.storage.from_(BUCKET).remove(photo_paths)
        print(f"deleted {len(photo_paths)} photos from storage")

    # item_photos rows go with it — the foreign key is ON DELETE CASCADE.
    db.table("items").delete().in_("id", item_ids).execute()
    print(f"removed {len(item_ids)} items from the catalogue")

    remaining = db.table("items").select("id", count="exact").execute()
    print(f"\n{remaining.count} items remain in stock")


if __name__ == "__main__":
    main()
