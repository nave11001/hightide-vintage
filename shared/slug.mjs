// Product URLs: /product/billabong-142
//
// Plain .mjs, next to sizing.mjs, because both the browser bundle and the
// Netlify function that writes the share-card tags have to agree on what a
// product's address is. Two copies of this would drift and break links.
//
// The number carries the identity and the brand is there for people and for
// Google. That split is deliberate: item numbers are unique across the whole
// catalogue, so a link keeps working after a brand is renamed or re-spelled,
// and the shop can redirect it to the current spelling instead of 404ing. Links
// live for years in Instagram DMs; the words in them do not.

/** Lowercase, ASCII, hyphen-separated. 'T&C SHIRTS' -> 't-c-shirts'. */
export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The canonical address for an item.
 * @param {string} brand e.g. 'Billabong X Bob Marley'
 * @param {number|string} num the catalogue number
 */
export function productSlug(brand, num) {
  const name = slugify(brand);
  return name ? `${name}-${num}` : String(num);
}

/** The path a product lives at, ready for history.pushState. */
export function productPath(brand, num) {
  return `/product/${productSlug(brand, num)}`;
}

/**
 * The item number inside a slug, or null.
 *
 * Reads the trailing digits, so every past spelling of a brand resolves to the
 * same item. Also accepts the bot's older `boardies-126` ids unchanged.
 */
export function numFromSlug(slug) {
  const match = /(\d+)$/.exec(String(slug ?? '').trim());
  return match ? Number(match[1]) : null;
}
