# -*- coding: utf-8 -*-
"""Did the rebuilt snapshot change in a way a customer would notice?

    python scripts/snapshot_matters.py              # committed vs working copy
    python scripts/snapshot_matters.py OLD NEW      # two files, for testing

Exits 0 when it did and the file should be committed, 1 when it did not.

Why this exists
---------------
The sync job rebuilds src/catalog-snapshot.json every six hours and commits it
whenever the file differs, and every commit is a Netlify build. The file almost
always differs: it carries each garment's view count, which is a rolling
thirty-day figure that moves by one or two every run. In the first thirteen days
of September that was 44 builds, nearly all of them for nothing.

So two fields are ignored when deciding:

  v            view counts. The fallback uses them only to order the Most
               Wanted rail, and a rail ordered by last week's numbers is fine.
  generatedAt  the date. It changes at midnight whether anything else did or not.

Everything else — sold, size, price, sale price, photos, a garment arriving or
leaving — is what the fallback exists to get right, and any change to it commits
as before. When it does, the view counts ride along and catch up too.

If either file cannot be read or parsed this says "commit": a wasted build is
cheap, and a fallback that silently stops updating is the failure this whole
arrangement is there to prevent.
"""
import io
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAPSHOT = "src/catalog-snapshot.json"
IGNORED_ITEM_FIELDS = ("v",)


def meaningful(snapshot):
    """The parts of a snapshot a customer would notice, in comparable form."""
    items = []
    for item in snapshot.get("items") or []:
        items.append({k: v for k, v in item.items() if k not in IGNORED_ITEM_FIELDS})
    return sorted(items, key=lambda i: (str(i.get("c")), i.get("n") or 0))


def read_committed():
    out = subprocess.run(
        ["git", "show", "HEAD:%s" % SNAPSHOT],
        cwd=ROOT, capture_output=True, check=True,
    ).stdout
    return json.loads(out.decode("utf-8"))


def read_file(path):
    with io.open(path, encoding="utf-8") as fh:
        return json.load(fh)


def main(argv):
    try:
        if len(argv) == 2:
            old, new = read_file(argv[0]), read_file(argv[1])
        else:
            old, new = read_committed(), read_file(os.path.join(ROOT, SNAPSHOT))
    except Exception as err:
        print("could not compare (%s) — committing to be safe" % type(err).__name__)
        return 0

    before, after = meaningful(old), meaningful(new)
    if before == after:
        print("only view counts or the date moved — no commit, no build")
        return 1

    # Name what changed, so the job log says why a build happened.
    key = lambda i: (i.get("c"), i.get("n"))
    was = {key(i): i for i in before}
    now = {key(i): i for i in after}
    for k in sorted(set(was) | set(now), key=lambda k: (str(k[0]), k[1] or 0)):
        if k not in was:
            print("  + %s #%s arrived" % k)
        elif k not in now:
            print("  - %s #%s left" % k)
        elif was[k] != now[k]:
            fields = sorted(f for f in set(was[k]) | set(now[k])
                            if was[k].get(f) != now[k].get(f))
            print("  ~ %s #%s  %s" % (k[0], k[1], ", ".join(fields)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
