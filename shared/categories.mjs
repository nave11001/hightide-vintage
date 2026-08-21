// The shop's categories, in one place.
//
// `name` is the button label inside the shop. `title` and `description` are
// what Google prints and what a shared link says, so they are written as a
// person would search rather than as the shop names its own tabs — nobody
// searches for "בורדיז".
//
// Plain .mjs, like slug.mjs, because the Netlify function that writes the head
// tags cannot import TypeScript, and a second copy of this would drift.

export const CATEGORIES = [
  {
    id: 'all',
    name: 'כל הפריטים',
    title: 'כל פריטי הוינטג׳',
    description:
      'כל המלאי: מכנסי גלישה, חולצות, אקססוריז ופריטי נשים וינטג׳ מקוריים. כל פריט יחיד במלאי.',
  },
  {
    id: 'boardies',
    name: 'בורדיז',
    title: 'מכנסי גלישה וינטג׳ — בורדשורטס מקוריים',
    description:
      'בורדשורטס וינטג׳ מקוריים של תור הזהב — Billabong, Quiksilver, O׳Neill, Rip Curl. כל פריט יחיד במלאי.',
  },
  {
    id: 'shirts',
    name: 'חולצות',
    title: 'חולצות וינטג׳ מקוריות',
    description:
      'חולצות וסווטשרטים וינטג׳ מקוריים מתור הזהב של הגלישה. כל פריט יחיד במלאי.',
  },
  {
    id: 'accessories',
    name: 'אקססוריז',
    title: 'אקססוריז וינטג׳',
    description: 'כובעים, חגורות ואקססוריז וינטג׳ מקוריים. כל פריט יחיד במלאי.',
  },
  {
    id: 'women',
    name: 'נשים',
    title: 'וינטג׳ לנשים — Roxy ועוד',
    description:
      'פריטי וינטג׳ מקוריים לנשים — Roxy, Billabong ועוד. כל פריט יחיד במלאי.',
  },
];

/**
 * The newest arrivals. A view of the catalogue rather than a column in it,
 * which is why it is not in the list above — but it still deserves an address.
 */
export const LATEST = {
  id: 'latest',
  name: 'הדרופ האחרון',
  title: 'הדרופ האחרון',
  description: 'הפריטים שהגיעו אחרונים לחנות. דרופ חדש כל שבוע.',
};

const BY_ID = new Map([...CATEGORIES, LATEST].map((c) => [c.id, c]));

/** The category with this id, or null. Used to reject invented addresses. */
export function categoryById(id) {
  return BY_ID.get(String(id ?? '')) ?? null;
}
