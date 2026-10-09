// Where the visitor is, and what a dollar costs today — for src/i18n.ts, which
// shows the shop in English with dollar prices to visitors from abroad.
//
// The country comes from Netlify, which reads it off the connection; nothing
// is stored. The rate is the Bank of Israel's representative rate, kept in
// memory for a few hours so a busy day costs a handful of calls to the bank
// rather than one per visitor.

export const config = { path: '/api/locale' };

const RATE_URL = 'https://boi.org.il/PublicApi/GetExchangeRate?key=USD';
const RATE_TTL_MS = 6 * 60 * 60 * 1000;

let cached = { rate: null, at: 0 };

async function usdRate() {
  if (cached.rate && Date.now() - cached.at < RATE_TTL_MS) return cached.rate;
  try {
    const response = await fetch(RATE_URL, { signal: AbortSignal.timeout(3000) });
    const body = await response.json();
    const rate = Number(body.currentExchangeRate);
    if (rate > 1 && rate < 10) cached = { rate, at: Date.now() };
  } catch {
    // Keep whatever was there; the page has its own fallback for none at all.
  }
  return cached.rate;
}

export default async function handler(request, context) {
  const country = context.geo?.country?.code ?? null;
  return new Response(JSON.stringify({ country, usd: await usdRate() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Per visitor — the country is theirs — so never shared by a cache.
      'Cache-Control': 'private, no-store',
    },
  });
}
