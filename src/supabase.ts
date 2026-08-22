// PostgREST over fetch, in place of @supabase/supabase-js.
//
// The SDK weighed 57KB gzipped — a quarter of the shop's JavaScript — and all
// of it was here to serve a single GET. Its auth, realtime, storage and
// functions clients were never touched. What remains is the request the SDK
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

// Photo URLs and their fallbacks live in src/photos.ts — that is picture
// plumbing, not database plumbing, and it has to keep working when everything
// below this line has stopped answering.

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
