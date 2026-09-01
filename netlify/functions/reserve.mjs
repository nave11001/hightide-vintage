// Records a hold request ("שריון") from the Instagram bot.
//
// The read-only bot endpoint is next door in bot.mjs. This one writes, so it is
// deliberately narrow: one table, insert only, and a shared secret ManyChat
// carries so the address alone is not an open door.
//
//   x-bot-key: …
//   /.netlify/functions/reserve?description=…&phone=…&user=…
//
// The secret belongs in the header. A query string travels in the clear through
// every access log it touches; a header usually does not. ?key= is still read so
// an already-configured automation keeps working while it is being moved over.
//
// The rows hold customers' phone numbers. They are never read back through this
// function and never written to the logs.
//
// Under Supabase that was the database's job: row level security granted anon
// INSERT and nothing else. Cloudflare D1 has no such thing, and does not need
// it in the same shape — no browser holds a D1 credential, so the only way in
// is a function we wrote. The guarantee moved from the database into the code,
// which means it now rests on this staying true: nothing selects from
// `reservations`. See cloudflare/schema.sql.

import { parseSizeQuery } from '../../shared/sizing.mjs';
import { d1Query, isD1Configured } from '../../shared/d1.mjs';

const SECRET = process.env.BOT_SHARED_SECRET;
const SHOP = 'https://hightide-vintage.netlify.app';

const MAX_DESCRIPTION = 500;
const MAX_PHONE = 30;

function manyChatBody(text) {
  return {
    version: 'v2',
    content: { type: 'instagram', messages: [{ type: 'text', text }] },
  };
}

const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

/** Browsers ask for HTML; ManyChat does not. Answer each in its own language. */
function send(request, text) {
  if ((request.headers.get('accept') || '').includes('text/html')) {
    return new Response(
      `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">` +
        `<title>שריון — בוט HighTide</title><meta name="robots" content="noindex">` +
        `<style>body{margin:0;padding:24px;background:#0f172a;color:#e2e8f0;` +
        `font:16px/1.7 system-ui,sans-serif}.b{max-width:520px;margin:0 auto;` +
        `background:#1e293b;border-radius:18px 18px 18px 4px;padding:16px 18px;` +
        `white-space:pre-wrap}</style></head><body><div class="b">${esc(text)}</div></body></html>`,
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
  return Response.json(manyChatBody(text));
}

/** Keep digits and a leading +; anything else in a phone field is noise. */
function tidyPhone(raw) {
  const s = String(raw ?? '').trim();
  const plus = s.startsWith('+') ? '+' : '';
  const digits = s.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 20 ? plus + digits : null;
}

/** "117" and "#117" name a piece; a sentence does not. */
function itemNumberIn(description) {
  const only = String(description).trim().match(/^#?(\d{1,4})$/);
  if (!only) return null;
  const n = Number(only[1]);
  // A bare number in this range is far more likely a waist than an item.
  return parseSizeQuery(only[1])?.kind === 'waist' ? null : n;
}

export default async (request) => {
  const params = new URL(request.url).searchParams;

  if (!isD1Configured || !SECRET) {
    return send(request, 'אופס, יש תקלה זמנית. כתבו לנו ונסדר את זה ידנית 🙏');
  }

  // Without this the address is a public write endpoint for anyone who finds it.
  const presented = request.headers.get('x-bot-key') ?? params.get('key');
  if (presented !== SECRET) {
    return new Response('Not found', { status: 404 });
  }

  const description = String(params.get('description') ?? '').trim().slice(0, MAX_DESCRIPTION);
  const phone = tidyPhone(params.get('phone'));

  if (!description) {
    return send(request, 'לא קלטתי מה תרצו לשריין 🤔\nאפשר לתאר את הפריט או לשלוח את מספרו.');
  }
  if (!phone) {
    return send(request, 'המספר לא נראה תקין 🤔\nאפשר לשלוח מספר טלפון עם קידומת?');
  }

  const row = {
    description,
    phone,
    instagram_user: String(params.get('user') ?? '').trim().slice(0, 120) || null,
    item_num: itemNumberIn(description),
  };

  try {
    // Bound parameters, never an interpolated string: every value here arrived
    // on a query string. The length limits the old RLS policy enforced are now
    // CHECK constraints on the table — see cloudflare/schema.sql.
    await d1Query(
      `INSERT INTO reservations (description, phone, instagram_user, item_num)
       VALUES (?, ?, ?, ?)`,
      [row.description, row.phone, row.instagram_user, row.item_num],
    );
  } catch {
    // No detail, ever. A D1 error can quote the statement back, and the
    // statement carries a phone number.
    console.error('reservation insert failed');
      return send(request, 'אופס, לא הצלחתי לשמור את הבקשה 🙏\nכתבו לנו כאן ונשריין ידנית.');
  }

  return send(
    request,
    'הבקשה נקלטה ✅\n\n' +
      'נחזור אליכם בהקדם לאישור השריון.\n' +
      'עלות השריון 50₪, והם יורדים מהמחיר הסופי.\n\n' +
      `בינתיים אפשר להמשיך לגלוש 👇\n${SHOP}`,
  );
};
