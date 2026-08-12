# -*- coding: utf-8 -*-
"""Put the shot that shows the garment laid open at position 0.

Which file got the plain number and which got the 'a' suffix was never
consistent — some items were photographed open first, some folded first. The
shop always leads with position 0, so half the grid showed a rolled-up bundle.

A garment laid open is wide relative to its height; folded or hanging it is
narrow and tall. Measuring the garment's own bounding box, ignoring the white
surround, separates the two cleanly.

  python scripts/order_open_shot_first.py --dry-run
  python scripts/order_open_shot_first.py
"""
import io
import os
import sys
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUCKET = "inventory"
WHITE_CUTOFF = 244
# Below this the two shots are too similar to call, so the existing order wins.
MIN_RATIO_GAP = 0.12

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


def openness(url):
    """Width / height of the garment itself. Higher means more spread out."""
    raw = urllib.request.urlopen(url, timeout=45).read()
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    mask = im.convert("L").point(lambda p: 255 if p < WHITE_CUTOFF else 0)
    box = mask.getbbox()
    if not box:                       # no white surround to measure against
        return im.width / im.height
    left, top, right, bottom = box
    return (right - left) / max(1, bottom - top)


def main():
    load_env()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY missing.")

    from supabase import create_client

    db = create_client(url, key)
    rows = db.table("items").select(
        "id, num, category, item_photos(id, path, position)"
    ).execute().data

    swapped = kept = 0
    for row in sorted(rows, key=lambda r: (r["category"] or "", r["num"])):
        photos = sorted(row["item_photos"], key=lambda p: p["position"])
        if len(photos) < 2:
            continue

        scores = []
        for p in photos:
            public = f"{url}/storage/v1/object/public/{BUCKET}/{p['path']}"
            try:
                scores.append((openness(public), p))
            except Exception as e:
                print(f"  ! {p['path']}: {str(e)[:50]}")

        if len(scores) < 2:
            continue

        scores.sort(key=lambda s: -s[0])
        widest, runner_up = scores[0], scores[1]
        label = f"{row['category']}-{row['num']}"

        if widest[1]["position"] == 0:
            kept += 1
            continue
        if widest[0] - runner_up[0] < MIN_RATIO_GAP:
            print(f"  {label:<16} too close to call ({widest[0]:.2f} vs {runner_up[0]:.2f}) — left as is")
            kept += 1
            continue

        print(f"  {label:<16} {widest[1]['path'].split('/')[-1]} "
              f"({widest[0]:.2f}) moves to front, was {runner_up[1]['path'].split('/')[-1]} ({runner_up[0]:.2f})")
        if not DRY:
            for new_position, (_score, photo) in enumerate(scores):
                db.table("item_photos").update({"position": new_position}).eq("id", photo["id"]).execute()
        swapped += 1

    verb = "[dry-run] would reorder" if DRY else "reordered"
    print(f"\n{verb} {swapped} items, left {kept} alone")


if __name__ == "__main__":
    main()
