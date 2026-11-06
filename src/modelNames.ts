// Model names — "Blue Ripple" under QUIKSILVER.
//
// They live in the `model` column in D1, where the owner edits them in
// Cloudflare like everything else (moved there from a table in this file on
// 2026-11-06). An item with no model shows its brand alone.

/** Words typed into the name column that are not brands at all. */
const NOT_BRANDS = new Set(['fire', 'local', 'gray', 'flowers', 'firefighter']);

/**
 * The brand and the model a garment shows, from the name and model typed in
 * the database. "Billabong × Taj Burrow" with a model becomes brand
 * "Billabong", model "Taj Burrow". Without a model, both stay what they were.
 */
export function brandAndModel(typed: string, model?: string | null): { brand: string; name: string; maker?: string } {
  const named = model?.trim();
  // `brand` stays the name as typed (spelled by shared/brands.mjs): product
  // addresses are made from it, here and in netlify/functions/product-meta.mjs,
  // and the two have to agree. `maker` is only what the cards print above the
  // model: "Billabong × Taj Burrow" shows as BILLABONG over "Taj Burrow".
  if (!named) return { brand: typed, name: typed };
  const maker = typed.split(/\s+[×xX]\s+/)[0].trim();
  return { brand: typed, name: named, maker: NOT_BRANDS.has(maker.toLowerCase()) ? undefined : maker };
}
