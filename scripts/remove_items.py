# -*- coding: utf-8 -*-
"""Remove specific item numbers from the store (used for duplicate listings).

Their rows are deleted from the Excel sheets and their photos are moved to
removed_archive/, so nothing is lost from disk — the items just stop being
listed on the site.

Usage:
  python scripts/remove_items.py 77 76 72 --dry-run
  python scripts/remove_items.py 77 76 72
"""
import ctypes
import os
import re
import shutil
import sys
import glob
import tempfile
import time

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INV = os.path.join(ROOT, "assets", "inventory")
ARCHIVE = os.path.join(ROOT, "removed_archive")
PHOTO_DIRS = ["bordies", "T-shirts", "women", "accessories"]
IMAGE_EXT = (".jpeg", ".jpg", ".png", ".webp")

DRY = "--dry-run" in sys.argv
targets = {int(a) for a in sys.argv[1:] if a.isdigit()}
if not targets:
    sys.exit("give at least one item number, e.g. python scripts/remove_items.py 77 76 72")

print(f"removing items: {sorted(targets)}{' (dry run)' if DRY else ''}\n")


def copy_locked(src, dst, attempts=3):
    """Copy, retrying briefly — OneDrive grabs a short lock after every save."""
    if os.name != "nt":
        shutil.copyfile(src, dst)
        return
    for i in range(attempts):
        if ctypes.windll.kernel32.CopyFileW(os.path.abspath(src), os.path.abspath(dst), False):
            return
        err = ctypes.GetLastError()
        if err == 32 and i < attempts - 1:   # ERROR_SHARING_VIOLATION
            time.sleep(1.5)
            continue
        if err == 32:
            sys.exit(f"\n'{os.path.basename(dst)}' is open in Excel — close it and run again.")
        raise OSError(f"copy failed ({err}): {dst}")


def item_number(filename):
    base = os.path.splitext(filename)[0].replace(" ", "").lower()
    m = re.match(r"^(\d+)[a-z]?$", base)
    return int(m.group(1)) if m else None


# ---- strip rows from the sheets ----
for src in glob.glob(os.path.join(INV, "excel", "*.xlsx")):
    if os.path.basename(src).startswith("~$"):
        continue
    tmp = os.path.join(tempfile.gettempdir(), "remove_" + str(abs(hash(src))) + ".xlsx")
    copy_locked(src, tmp)
    wb = openpyxl.load_workbook(tmp)
    removed = []
    for ws in wb.worksheets:
        for row in reversed(list(ws.iter_rows())):
            raw = row[0].value
            if not isinstance(raw, str):
                continue
            m = re.match(r"^#(\d+)$", raw.strip())
            if m and int(m.group(1)) in targets:
                removed.append(int(m.group(1)))
                if not DRY:
                    ws.delete_rows(row[0].row)
    if removed:
        print(f"{os.path.basename(src)}: removed rows {sorted(removed)}")
        if not DRY:
            wb.save(tmp)
            copy_locked(tmp, src)

# ---- move their photos out ----
moved = 0
for folder in PHOTO_DIRS:
    d = os.path.join(INV, folder)
    if not os.path.isdir(d):
        continue
    for fn in sorted(os.listdir(d)):
        if not fn.lower().endswith(IMAGE_EXT):
            continue
        if item_number(fn) in targets:
            print(f"  archive {folder}/{fn}")
            if not DRY:
                dest = os.path.join(ARCHIVE, folder)
                os.makedirs(dest, exist_ok=True)
                shutil.move(os.path.join(d, fn), os.path.join(dest, fn))
            moved += 1

print(f"\n{'[dry-run] would archive' if DRY else 'archived'} {moved} photos")
