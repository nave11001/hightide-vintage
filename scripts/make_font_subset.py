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

# The characters the declared metrics are measured against — see
# normalise_vertical_metrics. Centring is exact for text whose ink matches the
# declared ascent and descent, and different characters have different extents,
# so this has to be the set the shop actually sets in this face: the headings
# and the category labels, which are uppercase, plus digits and the ampersand
# in VINTAGE TEES & HOODIES. Measuring against all of KEEP instead would drag
# the numbers out to brackets and parentheses that never appear in a heading,
# and leave the capitals sitting low again.
METRIC_BASIS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&"


def normalise_vertical_metrics(font) -> None:
    """Make the font declare where its letters actually are.

    Why this is here
    ----------------
    A font carries three sets of vertical metrics and browsers disagree about
    which to believe: hhea, OS/2 typo, and OS/2 win. Flowers Kingdom ships all
    three, all different, and none of them describing this typeface:

        hhea       ascent 0.838em  descent -0.204em   (asc-desc 1.042em)
        OS/2 typo  ascent 0.700em  descent -0.200em   (asc-desc 0.900em)
        OS/2 win   ascent 2.344em  descent -0.204em   (asc-desc 2.548em)

    while the capitals actually run from 1.930em down to -0.116em. It is a
    display face with enormous caps that overshoot the em box, and the metrics
    were never updated to match.

    Text is centred on the line box, and the line box is positioned from these
    declared numbers rather than from the letters that get drawn. So the same
    CSS put the label text 0.25em low in Chrome, which reads the win metrics,
    and half an em high on iOS, which reads hhea — the phone screenshot and the
    desktop measurement disagreed because the font was telling them different
    things.

    Centring is exact when declared (ascent - descent) equals the ink's
    (ascent - descent), whatever the line-height. So all three sets are set to
    the ink, and USE_TYPO_METRICS is switched on so anything reading OS/2
    prefers the typo pair. After this the three agree, and so do the browsers.
    """
    upm = font["head"].unitsPerEm
    glyf, cmap = font["glyf"], font.getBestCmap()

    tops, bottoms = [], []
    for char in METRIC_BASIS:
        name = cmap.get(ord(char))
        if not name:
            continue
        glyph = glyf[name]
        if glyph.numberOfContours == 0:      # space and friends have no outline
            continue
        tops.append(glyph.yMax)
        bottoms.append(glyph.yMin)

    ascent, descent = max(tops), min(bottoms)

    hhea, os2 = font["hhea"], font["OS/2"]
    hhea.ascent, hhea.descent, hhea.lineGap = ascent, descent, 0
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ascent, descent, 0
    os2.usWinAscent, os2.usWinDescent = ascent, -descent
    # USE_TYPO_METRICS is only defined from OS/2 version 4. This font ships
    # version 3, where setting the bit is meaningless — so raise the version
    # first, or the flag is written into a table too old to declare it.
    if os2.version < 4:
        os2.version = 4
    os2.fsSelection |= 1 << 7                # USE_TYPO_METRICS

    print(f"  metrics normalised to the ink: ascent {ascent / upm:.3f}em, "
          f"descent {descent / upm:.3f}em  (was three different values)")


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

    normalise_vertical_metrics(font)

    font.flavor = "woff2"
    font.save(DST)

    after = os.path.getsize(DST)
    kept = len(TTFont(DST).getBestCmap())
    print(f"FlowersKingdom: {before / 1024:.0f} KB TTF -> {after / 1024:.0f} KB WOFF2"
          f"  ({100 - after * 100 // before}% lighter, {kept} glyphs kept)")


if __name__ == "__main__":
    main()
