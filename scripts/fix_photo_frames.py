# -*- coding: utf-8 -*-
"""Re-frame any studio shot in Storage that is not 4:5, straight in the bucket.

The cards and the item view both render 4:5. A photo at any other ratio either
gets cropped or floats in bars, and one wrong file is enough to make the grid
look broken.

Only shots on a white sweep are touched. The older photos taken on a sofa or a
floor are left alone — padding those would frame a living room in white.

  python scripts/fix_photo_frames.py --dry-run
  python scripts/fix_photo_frames.py
"""
import io
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUCKET = "inventory"
TARGET_RATIO = 4 / 5
GARMENT_SHARE = 0.88     # margin so nothing touches the edge
WHITE_CUTOFF = 244
TOLERANCE = 0.02         # 0.78–0.82 counts as already correct

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


def on_white(im):
    """True when the border of the image is a plain light sweep."""
    grey = im.convert("L")
    w, h = grey.size
    edge = (
        [grey.getpixel((x, 0)) for x in range(0, w, max(1, w // 40))]
        + [grey.getpixel((x, h - 1)) for x in range(0, w, max(1, w // 40))]
        + [grey.getpixel((0, y)) for y in range(0, h, max(1, h // 40))]
        + [grey.getpixel((w - 1, y)) for y in range(0, h, max(1, h // 40))]
    )
    light = sum(1 for p in edge if p >= WHITE_CUTOFF)
    return light / len(edge) > 0.9


def reframe(im):
    """Trim the surround, then centre the garment on a 4:5 white canvas."""
    mask = im.convert("L").point(lambda p: 255 if p < WHITE_CUTOFF else 0)
    box = mask.getbbox()
    garment = im.crop(box) if box else im

    height = max(garment.height, int(garment.width / TARGET_RATIO))
    height = int(height / GARMENT_SHARE)
    width = int(height * TARGET_RATIO)
    if width < garment.width / GARMENT_SHARE:
        width = int(garment.width / GARMENT_SHARE)
        height = int(width / TARGET_RATIO)

    canvas = Image.new("RGB", (width, height), (255, 255, 255))
    canvas.paste(garment, ((width - garment.width) // 2, (height - garment.height) // 2))
    return canvas


def main():
    load_env()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL / SUPABASE_SERVICE_KEY missing.")

    import urllib.request

    from supabase import create_client

    db = create_client(url, key)
    rows = db.table("items").select("num, category, item_photos(path)").execute().data
    paths = sorted({p["path"] for r in rows for p in r["item_photos"]})
    print(f"{len(paths)} photos in the bucket\n")

    fixed = skipped_ok = skipped_scene = 0
    for path in paths:
        public = f"{url}/storage/v1/object/public/{BUCKET}/{path}"
        raw = urllib.request.urlopen(public, timeout=45).read()
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        ratio = im.width / im.height

        if abs(ratio - TARGET_RATIO) <= TOLERANCE:
            skipped_ok += 1
            continue
        if not on_white(im):
            skipped_scene += 1
            continue

        out = reframe(im)
        print(f"  {path:<26} {im.width}x{im.height} ({ratio:.2f})"
              f" -> {out.width}x{out.height} (0.80)")
        if not DRY:
            buf = io.BytesIO()
            out.save(buf, "JPEG" if path.lower().endswith((".jpg", ".jpeg")) else "PNG",
                     quality=90, optimize=True)
            mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
            db.storage.from_(BUCKET).upload(
                path, buf.getvalue(), {"content-type": mime, "upsert": "true"}
            )
        fixed += 1

    verb = "[dry-run] would re-frame" if DRY else "re-framed"
    print(f"\n{verb} {fixed}   already 4:5 {skipped_ok}   shot on a background, left alone {skipped_scene}")


if __name__ == "__main__":
    main()
