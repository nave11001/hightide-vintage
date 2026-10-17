"""Cut every live garment photo off its background, for the shop's backdrop.

Every product photo is a garment laid on a plain backdrop; this lifts the
garment off it, scales it to the same share of the frame as every other
garment, adds a soft contact shadow, and writes a transparent 4:5 WebP to
public/cut/<category>/<stem>.webp, with 800px and 480px copies beside it for the cards.
The shop lays its background (public/backdrop.webp) behind every one — see
src/backdrop.ts and the img[src^='/cut/'] rule in src/index.css.

Part of the drop routine (npm run upload-drop): a photo with no cut-out is
shown as it was shot, on white, among garments on the sea.

The cut is BiRefNet, a background-removal model (the open-source rembg
project's ONNX build, run with onnxruntime). Colour thresholds could not tell
a white panel from the white it was photographed on, or a grey contact shadow
from a grey garment; the model can. Its first run downloads it (224 MB) to
~/.u2net, where rembg keeps it. A photo the cut gets wrong is listed in the
manifest's "rejected" and the shop shows its original instead.

    python scripts/make_cutouts.py            # every live item
    python scripts/make_cutouts.py 43 117     # just these items
"""
import json
import os
import sys
import urllib.request

import cv2
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from d1 import query  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, 'assets', 'inventory-web')
OUT = os.path.join(ROOT, 'public', 'cut')
MANIFEST = os.path.join(ROOT, 'src', 'cutouts.json')
MODEL_NAME = 'BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx'
MODEL = os.path.join(os.path.expanduser('~'), '.u2net', MODEL_NAME)
MODEL_URL = f'https://github.com/danielgatis/rembg/releases/download/v0.0.0/{MODEL_NAME}'
# The item page shows a garment at full phone width, which on a sharp phone is
# about 1200 device pixels; the cards take the 800 and 480 copies.
W, H = 1200, 1500
FILL = 0.80  # garment height as a share of the frame, the same for every photo
_session = None


def source_for(stem):
    for name in (f'{stem}.webp', f'{stem}-800.webp'):
        path = os.path.join(WEB, *name.split('/'))
        if os.path.exists(path):
            return path
    return None


def session():
    global _session
    if _session is None:
        import onnxruntime as ort
        if not os.path.exists(MODEL):
            print(f'downloading the background-removal model ({MODEL_URL})')
            os.makedirs(os.path.dirname(MODEL), exist_ok=True)
            urllib.request.urlretrieve(MODEL_URL, MODEL + '.part')
            os.replace(MODEL + '.part', MODEL)
        _session = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    return _session


