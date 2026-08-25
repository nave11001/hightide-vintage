import { Product } from './types';
import { productPath } from '@/shared/slug.mjs';

// The message a customer sends when they want a garment.
//
// It carries the garment's own address, and that address is what puts the
// photograph in the message. WhatsApp fetches any link it is given and draws
// og:title, og:description and og:image as a card above the text — and this
// shop already serves all three per garment, from
// netlify/functions/product-meta.mjs, with the cards themselves sitting in
// public/og/ (verified live: /og/70.jpg, 200, image/jpeg). So the picture
// costs nothing to send and nothing to build. It is the link that fetches it.
//
// The link also answers the older complaint, which is what these messages used
// to look like from the shop's side: a name and a price, and a garment to go
// and find. "Quiksilver #70 — ₪280" is not something you can answer from at
// speed. A link is.
//
// One blank line between the sentence and the URL, because WhatsApp will only
// preview a link it can see on its own, and a URL welded to the end of a
// sentence is frequently swallowed into it.

/** The shop's WhatsApp number, digits only, as wa.me wants it. */
const SHOP_NUMBER = '972528879922';

/**
 * Where the garment lives, absolute.
 *
 * Taken from the window rather than a constant, so a link always points at the
 * site it was copied from. On localhost that means a localhost URL with no
 * preview behind it, which is correct — there is no shop there to preview.
 */
export function productUrl(product: Product): string {
  return new URL(productPath(product.brand, product.num), window.location.origin).href;
}

/**
 * A wa.me link that opens WhatsApp with the message already written.
 *
 * `opening` replaces the first line for the places that word it differently —
 * the favourites drawer says where the shopper saw the garment.
 */
export function buyOnWhatsApp(product: Product, opening?: string): string {
  const text = [
    opening ??
      `שלום! אני מעוניין לרכוש את הפריט "${product.name}" במחיר ₪${product.price}. האם הוא זמין במלאי?`,
    productUrl(product),
  ].join('\n\n');

  return `https://wa.me/${SHOP_NUMBER}?text=${encodeURIComponent(text)}`;
}
