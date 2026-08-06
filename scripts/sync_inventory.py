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
Columns are located by their header text, not their position, so they can be
moved or added freely. For an item on sale, add a "מחיר לפני" column holding
the pre-discount price; the shop then strikes it through beside the new one.
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


# Where each field sits when a sheet has no header row we recognise.
DEFAULT_COLUMNS = {"name": 1, "size": 2, "date": 3, "status": 4, "price": 5}

# Header text -> field. Matched as a prefix, so "מספר מכנס" and "שם מכנס" both work.
# Order matters: "מחיר לפני" has to be claimed by original_price before the
# generic "מחיר" rule can grab it, so the sale columns are listed first.
HEADER_PATTERNS = [
    ("original_price", re.compile(r"^(מחיר לפני|לפני|price before|before)", re.I)),
    ("price", re.compile(r"^(מחיר אחרי|מחיר|price after|price)", re.I)),
    ("size", re.compile(r"^מידה")),
    ("date", re.compile(r"^תאריך")),
    ("status", re.compile(r"^מצב")),
    ("name", re.compile(r"^שם")),
    ("sale", re.compile(r"^sale$", re.I)),
]


def header_columns(row):
    """Map field -> column index if this row looks like a header row."""
    found = {}
    for i, value in enumerate(row):
        if not isinstance(value, str):
            continue
        text = value.strip()
        for field, pattern in HEADER_PATTERNS:
            if field not in found and pattern.match(text):
                found[field] = i
                break  # one column feeds one field, never two
    # מחיר alone is enough to tell a header row from a data row.
    return found if "price" in found else None


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
        columns = DEFAULT_COLUMNS
        for row in ws.iter_rows(values_only=True):
            # Sheets differ in layout — a later drop added a SALE column that
            # shifted מחיר across — so columns are located by their header.
            found = header_columns(row)
            if found:
                columns = found
                continue

            num_cell = row[0]
            if not isinstance(num_cell, str):
                continue
            m = re.match(r"^#(\d+)$", num_cell.strip())
            if not m:
                continue

            def cell(key):
                i = columns.get(key)
                return row[i] if i is not None and i < len(row) else None

            brand, size, date, status, price = (
                cell("name"), cell("size"), cell("date"), cell("status"), cell("price")
            )
            # Only filled in for items on sale: the price the item carried
            # before the discount. The shop strikes it through beside `price`.
            before = cell("original_price")
            # A numbered row with neither a name nor a price is a leftover the
            # sheet never filled in — it would otherwise shadow the real entry.
            if not brand and not isinstance(price, (int, float)):
                print(f"  ! {name}: row #{m.group(1)} is empty, skipped")
                continue

            items.append({
                "num": int(m.group(1)),
                "name": str(brand).strip() if brand else "",
                "size": str(size).strip() if size is not None else "",
                "date": date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date or ""),
                "sold": str(status or "").strip() == "נמכר",
                "price": int(price) if isinstance(price, (int, float)) else 0,
                "original_price": int(before) if isinstance(before, (int, float)) and before else None,
                "sale": str(cell("sale") or "").strip() in ("כן", "yes", "Yes", "TRUE"),
                "categories": categories,
            })
            count += 1
    print(f"{name} -> {count} items (categories: {', '.join(categories)})")

out = os.path.join(ROOT, "src", "inventory_db.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)
print(f"total {len(items)} items -> src/inventory_db.json")
