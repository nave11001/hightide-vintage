// The size rules, in one place.
//
// Both the shop (src/components/SizeLanding.tsx) and the Instagram bot
// (netlify/functions/bot.mjs) answer "what fits me". They have to answer it the
// same way, so the rules live here rather than in each of them.
//
// The sheets label garments three different ways and all three are legitimate:
//   "32"      a waist in inches
//   "32-34"   a waist the piece spans
//   "L"       a letter, mostly on older boardshorts
//
// A letter is not a waist. Treating "L" as 34 once turned a search for 32 into
// 24 results, most of which were not size 32 at all. So letters are kept in
// their own bucket and shown under a heading that says what they are.

export const LETTER_RANGE = {
  SMALL: [28, 30],
  S: [28, 30],
  M: [30, 32],
  L: [32, 34],
  XL: [34, 36],
  XXL: [36, 38],
};

export const LETTERS = ['S', 'M', 'L', 'XL', 'XXL'];

/** Waists we accept from a customer. Outside this, they mistyped. */
export const MIN_WAIST = 24;
export const MAX_WAIST = 48;

export const norm = (size) => String(size ?? '').trim().toUpperCase();

// The shop and the bot hold the same garment in two shapes: the shop's Product
// carries `sizes[]` / `isSold`, a Supabase row carries `size` / `sold`. Read
// through these rather than picking one and quietly matching nothing.
export const sizeOf = (item) =>
  item?.size ?? (Array.isArray(item?.sizes) ? item.sizes[0] : undefined);
export const soldOf = (item) => Boolean(item?.isSold ?? item?.sold);

/** True for the one label that fits everyone and therefore tells us nothing. */
export const isOneSize = (size) => norm(size) === 'ONE SIZE';

/**
 * A numeric label, or a range, as [low, high]. Letters return null on purpose —
 * see the note at the top.
 */
export function numericSpan(size) {
  const s = norm(size);
  const range = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const [lo, hi] = [+range[1], +range[2]];
    return lo <= hi ? [lo, hi] : [hi, lo];
  }
  const plain = s.match(/^(\d+)$/);
  if (!plain) return null;
  const n = +plain[1];
  return n >= MIN_WAIST && n <= MAX_WAIST ? [n, n] : null;
}

/** The waist range a letter label stands for, or null if it is not a letter. */
export function letterSpan(size) {
  if (isOneSize(size)) return null;
  return LETTER_RANGE[norm(size)] ?? null;
}

/** 'Small' -> 'S', 'm' -> 'M', '32' -> null. Used to match shirt to shirt. */
export function letterOf(size) {
  const s = norm(size);
  if (s === 'SMALL') return 'S';
  if (s === 'MEDIUM') return 'M';
  if (s === 'LARGE') return 'L';
  return LETTERS.includes(s) ? s : null;
}

/**
 * The size as the shop should print it: one letter, or the number as typed.
 *
 * The sheet holds `M` and `m` and `Small` and `s`, and the category filter
 * built its buttons straight from those strings — so a shopper who picked M
 * was shown five garments and quietly not shown the two filed under `m`. The
 * filter is right; the labels behind it were three spellings of one size.
 */
export function displaySize(size) {
  const s = norm(size);
  if (!s) return s;
  if (isOneSize(s)) return 'ONE SIZE';
  return letterOf(s) ?? s;
}

const covers = (span, n) => Boolean(span) && n >= span[0] && n <= span[1];

// Customers answer in their own words, not in the shape a form would demand.
// Real replies to "what size are you" include אל, לארג׳, W32, "32 אינץ",
// and "בערך 33". Each of these is a clear answer; refusing them would be the
// bot being difficult.
//
// These are dictionaries rather than clever matching on purpose: a wrong guess
// here quietly shows a woman men's trousers, so every accepted spelling is one
// somebody decided to accept. Add to them as real replies come in.
const SIZE_WORDS = {
  S: ['S', 'SM', 'SMALL', 'XS', 'סמול', 'אס', 'ס', 'קטן', 'קטנה'],
  M: ['M', 'MED', 'MEDIUM', 'מדיום', 'אם', 'אמ', 'מ', 'בינוני', 'בינונית', 'אמצע'],
  L: ['L', 'LG', 'LARGE', 'לארג', 'לרג', 'אל', 'ל', 'גדול', 'גדולה'],
  XL: ['XL', 'XLARGE', 'EXTRALARGE', 'אקסל', 'אקסלארג', 'איקסאל', 'אקסאל', 'אקסטרהלארג'],
  XXL: ['XXL', '2XL', 'XXLARGE', 'אקסאקסל', 'אקסאקסאל', 'אקסאקסלארג', 'איקסאיקסאל', '2אקסל'],
};

/** Every spelling above, flattened to the letter it means. */
const SIZE_LOOKUP = Object.fromEntries(
  Object.entries(SIZE_WORDS).flatMap(([letter, spellings]) =>
    spellings.map((word) => [word, letter]),
  ),
);

