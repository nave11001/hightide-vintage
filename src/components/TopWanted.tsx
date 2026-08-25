import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { track } from '../analytics';
import { onPhotoError, srcSetFor } from '../photos';
import { productPath } from '@/shared/slug.mjs';

// The ten most-viewed items, straight from the view counter each item carries.
// No editing, no curation: whatever the shop is actually looking at rises.
//
// The rail is the browser's own horizontal scroll with snap points, which is
// where it started. For a while it was an arc instead — cards riding a circle,
// tilting along the tangent, driven by a rAF loop that set a transform on every
// card every frame. It looked better standing still and was worse to use: the
// arc costs the two outer cards to the curve, so fewer garments are on screen,
// and a hand-rolled scroll cannot reproduce what a phone does natively.
// Momentum, rubber-banding at the ends, the flick that carries — all of it is
// free here and approximated there.
//
// What the arc did leave behind is kept: real <img> with srcset, the second
// angle on hover, the photo fallback, and cards that are links.

/** What the rail's images are drawn at, so srcset picks the right file. */
export const RAIL_SIZES = '(min-width: 1024px) 30vw, (min-width: 640px) 40vw, 55vw';

interface TopWantedProps {
  products: Product[];
  onViewDetails: (product: Product) => void;
}

const HOW_MANY = 10;

/**
 * The rail's contents. Exported because the loading veil has to wait for these
 * exact photos — this rail is the first thing on the homepage, and warming any
 * other selection lifts the veil onto a row of empty frames.
 */
export function pickTopWanted(products: Product[]): Product[] {
  // Sold items keep their views but stop being something to want.
  return [...products]
    .filter((p) => !p.isSold && (p.views ?? 0) > 0)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, HOW_MANY);
}

/** How many times the ten garments are laid end to end. */
const COPIES = 3;

