import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// A rail whose cards ride an arc instead of a straight line: the further a card
// sits from the middle, the lower it drops and the more it tilts, following the
// tangent of a circle. Drag it, swipe it, or use the arrows; it wraps forever.
//
// The reference implementation for this look (ReactBits' CircularGallery) draws
// everything into a WebGL canvas. That buys a truer curve and costs the things a
// shop cannot give up: prices, real <img> tags, links a crawler can see, and
// keyboard focus. This one keeps the cards as ordinary DOM and bends them with
// CSS transforms, so nothing is lost but the last few degrees of fidelity.
//
// Layout runs off a ref-driven rAF loop rather than React state — a re-render per
// frame for twenty cards is exactly the kind of work that makes a rail stutter.

export interface GalleryItem {
  id: string;
  image: string;
  /** A second angle, faded in while the pointer rests on the card. */
  hoverImage?: string;
  title: string;
  price: number;
  originalPrice?: number;
  /** Small square marker in the image corner — a rank, a size, whatever fits. */
  badge?: string;
}

interface CircularGalleryProps {
  items: GalleryItem[];
  onSelect: (item: GalleryItem) => void;
  /** How hard the rail curves. 0 is a flat row; negative arcs the other way. */
  bend?: number;
  /** Corner rounding of the image, as a fraction of card width. */
  borderRadius?: number;
  /** Multiplier on trackpad and drag distance. */
  scrollSpeed?: number;
  /** How quickly the rail catches up to where it is headed, per frame, 0–1. */
  scrollEase?: number;
  /** Idle px per frame. 0 holds still. Ignored under reduced-motion. */
  drift?: number;
  /** Fired by the arrow buttons, for whoever wants to count them. */
  onNudge?: (dir: 'prev' | 'next') => void;
  textColor?: string;
  className?: string;
  // Declared because the project carries no @types/react — same as ProductCard.
  key?: string;
}

// A tilted card is wider than it is: rotating W by θ needs W·cosθ + H·sinθ of
// room. The gap has to cover that overhang or neighbours climb onto each other,
// so it scales with the card rather than sitting at a fixed pixel count.
//
// A phone needs more of it. The rail is the same arc across half the width, so
// every card sits at a steeper tilt and overhangs further.
const gapRatioFor = (width: number) => (width < 640 ? 0.42 : 0.26);

/** Below this the rail only moves when a finger moves it. */
const DRIFT_MIN_WIDTH = 640;

/** Capture is a nicety; a throw here would strand the rail mid-drag. */
function capture(el: any, id: number, on: boolean) {
  try {
    if (on) el.setPointerCapture?.(id);
    else el.releasePointerCapture?.(id);
  } catch {
    /* pointer already gone */
  }
}
const DEG = 180 / Math.PI;
/** Past this much pointer travel it was a drag, not a click on a card. */
const DRAG_SLOP = 6;

/** Card width tracks the viewport: a phone shows two, a desktop shows four. */
function stepFor(width: number) {
  if (width < 640) return width * 0.56;
  if (width < 1024) return width * 0.34;
  return width * 0.24;
}

