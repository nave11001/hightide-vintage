"""Cuts assets/fonts/FlowersKingdom.ttf down to the letters the shop sets in it.

    python scripts/make_font_subset.py

Why
---
The file ships whole: 243 glyphs, 144KB, 46KB over the wire. The shop sets
exactly one thing in it — English headings like OUR MOST WANTED PIECES — and the
face has no Hebrew glyphs at all, so every Hebrew heading already falls through
to Rubik Bubbles and always did.

Keeping ASCII and dropping the rest costs nothing visible. Converting to WOFF2
at the same time is free: it is the same outlines under Brotli, understood by
every browser since 2016.

The original TTF stays in assets/fonts/ as the master.
"""

import os

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "fonts", "FlowersKingdom.ttf")
DST = os.path.join(ROOT, "assets", "fonts", "FlowersKingdom.woff2")

# Printable ASCII. Wider than the headings need today, so a new one cannot land
# on a glyph that was cut — and it is 95 outlines, which costs almost nothing.
KEEP = "".join(chr(c) for c in range(0x20, 0x7F))


def main() -> None:
    before = os.path.getsize(SRC)

    font = TTFont(SRC)
    options = subset.Options()
    options.flavor = "woff2"
    # Layout tables the browser never consults for a display heading.
    options.layout_features = ["kern", "liga"]
    options.desubroutinize = True
    options.drop_tables += ["DSIG"]
    options.notdef_outline = True

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=KEEP)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(DST)

    after = os.path.getsize(DST)
    kept = len(TTFont(DST).getBestCmap())
    print(f"FlowersKingdom: {before / 1024:.0f} KB TTF -> {after / 1024:.0f} KB WOFF2"
          f"  ({100 - after * 100 // before}% lighter, {kept} glyphs kept)")


if __name__ == "__main__":
    main()
