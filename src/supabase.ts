// PostgREST over fetch, in place of @supabase/supabase-js.
//
// The SDK weighed 57KB gzipped — a quarter of the shop's JavaScript — and all
// of it was here to serve a single GET. Its auth, realtime, storage and
// functions clients were never touched, and storageUrl() below never needed it
// at all: that is string concatenation. What remains is the request the SDK
// would have sent, which is also the request netlify/functions/product-meta.mjs
// already makes by hand.
//
// Both values are safe to ship to the browser. The anon key only grants what
// the row level security policies allow — public read, no writes. Verified
// against the live project: INSERT is refused outright, and UPDATE and DELETE
// match zero rows. See supabase/schema.sql.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

const BUCKET = 'inventory';

// Product photos are served from this site, not from Supabase Storage.
//
// They used to come from the bucket, one download per shopper per hour. In
// August 2026 that pushed 56GB through a 5GB allowance and Supabase restricted
// the whole project — catalogue and pictures both — until it was paid for.
// Shipping the photos with the site removes that meter entirely, and Netlify
// serves them under a name that only changes when the picture does, so a
// returning customer downloads nothing.
//
// Built by scripts/make_inventory_web.py, which names each file after the item
// number the database knows it by. Verified: all 116 paths in the database
// resolve here.
const LOCAL_PHOTOS = import.meta.glob('@/assets/inventory-web/**/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** "boardies/104.jpg" -> the key make_inventory_web.py wrote. */
function localKey(path: string): string {
  return `/assets/inventory-web/${path.replace(/\.[^./]+$/, '')}.webp`;
}

/**
 * Where to load the photo stored at e.g. "boardies/47.jpeg".
 *
 * Falls back to the bucket for anything not in the build — a garment added to
 * the dashboard since the last deploy shows its picture rather than a hole.
 */
export function storageUrl(path: string): string {
  return LOCAL_PHOTOS[localKey(path)] ?? `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Read rows from a table.
 *
 * `params` is PostgREST's own query language, which is what the SDK was
 * building anyway — `select` takes embedded tables in the same syntax, and
 * `order` takes `column.asc`.
 *
 * Failures throw rather than return, so callers keep the try/catch they had.
 */
export async function selectRows<T>(
  table: string,
  params: Record<string, string>,
): Promise<T[]> {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  // A deadline, because the shop has somewhere else to go.
  //
  // The catalogue is tried first and the copy that ships with the site is the
  // fallback, so every second spent waiting here is a second of blank screen
  // for a shopper whose answer was already on disk. Without this the wait is
  // whatever the browser's own timeout happens to be — which during the August
  // outage meant 2.3 seconds of nothing on every single visit, and would mean
  // far longer if Supabase were slow rather than refusing outright.
  const deadline = AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined;

  const response = await fetch(`${url}/rest/v1/${table}?${new URLSearchParams(params)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    signal: deadline,
  });

  if (!response.ok) {
    // PostgREST puts the reason in the body. The status alone cannot tell a
    // misspelled column from a policy refusal, and both look identical in a
    // bug report a week later.
    throw new Error(`Supabase ${table} ${response.status}: ${await response.text()}`);
  }

  return response.json();
}
