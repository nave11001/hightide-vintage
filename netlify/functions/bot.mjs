// Answers the Instagram bot from the live catalogue.
//
// ManyChat's Dynamic block will not talk to Supabase directly — it expects its
// own JSON shape — so this sits between them. It reads with the anon key, which
// is public and read-only under Row Level Security, and never writes anything.
//
//   /.netlify/functions/bot?size=32     which pieces fit a 32in waist
//   /.netlify/functions/bot?item=126    is #126 still available
//
// ManyChat gets Dynamic Block v2 JSON. Open the same URL in a browser and you
// get the message laid out the way the customer will see it — the raw JSON is
// unreadable in Hebrew, and the owner tests these by hand.

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

// A waist measurement only means something on the bottom half. A shirt marked
// M is not a 32in waist, and treating it as one filled the answer with
// garments that have nothing to do with what was asked.
const BOTTOMS = new Set(['boardies', 'women']);

/** Drawstrings forgive slack, not tightness. Kept tight so a reply is a
 *  recommendation and not a catalogue dump. */
function fitLabel(sizeInches, waistInches) {
  const slack = sizeInches - waistInches;
  if (slack < -1) return null;              // will not close, do not offer it
  if (slack < 1) return 'מתאים';
  if (slack <= 2) return 'רפוי מעט';
  return null;                              // too big to bother suggesting
}

/** 'M' -> 'm', 'Small' -> 's', '32' -> null */
function letterOf(size) {
  const s = String(size || '').trim().toLowerCase();
  const map = { small: 's', s: 's', medium: 'm', m: 'm', large: 'l', l: 'l', xl: 'xl', xxl: 'xxl' };
  return map[s] ?? null;
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

function manyChatBody(text, quickReplies) {
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

const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** The same answer, laid out for a person instead of for ManyChat. */
function previewPage(text) {
  const body = esc(text).replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" dir="ltr">$1</a>',
  );
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>תצוגה מקדימה — בוט HighTide</title>
<meta name="robots" content="noindex">
<style>
  body{margin:0;padding:24px;background:#0f172a;color:#e2e8f0;
       font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
  .wrap{max-width:520px;margin:0 auto}
  .note{font-size:13px;color:#94a3b8;margin:0 0 16px}
  .bubble{background:#1e293b;border-radius:18px 18px 18px 4px;padding:16px 18px;
          white-space:pre-wrap;overflow-wrap:anywhere}
  a{color:#7dd3fc}
</style></head>
<body><div class="wrap">
<p class="note">כך ההודעה תיראה ללקוח באינסטגרם. ManyChat מקבל את אותו תוכן בפורמט JSON.</p>
<div class="bubble">${body}</div>
</div></body></html>`;
}

/** Browsers ask for HTML; ManyChat does not. Answer each in its own language. */
function send(request, text, quickReplies = []) {
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return new Response(previewPage(text), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  return Response.json(manyChatBody(text, quickReplies));
}

export default async (request) => {
  const params = new URL(request.url).searchParams;
  const wantedSize = params.get('size');
  const wantedItem = params.get('item');

  if (!SUPABASE_URL || !ANON_KEY) {
    return send(request, 'אופס, יש תקלה זמנית. נחזור אליך תוך כמה דקות 🙏');
  }

  let items;
  try {
    items = await catalogue();
  } catch {
    return send(request, 'אופס, יש תקלה זמנית. נחזור אליך תוך כמה דקות 🙏');
  }

  // ── a specific piece ───────────────────────────────────────────────────
  if (wantedItem) {
    const num = parseInt(String(wantedItem).replace(/[^\d]/g, ''), 10);
    if (!num) {
      return send(request, 'לא זיהיתי את המספר. אפשר לשלוח רק את הספרות? למשל 126');
    }
    const found = items.find((i) => i.num === num);
    if (!found) {
      return send(
        request,
        `פריט #${num} כבר לא במלאי 😔\n\n` +
          `כל פריט אצלנו יחיד, אז ברגע שנמכר הוא נעלם.\n` +
          `מה שיש עכשיו: ${SHOP}`,
      );
    }
    return send(
      request,
      `פריט #${found.num} — זמין ✅\n\n` +
        `${found.name}\n` +
        `${CATEGORY_LABEL[found.category] || ''} · מידה ${found.size}\n` +
        `${priceText(found)}\n\n` +
        `${SHOP}/?item=${found.category}-${found.num}`,
    );
  }

  // ── everything that fits a waist ───────────────────────────────────────
  if (wantedSize) {
    const asked = String(wantedSize).trim();
    const askedLetter = letterOf(asked);
    const waist = sizeToInches(asked);

    if (!waist) {
      return send(
        request,
        'לא זיהיתי את המידה 🤔\n\n' +
          'אפשר לשלוח מספר באינצ׳ים (למשל 32)\n' +
          'או מידה באותיות (S / M / L / XL)',
      );
    }

    const matches = [];
    for (const item of items) {
      const isBottom = BOTTOMS.has(item.category);
      // A number is a waist, so it only speaks to bottoms. A letter matches
      // tops letter-for-letter, and bottoms through the waist it stands for.
      if (!isBottom && !askedLetter) continue;
      if (!isBottom) {
        if (letterOf(item.size) === askedLetter) {
          matches.push({ item, label: 'מתאים', gap: 0 });
        }
        continue;
      }
      const inches = sizeToInches(item.size);
      if (inches === null) continue;
      const label = fitLabel(inches, waist);
      if (label) matches.push({ item, label, gap: Math.abs(inches - waist) });
    }
    matches.sort((a, b) => a.gap - b.gap);

    const what = askedLetter ? asked.toUpperCase() : `${waist}`;
    if (matches.length === 0) {
      return send(
        request,
        `לא מצאתי כרגע פריטים במידה ${what} 😔\n\n` +
          `דרופ חדש נכנס כל שבוע — שווה לעקוב.\n${SHOP}`,
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

    return send(
      request,
      `מצאתי ${matches.length} פריטים שמתאימים למידה ${what} 🤙\n\n` +
        lines.join('\n\n') +
        more,
    );
  }

  return send(
    request,
    'שלחו מידה (למשל 32) או מספר פריט (למשל 126) ואבדוק במלאי.',
  );
};
