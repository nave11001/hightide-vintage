"""Writes src/catalog-snapshot.json — the copy of the shop that ships with it.

    python scripts/make_catalog_snapshot.py

Run it after a drop. `npm run upload-drop` already does.

The site reads its catalogue live from Cloudflare D1, so a price or a sold mark
changes the moment it is set. That is worth keeping, but it means the database
being unreachable would take the whole shop down — which is exactly what
Supabase did in August 2026: restricted for exceeding its bandwidth allowance,
then auto-paused for inactivity, and finally gone from DNS altogether.

This is the answer to that. The site tries live first, falls back to whatever
the visitor saw last time, and falls back again to this file. A shop one deploy
out of date is still a shop.

Only what cannot be derived is stored. Descriptions, ids and display names are
rebuilt by the same code that builds the live catalogue, so the two cannot drift
apart. Photo paths are stored, not URLs, because the site decides for itself
where photos come from — see src/photos.ts.

RUN THIS AFTER EVERY CHANGE YOU MAKE IN THE DATABASE, not only after a drop.
The fallback is only worth having if it is current: when this file said a
garment was a 33 and the database said 26, a database outage would have put the
wrong size in front of a customer. `npm run make-snapshot` is the whole job.
"""

import json
import os
import sys
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "catalog-snapshot.json")

NOTE = ("Built by scripts/make_catalog_snapshot.py. The shop falls back to this "
        "when the database cannot be reached. Do not edit by hand.")


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


def main() -> None:
    load_env()
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    database = os.environ.get("CLOUDFLARE_D1_DATABASE_ID")
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not account or not database or not token:
        sys.exit("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / "
                 "CLOUDFLARE_API_TOKEN missing from .env.")

    def d1(sql):
        request = urllib.request.Request(
            "https://api.cloudflare.com/client/v4/accounts/"
            f"{account}/d1/database/{database}/query",
            data=json.dumps({"sql": sql}).encode("utf-8"),
            headers={"Authorization": f"Bearer {token}",
                     "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.load(response)
        if not body.get("success"):
            sys.exit("D1 refused: %s" % "; ".join(
                e.get("message", "") for e in body.get("errors", [])))
        return body["result"][0]["results"]

    rows = d1(
        "SELECT id, num, category, name, size, price, original_price, drop_date, "
        "sold, waist_cm, length_cm, views FROM items ORDER BY num ASC"
    )
    # Photos in a second query rather than a join: SQLite would repeat every
    # garment once per photograph, and this wants them nested.
    photos = d1(
        "SELECT item_id, path, position FROM item_photos ORDER BY item_id, position, path"
    )
    by_item = {}
    for photo in photos:
        by_item.setdefault(photo["item_id"], []).append(
            {"path": photo["path"], "position": photo["position"]})
    for row in rows:
        row["item_photos"] = by_item.get(row["id"], [])
        # SQLite has no boolean; the column is 0/1 and the writer below tests it.
        row["sold"] = bool(row["sold"])

    # The newest arrival date in the catalogue is what "latest drop" means.
    latest = max((r["drop_date"] for r in rows if r.get("drop_date")), default=None)

    items = []
    for row in rows:
        if not row.get("category"):
            continue  # uploaded but not yet filed into a category
        photos = sorted(row.get("item_photos") or [],
                        key=lambda p: (p["position"], p["path"]))
        if not photos:
            continue

        item = {
            "n": row["num"],
            "c": row["category"],
            "b": row["name"],
            "s": row["size"],
            "p": row["price"],
            "ph": [p["path"] for p in photos],
            "v": row.get("views") or 0,
        }
        if row.get("original_price"):
            item["o"] = row["original_price"]
        if row.get("sold"):
            item["sold"] = 1
        if latest and row.get("drop_date") == latest:
            item["new"] = 1
        if row.get("waist_cm") is not None:
            item["w"] = row["waist_cm"]
        if row.get("length_cm") is not None:
            item["l"] = row["length_cm"]
        items.append(item)

    # One item per line: a diff should show which garment changed, not one
    # unreadable line that changed.
    body = ",\n".join(json.dumps(i, ensure_ascii=False) for i in items)
    text = (f'{{"note":{json.dumps(NOTE)},'
            f'"generatedAt":"{date.today().isoformat()}","items":[\n{body}\n]}}\n')

    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)

    sold = sum(1 for i in items if i.get("sold"))
    print(f"{len(items)} items ({len(items) - sold} available, {sold} sold)"
          f" -> src/catalog-snapshot.json  ({len(text) // 1024}KB)")


if __name__ == "__main__":
    main()