/** Drop the words and marks people wrap a size in, leaving the size itself. */
function tidySize(raw) {
  return norm(raw)
    .replace(/["'`׳״]/g, '')
    .replace(/מידה|אינטש|אינץ|בערך|SIZE/g, ' ')
    .replace(/\bW(?=\d)/g, ' ')     // W32
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * What the customer typed. A number is a waist and speaks to bottoms; a letter
 * speaks to shirts. Returns null when it is neither.
 */
export function parseSizeQuery(raw) {
  const s = tidySize(raw);
  if (!s) return null;

  // "אקס אל" and "אקסאל" are the same answer; close the gaps before looking up.
  const letter = letterOf(s) ?? SIZE_LOOKUP[s.replace(/[\s-]/g, '')];
  if (letter) return { kind: 'letter', letter };

  // First number wins: "32-34" and "בערך 33" both name a waist to search from.
  const found = s.match(/\d{2}/);
  if (found) {
    const n = +found[0];
    if (n >= MIN_WAIST && n <= MAX_WAIST) return { kind: 'waist', waist: n };
  }
  return null;
}

// The bot's buttons are written for the customer, so they send back Hebrew —
// but Instagram lets anyone type instead of tapping, and they do.
const GENDER_WORDS = {
  women: [
    'WOMEN', 'WOMAN', 'WOMENS', 'FEMALE', 'F', 'W', 'GIRL', 'GIRLS', 'LADY', 'LADIES',
    'נקבה', 'אישה', 'אשה', 'נשים', 'בת', 'בנות', 'גברת', 'ליידי', 'נשי', 'נשית',
    'לאישה', 'לאשה', 'לנשים', 'לבת', 'חברה', 'אשתי', 'בחורה', 'בחורות',
  ],
  men: [
    'MEN', 'MAN', 'MENS', 'MALE', 'M', 'BOY', 'BOYS', 'GUY', 'GUYS', 'GENTLEMAN',
    'זכר', 'גבר', 'גברים', 'בן', 'בנים', 'אדון', 'גברי', 'לגבר', 'לגברים',
    'לבן', 'חבר', 'בעלי', 'בחור', 'בחורים',
  ],
};

const GENDER_LOOKUP = Object.fromEntries(
  Object.entries(GENDER_WORDS).flatMap(([gender, spellings]) =>
    spellings.map((word) => [word, gender]),
  ),
);

/** Split an answer into comparable pieces: "בשביל אישה" should still read. */
function tokens(raw) {
  return norm(raw)
    .replace(/["'`׳״\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Which rail to show. Anything unrecognised falls to the men's side, where the
 * bulk of the stock is — see genderIsClear for telling that apart from a real
 * answer.
 */
export function parseGender(raw) {
  const parts = tokens(raw);
  const whole = parts.join('');
  return GENDER_LOOKUP[whole] ?? parts.map((t) => GENDER_LOOKUP[t]).find(Boolean) ?? 'men';
}

/** False when nothing in the answer was recognised, so the caller can say so. */
export function genderIsClear(raw) {
  const parts = tokens(raw);
  return Boolean(GENDER_LOOKUP[parts.join('')] ?? parts.map((t) => GENDER_LOOKUP[t]).find(Boolean));
}

/** Which catalogue category a gender choice means. */
export const categoryForGender = (gender) => (gender === 'women' ? 'women' : 'boardies');

/**
 * Split a category's stock against a waist: pieces actually labelled that size,
 * and pieces labelled with a letter that covers it. Sold pieces are dropped —
 * every garment here is one of a kind.
 *
 * @param {any[]} items
 * @param {number} waist
 * @param {{ category?: string }} [options]
 */
export function splitByWaist(items, waist, { category } = {}) {
  const pool = items.filter(
    (i) => !soldOf(i) && !isOneSize(sizeOf(i)) && (!category || i.category === category),
  );
  return {
    exact: pool.filter((i) => covers(numericSpan(sizeOf(i)), waist)),
    maybe: pool.filter((i) => covers(letterSpan(sizeOf(i)), waist)),
  };
}

/** Shirts whose letter matches, letter for letter. */
export function shirtsByLetter(items, letter) {
  return items.filter(
    (i) => !soldOf(i) && i.category === 'shirts' && letterOf(sizeOf(i)) === letter,
  );
}

/**
 * Sizes that do have stock, closest first. Turns an empty result into somewhere
 * to go — most waists the shop misses are one inch from one it carries.
 *
 * @param {any[]} items
 * @param {number} waist
 * @param {{ category?: string, limit?: number }} [options]
 */
export function nearestWaists(items, waist, { category, limit = 3 } = {}) {
  const counts = new Map();
  for (let n = MIN_WAIST; n <= MAX_WAIST; n += 1) {
    if (n === waist) continue;
    const { exact, maybe } = splitByWaist(items, n, { category });
    // Promise what the landing page will actually headline: the pieces
    // labelled that size, or the letter-labelled ones when that is all there
    // is. Counting both would offer 8 and then show 7.
    const count = exact.length || maybe.length;
    if (count > 0) counts.set(n, count);
  }
  return [...counts.entries()]
    .map(([size, count]) => ({ size, count, gap: Math.abs(size - waist) }))
    .sort((a, b) => a.gap - b.gap || b.count - a.count)
    .slice(0, limit);
}

/** Shirt sizes that have stock, ordered S -> XXL. */
export function availableShirtLetters(items) {
  return LETTERS.map((letter) => ({ letter, count: shirtsByLetter(items, letter).length }))
    .filter((s) => s.count > 0);
}

/** Most-viewed first. Views come from PostHog via scripts/sync_top_wanted.py. */
export const byViews = (a, b) => (b.views ?? 0) - (a.views ?? 0);
