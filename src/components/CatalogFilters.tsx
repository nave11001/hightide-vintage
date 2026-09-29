import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

const LIST_WIDTH = 200; // w-[200px] on the list below

export interface FilterDef {
  id: string;
  wrapperId: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  /** Sizes: tabular figures, so a column of them lines up. */
  mono?: boolean;
}

/**
 * The catalogue's filters, drawn the way the category tabs above them are:
 * text, no box, and a rule under a filter once it is doing something.
 *
 * They were bordered <select>s, and a tap opened the phone's own picker — a
 * grey wheel on an iPhone, a system dialog on Android, neither of which looked
 * like the shop. Now a tap drops a small white list out of the filter with a
 * tick beside the current choice, the same on every phone and every screen.
 *
 * A filter at its default reads as quiet grey; one that is narrowing the list
 * turns black with the same 2px underline the active tab carries, which is
 * also how anyone can tell at a glance that the grid below is filtered.
 */
export default function CatalogFilters({ filters }: { filters: FilterDef[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [align, setAlign] = useState<'left' | 'right'>('right');
  const area = useRef<HTMLDivElement>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});

  // Escape closes and hands focus back to the filter; a tap anywhere outside
  // closes too.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpenId(null);
      triggers.current[openId]?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!area.current?.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [openId]);

  // Put focus on the current choice when a list opens, so a keyboard lands
  // inside it rather than behind it.
  useEffect(() => {
    if (!openId) return;
    document.querySelector<HTMLElement>(`[data-filter-list="${openId}"] [aria-selected="true"]`)?.focus({ preventScroll: true });
  }, [openId]);

  const choose = (f: FilterDef, value: string) => {
    f.onChange(value);
    setOpenId(null);
    triggers.current[f.id]?.focus({ preventScroll: true });
  };

  return (
    <div ref={area} dir="rtl" className="flex items-center gap-x-5 sm:gap-x-6 gap-y-0 flex-wrap" id="catalog-filters">
      {filters.map((f) => {
        const isOpen = openId === f.id;
        const active = f.value !== '';
        const shown = f.options.find((o) => o.value === f.value)?.label ?? f.options[0]?.label;
        return (
          <div key={f.id} className="relative" id={f.wrapperId}>
            <button
              ref={(el) => {
                triggers.current[f.id] = el;
              }}
              type="button"
              id={f.id}
              onClick={(e) => {
                if (isOpen) return setOpenId(null);
                // The list hangs from the filter's right edge. If that would
                // run it off the left of the screen — the last filter on a
                // phone — it hangs from the left edge instead.
                const r = e.currentTarget.getBoundingClientRect();
                setAlign(r.right - LIST_WIDTH < 8 ? 'left' : 'right');
                setOpenId(f.id);
              }}
              aria-label={`${f.label}: ${shown}`}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              className={`inline-flex items-center gap-1.5 h-11 border-b-2 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${
                active || isOpen ? 'border-stone-900' : 'border-transparent'
              }`}
            >
              {/* A phone gets one word per filter — its name while it is
                  idle, its choice once it is set — so all three sit on one
                  line. "מידה: כל המידות" three times over wrapped to two. */}
              <span
                className={`sm:hidden text-sm whitespace-nowrap ${active && f.mono ? 'font-mono' : ''} ${
                  active ? 'text-stone-900 font-medium' : 'text-stone-700'
                }`}
              >
                {active ? shown : f.label}
              </span>
              <span className="hidden sm:inline text-sm text-stone-500">{f.label}:</span>
              <span
                className={`hidden sm:inline text-sm whitespace-nowrap ${f.mono ? 'font-mono' : ''} ${
                  active ? 'text-stone-900 font-medium' : 'text-stone-700'
                }`}
              >
                {shown}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`w-3.5 h-3.5 text-stone-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isOpen && (
              <div
                role="listbox"
                aria-label={f.label}
                data-filter-list={f.id}
                // No scrollbar: the site-wide one is an 8px black bar, heavy
                // on a list this small. The height stops halfway through a
                // row, and the cut-off row says there is more.
                className={`absolute top-full ${align === 'left' ? 'left-0' : 'right-0'} mt-1 z-40 w-[200px] max-h-72 overflow-y-auto overscroll-contain no-scrollbar bg-white border border-stone-200 shadow-[0_10px_30px_rgba(0,0,0,0.10)] py-1 animate-drop-in`}
              >
                {f.options.map((o) => {
                  const selected = o.value === f.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => choose(f, o.value)}
                      className={`w-full h-11 flex items-center justify-between gap-4 px-4 text-sm text-right cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-stone-100 ${
                        f.mono ? 'font-mono' : ''
                      } ${selected ? 'text-stone-900 font-medium' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                    >
                      <span>{o.label}</span>
                      {selected ? <Check aria-hidden="true" className="w-4 h-4 shrink-0" /> : <span className="w-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
