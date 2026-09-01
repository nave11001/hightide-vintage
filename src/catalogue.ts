// Where the shop gets its catalogue, now that it is not Supabase.
//
// This file replaces src/supabase.ts, and the change is smaller than it looks.
// The shop used to call Supabase directly, because Supabase issued a public key
// that was safe to ship inside a web page. Cloudflare D1 issues no such key —
// its token is a server credential — so the page asks this site's own endpoint
// and the endpoint asks D1. See netlify/functions/catalogue.mjs.
//
// One address, one GET, and the same rows come back in the same shape
// PostgREST used to return, so src/data.ts did not have to change how it reads
// them.
//
// Nothing here is a fallback. When this fails, App falls through to the
// catalogue cached in the browser and then to the copy that ships with the
// site — the same chain that kept the shop open through the Supabase outage,
// untouched.

/** The endpoint netlify/functions/catalogue.mjs answers on. */
const CATALOGUE_URL = '/api/catalogue';

/**
 * Read the catalogue.
 *
 * Failures throw rather than return, so callers keep the try/catch they had.
 */
export async function fetchCatalogue<T>(): Promise<T[]> {
  // A deadline, because the shop has somewhere else to go. Every second spent
  // waiting here is a second of blank screen for a shopper whose answer is
  // already on disk — during the August outage a missing deadline meant 2.3
  // seconds of nothing on every single visit.
  const deadline = AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined;

  const response = await fetch(CATALOGUE_URL, {
    headers: { Accept: 'application/json' },
    signal: deadline,
  });

  if (!response.ok) {
    throw new Error(`catalogue ${response.status}`);
  }

  return response.json();
}
