import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORIES } from '../data';
import { LATEST } from '@/shared/categories.mjs';

interface CategoryBarProps {
  selected: string;
  onSelect: (id: string) => void;
}

// Every category plus the latest drop.
const ITEMS = [...CATEGORIES, LATEST].map(({ id, name }) => ({ id, name }));

/**
 * The category menu under the header: text tabs with a rule under the active
 * one, the same look as the links over the hero on the homepage.
 *
 * The one it replaces wrapped its buttons with flex-grow, so on a phone the
 * first row came out as four boxes of different widths and the second as two
 * wide ones — nothing lined up with anything. It also carried a grey
 * "קטגוריות" button that went back to the homepage, which the logo and the
 * "חזרה לקטגוריות" link already do.
 *
 * Where all six fit — a desktop, a tablet — they sit centred. Where they do not
 * — most phones — the row becomes a slider: it scrolls sideways under a finger,
 * settles on a tab rather than halfway through one, and the edge that has more
 * behind it fades out under an arrow, which is also a button for anyone with a
 * mouse. The arrow on an edge goes away once there is nothing left behind it.
 */
export default function CategoryBar({ selected, onSelect }: CategoryBarProps) {
  const row = useRef<HTMLDivElement>(null);
  // Which edges have more tabs behind them. "Back" is the right-hand edge —
  // where a right-to-left row starts — and "on" the left-hand one.
  const [more, setMore] = useState({ back: false, on: false });

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    // In a right-to-left row scrollLeft runs from 0 at the start down to a
    // negative number at the end, so its size is how far along the row is.
    const along = Math.abs(el.scrollLeft);
    const room = el.scrollWidth - el.clientWidth;
    const next = { back: along > 2, on: along < room - 2 };
    setMore((prev) => (prev.back === next.back && prev.on === next.on ? prev : next));
  }, []);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // A turned phone or a resized window changes whether the row fits at all;
    // so does the webfont arriving and every tab changing width with it.
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    if (el.firstElementChild) resize.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', measure);
      resize.disconnect();
    };
  }, [measure]);

  // Bring the active tab into the middle of the row when the category changes.
  useEffect(() => {
    const scroller = row.current;
    const active = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!scroller || !active) return;
    // A delta rather than scrollIntoView: scrollIntoView would also move the
    // page vertically to reach the bar, and App has just put the page at the
    // top on purpose. scrollBy with a physical delta is also the one form that
    // behaves the same in right-to-left rows across browsers.
    const s = scroller.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    scroller.scrollBy({ left: a.left + a.width / 2 - (s.left + s.width / 2), behavior: 'instant' as ScrollBehavior });
    measure();
  }, [selected, measure]);

  const slide = (towards: 'left' | 'right') => {
    const el = row.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: (towards === 'left' ? -1 : 1) * el.clientWidth * 0.6,
      behavior: reduce ? ('instant' as ScrollBehavior) : 'smooth',
    });
  };

  return (
    <nav aria-label="קטגוריות" className="bg-white border-b border-stone-200 animate-fade-in" id="categories-bar">
      <div className="relative max-w-7xl mx-auto">
        <div ref={row} dir="rtl" className="overflow-x-auto no-scrollbar snap-x snap-proximity overscroll-x-contain">
          {/* w-max with auto margins: centred while it fits, and simply wider
              than the row — so scrollable — once it does not. */}
          <div className="flex w-max mx-auto px-2">
            {ITEMS.map((item) => {
              const active = selected === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative shrink-0 snap-center h-12 px-4 text-sm whitespace-nowrap transition-colors cursor-pointer ${
                    active ? 'text-stone-900 font-medium' : 'text-stone-500 hover:text-stone-900'
                  }`}
                  id={`cat-filter-${item.id}`}
                >
                  {item.name}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-4 bottom-0 h-0.5 transition-colors ${active ? 'bg-stone-900' : 'bg-transparent'}`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* The edges. Hidden from screen readers and the tab order: every tab
            is reachable directly, so these only save a mouse user a drag. */}
        <EdgeArrow side="right" visible={more.back} onClick={() => slide('right')} />
        <EdgeArrow side="left" visible={more.on} onClick={() => slide('left')} />
      </div>
    </nav>
  );
}

function EdgeArrow({ side, visible, onClick }: { side: 'left' | 'right'; visible: boolean; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 ${side === 'left' ? 'left-0 bg-gradient-to-r' : 'right-0 bg-gradient-to-l'} from-white from-40% to-transparent w-14 flex items-center ${
        side === 'left' ? 'justify-start' : 'justify-end'
      } transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={onClick}
        className={`h-full w-8 flex items-center justify-center text-stone-700 cursor-pointer ${visible ? 'pointer-events-auto' : ''}`}
      >
        <Icon className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );
}
