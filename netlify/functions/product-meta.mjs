// Serves /product/<slug> with that garment's own title, description and photo
// written into the HTML.
//
// This is the whole reason product URLs are worth having. The shop is a React
// app: the garment is drawn by JavaScript, and the crawlers that build link
// previews for WhatsApp, Instagram and Facebook do not run any. Without this
// every one of the shop's links would unfurl with the same generic card and no
// photograph — a shop whose sales channel is Instagram DMs cannot afford that.
//
// Googlebot does execute JavaScript, so search would eventually manage without
// this. Sharing never would.
//
// The page is fetched fresh rather than baked at build time, because the thing
// most worth being current — whether the item is still available — changes in
// the dashboard, which does not trigger a deploy. A short cache keeps repeat
// unfurls of the same link cheap.

import { numFromSlug, productSlug } from '../../shared/slug.mjs';
import { brandName } from '../../shared/brands.mjs';
import { displaySize } from '../../shared/sizing.mjs';
import { categoryById } from '../../shared/categories.mjs';
import snapshot from '../../src/catalog-snapshot.json' with { type: 'json' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SHOP = 'https://hightide-vintage.netlify.app';

// Which item numbers have a share card in public/og/. A garment added since the
// last deploy has none, and falls back to the shop's cover.
const OG_ITEMS = new Set((snapshot.items ?? []).map((row) => row.n));

export const config = { path: ['/product/*', '/category/*'] };

const CATEGORY_WORD = {
  boardies: 'מכנסי גלישה וינטג׳',
  shirts: 'חולצת וינטג׳',
  accessories: 'אקססורי וינטג׳',
  women: 'פריט נשים וינטג׳',
};

/** For text inside a double-quoted HTML attribute. */
const attr = (value) =>
  String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** For a string inside a <script type="application/ld+json"> block. */
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

async function fetchItem(num) {
  if (!SUPABASE_URL || !ANON_KEY) return null;

  const query = new URLSearchParams({
    select: 'num,category,name,size,price,original_price,sold,item_photos(path,position)',
    num: `eq.${num}`,
    limit: '1',
  });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/items?${query}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!response.ok) return null;

  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

/**
 * The same garment out of the copy that ships with the site.
 *
 * Used when Supabase does not answer. Without it every product link returns
 * 404 during an outage — the page itself still draws, because the app has the
 * same snapshot, but search engines are told the garment does not exist and a
 * shared link unfurls as the shop rather than the item. For a business whose
 * links live in Instagram DMs that is the outage doing its real damage.
 */
function fromSnapshot(num) {
  const row = (snapshot.items ?? []).find((item) => item.n === num);
  if (!row) return null;
  return {
    num: row.n,
    category: row.c,
    name: row.b,
    size: row.s,
    price: row.p,
    original_price: row.o ?? null,
    sold: row.sold === 1,
    item_photos: (row.ph ?? []).map((path, position) => ({ path, position })),
    fromSnapshot: true,
  };
}

function buildHead(item, url) {
  const photos = [...(item.item_photos ?? [])].sort(
    (a, b) => a.position - b.position || a.path.localeCompare(b.path),
  );
  // This garment's own share card, served from here.
  //
  // It used to point at the bucket, which was wrong twice over: an unfurler
  // pulled the full-resolution upload — half a megabyte to draw a thumbnail,
  // from the metered store — and it broke completely the moment Supabase
  // stopped answering, which is when every link fell back to the shop's
  // generic cover. For a business whose links live in Instagram DMs, that
  // meant every shared garment looked like every other one.
  //
  // scripts/make_og_images.py writes one per catalogue item under a stable,
  // unhashed name, so this can be built without knowing the build.
  const image = OG_ITEMS.has(item.num)
    ? `${SHOP}/og/${item.num}.jpg`
    : `${SHOP}/og-cover.jpg`;

  const kind = CATEGORY_WORD[item.category] || 'פריט וינטג׳';
  // Spelled the same way the page spells it. This is the more important of the
  // two: the preview is what a customer reads in a DM before deciding whether
  // to open the link at all, so a misspelt brand does its damage here first.
  const brand = brandName(item.name);
  const size = displaySize(item.size);
  const title = `${brand} #${item.num} — ${kind} | HIGHTIDE VINTAGE`;
  const status = item.sold ? 'נמכר' : `₪${item.price}`;
  const description = item.sold
    ? `${kind} של ${brand}, מידה ${size}. הפריט נמכר — כל פריט אצלנו הוא יחיד.`
    : `${kind} של ${brand}, מידה ${size}, ₪${item.price}. פריט יחיד במלאי, מקורי ומאומת.`;

  // Two graphs: what the thing is, and where it sits. Google draws the second
  // as a path under the result — "hightide-vintage.netlify.app › בורדיז ›
  // billabong #66" — in place of a bare URL.
  const category = categoryById(item.category);
  const breadcrumb = category && {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'HIGHTIDE VINTAGE', item: SHOP },
      { '@type': 'ListItem', position: 2, name: category.name, item: `${SHOP}/category/${category.id}` },
      { '@type': 'ListItem', position: 3, name: `${brand} #${item.num}` },
    ],
  };

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${brand} #${item.num}`,
    description,
    image,
    sku: String(item.num),
    brand: { '@type': 'Brand', name: brand },
    offers: {
      '@type': 'Offer',
      url,
      price: item.price,
      priceCurrency: 'ILS',
      itemCondition: 'https://schema.org/UsedCondition',
      availability: item.sold
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
    },
  };

  return `<title>${attr(title)}</title>
    <meta name="description" content="${attr(description)}" />
    <link rel="canonical" href="${attr(url)}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="HIGHTIDE VINTAGE" />
    <meta property="og:locale" content="he_IL" />
    <meta property="og:url" content="${attr(url)}" />
    <meta property="og:title" content="${attr(`${brand} #${item.num}`)} — ${attr(status)}" />
    <meta property="og:description" content="${attr(description)}" />
    <meta property="og:image" content="${attr(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="product:price:amount" content="${attr(item.price)}" />
    <meta property="product:price:currency" content="ILS" />
    <meta property="product:availability" content="${item.sold ? 'oldout' : 'instock'}" />
    <!-- "oldout" is not a typo: it is the spelling the Open Graph product
         namespace defines. The word a person reads is in og:title above. -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${attr(image)}" />
    <script type="application/ld+json">${json(schema)}</script>${
      breadcrumb ? `\n    <script type="application/ld+json">${json(breadcrumb)}</script>` : ''
    }`;
}

/**
 * Swap the shop's own head tags for this garment's.
 *
 * The originals are removed rather than added to: a crawler handed two og:title
 * tags takes whichever it meets first, which would be the shop's.
 */
function rewrite(html, head) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/i, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, '')
    .replace('</head>', `${head}\n  </head>`);
}

/**
 * A category's head tags. No lookup needed — the wording is fixed per category
 * and lives in shared/categories.mjs, alongside the list the shop renders from.
 *
 * The shop's own cover picture is kept: a category is a room, not an object,
 * and picking one garment to stand for it would be arbitrary and would go stale
 * the moment it sold.
 */
function buildCategoryHead(category, url) {
  const title = `${category.title} | HIGHTIDE VINTAGE`;
  return `<title>${attr(title)}</title>
    <meta name="description" content="${attr(category.description)}" />
    <link rel="canonical" href="${attr(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="HIGHTIDE VINTAGE" />
    <meta property="og:locale" content="he_IL" />
    <meta property="og:url" content="${attr(url)}" />
    <meta property="og:title" content="${attr(category.title)}" />
    <meta property="og:description" content="${attr(category.description)}" />
    <meta property="og:image" content="${SHOP}/og-cover.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${SHOP}/og-cover.jpg" />`;
}

export default async (request) => {
  const url = new URL(request.url);

  // The shell is served whatever happens, so the app still boots and can show
  // its own not-found page. Only the status and the head tags differ.
  const shell = await fetch(new URL('/index.html', url.origin));
  const html = await shell.text();

  const ok = (head) =>
    new Response(rewrite(html, head), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });

  if (url.pathname.startsWith('/category/')) {
    const id = decodeURIComponent(url.pathname.replace(/^\/category\//, '').replace(/\/$/, ''));
    const category = categoryById(id);
    if (!category) {
      return new Response(html, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' },
      });
    }
    return ok(buildCategoryHead(category, `${SHOP}/category/${category.id}`));
  }

  const slug = decodeURIComponent(url.pathname.replace(/^\/product\//, '').replace(/\/$/, ''));
  const num = numFromSlug(slug);
  // Live first, because a price or a sold mark can change without a deploy.
  const item = num === null ? null : ((await fetchItem(num)) ?? fromSnapshot(num));

  if (!item) {
    return new Response(html, {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' },
    });
  }

  // Always advertise the canonical spelling, whatever spelling was followed —
  // including the sheet's own, now that brandName decides how a brand is spelt.
  return ok(buildHead(item, `${SHOP}/product/${productSlug(brandName(item.name), item.num)}`));
};