export default function TopWanted({ products, onViewDetails }: TopWantedProps) {
  const rail = useRef<HTMLDivElement>(null);
  // Second angles are fetched only once a pointer asks for one. Ten cards each
  // quietly pulling a second photograph doubled the weight of the homepage for
  // an effect no phone can show at all.
  const [wantsAngle, setWantsAngle] = useState<Record<string, boolean>>({});

  // The width of one run of ten garments, and which way this rail counts.
  const setWidth = useRef(0);
  const rtl = useRef(true);

  const top = pickTopWanted(products);
  const count = top.length;

  // Past the tenth garment comes the first again.
  //
  // The list is laid down three times and the scroll is parked in the middle
  // run, so there is always a full run of track in either direction. Whenever
  // the scroll drifts out of that middle run it is moved back by exactly one
  // run — the same garment, the same pixel of it, so nothing moves on screen.
  //
  // Only ever while the rail is standing still. Writing scrollLeft during a
  // flick kills the momentum on iOS, which is the one thing this rail is here
  // for; and it is never needed mid-flick, because one run is over four screens
  // wide and no single flick crosses that.
  const loop = COPIES > 1 ? Array.from({ length: COPIES }, () => top).flat() : top;

  useLayoutEffect(() => {
    const el = rail.current;
    if (!el || count === 0) return;
    const cards = el.children;
    if (cards.length <= count) return;

    // offsetLeft counts from the element's own left edge whichever way the
    // text runs, so the distance between a card and its twin one run along is
    // the run's width in both directions.
    const first = cards[0] as HTMLElement;
    const twin = cards[count] as HTMLElement;
    const width = Math.abs(twin.offsetLeft - first.offsetLeft);
    if (!width) return;

    setWidth.current = width;
    rtl.current = getComputedStyle(el).direction === 'rtl';
    el.scrollLeft = rtl.current ? -width : width;
  }, [count]);

  // Settled, not scrolling: `scrollend` where it exists, a short idle timer
  // where it does not (Safari, at the time of writing).
  useEffect(() => {
    const el = rail.current;
    if (!el) return;

    const recentre = () => {
      const width = setWidth.current;
      if (!width) return;
      const sign = rtl.current ? -1 : 1;
      const travelled = Math.abs(el.scrollLeft);
      // Anywhere inside the middle run is fine; only leaving it is worth a jump.
      if (travelled < width * 0.5) el.scrollLeft = sign * (travelled + width);
      else if (travelled > width * 1.5) el.scrollLeft = sign * (travelled - width);
    };

    // Both, deliberately. `scrollend` is the right event and fires the moment
    // the rail settles, but Safari only learned it recently and a browser can
    // carry the property without ever firing it — and a rail that silently
    // stops looping is exactly the kind of thing nobody notices until a
    // customer does. The idle timer is the floor under that. Recentring twice
    // costs nothing: the second call finds it already in the middle run and
    // does nothing.
    let idle = 0;
    const onScroll = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(recentre, 140);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', recentre);
    return () => {
      window.clearTimeout(idle);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('scrollend', recentre);
    };
  }, [count]);

  // Nothing viewed yet — say nothing rather than show an empty rail.
  if (top.length < 3) return null;

  const scroll = (dir: 'prev' | 'next') => {
    const el = rail.current;
    if (!el) return;
    // RTL: "next" walks left along the rail.
    const step = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'next' ? -step : step, behavior: 'smooth' });
    track('top_wanted_scroll', { direction: dir });
  };

  return (
    <section className="mb-12" id="top-wanted" dir="rtl">
      <div className="text-center mb-5">
        <h2 className="text-xl sm:text-2xl font-groovy font-normal text-stone-900 uppercase">
          Our Most Wanted Pieces
        </h2>
        <div className="w-12 h-[1px] bg-stone-800 mx-auto mt-3"></div>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => scroll('prev')}
          aria-label="הקודם"
          className="hidden sm:flex absolute -right-3 top-1/3 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 cursor-pointer shadow-sm"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => scroll('next')}
          aria-label="הבא"
          className="hidden sm:flex absolute -left-3 top-1/3 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 cursor-pointer shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* touch-action pan-x so a vertical swipe still scrolls the page: a rail
            that swallows the drag is a rail the shopper gets stuck in. */}
        <div
          ref={rail}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [touch-action:pan-x_pan-y] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          id="top-wanted-rail"
        >
          {loop.map((product, i) => {
            const href = productPath(product.brand, product.num);
            const hasAngle = Boolean(product.images && product.images[1]);
            const rank = (i % count) + 1;
            // Only the first run is the real one. The copies carry the same
            // garments, so they are kept out of the accessibility tree and out
            // of the tab order, and they surrender the id — a garment has one
            // of those, and three elements answering to it is a broken page.
            const isClone = i >= count;
            // A real href, so a long press offers "open in new tab" and a
            // crawler sees ten garments rather than ten buttons. The plain
            // click is still routed rather than reloading the shop.
            const open = (event: React.MouseEvent) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              if (event.button !== 0) return;
              event.preventDefault();
              track('top_wanted_click', { product_id: product.id, rank });
              onViewDetails(product);
            };

            return (
              <a
                key={`${product.id}-${i}`}
                href={href}
                onClick={open}
                aria-hidden={isClone || undefined}
                tabIndex={isClone ? -1 : undefined}
                onMouseEnter={
                  hasAngle && !wantsAngle[product.id]
                    ? () => setWantsAngle((seen) => ({ ...seen, [product.id]: true }))
                    : undefined
                }
                className="snap-start shrink-0 w-[46%] sm:w-[31%] lg:w-[23%] text-right group cursor-pointer no-underline"
                id={isClone ? undefined : `top-wanted-${product.id}`}
              >
                <div className="relative aspect-[4/5] bg-stone-50 border border-gray-100 overflow-hidden">
                  <img
                    src={product.image}
                    srcSet={srcSetFor(product.image)}
                    sizes={RAIL_SIZES}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    // Not lazy: this is the top of the homepage, and the
                    // loading veil is already holding for these exact files.
                    loading="eager"
                    decoding="async"
                    draggable={false}
                    onError={onPhotoError}
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-103"
                  />
                  {hasAngle && wantsAngle[product.id] && (
                    <img
                      src={product.images![1]}
                      srcSet={srcSetFor(product.images![1])}
                      sizes={RAIL_SIZES}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      decoding="async"
                      draggable={false}
                      onError={onPhotoError}
                      className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    />
                  )}
                  <span className="absolute top-2 right-2 bg-stone-900 text-white text-xs font-bold w-6 h-6 flex items-center justify-center select-none">
                    {rank}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-normal text-gray-800 line-clamp-1">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2 justify-start flex-row-reverse">
                  <span
                    className={
                      product.originalPrice
                        ? 'text-sm font-bold text-red-600'
                        : 'text-sm font-medium text-stone-900'
                    }
                  >
                    ₪{product.price}
                  </span>
                  {/* stone-500 at 14px, not gray-400 at 12px: this is the
                      saving, and on the card it measured 2.5:1. */}
                  {product.originalPrice && (
                    <span className="text-sm text-stone-500 line-through">
                      ₪{product.originalPrice}
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
