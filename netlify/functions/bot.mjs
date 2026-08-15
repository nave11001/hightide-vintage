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

import {
  parseSizeQuery,
  splitByWaist,
  shirtsByLetter,
  nearestWaists,
  availableShirtLetters,
  categoryForGender,
  parseGender,
  byViews,
} from '../../shared/sizing.mjs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SHOP = 'https://hightide-vintage.netlify.app';
const MAX_RESULTS = 5;

async function catalogue() {
  const url =
    `${SUPABASE_URL}/rest/v1/items` +
    // views drives the ranking — without it every sort is a no-op.
    `?select=num,category,name,size,price,original_price,sold,views` +
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

/** Hebrew takes a hyphen after the vav before a numeral, but not before a word. */
function joinHe(parts) {
  return parts.reduce(
    (acc, part, i) => (i === 0 ? part : `${acc} ${/^\d/.test(part) ? 'ו-' : 'ו'}${part}`),
    '',
  );
}

function priceText(item) {
  return item.original_price
    ? `${item.price}₪ (במקום ${item.original_price}₪)`
    : `${item.price}₪`;
}

// Dynamic Block v2. `type` names the channel and is required — without it
// ManyChat does not know where to send the message and drops to the block's
// fallback step, which reads exactly like the server being down.
// https://manychat.github.io/dynamic_block_docs/
function manyChatBody(text, quickReplies) {
  const content = {
    type: 'instagram',
    messages: [{ type: 'text', text }],
  };
  // Both arrays are optional; send them only when they carry something.
  if (quickReplies.length > 0) {
    content.quick_replies = quickReplies.map((title) => ({
      type: 'node',
      caption: title,
      target: '',
    }));
  }
  return { version: 'v2', content };
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
      return send(
        request,
        `לא זיהיתי את המספר. אפשר לשלוח רק את הספרות? למשל 126\n\n${SHOP}`,
      );
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

  // ── both sizes at once: one short line and one link ────────────────────
  //
  // The bot asks for a waist and then a shirt letter, so by this point it
  // holds both. Rather than pasting two lists into a DM, it hands over the
  // landing page, where each type gets its own rail of the five most-wanted.
  const rawWaist = params.get('waist');
  const rawShirt = params.get('shirt');
  if (rawWaist || rawShirt) {
    const gender = parseGender(params.get('gender'));
    const category = categoryForGender(gender);
    const trouserWord = gender === 'women' ? 'מכנסי נשים' : 'מכנסיים';

    const waistQuery = rawWaist ? parseSizeQuery(rawWaist) : null;
    const shirtQuery = rawShirt ? parseSizeQuery(rawShirt) : null;
    const waist = waistQuery?.kind === 'waist' ? waistQuery.waist : null;
    const shirt = shirtQuery?.kind === 'letter' ? shirtQuery.letter : null;

    if (waist === null && shirt === null) {
      return send(
        request,
        'לא זיהיתי את המידות 🤔\n\n' +
          'למכנסיים — מספר באינצ׳ים (למשל 32)\n' +
          'לחולצה — אות (S / M / L / XL)\n\n' +
          `בינתיים אפשר לראות הכל כאן 👇\n${SHOP}`,
      );
    }

    const pants = waist === null ? { exact: [], maybe: [] } : splitByWaist(items, waist, { category });
    const shirts = shirt === null ? [] : shirtsByLetter(items, shirt);

    const link =
      `${SHOP}/?` +
      [
        waist === null ? '' : `waist=${waist}&gender=${gender}`,
        shirt === null ? '' : `shirt=${shirt}`,
      ]
        .filter(Boolean)
        .join('&');

    const found = [
      pants.exact.length === 1 ? 'מכנס אחד' : pants.exact.length ? `${pants.exact.length} ${trouserWord}` : '',
      shirts.length === 1 ? 'חולצה אחת' : shirts.length ? `${shirts.length} חולצות` : '',
    ].filter(Boolean);

    if (found.length === 0) {
      const near = waist === null ? [] : nearestWaists(items, waist, { category });
      const options = near
        .map((s) => `מידה ${s.size} — ${s.count === 1 ? 'פריט אחד' : `${s.count} פריטים`}`)
        .join('\n');
      return send(
        request,
        'אין לנו כרגע במידות שלך 😔\n\n' +
          (options ? `אבל יש במידות האלה:\n${options}\n\n` : 'דרופ חדש נכנס כל שבוע.\n\n') +
          link,
      );
    }

    const extra = pants.maybe.length
      ? `\nועוד ${pants.maybe.length} שעשויים להתאים לך.`
      : '';

    const yours = waist !== null && shirt !== null ? 'במידות שלך' : 'במידה שלך';
    return send(
      request,
      `מצאתי ${joinHe(found)} ${yours} 🤙${extra}\n\n` +
        `הכל מחכה לך כאן 👇\n${link}`,
    );
  }

  // ── a single size, the older one-question flow ─────────────────────────
  if (wantedSize) {
    const query = parseSizeQuery(wantedSize);
    if (!query) {
      return send(
        request,
        'לא זיהיתי את המידה 🤔\n\n' +
          'למכנסיים — מספר באינצ׳ים (למשל 32)\n' +
          'לחולצה — אות (S / M / L / XL)\n\n' +
          `בינתיים אפשר לראות הכל כאן 👇\n${SHOP}`,
      );
    }

    const isWaist = query.kind === 'waist';
    const gender = parseGender(params.get('gender'));
    const category = isWaist ? categoryForGender(gender) : 'shirts';
    const label = isWaist ? String(query.waist) : query.letter;
    const noun = isWaist ? (gender === 'women' ? 'מכנסי נשים' : 'מכנסיים') : 'חולצות';
    const landing = `${SHOP}/?size=${encodeURIComponent(label)}` + (isWaist ? `&gender=${gender}` : '');

    const { exact, maybe } = isWaist
      ? splitByWaist(items, query.waist, { category })
      : { exact: shirtsByLetter(items, query.letter), maybe: [] };

    // Nothing at all — point at the sizes that do have stock instead of
    // closing the conversation.
    if (exact.length === 0 && maybe.length === 0) {
      const near = isWaist
        ? nearestWaists(items, query.waist, { category })
        : availableShirtLetters(items).filter((s) => s.letter !== query.letter);
      const options = near
        .map((s) => `מידה ${s.size ?? s.letter} — ${s.count === 1 ? 'פריט אחד' : `${s.count} פריטים`}`)
        .join('\n');
      return send(
        request,
        `אין לנו כרגע ${noun} במידה ${label} 😔\n\n` +
          (options ? `אבל יש במידות האלה:\n${options}\n\n` : 'דרופ חדש נכנס כל שבוע.\n\n') +
          SHOP,
      );
    }

    const line = (item) =>
      `#${item.num} · ${item.name} · מידה ${item.size} · ${priceText(item)}\n` +
      `${SHOP}/?item=${item.category}-${item.num}`;

    const top = [...exact].sort(byViews).slice(0, MAX_RESULTS).map(line);
    const more =
      exact.length > MAX_RESULTS
        ? `\n\nויש עוד ${exact.length - MAX_RESULTS} במידה שלך 👇\n${landing}`
        : '';

    // Letter-labelled pieces are a weaker claim than a numeric label, so they
    // are named as such rather than mixed into the count.
    const alsoFits = [...maybe].sort(byViews).slice(0, 3);
    const alsoText = alsoFits.length
      ? `\n\nוגם אלה עשויים להתאים:\n` +
        alsoFits.map((i) => `#${i.num} · ${i.name} · מידה ${i.size} · ${priceText(i)}`).join('\n')
      : '';

    if (exact.length === 0) {
      return send(
        request,
        `אין ${noun} מסומנים במידה ${label}, אבל אלה עשויים להתאים 🤙\n\n` +
          [...maybe].sort(byViews).slice(0, MAX_RESULTS).map(line).join('\n\n') +
          `\n\n${landing}`,
      );
    }

    return send(
      request,
      `מצאתי ${exact.length} ${noun} במידה ${label} 🤙\n\n` +
        top.join('\n\n') +
        more +
        alsoText,
    );
  }

  return send(
    request,
    `שלחו מידה (למשל 32) או מספר פריט (למשל 126) ואבדוק במלאי.\n\n${SHOP}`,
  );
};
