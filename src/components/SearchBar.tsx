import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

/**
 * The shop's search field.
 *
 * It used to live inside Header, and the homepage has its own Header — the
 * transparent one inside the hero. Typing the first letter there made the
 * search term non-empty, which is exactly the condition that takes the hero
 * away and puts the ordinary sticky header up instead. So the first keystroke
 * unmounted the very input it was typed into; the new header arrived with its
 * search closed; and the shopper had to tap search again to carry on, by which
 * point the page underneath had changed shape and jumped.
 *
 * Rendered once, by App, above whichever header is showing, it is the same
 * element from the first letter to the last and the keyboard never drops.
 *
 * Fixed to the top rather than placed in the flow, so the page swapping from
 * homepage to results underneath it cannot move it either.
 *
 * text-base, not text-sm: below 16px iOS Safari zooms the whole page in when a
 * field is focused, which was the other half of the jump.
 */
export default function SearchBar({ value, onChange, onClose }: SearchBarProps) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] bg-white border-b border-stone-200 shadow-sm pt-[env(safe-area-inset-top)] animate-fade-in"
      id="search-bar-container"
    >
      <form
        role="search"
        onSubmit={(e) => {
          // Enter puts the keyboard away so the results under it can be seen.
          e.preventDefault();
          input.current?.blur();
        }}
        className="max-w-2xl mx-auto flex items-center gap-2 px-4 h-16"
        dir="rtl"
      >
        <div className="relative flex-grow">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none"
            aria-hidden="true"
          />
          {/* autoFocus rather than focusing from an effect: React applies it
              during the commit that the tap itself triggered, which iOS still
              counts as the user's gesture and so opens the keyboard for. A
              focus() from useEffect runs a frame later and iOS ignores it. */}
          <input
            ref={input}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="חיפוש לפי מותג, סוג או מידה"
            aria-label="חיפוש בחנות"
            className="w-full h-11 bg-stone-50 border border-stone-200 pr-10 pl-10 text-base text-stone-900 placeholder:text-stone-500 focus:outline-none focus:border-stone-900 focus:bg-white rounded-none"
            id="search-input"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                input.current?.focus();
              }}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-stone-500 hover:text-stone-900"
              aria-label="ניקוי החיפוש"
              id="clear-search-btn"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-11 px-3 text-sm font-medium text-stone-900 hover:text-stone-600 cursor-pointer shrink-0"
          id="close-search-btn"
        >
          ביטול
        </button>
      </form>
    </div>
  );
}
