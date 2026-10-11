// Consent to analytics cookies.
//
// Until a visitor says yes, both measuring tools run without cookies: GA4
// through Google's consent mode (the default is set in index.html, before any
// Google script loads, from the same stored answer read here), and PostHog
// with its memory-only persistence. Visits, product views and WhatsApp clicks
// are still counted — items.views, which orders the Most Wanted rail, comes
// from those events — what is lost without consent is recognising the same
// visitor on a later day.
//
// "No" is remembered as firmly as "yes", so the banner asks once. The footer
// has a link that asks again.

export type Consent = 'granted' | 'denied';

const KEY = 'hightide_consent';

export function storedConsent(): Consent | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

type Listener = (consent: Consent) => void;
const listeners = new Set<Listener>();

/** Called by posthog.ts, which applies a choice to its own client. */
export function onConsentChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setConsent(consent: Consent): void {
  try {
    localStorage.setItem(KEY, consent);
  } catch {
    // Not kept: the banner will ask again next visit. The choice still holds now.
  }
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  gtag?.('consent', 'update', { analytics_storage: consent });
  listeners.forEach((listener) => listener(consent));
}

// The footer's "cookie settings" link and the banner share this, so the link
// can reopen a banner it does not own.
type Reopen = () => void;
let reopen: Reopen | null = null;
export function registerConsentPrompt(open: Reopen | null): void {
  reopen = open;
}
export function askConsentAgain(): void {
  reopen?.();
}
