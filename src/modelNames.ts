// Model names — "Blue Ripple" under QUIKSILVER — by item number.
//
// Proposed from the photos on 2026-10-17 and approved by the owner on the
// site. Kept here until they move to a `model` column in D1, where the owner
// can edit them in Cloudflare like everything else; an item with no entry
// shows its brand alone, as before.

const MODEL_NAMES: Record<number, string> = {
  43: "Fire",
  49: "Hibiscus Flame",
  57: "Platinum X",
  63: "Red Diamond Check",
  66: "Green Script",
  78: "Aqua Lime Chevron",
  87: "Yin Yang Stripe",
  88: "Hibiscus Barrel",
  90: "Orange Lei",
  96: "Yellow Flare",
  98: "Neon Rays",
  99: "Grey Prism Panels",
  101: "Graffiti Letters",
  111: "Hammerhead Surf",
  117: "Aqua Hibiscus",
  130: "Charcoal Outline",
  133: "Navy Sunburst",
  139: "Purple Kangaroo",
  140: "Blue Plaid Script",
  142: "Sunset Stripe",
  143: "Rising Sun",
  145: "Aqua Plaid Rays",
  146: "Calligraphy Plaid",
  147: "Gothic Plaid",
  148: "Pink Peach Plaid",
  150: "Lemon Plaid",
  151: "Navy Gothic Patch",
  152: "Black Shadow Plaid",
  153: "Turquoise Script",
  154: "Aqua Plaid Panel",
  156: "Black Blue Plaid",
  159: "Pipemaster",
  160: "Amber Star Crown",
  162: "Red Medallion Bolt",
  163: "Blue Paint Splash",
  166: "Rainbow Arch",
  168: "Sky Gothic Script",
  169: "Green Halftone",
  170: "Flash",
  171: "White Plaid Curve",
  172: "Bobby Martinez",
  173: "Aqua Peach Script",
  174: "Sky Pinstripe",
  175: "Black Aqua Rings",
  178: "Mono Block Check",
  179: "White Script",
  180: "Casino Knockout",
  181: "Taj Burrow",
  182: "Black Stag",
  184: "Sketch Bloom",
  187: "Lime Swoop",
  188: "Joel Parkinson",
  189: "Red Graffiti",
  190: "Sandstone Panel",
  191: "Checker Collage",
  192: "Lime Lagoon Plaid",
  193: "White Star Panels",
  194: "Red Navy Block",
  195: "Red Gold Streak",
  196: "Hawaiian",
  197: "Flame Hibiscus",
  200: "Bamboo Footprints",
  201: "Red Hot Rod",
  202: "Scarlet Team Polo",
  205: "Navy Hibiscus Tank",
  206: "Aloha",
  207: "Blue Diamond Swirl",
  211: "Coral Square",
};

/** Words typed into the name column that are not brands at all. */
const NOT_BRANDS = new Set(['fire', 'local', 'gray', 'flowers', 'firefighter']);

/**
 * The brand and the model a garment shows, from the name typed in the
 * database. "Billabong × Taj Burrow" with a model becomes brand "Billabong",
 * model "Taj Burrow". Without a proposed model, both stay what they were.
 */
export function brandAndModel(typed: string, num: number): { brand: string; name: string; maker?: string } {
  const model = MODEL_NAMES[num];
  // `brand` stays the name as typed (spelled by shared/brands.mjs): product
  // addresses are made from it, here and in netlify/functions/product-meta.mjs,
  // and the two have to agree. `maker` is only what the cards print above the
  // model: "Billabong × Taj Burrow" shows as BILLABONG over "Taj Burrow".
  if (!model) return { brand: typed, name: typed };
  const maker = typed.split(/\s+[×xX]\s+/)[0].trim();
  return { brand: typed, name: model, maker: NOT_BRANDS.has(maker.toLowerCase()) ? undefined : maker };
}
