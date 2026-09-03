# -*- coding: utf-8 -*-
"""Copy PostHog's product_view counts into items.views.

The shop cannot read PostHog directly — that needs a personal API key, which is
a real secret and must never reach a browser. So this runs on a schedule,
server side, and leaves the numbers in Supabase where the site already looks.

Ranking is by *distinct people*, not raw events. One shopper refreshing an item
five times says the same thing as one shopper looking once, and raw counts would
let a single visitor decide the front page.

Setup (.env locally, GitHub secrets in CI):
  POSTHOG_PERSONAL_API_KEY=phx_...      <- Query Read scope, never commit
  CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN

Usage:
  python scripts/sync_top_wanted.py --dry-run
  python scripts/sync_top_wanted.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import d1
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTHOG_HOST = "https://us.posthog.com"
PROJECT_ID = 527381
WINDOW_DAYS = 30      # what the shop is wanted *now*, not what it ever was

DRY = "--dry-run" in sys.argv


def load_env():
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def posthog_counts(api_key):
    """{(category, num): people} from product_view events."""
    sql = f"""
        select properties.product_id as item, count(distinct person_id) as people
        from events
        where event = 'product_view'
          and timestamp > now() - interval {WINDOW_DAYS} day
          and properties.product_id is not null
        group by item
    """
    body = json.dumps({"query": {"kind": "HogQLQuery", "query": sql}}).encode()
    req = urllib.request.Request(
        f"{POSTHOG_HOST}/api/projects/{PROJECT_ID}/query/",
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        rows = json.load(r)["results"]

    counts = {}
    for item, people in rows:
        # Product ids are '<category>-<num>' — anything else is not ours.
        category, _, num = str(item).rpartition("-")
        if category and num.isdigit():
            counts[(category, int(num))] = int(people)
    return counts


def main():
    load_env()
    api_key = os.environ.get("POSTHOG_PERSONAL_API_KEY")
    if not api_key:
        sys.exit("POSTHOG_PERSONAL_API_KEY missing — see the docstring above.")

    # d1.credentials() exits with the names of anything missing.
    d1.credentials()

    counts = posthog_counts(api_key)
    print(f"PostHog: {len(counts)} items viewed in the last {WINDOW_DAYS} days")

    items = d1.query("SELECT id, category, num, views, sold FROM items")
    print(f"D1: {len(items)} items in stock")
    print()

    changed = 0
    for row in sorted(items, key=lambda r: -counts.get((r["category"], r["num"]), 0)):
        people = counts.get((row["category"], row["num"]), 0)
        if people == (row["views"] or 0):
            continue
        mark = "  SOLD" if row["sold"] else ""
        print(f"  {row['category']}-{row['num']:<5} {row['views'] or 0:>4} -> {people:<4}{mark}")
        if not DRY:
            d1.execute("UPDATE items SET views = ? WHERE id = ?", [people, row["id"]])
        changed += 1

    verb = "[dry-run] would update" if DRY else "updated"
    print(f"\n{verb} {changed} items")

    # Anything PostHog knows about that the shop no longer stocks — sold and
    # cleared by the scheduled reset. Not an error, just worth seeing.
    stocked = {(r["category"], r["num"]) for r in items}
    gone = [k for k in counts if k not in stocked]
    if gone:
        print(f"{len(gone)} viewed items are no longer in stock (sold and cleared)")


if __name__ == "__main__":
    main()
