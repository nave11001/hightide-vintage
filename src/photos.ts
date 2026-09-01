// Where a garment's photograph comes from: this site, and nowhere else.
//
// It used to be Supabase Storage first with the shipped copy behind it. In
// August 2026 Supabase restricted the project for exceeding its bandwidth
// allowance and answered 402 to everything — catalogue and photographs alike —
// and the shop showed names and prices with holes where the clothes should
// have been. It has since auto-paused and its hostname no longer resolves at
// all.
//
// The local copy was already first in line, which is the only reason the
// garments stayed on screen through both. Now it is the only line. Two things
// still stand between an old URL and a broken image:
//
//   1. repairPhotos() rewrites bucket URLs recovered from a visitor's own
//      cache — a shopper who last came in July is carrying a pocketful of
//      addresses whose host is gone from DNS;
//   2. onPhotoError() catches whatever still slips through, per <img>.
//
// Only the second can save a photo the first never saw coming, so it is the
// one that must never be omitted from an <img> showing a garment.

// Every photograph the database knows about, compressed and renamed after the
// item number it belongs to. Built by scripts/make_inventory_web.py; verified
// to cover all 116 paths the database holds. 8.4MB for 147 files.
// Every picture the site ships, garments and furniture alike. Both need the
// same treatment — the shop's own sold stamp was 620px wide to be drawn at 54,
// which cost more than any single garment on the page — so both are read here
// and both get a srcset below.
//
// _originals is excluded: those are the uncompressed masters, kept out of git
// and never shipped.
const LOCAL_PHOTOS = import.meta.glob(
  ['@/assets/**/*.webp', '!@/assets/_originals/**'],
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

/** "boardies/104.jpg" -> the key make_inventory_web.py wrote. */
function localKey(path: string): string {
  return `/assets/inventory-web/${path.replace(/\.[^./]+$/, '')}.webp`;
}

/** The local twin of a stored path, if this build shipped one. */
export function localPhotoUrl(path: string): string | undefined {
  return LOCAL_PHOTOS[localKey(path)];
}

// Each photograph ships at three widths — see scripts/make_inventory_web.py.
// This maps the full-width URL to the srcset offering all three, so a component
// holding nothing but a resolved URL can still hand the browser the choice.
//
// Worth the map: a card on a phone is 164 CSS pixels wide, 328 real ones, and
// was being sent 1170. The 480px copy is 19KB against 58KB, and a category page
// of photographs falls from 3.45MB to roughly 1MB with nothing to see for it.
const SRCSET_BY_URL: Record<string, string> = {};
{
  const widths = [480, 800];
  // The width claimed for the full-size candidate. The real ones differ a
  // little — garments are 1200, the hero 1264, the category tiles 1170 — and
  // nothing here can measure an image before it loads.
  //
  // So: the smallest of them, deliberately. Under-claiming makes the browser
  // reach for the full file a touch sooner than it strictly must, which costs
  // a few kilobytes on a wide screen. Over-claiming makes it settle for the
  // 800px copy where the slot needed more, which is a blurry photograph. The
  // 2.5% error only ever falls on the safe side.
  const FULL = 1170;
  for (const [key, href] of Object.entries(LOCAL_PHOTOS)) {
    if (/-\d+\.webp$/.test(key)) continue; // a variant, not a full-width original
    const base = key.slice(0, -'.webp'.length);
    const parts: string[] = [];
    for (const w of widths) {
      const variant = LOCAL_PHOTOS[`${base}-${w}.webp`];
      if (variant) parts.push(`${variant} ${w}w`);
    }
    // No variants means the master was already smaller than the smallest of
    // them. Leaving it without a srcset is the honest answer — a lone candidate
    // labelled with a width would be claiming one the file does not have.
    if (parts.length) SRCSET_BY_URL[href] = [...parts, `${href} ${FULL}w`].join(', ');
  }
}

/**
 * The widths available for an already-resolved URL, or undefined.
 *
 * Undefined for anything this build did not ship, and for a master that was
 * already smaller than the smallest variant. An <img> with no srcset simply
 * uses its src.
 */
export function srcSetFor(url: string): string | undefined {
  return SRCSET_BY_URL[url];
}

// Shown only when a garment has no photograph anywhere. Drawn rather than
// fetched: a placeholder that can itself fail to load is not a placeholder.
export const PHOTO_PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100">
       <rect width="80" height="100" fill="#f5f5f4"/>
       <path d="M18 62l14-16 10 11 8-8 12 13z" fill="#d6d3d1"/>
       <circle cx="52" cy="38" r="5" fill="#d6d3d1"/>
       <text x="40" y="84" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
             font-size="7" letter-spacing="1.2" fill="#a8a29e">HIGHTIDE</text>
     </svg>`,
  );

/**
 * Where to load the photo stored at e.g. "boardies/47.jpeg".
 *
 * From this site, always. There is no second place to look any more, and the
 * numbers say there should not be: the bucket held one size, the
 * full-resolution upload, so filling a 164-pixel card from it meant sending
 * 564KB where the local copy is 19KB with srcset choosing it. That difference
 * is what put 56GB through a 5GB allowance and paused the project.
 *
 * A path with no local file falls to the placeholder rather than to an empty
 * string, so a missing photograph is a drawn frame instead of a broken icon.
 */
export function storageUrl(path: string): string {
  return localPhotoUrl(path) ?? PHOTO_PLACEHOLDER;
}

/**
 * The stored path behind an old bucket URL, or null if it is not one.
 *
 * Matched on `/inventory/` rather than on the project's hostname, because the
 * hostname is gone and a URL saved months ago may not even be the last one the
 * project had. Everything after the bucket name is the path this site knows.
 */
function pathFromRemote(src: string): string | null {
  const marker = '/inventory/';
  const at = src.indexOf(marker);
  if (at === -1 || !/^https?:\/\//i.test(src)) return null;
  return decodeURIComponent(src.slice(at + marker.length).split('?')[0]);
}

/** The local twin of an already-resolved URL, if there is one. */
export function localTwin(src: string): string | undefined {
  const path = pathFromRemote(src);
  return path === null ? undefined : localPhotoUrl(path);
}

/**
 * Rewrite bucket URLs that came out of a visitor's own storage.
 *
 * Favourites and the cached catalogue hold photo URLs resolved on some earlier
 * visit, and those were absolute — a shopper who last came while Supabase was
 * healthy carries a pocketful of URLs that now 402. This is what turned a
 * returning customer's homepage into a broken-image icon while a first-time
 * visitor saw the shop in full.
 *
 * A no-op while the bucket answers, so a cached URL keeps working and a garment
 * added since that visit is still reachable.
 */
export function repairPhotos<T extends { image: string; images?: string[] }>(items: T[]): T[] {
  // Unconditional now. It used to be a no-op while the bucket answered, so a
  // cached URL kept working; there is no bucket to answer any more, so every
  // one of them is a broken image waiting to happen. A shopper who last
  // visited in July is carrying a pocketful of URLs whose host no longer
  // exists in DNS — this is what turns them back into pictures.
  return items.map((item) => {
    const image = localTwin(item.image) ?? item.image;
    const images = item.images?.map((src) => localTwin(src) ?? src);
    return image === item.image && !images ? item : { ...item, image, images };
  });
}

/**
 * Last resort, on the <img> itself: swap in the local copy, then a placeholder.
 *
 * Attach to every <img> that shows a garment. The element carries its own state
 * in a data attribute, so a photograph that fails twice ends at the placeholder
 * rather than looping.
 */
export function onPhotoError(event: { currentTarget: HTMLImageElement }): void {
  const img = event.currentTarget;
  if (img.dataset.photoFallback) {
    // The local copy failed too — or the placeholder did, and there is nothing
    // further to try.
    if (img.dataset.photoFallback === 'local') {
      img.dataset.photoFallback = 'placeholder';
      img.src = PHOTO_PLACEHOLDER;
    }
    return;
  }

  const twin = localTwin(img.src);
  img.dataset.photoFallback = twin ? 'local' : 'placeholder';
  // Before src, and unconditionally: a srcset outranks src, so leaving one in
  // place would send the browser straight back to the URL that just failed.
  img.srcset = twin ? (srcSetFor(twin) ?? '') : '';
  img.src = twin ?? PHOTO_PLACEHOLDER;
}
