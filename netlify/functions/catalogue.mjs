import { loadCatalogue } from '../../shared/d1.mjs';

// The shop's catalogue, served to the browser.
//
// This function exists because of the one real difference between Supabase and
// D1: Supabase had a public anon key, so the page fetched the catalogue itself.
// D1 has no browser-safe credential, so the page asks this instead and the
// token stays on the server.
//
// The response is deliberately the same shape src/data.ts already parsed out of
// PostgREST — the same field names, `sold` as a boolean, and photos nested
// under `item_photos` — so nothing downstream had to learn a new format.
//
// Read-only by construction: one SELECT, no parameters from the request, and
// no path from here to `reservations`.

export const config = { path: '/api/catalogue' };

export default async function handler() {
  try {
    const items = await loadCatalogue();
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Thirty seconds at the edge, and a stale copy may be served for five
        // minutes after that while a fresh one is fetched behind it. Marking an
        // item sold shows up within the minute, and a burst of visitors costs
        // one query rather than one each.
        'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    // Status only, never the message: it can quote the statement back.
    console.error('catalogue: D1 unavailable');
    return new Response(JSON.stringify({ error: 'catalogue unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
