# -*- coding: utf-8 -*-
"""Find items that were uploaded twice under different numbers.

Items are compared by what the photo shows, not by filename, so the same pair
of shorts photographed twice and uploaded as #41 and #77 is caught even though
the two shots differ in scale, angle and lighting.

How it works:
  1. the near-white studio background is cropped away, so the garment fills
     the frame and photos taken from different distances line up
  2. ORB keypoints are matched between every pair of garments — the same
     garment re-shot shares hundreds of features (print details, seams,
     logo edges), while two different shorts share almost none

Calibrated on the known #41/#77 duplicate: true duplicates score 0.10-0.24,
visually distinct pairs score 0.005-0.010, so the 0.04 cutoff sits in a wide
empty gap.

Requires: pip install opencv-python-headless

Usage:
  python scripts/find_duplicates.py            # human-readable report
  python scripts/find_duplicates.py --json     # machine-readable
"""
import json
import os
import re
import sys

import numpy as np

try:
    import cv2
except ImportError:
    sys.exit("opencv missing. Run: pip install opencv-python-headless")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INV = os.path.join(ROOT, "assets", "inventory")
PHOTO_DIRS = ["bordies", "T-shirts", "women", "accessories"]
IMAGE_EXT = (".jpeg", ".jpg", ".png", ".webp")

MATCH_RATIO = 0.04   # share of keypoints that must match
MIN_MATCHES = 30     # and at least this many, so tiny photos can't sneak through
BG_LEVEL = 225       # pixels brighter than this on every channel are background
NORM_HEIGHT = 600

orb = cv2.ORB_create(nfeatures=1200)
matcher = cv2.BFMatcher(cv2.NORM_HAMMING)


def item_number(filename):
    base = os.path.splitext(filename)[0].replace(" ", "").lower()
    m = re.match(r"^(\d+)[a-z]?$", base)
    return int(m.group(1)) if m else None


def load_garment(path):
    """Read the photo, crop the studio background away, normalise the height."""
    data = np.fromfile(path, dtype=np.uint8)          # handles Hebrew paths
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        return None
    mask = ~np.all(img > BG_LEVEL, axis=2)
    ys, xs = np.where(mask)
    if len(ys) == 0:
        return None
    img = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    if img.shape[0] < 40 or img.shape[1] < 40:
        return None
    scale = NORM_HEIGHT / img.shape[0]
    return cv2.resize(img, (max(1, int(img.shape[1] * scale)), NORM_HEIGHT))


def fingerprint(path):
    img = load_garment(path)
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    keypoints, descriptors = orb.detectAndCompute(gray, None)
    if descriptors is None or len(keypoints) < 20:
        return None
    return keypoints, descriptors


def similarity(fa, fb):
    """Share of keypoints that match between two photos (Lowe's ratio test)."""
    (ka, da), (kb, db) = fa, fb
    pairs = matcher.knnMatch(da, db, k=2)
    good = [m for m, n in (p for p in pairs if len(p) == 2) if m.distance < 0.75 * n.distance]
    return len(good), len(good) / max(1, min(len(ka), len(kb)))


# ---- fingerprint every photo, grouped by item ----
items = {}
for folder in PHOTO_DIRS:
    d = os.path.join(INV, folder)
    if not os.path.isdir(d):
        continue
    for fn in sorted(os.listdir(d)):
        if not fn.lower().endswith(IMAGE_EXT):
            continue
        num = item_number(fn)
        if num is None:
            continue
        fp = fingerprint(os.path.join(d, fn))
        if fp:
            items.setdefault((folder, num), []).append((fn, fp))

# ---- metadata for the report ----
meta = {}
db_path = os.path.join(ROOT, "src", "inventory_db.json")
if os.path.exists(db_path):
    for row in json.load(open(db_path, encoding="utf-8")):
        meta.setdefault(row["num"], row)

# ---- compare every pair of items ----
pairs = []
keys = sorted(items)
for i, key_a in enumerate(keys):
    for key_b in keys[i + 1:]:
        if key_a[1] == key_b[1]:
            continue  # same number in two folders is not a duplicate listing
        best = None
        for name_a, fa in items[key_a]:
            for name_b, fb in items[key_b]:
                count, ratio = similarity(fa, fb)
                if ratio >= MATCH_RATIO and count >= MIN_MATCHES:
                    if best is None or ratio > best["match_ratio"]:
                        best = {
                            "matches": count,
                            "match_ratio": round(ratio, 3),
                            "photo_a": f"{key_a[0]}/{name_a}",
                            "photo_b": f"{key_b[0]}/{name_b}",
                        }
        if best:
            ma, mb = meta.get(key_a[1], {}), meta.get(key_b[1], {})
            pairs.append({
                "a": {"num": key_a[1], "folder": key_a[0], "name": ma.get("name", "?"),
                      "size": ma.get("size", "?"), "price": ma.get("price", 0),
                      "sold": ma.get("sold", False)},
                "b": {"num": key_b[1], "folder": key_b[0], "name": mb.get("name", "?"),
                      "size": mb.get("size", "?"), "price": mb.get("price", 0),
                      "sold": mb.get("sold", False)},
                **best,
            })

pairs.sort(key=lambda p: -p["match_ratio"])

if "--json" in sys.argv:
    print(json.dumps(pairs, ensure_ascii=False, indent=2))
else:
    print(f"scanned {len(items)} items in {sum(len(v) for v in items.values())} photos\n")
    if not pairs:
        print("no duplicates found")
    else:
        print(f"{len(pairs)} suspected duplicate pair(s):\n")
        for p in pairs:
            a, b = p["a"], p["b"]
            level = "certain" if p["match_ratio"] >= 0.08 else "likely"
            print(f"[{level}] #{a['num']} <-> #{b['num']}  "
                  f"({p['matches']} matching features, score {p['match_ratio']})")
            for side, photo in ((a, p["photo_a"]), (b, p["photo_b"])):
                print(f"    #{side['num']:<3} {side['name']:<16} size {side['size']:<4} "
                      f"₪{side['price']:<4}{' SOLD' if side['sold'] else '':5} {photo}")
            print()
