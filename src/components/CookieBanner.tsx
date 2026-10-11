import { useEffect, useState } from 'react';
import { navigate } from '../router';
import { tr } from '../i18n';
import { registerConsentPrompt, setConsent, storedConsent } from '../consent';

/**
 * The cookie question — small on purpose.
 *
 * A strip at the foot of the screen, one or two short lines, that never covers
 * the page or stops it scrolling: the shop stays fully usable while it is up,
 * and nothing measured depends on an answer (see consent.ts). It sits to the
 * side of the floating WhatsApp button rather than over it, and under any open
 * garment, whose buy button matters more.
 *
 * Shown until answered, then never again unless the footer's link asks.
 */
export default function CookieBanner() {
  const [open, setOpen] = useState(() => storedConsent() === null);

  useEffect(() => {
    registerConsentPrompt(() => setOpen(true));
    return () => registerConsentPrompt(null);
  }, []);

  if (!open) return null;

  const answer = (consent: 'granted' | 'denied') => {
    setConsent(consent);
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label={tr('הסכמה לעוגיות', 'Cookie consent')}
      dir={tr('rtl', 'ltr')}
      className="fixed z-40 right-3 left-[5.5rem] sm:left-auto sm:right-4 sm:max-w-md bg-stone-900/95 text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] px-3 py-2 flex items-center gap-2 animate-fade-in"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      id="cookie-banner"
    >
      <p className="text-[12px] leading-snug text-stone-100 min-w-0 flex-1">
        {tr('האתר משתמש בעוגיות למדידת שימוש.', 'We use cookies to measure visits.')}{' '}
        <a
          href="/privacy"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            navigate('/privacy');
          }}
          className="underline underline-offset-2 text-white whitespace-nowrap"
        >
          {tr('פרטים', 'Details')}
        </a>
      </p>
      <button
        type="button"
        onClick={() => answer('denied')}
        className="shrink-0 min-h-[36px] px-2.5 text-[12px] text-stone-300 hover:text-white cursor-pointer"
      >
        {tr('דחייה', 'Decline')}
      </button>
      <button
        type="button"
        onClick={() => answer('granted')}
        className="shrink-0 min-h-[36px] px-3 text-[12px] font-medium bg-white text-stone-900 hover:bg-stone-200 cursor-pointer"
      >
        {tr('אישור', 'Accept')}
      </button>
    </div>
  );
}
