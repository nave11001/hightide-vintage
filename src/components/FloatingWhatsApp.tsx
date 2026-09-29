import { useEffect, useState } from 'react';
import WhatsAppMark from './WhatsAppMark';

/**
 * The floating "talk to us" button.
 *
 * It sat permanently in the bottom corner, and a phone's bottom corner is where
 * the product grid is — so on the way down a category it was always on top of
 * something: a SALE stamp, a price, the card's own buy button. A second
 * WhatsApp control drawn over the first is also why it read as odd.
 *
 * Now it gets out of the way while someone is reading. Scrolling down tucks it
 * off the screen; the first scroll back up brings it back, as does being near
 * the top or at the very bottom, where the footer's contact details are. It
 * also stands aside entirely while a garment is open — that layer has its own,
 * larger buy button, and two would compete.
 */
export default function FloatingWhatsApp({ suppressed = false }: { suppressed?: boolean }) {
  const [tucked, setTucked] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 80;
      // A few pixels of hysteresis, so the jitter of a finger resting on the
      // glass does not flick it in and out.
      if (y < 120 || atBottom) setTucked(false);
      else if (y > last + 6) setTucked(true);
      else if (y < last - 6) setTucked(false);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const hidden = suppressed || tucked;

  return (
    <a
      href="https://wa.me/972528879922"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="שיחה איתנו בווטסאפ"
      title="דברו איתנו בווטסאפ"
      // Out of the tab order and the accessibility tree while it is off
      // screen, so nobody tabs onto a control they cannot see.
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden || undefined}
      className={`fixed left-4 z-50 rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.22)] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
        hidden ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      id="floating-whatsapp"
    >
      {/* A disc, not the bubble logo: a round button with a round shadow,
          and the white glyph on WhatsApp's green is how every chat button on
          the web looks, so it is recognised before it is read. */}
      <span className="w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center text-white">
        <WhatsAppMark className="w-8 h-8" />
      </span>
    </a>
  );
}
