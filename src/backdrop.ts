// The shop's backdrop.
//
// Every garment photo is a garment on a plain backdrop. scripts/make_cutouts.py
// lifts each one off it into public/cut/<category>/<stem>.webp (with a 480px
// copy for the cards), all at the same scale, and the img[src^='/cut/'] rule in
// index.css lays one background behind every one — public/backdrop.webp, a
// turquoise barrel with palms, which the owner chose from eleven. It loads
// once for the whole shop.
//
// A photo with no cut-out (a new drop the script has not run on yet, or one
// listed in "rejected" — a close-up of a print, a misfiled photo) is shown as
// it was shot.

import cutouts from './cutouts.json';

const CUT = new Set<string>(cutouts.cut);
const REJECTED = new Set<string>(cutouts.rejected);
// A fingerprint of each cut-out's file. The files are cached for a day, so a
// re-cut garment needs a new address or a returning visitor keeps the old one.
const VERSION: Record<string, string> = (cutouts as { v?: Record<string, string> }).v ?? {};

/** The garment on the shop's backdrop, or undefined to keep the original photo. */
export function cutoutFor(path: string): string | undefined {
  const stem = path.replace(/\.[^./]+$/, '');
  if (!CUT.has(stem) || REJECTED.has(stem)) return undefined;
  return VERSION[stem] ? `/cut/${stem}.webp?v=${VERSION[stem]}` : `/cut/${stem}.webp`;
}

/** The srcset of a cut-out: 480 and 800 for the cards, 1200 for the item page. */
export function cutoutSrcSet(url: string): string | undefined {
  if (!url.startsWith('/cut/')) return undefined;
  const [file, version] = url.split('?');
  const query = version ? `?${version}` : '';
  const base = file.replace(/\.webp$/, '');
  return `${base}-480.webp${query} 480w, ${base}-800.webp${query} 800w, ${url} 1200w`;
}

/** The stored photo path behind a cut-out URL ("boardies/43"), or null. */
export function pathOfCutout(src: string): string | null {
  const match = /\/cut\/(.+?)(?:-480|-800)?\.webp(?:\?.*)?$/.exec(src);
  return match ? match[1] : null;
}