def matte(rgb, backdrop):
    """The model's garment mask, 0..1, at the photo's size.

    The model looks at a 1024px square. The photo is set in the middle of one,
    on its own backdrop colour with a margin round it, not squashed into it:
    squashed, a plaid leg near the frame's edge (#145) read as backdrop."""
    h, w = rgb.shape[:2]
    side = int(max(h, w) * 1.12)
    y0, x0 = (side - h) // 2, (side - w) // 2
    square = np.empty((side, side, 3), np.uint8)
    square[:] = np.clip(backdrop, 0, 255).astype(np.uint8)
    square[y0:y0 + h, x0:x0 + w] = rgb
    im = np.asarray(Image.fromarray(square).resize((1024, 1024), Image.LANCZOS)).astype(np.float32)
    im /= max(float(im.max()), 1e-6)
    im = (im - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    s = session()
    out = s.run(None, {s.get_inputs()[0].name: im.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
    p = 1 / (1 + np.exp(-out))
    p = (p - p.min()) / max(float(p.max() - p.min()), 1e-6)
    p = cv2.resize(p.astype(np.float32), (side, side), interpolation=cv2.INTER_CUBIC)
    return p[y0:y0 + h, x0:x0 + w].clip(0, 1)


def edge_connected(near):
    """The pixels of `near` that touch the frame's edge, through each other."""
    _, labels = cv2.connectedComponents(near.astype(np.uint8), connectivity=4)
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    return np.isin(labels, list(edge)) & (near == 1)


def is_close_up(path):
    """A photo whose garment runs off the frame: a close-up of a print, a
    detail, a garment shot too tight. Cut out, its straight cropped edges float
    on the backdrop like torn paper (Rising Sun's second photo did), so it is
    shown as it was shot. A whole garment touches an edge for a few percent of
    it at most; these cover two-thirds of a side or more."""
    a = np.asarray(Image.open(path).convert('RGB')).min(axis=2)
    sides = (a[:2], a[-2:], a[:, :2], a[:, -2:])
    return max(float((side < 240).mean()) for side in sides) > 0.35


def fill_enclosed_white(rgb, alpha, path):
    """White the garment closes all round — a label under a pocket flap, a
    white lining — is garment, not a hole, though the model sometimes clears
    it (it did on #57). A real hole, the backdrop inside a cord loop or under a
    hanger, is closed by something thin, with backdrop just beyond it; this
    keeps only white whose surroundings are fabric all round, and that is not
    the backdrop's own flat white."""
    h, w = alpha.shape
    mn = rgb.min(axis=2)
    level = int(np.median(np.concatenate([mn[:3].ravel(), mn[-3:].ravel(), mn[:, :3].ravel(), mn[:, -3:].ravel()])))
    light = mn >= 200
    enclosed = light & ~edge_connected(light)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(enclosed.astype(np.uint8), connectivity=4)
    r = max(5, round(w * 0.02))
    kernel = np.ones((2 * r + 1, 2 * r + 1), np.uint8)
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if area < 0.0002 * h * w:
            continue
        x0, y0, x1, y1 = max(0, x - r), max(0, y - r), min(w, x + bw + r), min(h, y + bh + r)
        region = labels[y0:y1, x0:x1] == i
        a = alpha[y0:y1, x0:x1]
        if a[region].mean() > 0.5 or (mn[y0:y1, x0:x1][region] >= level - 1).mean() > 0.5:
            continue
        ring = cv2.dilate(region.astype(np.uint8), kernel).astype(bool) & ~region
        if (a[ring] > 0.5).mean() >= 0.9:
            a[cv2.dilate(region.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)] = 1
            print(f'  kept enclosed white at ({x},{y}), {area} px: {os.path.basename(path)}')


def trim_shadow_rim(rgb, alpha, backdrop):
    """The model sometimes keeps the edge of the photo's soft shadow as a few
    pixels of light grey along a dark garment's outline: under #111's sleeves
    and hem, under #101's hem. On the sea that reads as a white rim. Light
    neutral pixels at the outline, open to the outside, next to dark fabric,
    are unmixed against that fabric's colour, which leaves them a faint shadow.
    White fabric is never next to dark fabric only, so it is left alone."""
    C = rgb.astype(np.float32)
    h, w = alpha.shape
    s = w / 1100
    solid = alpha > 0.5
    dist = cv2.distanceTransform(solid.astype(np.uint8), cv2.DIST_L2, 5)
    band = solid & (dist <= 7 * s)
    inner = solid & (dist > 9 * s) & (dist <= 20 * s)
    mn = C.min(axis=2)
    light = band & (C.max(axis=2) - mn < 25) & (mn >= 120)
    # Only light that reaches the outside, not a stitch line inside the edge.
    outside = cv2.dilate((~solid).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    n, labels = cv2.connectedComponents(light.astype(np.uint8), connectivity=8)
    hit = np.unique(labels[outside & light])
    light &= np.isin(labels, hit[hit != 0])
    sig = 8 * s
    wgt = cv2.GaussianBlur(inner.astype(np.float32), (0, 0), sig)
    F = cv2.GaussianBlur(C * inner[..., None], (0, 0), sig) / np.maximum(wgt, 1e-6)[..., None]
    light &= (wgt > 0.05) & (F.max(axis=2) < 110)
    if not light.any():
        return rgb, alpha
    FB = F - backdrop
    a = np.clip(((C - backdrop) * FB).sum(axis=2) / np.maximum((FB ** 2).sum(axis=2), 1), 0, 1)
    alpha = alpha.copy()
    alpha[light] = np.minimum(alpha[light], a[light])
    rgb = rgb.copy()
    rgb[light] = np.clip(F[light], 0, 255).astype(np.uint8)
    return rgb, alpha


def cutout(path):
    rgb = np.array(Image.open(path).convert('RGB'))
    C = rgb.astype(np.float32)
    rim = np.concatenate([C[:3].reshape(-1, 3), C[-3:].reshape(-1, 3),
                          C[:, :3].reshape(-1, 3), C[:, -3:].reshape(-1, 3)])
    backdrop = np.median(rim, axis=0)
    alpha = matte(rgb, backdrop)

    white = np.percentile(rim.min(axis=1), 5) >= 245
    if white:
        # On white, whatever is plainly coloured and not the white that reaches
        # the frame's edge is garment, whatever the model says: bright green
        # and yellow stay in the shorts (GrabCut, used here before, cut them
        # out of Green Script and Yellow Flare).
        far = np.linalg.norm(C - backdrop, axis=2) > 80
        hard = far & ~edge_connected(rgb.min(axis=2) >= 250)
        hard = cv2.erode(hard.astype(np.uint8), np.ones((5, 5), np.uint8))
        alpha = np.maximum(alpha, hard.astype(np.float32))
        fill_enclosed_white(rgb, alpha, path)

    # Specks of backdrop the model half-kept would stretch the garment's box.
    alpha[alpha < 0.03] = 0
    solid = (alpha > 0.5).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    if n > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        # Keep a drawstring or a tag the photo shows apart from the body.
        solid = np.isin(labels, 1 + np.flatnonzero(areas >= areas.max() * 0.002)).astype(np.uint8)
        alpha *= cv2.dilate(solid, np.ones((15, 15), np.uint8)).astype(np.float32)

    if white:
        # The soft rim was photographed over white; take the white back out of
        # its colour, or a dark garment wears a pale halo on the sea.
        a = np.maximum(alpha, 1e-3)[..., None]
        fg = np.clip((C - (1 - a) * backdrop) / a, 0, 255)
        rgb = np.where((alpha > 0.98)[..., None], C, fg).astype(np.uint8)
        rgb, alpha = trim_shadow_rim(rgb, alpha, backdrop)
    rgba = np.dstack([rgb, (alpha * 255).round().astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA'), float(solid.mean())


def framed(cut):
    cut = cut.crop(cut.getbbox())
    s = min(H * FILL / cut.height, W * 0.86 / cut.width)
    cut = cut.resize((round(cut.width * s), round(cut.height * s)), Image.LANCZOS)
    frame = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x, y = (W - cut.width) // 2, (H - cut.height) // 2
    # The shadow is blurred on a canvas with room for the blur, or its edge is
    # clipped into a straight grey band beside the garment.
    pad = 64
    shadow = Image.new('RGBA', (cut.width + 2 * pad, cut.height + 2 * pad), (20, 14, 8, 0))
    shadow_alpha = Image.new('L', shadow.size, 0)
    shadow_alpha.paste(cut.split()[3].point(lambda v: int(v * 0.42)), (pad, pad))
    shadow.putalpha(shadow_alpha.filter(ImageFilter.GaussianBlur(21)))
    frame.alpha_composite(shadow, (x + 12 - pad, y + 24 - pad))
    frame.alpha_composite(cut, (x, y))
    return frame


def main():
    only = {int(a) for a in sys.argv[1:]}
    rows = query("SELECT i.num, p.path FROM items i JOIN item_photos p ON p.item_id = i.id "
                 "WHERE i.category IS NOT NULL ORDER BY i.num, p.position, p.path")
    manifest = json.load(open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else {'cut': [], 'rejected': []}
    live = {os.path.splitext(r['path'])[0] for r in rows}
    done = set(manifest['cut'])
    rejected = set(manifest['rejected'])

    def drop(stem):
        """Show this photo as it was shot: no cut-out on file, none in the manifest."""
        done.discard(stem)
        for suffix in ('', '-800', '-480'):
            path = os.path.join(OUT, *stem.split('/')) + suffix + '.webp'
            if os.path.exists(path):
                os.remove(path)

    for row in rows:
        if only and row['num'] not in only:
            continue
        stem = os.path.splitext(row['path'])[0]
        src = source_for(stem)
        if not src:
            print('no source', stem)
            continue
        # A garment that runs off the frame, or a cut that kept almost nothing
        # or almost everything, is shown as shot rather than published broken —
        # this runs unattended in the drop routine.
        if is_close_up(src):
            print('close-up, kept as shot', stem)
            rejected.add(stem)
            drop(stem)
            continue
        cut, coverage = cutout(src)
        if not 0.08 < coverage < 0.85:
            print(f'suspicious {stem}: {coverage:.0%} kept — kept as shot, check it by eye')
            rejected.add(stem)
            drop(stem)
            continue
        rejected.discard(stem)
        base = os.path.join(OUT, *stem.split('/'))
        os.makedirs(os.path.dirname(base), exist_ok=True)
        frame = framed(cut)
        frame.save(base + '.webp', 'WEBP', quality=78, method=4)
        frame.resize((800, 1000), Image.LANCZOS).save(base + '-800.webp', 'WEBP', quality=80, method=4)
        frame.resize((480, 600), Image.LANCZOS).save(base + '-480.webp', 'WEBP', quality=80, method=4)
        done.add(stem)
        print('cut', stem, flush=True)

    # Sold and removed garments leave the catalogue; their cut-outs go too.
    if not only:
        for stem in sorted(done - live):
            print('no longer listed', stem)
            drop(stem)
        rejected &= live
    manifest['cut'] = sorted(done)
    manifest['rejected'] = sorted(rejected)
    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
