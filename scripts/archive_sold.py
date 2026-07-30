# -*- coding: utf-8 -*-
"""Remove every item marked נמכר from the store: delete its row from the Excel
sheet and move its photos out of assets/Inventory into sold_archive/.

Usage:
  python scripts/archive_sold.py --dry-run   # show what would happen
  python scripts/archive_sold.py             # do it
"""
import ctypes
import glob
import os
import re
import shutil
import sys
import tempfile

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INV = os.path.join(ROOT, "assets", "inventory")
ARCHIVE = os.path.join(ROOT, "sold_archive")
IMAGE_EXT = (".jpeg", ".jpg", ".png", ".webp")
PHOTO_DIRS = ["bordies", "T-shirts", "women", "accessories"]

DRY = "--dry-run" in sys.argv


def win_copy(src, dst):
    """Copy that works even while Excel/OneDrive holds the file open."""
    if os.name == "nt":
        if not ctypes.windll.kernel32.CopyFileW(os.path.abspath(src), os.path.abspath(dst), False):
            raise OSError(f"copy failed ({ctypes.GetLastError()}): {src}")
    else:
        shutil.copyfile(src, dst)


def item_number(filename: str):
    """'16a.jpeg' -> 16, '12 a.jpeg' -> 12, '17 .jpeg' -> 17"""
    base = os.path.splitext(filename)[0].replace(" ", "").lower()
    m = re.match(r"^(\d+)[a-z]?$", base)
    return int(m.group(1)) if m else None


# ---- 1. collect sold numbers and strip their rows from every sheet ----
sold_numbers = set()
sheets = [f for f in glob.glob(os.path.join(INV, "excel", "*.xlsx"))
          if not os.path.basename(f).startswith("~$")]

for src in sheets:
    name = os.path.basename(src)
    tmp = os.path.join(tempfile.gettempdir(), "archive_" + str(abs(hash(src))) + ".xlsx")
    win_copy(src, tmp)
    wb = openpyxl.load_workbook(tmp)
    removed = []
    for ws in wb.worksheets:
        # bottom-up so row indexes stay valid while deleting
        for row in reversed(list(ws.iter_rows())):
            cell = row[0].value
            if not isinstance(cell, str):
                continue
            m = re.match(r"^#(\d+)$", cell.strip())
            if not m:
                continue
            status = str(row[4].value or "").strip()
            if status == "נמכר":
                num = int(m.group(1))
                sold_numbers.add(num)
                removed.append(num)
                if not DRY:
                    ws.delete_rows(row[0].row)
    print(f"{name}: {len(removed)} sold rows -> {sorted(removed)}")
    if removed and not DRY:
        wb.save(tmp)
        win_copy(tmp, src)

print(f"\nsold item numbers: {sorted(sold_numbers)}\n")

# ---- 2. move their photos to sold_archive/ ----
moved = 0
for folder in PHOTO_DIRS:
    d = os.path.join(INV, folder)
    if not os.path.isdir(d):
        continue
    for fn in sorted(os.listdir(d)):
        if not fn.lower().endswith(IMAGE_EXT):
            continue
        num = item_number(fn)
        if num in sold_numbers:
            dest_dir = os.path.join(ARCHIVE, folder)
            print(f"  archive {folder}/{fn}")
            if not DRY:
                os.makedirs(dest_dir, exist_ok=True)
                shutil.move(os.path.join(d, fn), os.path.join(dest_dir, fn))
            moved += 1

print(f"\n{'[dry-run] would archive' if DRY else 'archived'} {moved} photos")
