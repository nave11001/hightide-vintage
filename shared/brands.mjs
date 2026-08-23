// How a brand is spelled in the shop.
//
// The catalogue is typed by hand into a spreadsheet, so the same brand arrives
// in several spellings: Billabong and billabong were two separate names over
// sixteen garments, PICKO and PIKO split seven more. Two of them were simply
// wrong — Quiksilver has no `c` and O'Neill is not `Oniell` — on a shop whose
// item page promises "100% מקורי ומאומת". A customer who knows surf brands
// reads a misspelt one as a shop that does not know what it is selling.
//
// So: one table, keyed by the spelling lowercased, holding the name the brand
// actually uses. Anything not in it passes through with its own capitalisation
// intact — an unknown brand is left alone rather than mangled by a title-case
// rule that would turn RR into Rr.
//
// Links are safe across a rename: a product's address ends in its catalogue
// number and numFromSlug reads the trailing digits, so /product/quicksilver-70
// and /product/quiksilver-70 both resolve to item 70. See shared/slug.mjs.
//
// Plain .mjs so the Netlify function that writes share-card tags can import it
// too — the brand in a WhatsApp preview has to match the brand on the page.

const CANONICAL = {
  // Misspelt in the sheet. These are the ones that cost credibility.
  quicksilver: 'Quiksilver',
  quiksilver: 'Quiksilver',
  oniell: "O'Neill",
  oneill: "O'Neill",
  "o'neil": "O'Neill",
  picko: 'PIKO',
  piko: 'PIKO',

  // Right name, inconsistent case — one brand split across two listings.
  billabong: 'Billabong',
  'rip curl': 'Rip Curl',
  ripcurl: 'Rip Curl',
  roxy: 'Roxy',
  volcom: 'Volcom',
  'hang ten': 'Hang Ten',
  'ocean pacific': 'Ocean Pacific',
  kirra: 'Kirra',
  'captain santa': 'Captain Santa',
  'rude boyz': 'Rude Boyz',
  't&c shirts': 'T&C Surf',
  'andy irons': 'Andy Irons',

  // Collaborations, set with a multiplication sign rather than a bare x —
  // it is how the garments themselves are labelled, and these are the pieces
  // worth naming precisely.
  'billabong x bob marley': 'Billabong × Bob Marley',
  'billabong x andy irons': 'Billabong × Andy Irons',
  'billabong x taj burrow': 'Billabong × Taj Burrow',

  // Not brands at all — a print, a colour, a note to self. Tidied so they do
  // not read as sloppy, but left in place: renaming a garment is the owner's
  // call, not this table's.
  fire: 'Fire',
  firefighter: 'Firefighter',
  flowers: 'Flowers',
  gray: 'Gray',
  local: 'Local',
  hawaii: 'Hawaii',
  hawaiian: 'Hawaiian',
  rr: 'RR',
  't&r': 'T&R',
};

/** The brand as the shop should print it. Unknown spellings pass through. */
export function brandName(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return text;
  return CANONICAL[text.toLowerCase()] ?? text;
}
