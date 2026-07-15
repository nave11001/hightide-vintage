# -*- coding: utf-8 -*-
"""Sync ALL Excel inventory sheets under assets/Inventory into src/inventory_db.json.

Usage: python scripts/sync_inventory.py   (or: npm run sync-inventory)

Every .xlsx found (recursively) is parsed. Which product categories a sheet
applies to is inferred from its filename:
  מכנסיים / pants / bordies / boardies -> boardies + women (pants numbers are
                                          unique across both folders)
  חולצות / shirt / t-shirt / tee       -> shirts
  אקססוריז / accessor                  -> accessories
  נשים / women                          -> women
Unrecognized filenames apply to ALL categories.

Expected columns: מספר פריט | שם | מידה | תאריך | מצב | מחיר
"""
import glob
import json
import os
import re
import shutil
import sys
import tempfile

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl missing. Run: pip install openpyxl")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SCOPE_RULES = [
    (re.compile(r"מכנס|pants|bordies|boardies", re.I), ["boardies", "women"]),
    (re.compile(r"חולצ|shirt|tee", re.I), ["shirts"]),
    (re.compile(r"אקסס|accessor", re.I), ["accessories"]),
    (re.compile(r"נשים|women", re.I), ["women"]),
]
ALL_CATEGORIES = ["boardies", "shirts", "accessories", "women"]


def scope_for(filename: str):
    for pattern, cats in SCOPE_RULES:
        if pattern.search(filename):
            return cats
    return ALL_CATEGORIES


def read_locked(src: str) -> str:
    """Copy to temp before parsing. On Windows use Win32 CopyFileW, which
    works even while Excel holds the file open; elsewhere plain copy."""
    tmp = os.path.join(tempfile.gettempdir(), "hightide_sync_" + str(abs(hash(src))) + ".xlsx")
    if os.name == "nt":
        import ctypes
        if not ctypes.windll.kernel32.CopyFileW(src, tmp, False):
            raise OSError(f"cannot copy {src} (win error {ctypes.GetLastError()})")
    else:
        shutil.copyfile(src, tmp)
    return tmp


xlsx_files = [
    f for f in glob.glob(os.path.join(ROOT, "assets", "[Ii]nventory", "**", "*.xlsx"), recursive=True)
    if not os.path.basename(f).startswith("~$")  # skip Excel lock files
]
if not xlsx_files:
    sys.exit("No .xlsx files found in assets/Inventory")

items = []
for src in xlsx_files:
    name = os.path.basename(src)
    categories = scope_for(name)
    try:
        wb = openpyxl.load_workbook(read_locked(src), data_only=True)
    except Exception as e:
        print(f"skipping {name}: {e}")
        continue
    count = 0
    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            num_cell = row[0]
            if not isinstance(num_cell, str):
                continue
            m = re.match(r"^#(\d+)$", num_cell.strip())
            if not m:
                continue
            brand, size, date, status, price = row[1], row[2], row[3], row[4], row[5]
            items.append({
                "num": int(m.group(1)),
                "name": str(brand).strip() if brand else "",
                "size": str(size).strip() if size is not None else "",
                "date": date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date or ""),
                "sold": str(status or "").strip() == "נמכר",
                "price": int(price) if price is not None else 0,
                "categories": categories,
            })
            count += 1
    print(f"{name} -> {count} items (categories: {', '.join(categories)})")

out = os.path.join(ROOT, "src", "inventory_db.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)
print(f"total {len(items)} items -> src/inventory_db.json")
