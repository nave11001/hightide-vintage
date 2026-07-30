# -*- coding: utf-8 -*-
"""Inventory reset — runs automatically on the 1st and 15th of every month.

For every item marked נמכר in the Excel sheets:
  1. its row is appended to assets/inventory/excel/sold_log.csv (permanent
     sales record — nothing about the sale is lost)
  2. its row is removed from the working sheet
  3. its photos are moved out of assets/Inventory into sold_archive/

Photos that have no row in any sheet ("orphans", usually left over from an
earlier reset) are archived too, so the store never shows an item that the
sheets don't describe.

Usage:
  python scripts/reset_inventory.py --dry-run       # show what would happen
  python scripts/reset_inventory.py                 # full reset
  python scripts/reset_inventory.py --orphans-only  # only clear leftover photos,
                                                    # leave sold items on the site
"""
import csv
import ctypes
import datetime
import glob
import os
import re
import shutil
import sys
import tempfile

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INV = os.path.join(ROOT, "assets", "inventory")
EXCEL_DIR = os.path.join(INV, "excel")
LOG = os.path.join(EXCEL_DIR, "sold_log.csv")
ARCHIVE = os.path.join(ROOT, "sold_archive")
IMAGE_EXT = (".jpeg", ".jpg", ".png", ".webp")
PHOTO_DIRS = ["bordies", "T-shirts", "women", "accessories"]

DRY = "--dry-run" in sys.argv
ORPHANS_ONLY = "--orphans-only" in sys.argv
TODAY = datetime.date.today().isoformat()


def copy_locked(src, dst):
    """Copy that works even while Excel/OneDrive holds the file open."""
    if os.name == "nt":
        if not ctypes.windll.kernel32.CopyFileW(os.path.abspath(src), os.path.abspath(dst), False):
            raise OSError(f"copy failed ({ctypes.GetLastError()}): {src}")
    else:
        shutil.copyfile(src, dst)


def item_number(filename):
    """'16a.jpeg' -> 16, '12 a.jpeg' -> 12, '17 .jpeg' -> 17"""
    base = os.path.splitext(filename)[0].replace(" ", "").lower()
    m = re.match(r"^(\d+)[a-z]?$", base)
    return int(m.group(1)) if m else None


def cell(v):
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    return "" if v is None else str(v).strip()


sheets = [f for f in glob.glob(os.path.join(EXCEL_DIR, "*.xlsx"))
          if not os.path.basename(f).startswith("~$")]
if not sheets:
    sys.exit("no Excel sheets found in assets/inventory/excel")

sold_numbers = set()
all_numbers = set()
log_rows = []

for src in sheets:
    name = os.path.basename(src)
    tmp = os.path.join(tempfile.gettempdir(), "reset_" + str(abs(hash(src))) + ".xlsx")
    copy_locked(src, tmp)
    wb = openpyxl.load_workbook(tmp)
    removed = []
    for ws in wb.worksheets:
        # bottom-up so row indexes stay valid while deleting
        for row in reversed(list(ws.iter_rows())):
            raw = row[0].value
            if not isinstance(raw, str):
                continue
            m = re.match(r"^#(\d+)$", raw.strip())
            if not m:
                continue
            num = int(m.group(1))
            all_numbers.add(num)
            if cell(row[4].value) != "נמכר" or ORPHANS_ONLY:
                continue
            sold_numbers.add(num)
            removed.append(num)
            log_rows.append([
                TODAY, name, num, cell(row[1].value), cell(row[2].value),
                cell(row[3].value), cell(row[5].value),
            ])
            if not DRY:
                ws.delete_rows(row[0].row)
    print(f"{name}: {len(removed)} sold -> {sorted(removed)}")
    if removed and not DRY:
        wb.save(tmp)
        copy_locked(tmp, src)

# ---- permanent sales record ----
if log_rows and not DRY:
    new_file = not os.path.exists(LOG)
    with open(LOG, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(["תאריך איפוס", "גיליון", "מספר פריט", "שם", "מידה", "תאריך דרופ", "מחיר"])
        w.writerows(sorted(log_rows, key=lambda r: r[2]))
print(f"logged {len(log_rows)} sales to {os.path.basename(LOG)}")

# ---- move photos out of the store ----
moved = 0
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
        # sold this cycle, or a leftover with no row in any sheet
        if num in sold_numbers or num not in all_numbers:
            reason = "sold" if num in sold_numbers else "orphan"
            print(f"  archive [{reason}] {folder}/{fn}")
            if not DRY:
                dest = os.path.join(ARCHIVE, folder)
                os.makedirs(dest, exist_ok=True)
                shutil.move(os.path.join(d, fn), os.path.join(dest, fn))
            moved += 1

print(f"\n{'[dry-run] would archive' if DRY else 'archived'} {moved} photos")
