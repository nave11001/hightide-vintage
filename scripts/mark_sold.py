# -*- coding: utf-8 -*-
"""Mark garments sold in the catalogue that ships with the site.

Why this exists
---------------
Sold status lives in Supabase, and the shop reads it from there on every visit.
While the project is restricted (402, exceed_cached_egress_quota) the shop
cannot read anything from Supabase at all, so it serves src/catalog-snapshot.json
— the copy taken at build time. Marking an item sold in the Supabase dashboard
is therefore correct and invisible: the dashboard writes to a database the shop
is not allowed to read.

This writes the same fact into the snapshot, so the shop stops offering a
garment that is gone. Deploy after running it.

Temporary by construction. When the quota resets on 2 September, the shop reads
Supabase again and `python scripts/make_catalog_snapshot.py` rebuilds this file
from it — so whatever is set here is simply replaced by the truth. Nothing to
undo.

Usage:
  python scripts/mark_sold.py 63
  python scripts/mark_sold.py 63 70 92
  python scripts/mark_sold.py --unsold 63      # put one back
  python scripts/mark_sold.py --list           # what the site still offers
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAPSHOT = os.path.join(ROOT, "src", "catalog-snapshot.json")


def load():
    with io.open(SNAPSHOT, encoding="utf-8") as fh:
        return json.load(fh)


def save(data):
    # Byte-for-byte the layout make_catalog_snapshot.py writes: one garment per
    # line, so a diff shows which garment changed rather than one unreadable
    # line that changed. `note` and `generatedAt` are carried through untouched
    # — this patches a snapshot, it does not claim to have rebuilt one.
    body = ",\n".join(
        json.dumps(i, ensure_ascii=False, separators=(",", ":")) for i in data["items"]
    )
    text = (
        '{"note":%s,"generatedAt":"%s","items":[\n%s\n]}\n'
        % (json.dumps(data["note"], ensure_ascii=False), data["generatedAt"], body)
    )
    with io.open(SNAPSHOT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def describe(item):
    # ASCII only: this prints to a Windows console that mangles Hebrew and the
    # shekel sign, and a report you cannot read is not a report.
    mark = "SOLD" if item.get("sold") == 1 else "in stock"
    return "#{n:<5} {b:<24} {s:<10} {p:<5} {mark}".format(
        n=item["n"], b=item["b"], s=item["s"], p=item["p"], mark=mark
    )


def main(argv):
    data = load()
    items = data.get("items", [])

    if "--list" in argv:
        for item in items:
            if item.get("sold") != 1:
                print(describe(item))
        print("\n{} garments still offered.".format(
            sum(1 for i in items if i.get("sold") != 1)))
        return 0

    unsold = "--unsold" in argv
    numbers = []
    for arg in argv:
        if arg.startswith("-"):
            continue
        if not arg.isdigit():
            sys.exit("Not an item number: {}".format(arg))
        numbers.append(int(arg))

    if not numbers:
        sys.exit(__doc__)

    by_num = {item["n"]: item for item in items}
    missing = [n for n in numbers if n not in by_num]
    if missing:
        sys.exit("Not in the catalogue: {}".format(
            ", ".join("#" + str(n) for n in missing)))

    changed = []
    for n in numbers:
        item = by_num[n]
        was = item.get("sold") == 1
        now = not unsold
        if was == now:
            print("unchanged  " + describe(item))
            continue
        if now:
            item["sold"] = 1
        else:
            item.pop("sold", None)
        changed.append(item)
        print("updated    " + describe(item))

    if not changed:
        print("\nNothing to write.")
        return 0

    save(data)
    print("\n{} updated in src/catalog-snapshot.json.".format(len(changed)))
    print("Commit and deploy for the shop to show it.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