export default function CircularGallery({
  items,
  onSelect,
  bend = 4,
  borderRadius = 0.05,
  scrollSpeed = 2.4,
  scrollEase = 0.06,
  drift = 0.35,
  onNudge,
  textColor = '#1c1917',
  className = '',
}: CircularGalleryProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const cards = useRef<HTMLDivElement[]>([]);
  const [width, setWidth] = useState(0);

  // Where the rail is, and where it is heading. Frame state, never React state.
  const current = useRef(0);
  const target = useRef(0);
  const paused = useRef(false);
  const dragging = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth);
    // Measure first and observe second. Every card starts hidden and only the
    // layout pass reveals it, so a ResizeObserver that is slow, throttled or
    // missing would leave a tall empty hole where the rail should be.
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const itemW = stepFor(width);
  const step = itemW * (1 + gapRatioFor(width));

  // Repeat the list until it is long enough that wrapping never exposes a gap:
  // the visible window is one container wide, so two containers' worth of track
  // guarantees a card's other copy is always off screen.
  const reps =
    items.length > 0 && step > 0
      ? Math.max(1, Math.ceil((width * 2 + 2 * step) / (items.length * step)))
      : 1;
  const loop = reps > 1 ? Array.from({ length: reps }, () => items).flat() : items;
  const total = loop.length * step;

  useEffect(() => {
    if (width === 0 || loop.length === 0) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // On a phone the rail sits under the thumb. Anything that moves on its own
    // there reads as the page running away, so it waits to be dragged.
    const idle = width >= DRIFT_MIN_WIDTH ? drift : 0;
    const half = width / 2;
    // Sagitta: how far the rail dips by the time it reaches the edge. Feeding it
    // through the circle formula gives the radius the cards actually sit on.
    const sag = bend * 18;
    const radius = Math.abs(sag) > 0.5 ? (half * half + sag * sag) / (2 * sag) : 0;
    const sign = Math.sign(radius) || 1;
    const r = Math.abs(radius);
    // An arc measured from its own apex only ever pushes cards one way, which
    // leaves the middle hugging one edge of the box and the sides overflowing the
    // other. Lifting everything by half the dip at the rim centres the whole curve.
    const balance = r > 0 ? (r - Math.sqrt(Math.max(r * r - half * half, 0))) / 2 : 0;

    const layout = () => {
      for (let i = 0; i < loop.length; i++) {
        const el = cards.current[i];
        if (!el) continue;

        // Rank 1 sits rightmost, so higher indexes walk left — this is an RTL shop.
        let x = current.current - i * step;
        x = ((x % total) + total) % total;
        if (x >= total / 2) x -= total;

        // Off screen by more than a card: stop painting it entirely.
        if (Math.abs(x) > half + step) {
          el.style.visibility = 'hidden';
          continue;
        }
        el.style.visibility = 'visible';

        let dip = -balance;
        let tilt = 0;
        if (r > 0) {
          const c = Math.max(-r, Math.min(r, x));
          dip += sign * (r - Math.sqrt(Math.max(r * r - c * c, 0)));
          tilt = Math.asin(c / r) * sign * DEG;
        }

        const t = Math.min(Math.abs(x) / half, 1);
        const scale = 1 - 0.1 * t;
        el.style.transform =
          `translateX(${half + x - itemW / 2}px) translateY(-50%) ` +
          `translateY(${dip}px) rotate(${tilt}deg) scale(${scale})`;
        el.style.opacity = String(1 - 0.5 * Math.max(0, t - 0.6) / 0.4);
        el.style.zIndex = String(1000 - Math.round(Math.abs(x)));
      }
    };

    // Place the cards now. Every one of them starts hidden, and a background tab
    // suspends rAF entirely — without this pass the rail is a tall empty gap
    // until the frame arrives.
    layout();

    let frame = 0;
    const tick = () => {
      if (!reduced && idle !== 0 && !paused.current && !dragging.current) {
        target.current += idle;
      }
      current.current += (target.current - current.current) * scrollEase;
      layout();
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [width, itemW, step, total, loop.length, bend, scrollEase, drift]);

  /** Bring one card to the middle by the shortest way round the loop. */
  const centerOn = (i: number) => {
    if (total === 0) return;
    const want = i * step;
    const laps = Math.round((target.current - want) / total);
    target.current = want + laps * total;
  };

  const nudge = (dir: 'prev' | 'next') => {
    target.current += dir === 'next' ? step : -step;
    onNudge?.(dir);
  };

  // Pointer drag. The distance travelled decides whether the release opens an item.
  //
  // Capturing the pointer is what makes dragging past the rail's edge work, but it
  // also retargets the following `click` to the capturing element — so a listener
  // on the card itself never hears it. The tap is therefore resolved here, from
  // the card the press landed on, and the card handles only the keyboard.
  // A press does not start a drag, and nothing is captured until the finger has
  // travelled far enough to say which way it is going.
  //
  // This is what stands between the rail and the page on a phone. touch-action
  // asks the browser to keep vertical panning for itself, but capturing a touch
  // pointer overrules that and hands the whole gesture here — so a rail that
  // captures on pointerdown swallows every attempt to scroll past it, and the
  // page only moves if the finger happens to land beside a card. Waiting for a
  // direction leaves the vertical swipe with the browser, where it belongs.
  const start = useRef({ x: 0, y: 0, from: 0, moved: 0, card: -1, live: false, held: false });
  const onPointerDown = (e: any) => {
    const hit = e.target?.closest?.('[data-card]');
    start.current = {
      x: e.clientX,
      y: e.clientY,
      from: target.current,
      moved: 0,
      card: hit ? Number(hit.dataset.card) : -1,
      live: true,
      held: false,
    };
  };
  const onPointerMove = (e: any) => {
    const s = start.current;
    if (!s.live) return;

    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;

    if (!s.held) {
      // Still a tap until proven otherwise.
      if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical: this gesture belongs to the page. Let go of it entirely,
        // and forget the card so the release cannot open an item.
        s.live = false;
        s.card = -1;
        return;
      }
      // Horizontal. Take the gesture, and re-origin so the rail does not jump
      // by the slop that was spent deciding.
      s.held = true;
      s.live = true;
      s.x = e.clientX;
      s.from = target.current;
      s.moved = DRAG_SLOP + 1;
      dragging.current = true;
      capture(e.currentTarget, e.pointerId, true);
      return;
    }

    s.moved = Math.max(s.moved, Math.abs(dx));
    target.current = s.from + dx * scrollSpeed * 0.5;
  };
  const release = (e: any) => {
    if (start.current.held) capture(e.currentTarget, e.pointerId, false);
    dragging.current = false;
    start.current.live = false;
    start.current.held = false;
  };
  const onPointerUp = (e: any) => {
    const { moved, card, live } = start.current;
    release(e);
    start.current.card = -1;
    if (live && moved <= DRAG_SLOP && card >= 0 && loop[card]) onSelect(loop[card]);
  };
  const onPointerCancel = (e: any) => {
    release(e);
    start.current.card = -1;
  };

  // Horizontal intent only. Claiming the vertical wheel would trap the page.
  const onWheel = (e: any) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    target.current -= e.deltaX * scrollSpeed * 0.5;
  };

  if (items.length === 0 || items.length < 3) return null;

  return (
    <div className={`relative ${className}`} dir="ltr">
      <button
        type="button"
        onClick={() => nudge('prev')}
        aria-label="הקודם"
        className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-[2000] w-9 h-9 items-center justify-center bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 cursor-pointer shadow-sm"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => nudge('next')}
        aria-label="הבא"
        className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-[2000] w-9 h-9 items-center justify-center bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 cursor-pointer shadow-sm"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        ref={wrap}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerEnter={() => (paused.current = true)}
        onPointerLeave={() => {
          paused.current = false;
          dragging.current = false;
        }}
        onWheel={onWheel}
        className="relative h-full w-full overflow-hidden select-none cursor-grab active:cursor-grabbing [touch-action:pan-y]"
      >
        {loop.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            ref={(el: HTMLDivElement) => {
              cards.current[i] = el;
            }}
            data-card={i}
            className="absolute left-0 top-1/2 will-change-transform"
            style={{ width: itemW || undefined, visibility: 'hidden' }}
          >
            <button
              type="button"
              dir="rtl"
              onFocus={() => {
                paused.current = true;
                centerOn(i);
              }}
              onBlur={() => (paused.current = false)}
              // Pointer taps are settled on the rail; this is the keyboard path.
              onKeyDown={(e: any) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                onSelect(item);
              }}
              className="w-full text-right group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
            >
              <div
                className="relative aspect-[4/5] bg-stone-50 border border-gray-100 overflow-hidden"
                style={{ borderRadius: itemW ? itemW * borderRadius : undefined }}
              >
                <img
                  src={item.image}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  // Not lazy: this rail is the top of the homepage, and every
                  // card starts with visibility:hidden until the layout pass —
                  // which is exactly the state a lazy loader waits out.
                  loading="eager"
                  draggable={false}
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-103"
                />
                {/* Second angle revealed on hover, same as ProductCard. */}
                {item.hoverImage && (
                  <img
                    src={item.hoverImage}
                    alt={`${item.title} - זווית נוספת`}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                )}
                {item.badge && (
                  <span className="absolute top-2 right-2 bg-stone-900 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center select-none">
                    {item.badge}
                  </span>
                )}
              </div>
              <h3
                className="mt-2 text-sm font-normal line-clamp-1"
                style={{ color: textColor }}
              >
                {item.title}
              </h3>
              <div className="flex items-center gap-2 justify-start flex-row-reverse">
                <span
                  className={
                    item.originalPrice
                      ? 'text-sm font-bold text-red-600'
                      : 'text-sm font-medium text-stone-900'
                  }
                >
                  ₪{item.price}
                </span>
                {item.originalPrice && (
                  <span className="text-xs text-gray-400 line-through">
                    ₪{item.originalPrice}
                  </span>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
