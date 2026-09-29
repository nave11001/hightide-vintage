// WhatsApp's glyph, in one place.
//
// The path was written out by hand in four components — the card's buy button,
// the garment's, the favourites drawer's and now the share menu — and a
// twenty-line path copied four times is four chances to fix three of them.
//
// Decorative wherever it appears: every one of those controls already says
// "ווטסאפ" in words beside it, so the mark is hidden from a screen reader
// rather than read out a second time.
const GLYPH =
  'M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.58 1.981 14.11 1.012 11.48 1.01 6.046 1.01 1.622 5.38 1.618 10.807c-.001 1.701.453 3.361 1.314 4.815L1.879 21.16l5.768-1.506zM17.91 14.9c-.31-.155-1.832-.9-2.115-1.002-.282-.102-.489-.153-.695.155-.205.308-.797 1.002-.976 1.207-.18.205-.359.231-.669.077-.31-.155-1.307-.481-2.49-1.534-.92-.818-1.541-1.83-1.722-2.138-.18-.308-.02-.475.135-.629.14-.138.31-.36.465-.54.155-.18.205-.308.31-.514.105-.205.051-.385-.026-.54-.077-.155-.695-1.673-.951-2.29-.25-.6-.54-.515-.744-.526-.192-.01-.41-.01-.628-.01-.218 0-.573.082-.873.411-.3.308-1.148 1.121-1.148 2.733 0 1.612 1.174 3.172 1.336 3.393.162.22 2.311 3.52 5.597 4.939.781.337 1.39.539 1.86.688.784.249 1.497.214 2.061.13.629-.094 1.832-.749 2.088-1.439.256-.689.256-1.284.18-1.402-.077-.117-.282-.18-.592-.336z';

/** The bare glyph, in whatever colour the text around it is. */
export default function WhatsAppMark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={`fill-current ${className}`}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d={GLYPH} />
    </svg>
  );
}

// The glyph's two parts, for the logo below: the outline of the speech bubble,
// tail included, and the handset inside it.
const BUBBLE =
  'M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24z';
const HANDSET = GLYPH.slice(GLYPH.indexOf('M17.91'));

/**
 * The floating button's mark: a green disc, and on it the bubble drawn as a
 * bold white outline around the white handset — the way WhatsApp's own
 * "chat with us" buttons draw it.
 *
 * It was the stock glyph on the disc, whose ring is a hairline a twelfth of
 * its width. At 32px that came out 1.4px thick, so the bubble read as a faint
 * scribble around a phone. Here the ring is a stroke three times heavier.
 */
export function WhatsAppDisc({ className = 'w-14 h-14' }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="24" fill="#25D366" />
      {/* The 24-unit bubble at 1.15x, centred on the disc: 27.6 units wide,
          so 10.2 either side, and the stroke kept inside that margin. */}
      <g transform="translate(10.2 10.2) scale(1.15)">
        <path d={BUBBLE} fill="none" stroke="#fff" strokeWidth="2.1" strokeLinejoin="round" />
        <path d={HANDSET} fill="#fff" transform="translate(12 12) scale(1.08) translate(-12 -12)" />
      </g>
    </svg>
  );
}

/**
 * The logo the way WhatsApp itself draws it: a green speech bubble with a white
 * rim and a white handset.
 *
 * It was the glyph set on a green disc, and the glyph is itself a ring — so at
 * 20px on a buy button it read as a circle inside a circle with a speck in the
 * middle. This is the bubble shape people know, tail and all, with nothing
 * around it. The white rim is what separates it from the black buttons; on a
 * white menu it simply disappears into the page, which is how the logo sits on
 * white anyway.
 *
 * The rim is a stroke centred on the bubble's edge, so half of it falls outside
 * the 24-unit box; the view box is widened by a unit on every side to keep it.
 */
export function WhatsAppBadge({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="-1 -1 26 26"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d={BUBBLE} fill="#25D366" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={HANDSET} fill="#fff" transform="translate(12 12) scale(1.1) translate(-12 -12)" />
    </svg>
  );
}
