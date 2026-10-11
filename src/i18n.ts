// The shop in English, with prices in dollars, for visitors from abroad.
//
// One site, two languages. The language is settled once, before the first
// render (see main.tsx), and does not change while the page is open — switching
// it reloads the page. That is what lets every component simply ask `tr()` and
// `money()` without a context, a provider or a re-render to think about.
//
// How it is settled, first match wins:
//   1. ?lang=en / ?lang=he in the address — a link that opens in a given
//      language. For that visit only: a link someone was sent, or tried once,
//      must not decide every visit after it.
//   2. A choice made with the switch in the menu. That one is remembered.
//   3. Search engines always get Hebrew. Google crawls from the US; left to the
//      country rule it would index the English shop and the Hebrew one would
//      drop out of search in Israel.
//   4. A device set up in Israel gets Hebrew: the clock on Israel time, or
//      Hebrew among the browser's languages. Checked before the address
//      because a VPN — in the browser or on the phone — moves the address
//      abroad and moves neither of these. The owner, on an Israeli phone with
//      a VPN on, was shown the English shop.
//   5. The visitor's country, from /api/locale: outside Israel is English.
//   6. Hebrew — including whenever the answer does not come in time.
//
// Dollar prices are the shekel price at the Bank of Israel's representative
// rate, rounded up to a whole dollar. The shekel price in the database stays
// the only price anyone types in.

export type Lang = 'he' | 'en';

// _v2: the first version also saved a ?lang= from a link here, so a tried
// link stuck for good. Those are left behind rather than trusted.
const CHOICE_KEY = 'hightide_lang_v2';
const SESSION_KEY = 'hightide_lang_visit';
const LOCALE_KEY = 'hightide_locale';
/** How long a looked-up country and rate are trusted before asking again. */
const LOCALE_TTL_MS = 12 * 60 * 60 * 1000;
/** How long the first paint may wait for the country. The splash covers it. */
const LOOKUP_TIMEOUT_MS = 1500;
/**
 * Used only when the rate cannot be fetched at all. Deliberately on the low
 * side of the shekel's range, so that a stale fallback over-prices in dollars
 * rather than under-pricing.
 */
const FALLBACK_RATE = 3.0;

let lang: Lang = 'he';
let usdRate = FALLBACK_RATE;

export const isEnglish = (): boolean => lang === 'en';
export const currentLang = (): Lang => lang;

/** The Hebrew text, or the English one for a visitor reading in English. */
export function tr(he: string, en: string): string {
  return lang === 'en' ? en : he;
}

/** The shop's category names in English, by category id. */
export const CATEGORY_EN: Record<string, string> = {
  all: 'All items',
  boardies: 'Boardies',
  shirts: 'Tees',
  accessories: 'Accessories',
  women: 'Women',
  latest: 'Latest drop',
};

/** A shekel amount converted to whole dollars, rounded up. */
export function toUsd(ils: number): number {
  return Math.ceil(ils / usdRate);
}

/** A price as the visitor reads it: ₪249, or $82. */
export function money(ils: number): string {
  return lang === 'en' ? `$${toUsd(ils)}` : `₪${ils}`;
}

/** Switch language. Reloads, because the language is fixed for a page's life. */
export function setLang(next: Lang): void {
  try {
    localStorage.setItem(CHOICE_KEY, next);
  } catch {
    // Private mode: the switch still works for this load, it is just not kept.
  }
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('lang');
  window.location.replace(url.href);
}

interface Locale {
  country: string | null;
  usd: number | null;
  at: number;
}

function readCached(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Locale;
    return Date.now() - cached.at < LOCALE_TTL_MS ? cached : null;
  } catch {
    return null;
  }
}

async function lookUp(): Promise<Locale | null> {
  const cached = readCached();
  if (cached) return cached;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    const response = await fetch('/api/locale', { signal: controller.signal });
    window.clearTimeout(timer);
    if (!response.ok) return null;
    const body = (await response.json()) as { country?: string; usd?: number };
    const locale: Locale = {
      country: body.country ?? null,
      usd: typeof body.usd === 'number' && body.usd > 0 ? body.usd : null,
      at: Date.now(),
    };
    try {
      localStorage.setItem(LOCALE_KEY, JSON.stringify(locale));
    } catch {
      // Not kept; asked again next time. Harmless.
    }
    return locale;
  } catch {
    return null;
  }
}

const IS_BOT = /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|preview/i;

/** Set up in Israel: Israel time on the clock, or Hebrew in the browser's languages. */
function deviceIsIsraeli(): boolean {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone === 'Asia/Jerusalem' || zone === 'Asia/Tel_Aviv') return true;
  } catch {
    // No Intl time zone: fall through to the languages.
  }
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((l) => /^(he|iw)(-|$)/i.test(l ?? ''));
}

/** Settle the language (and, for English, the rate). Call once, before rendering. */
export async function initLocale(): Promise<void> {
  let choice: string | null = null;
  try {
    // A ?lang= link holds for the rest of this visit — the router drops the
    // parameter on the first navigation — and no longer.
    const fromLink = new URLSearchParams(window.location.search).get('lang');
    if (fromLink === 'en' || fromLink === 'he') sessionStorage.setItem(SESSION_KEY, fromLink);
    choice = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(CHOICE_KEY);
    localStorage.removeItem('hightide_lang');
  } catch {
    // Storage blocked: fall through to the device and the country.
  }

  if (choice === 'he' || choice === 'en') lang = choice;
  else if (IS_BOT.test(navigator.userAgent)) lang = 'he';
  else if (deviceIsIsraeli()) lang = 'he';
  else {
    const locale = await lookUp();
    lang = locale?.country && locale.country !== 'IL' ? 'en' : 'he';
  }

  if (lang === 'en') {
    const locale = await lookUp();
    if (locale?.usd) usdRate = locale.usd;
  }

  // lang only, never dir: the document is left-to-right in both languages and
  // the Hebrew layout is built from that (see the note in index.css). The
  // attribute is what the stylesheet keys English alignment on.
  document.documentElement.lang = lang;
}
