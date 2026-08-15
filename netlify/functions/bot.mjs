// Answers the Instagram bot from the live catalogue.
//
// ManyChat's Dynamic block will not talk to Supabase directly — it expects its
// own JSON shape — so this sits between them. It reads with the anon key, which
// is public and read-only under Row Level Security, and never writes anything.
//
//   /.netlify/functions/bot?size=32     which pieces fit a 32in waist
//   /.netlify/functions/bot?item=126    is #126 still available
//
// Response is ManyChat Dynamic Block v2.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SHOP = 'https://hightide-vintage.netlify.app';
const MAX_RESULTS = 6;

// Boardshort sizes are the waist in inches. Letters cover a range; these are
// the middle of each.
const LETTER_INCHES = {
  small: 30, s: 30, m: 32, medium: 32, l: 34, large: 34, xl: 36, xxl: 38,
};

/** '32' -> 32, '38-40' -> 38 (the narrow end has to close), 'L' -> 34 */
function sizeToInches(size) {
  const s = String(size || '').trim().toLowerCase();
  if (!s || s === 'one size') return null;
  const range = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return parseInt(range[1], 10);
  const plain = s.match(/^(\d+)$/);
  if (plain) {
    const n = parseInt(plain[1], 10);
    return n >= 24 && n <= 48 ? n : null;
  }
  return LETTER_INCHES[s] ?? null;
}

/** Drawstrings forgive slack, not tightness. */
function fitLabel(sizeInches, waistInches) {
  const slack = sizeInches - waistInches;
  if (slack < -2) return null;              // will not close, do not offer it
  if (slack < 0) return 'צמוד';
  if (slack <= 2) return 'מתאים';
  if (slack <= 4) return 'רפוי';
  return null;                              // too big to bother suggesting
}

async function catalogue() {
  const url =
    `${SUPABASE_URL}/rest/v1/items` +
    `?select=num,category,name,size,price,original_price,sold` +
    `&sold=eq.false&order=num.asc`;
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

const CATEGORY_LABEL = {
  boardies: 'בורדשורטס',
  shirts: 'חולצה',
  accessories: 'אקססורי',
  women: 'נשים',
};

function priceText(item) {
  return item.original_price
    ? `${item.price}₪ (במקום ${item.original_price}₪)`
    : `${item.price}₪`;
}

function reply(text, quickReplies = []) {
  return {
    version: 'v2',
    content: {
      messages: [{ type: 'text', text }],
      actions: [],
      quick_replies: quickReplies.map((title) => ({
        type: 'node',
        caption: title,
        target: '',
      })),
    },
  };
}

export default async (request) => {
  const params = new URL(request.url).searchParams;
  const wantedSize = params.get('size');
  const wantedItem = params.get('item');

  if (!SUPABASE_URL || !ANON_KEY) {
    return Response.json(reply('אופס, יש תקלה זמנית. נחזור אליך תוך כמה דקות 🙏'));
  }

  let items;
  try {
    items = await catalogue();
  } catch {
    return Response.json(reply('אופס, יש תקלה זמנית. נחזור אליך תוך כמה דקות 🙏'));
  }

  // ── a specific piece ───────────────────────────────────────────────────
  if (wantedItem) {
    const num = parseInt(String(wantedItem).replace(/[^\d]/g, ''), 10);
    if (!num) {
      return Response.json(reply('לא זיהיתי את המספר. אפשר לשלוח רק את הספרות? למשל 126'));
    }
    const found = items.find((i) => i.num === num);
    if (!found) {
      return Response.json(
        reply(
          `פריט #${num} כבר לא במלאי 😔\n\n` +
            `כל פריט אצלנו יחיד, אז ברגע שנמכר הוא נעלם.\n` +
            `מה שיש עכשיו: ${SHOP}`,
        ),
      );
    }
    return Response.json(
      reply(
        `פריט #${found.num} — זמין ✅\n\n` +
          `${found.name}\n` +
          `${CATEGORY_LABEL[found.category] || ''} · מידה ${found.size}\n` +
          `${priceText(found)}\n\n` +
          `${SHOP}/?item=${found.category}-${found.num}`,
      ),
    );
  }

  // ── everything that fits a waist ───────────────────────────────────────
  if (wantedSize) {
    const waist = sizeToInches(wantedSize);
    if (!waist) {
      return Response.json(
        reply(
          'לא זיהיתי את המידה 🤔\n\n' +
            'אפשר לשלוח מספר באינצ׳ים (למשל 32)\n' +
            'או מידה באותיות (S / M / L / XL)',
        ),
      );
    }

    const matches = [];
    for (const item of items) {
      const inches = sizeToInches(item.size);
      if (inches === null) continue;
      const label = fitLabel(inches, waist);
      if (label) matches.push({ item, label, gap: Math.abs(inches - waist) });
    }
    matches.sort((a, b) => a.gap - b.gap);

    if (matches.length === 0) {
      return Response.json(
        reply(
          `לא מצאתי כרגע פריטים במידה ${waist} 😔\n\n` +
            `דרופ חדש נכנס כל שבוע — שווה לעקוב.\n${SHOP}`,
        ),
      );
    }

    const lines = matches.slice(0, MAX_RESULTS).map(
      ({ item, label }) =>
        `#${item.num} · ${item.name} · מידה ${item.size} · ${priceText(item)} — ${label}\n` +
        `${SHOP}/?item=${item.category}-${item.num}`,
    );
    const more =
      matches.length > MAX_RESULTS
        ? `\n\nויש עוד ${matches.length - MAX_RESULTS} במידה שלך באתר 👇\n${SHOP}`
        : '';

    return Response.json(
      reply(
        `מצאתי ${matches.length} פריטים שמתאימים למידה ${waist} 🤙\n\n` +
          lines.join('\n\n') +
          more,
      ),
    );
  }

  return Response.json(
    reply('שלחו מידה (למשל 32) או מספר פריט (למשל 126) ואבדוק במלאי.'),
  );
};
