// Cloudflare D1 over its HTTP API, for the Netlify functions.
//
// This replaces src/supabase.ts, and the difference that matters is who holds
// the key. Supabase shipped an anon key inside the website and let the browser
// read the catalogue directly; row level security was what stopped that same
// key reading customers' phone numbers.
//
// D1 has no browser-safe key and no row level security. The token here is a
// server credential and never reaches a page, so nothing in a browser can
// reach the database at all — it can only ask a function we wrote. That is a
// tighter default, and it moves one guarantee out of the database and into
// this code: `reservations` is written by reserve.mjs and read by nothing that
// answers a request from the internet. See cloudflare/schema.sql.
//
// Three environment variables, set in the Netlify dashboard and in .env
// locally: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID and
// CLOUDFLARE_API_TOKEN.

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const DATABASE = process.env.CLOUDFLARE_D1_DATABASE_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;

export const isD1Configured = Boolean(ACCOUNT && DATABASE && TOKEN);

/**
 * Run one statement and return its rows.
 *
 * Parameters are bound, never interpolated — every caller here takes values
 * from a query string or from ManyChat, and a hand-built SQL string is how
 * that becomes someone else's database.
 *
 * Throws on failure, so callers keep the try/catch they already had around
 * the Supabase version.
 */
export async function d1Query(sql, params = []) {
  if (!isD1Configured) {
    throw new Error(
      'Cloudflare D1 is not configured. Set CLOUDFLARE_ACCOUNT_ID, ' +
        'CLOUDFLARE_D1_DATABASE_ID and CLOUDFLARE_API_TOKEN.',
    );
  }

  // A deadline, because every caller has somewhere else to go: the shop falls
  // back to the catalogue it ships with, and the bot has a person waiting.
  const deadline = AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DATABASE}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
      signal: deadline,
    },
  );

  if (!response.ok) {
    // Status only. The body can echo back the statement, and a statement can
    // carry a phone number.
    throw new Error(`D1 HTTP ${response.status}`);
  }

  const body = await response.json();
  if (!body.success) {
    const why = (body.errors || []).map((e) => e.message).join('; ');
    throw new Error(`D1 refused: ${why || 'unknown error'}`);
  }

  // One statement in, so one result set out.
  return body.result?.[0]?.results ?? [];
}

/**
 * The catalogue, in the shape the shop and the bot both expect.
 *
 * Photos come back from a second query rather than a join: SQLite would repeat
 * every garment once per photograph, and the shop wants one row per garment
 * with its pictures nested — which is what Supabase's embedded select gave.
 */
export async function loadCatalogue() {
  const items = await d1Query(
    `SELECT id, num, category, name, size, price, original_price, drop_date,
            sold, waist_cm, length_cm, views
       FROM items
      WHERE category IS NOT NULL
      ORDER BY num ASC`,
  );

  const photos = await d1Query(
    `SELECT item_id, path, position FROM item_photos ORDER BY item_id, position, path`,
  );

  const byItem = new Map();
  for (const photo of photos) {
    const list = byItem.get(photo.item_id) ?? [];
    list.push({ path: photo.path, position: photo.position });
    byItem.set(photo.item_id, list);
  }

  return items.map((item) => ({
    ...item,
    // SQLite has no boolean; the column is 0/1 and every caller wants a real one.
    sold: item.sold === 1,
    item_photos: byItem.get(item.id) ?? [],
  }));
}
