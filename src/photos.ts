// Where a garment's photograph comes from.
//
// Supabase Storage first, the copy that ships with the site behind it. A
// picture uploaded to the dashboard is visible without a deploy, and when the
// bucket does not answer the shop still shows the garment.
//
// The fallback is not hypothetical. In August 2026 Supabase restricted the
// project for exceeding its bandwidth allowance and answered 402 to everything
// — catalogue and photographs alike — and the shop showed names and prices with
// holes where the clothes should have been. Three things now stand between that
// and a customer:
//
//   1. the catalogue request doubles as a probe (markBucketUnreachable below),
//      so once Supabase has refused once, nothing else is asked of it;
//   2. repairPhotos() rewrites URLs recovered from a visitor's own cache, which
//      were resolved on an earlier visit and may point anywhere;
//   3. onPhotoError() catches whatever still slips through, per <img>.
//
// Only the third can save a photo the other two never saw coming, so it is the
// one that must never be omitted from an <img> showing a garment.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const BUCKET = 'inventory';
const REMOTE_PREFIX = url ? `${url}/storage/v1/object/public/${BUCKET}/` : '';

// Every photograph the database knows about, compressed and renamed after the
// item number it belongs to. Built by scripts/make_inventory_web.py; verified
// to cover all 116 paths the database holds. 8.4MB for 147 files.
const LOCAL_PHOTOS = import.meta.glob('@/assets/inventory-web/**/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

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
    // labelled 1200w would be claiming a width the file does not have.
    if (parts.length) SRCSET_BY_URL[href] = [...parts, `${href} 1200w`].join(', ');
  }
}

/**
 * The widths available for an already-resolved URL, or undefined.
 *
 * Undefined for a bucket URL: Supabase holds one size, so there is nothing to
 * choose between, and an <img> with no srcset simply uses its src.
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

// Set the first time Supabase refuses. Not persisted: a restriction that is
// lifted should reach the next visit, not the next month.
let bucketReachable = true;

/**
 * Stop asking Supabase for photographs.
 *
 * Called by App when the catalogue request fails, which is the cheapest probe
 * available — REST and Storage are restricted together, so one refusal already
 * answers for the other. Without this, an outage costs every visitor one failed
 * request per photograph before the fallbacks get their turn.
 */
export function markBucketUnreachable(): void {
  bucketReachable = false;
}

export function isBucketReachable(): boolean {
  return bucketReachable;
}

/**
 * Where to load the photo stored at e.g. "boardies/47.jpeg".
 *
 * A photograph this build shipped is served from here; anything else comes from
 * the bucket. So a garment photographed this morning still appears without a
 * deploy — Supabase is what makes new pictures reachable — while the ones
 * already on this site cost nobody's bandwidth.
 *
 * The bucket holds one size, and it is the full-resolution upload. Serving a
 * card from it means sending 564KB to fill 164 CSS pixels; the local copy at
 * the same place is 19KB with srcset choosing it. That difference is what put
 * 56GB through a 5GB allowance in August.
 *
 * To put the bucket first again — every photo from Supabase while it answers —
 * make this `if (bucketReachable) return REMOTE_PREFIX + path;` above the
 * lookup. One line, and it reverses.
 */
export function storageUrl(path: string): string {
  const local = localPhotoUrl(path);
  if (local) return local;
  return REMOTE_PREFIX ? REMOTE_PREFIX + path : '';
}

/** The stored path behind a bucket URL, or null if it is not one. */
function pathFromRemote(src: string): string | null {
  if (!REMOTE_PREFIX || !src.startsWith(REMOTE_PREFIX)) return null;
  return decodeURIComponent(src.slice(REMOTE_PREFIX.length).split('?')[0]);
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
  if (bucketReachable) return items;
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

  // One refusal is enough: spare every photograph after this one the same trip.
  markBucketUnreachable();

  const twin = localTwin(img.src);
  img.dataset.photoFallback = twin ? 'local' : 'placeholder';
  // Before src, and unconditionally: a srcset outranks src, so leaving one in
  // place would send the browser straight back to the URL that just failed.
  img.srcset = twin ? (srcSetFor(twin) ?? '') : '';
  img.src = twin ?? PHOTO_PLACEHOLDER;
}
