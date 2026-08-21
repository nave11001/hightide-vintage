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

/** Public URL of a photo stored at e.g. "boardies/47.jpeg". */
export function storageUrl(path: string): string {
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
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

  const response = await fetch(`${url}/rest/v1/${table}?${new URLSearchParams(params)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });

  if (!response.ok) {
    // PostgREST puts the reason in the body. The status alone cannot tell a
    // misspelled column from a policy refusal, and both look identical in a
    // bug report a week later.
    throw new Error(`Supabase ${table} ${response.status}: ${await response.text()}`);
  }

  return response.json();
}
