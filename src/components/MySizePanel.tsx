import { useState, useEffect } from 'react';
import { Ruler, X } from 'lucide-react';
import { track } from '../analytics';

// The shopper tells us their waist once. From then on every size in the shop
// carries a verdict, and the cards that suit them are marked. Kept in
// localStorage so it survives a reload and follows them across categories.

const STORAGE_KEY = 'hightide_my_size';

export function readMySize(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isNaN(n) ? null : n;
}

// Boardshort sizes are the waist in inches. Letters have no single truth, so
// these are the middle of the range each one usually covers.
const LETTER_INCHES: Record<string, number> = {
  small: 30, s: 30, m: 32, medium: 32, l: 34, large: 34, xl: 36, xxl: 38,
};

/** '32' -> 32, '38-40' -> 38 (the narrower end is what has to close), 'L' -> 34 */
export function sizeToInches(size: string): number | null {
  const s = size.trim().toLowerCase();
  if (!s || s === 'one size') return null;
  const range = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return parseInt(range[1], 10);
  const plain = s.match(/^(\d+)$/);
  if (plain) {
    const n = parseInt(plain[1], 10);
    return n >= 24 && n <= 48 ? n : null;
  }
  return LETTER_INCHES[s] ?? null;
}

export interface Verdict {
  label: string;
  tone: 'good' | 'warn' | 'bad';
  note: string;
}

/** How a garment cut for `sizeInches` sits on a `waistInches` waist. */
export function verdictFor(sizeInches: number, waistInches: number): Verdict {
  const slack = sizeInches - waistInches;
  if (slack < -2) return { label: 'קטן מדי', tone: 'bad', note: 'לא ייסגר' };
  if (slack < 0) return { label: 'צמוד', tone: 'warn', note: 'ייסגר בלי מרווח' };
  if (slack <= 2) return { label: 'מתאים', tone: 'good', note: 'המידה שלך' };
  if (slack <= 4) return { label: 'רפוי', tone: 'warn', note: 'רחב, השרוך יחזיק' };
  return { label: 'גדול מדי', tone: 'bad', note: 'רחב מדי' };
}

/**
 * Stricter than `verdictFor` — used for the badge on the grid. "מתאים" covers
 * three label sizes, which would decorate half the catalogue and stop meaning
 * anything; the badge is reserved for a size cut at, or one inch above, the
 * shopper's own waist.
 */
export function isMySize(sizeInches: number, waistInches: number): boolean {
  const slack = sizeInches - waistInches;
  return slack >= 0 && slack <= 1;
}

export const TONE_CLASS: Record<string, string> = {
  good: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  warn: 'bg-amber-50 border-amber-300 text-amber-900',
  bad: 'bg-red-50 border-red-300 text-red-900',
};

interface MySizePanelProps {
  availableSizes: string[];
  waistInches: number | null;
  onChange: (waist: number | null) => void;
}

export default function MySizePanel({ availableSizes, waistInches, onChange }: MySizePanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(waistInches ? String(waistInches) : '');

  useEffect(() => {
    setDraft(waistInches ? String(waistInches) : '');
  }, [waistInches]);

  const save = () => {
    const n = parseFloat(draft);
    if (Number.isNaN(n) || n < 24 || n > 48) return;
    localStorage.setItem(STORAGE_KEY, String(n));
    onChange(n);
    track('my_size_set', { waist_inches: n });
    setOpen(false);
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    onChange(null);
    setDraft('');
  };

  // Every distinct size in the shop that can be reasoned about, smallest first.
  const rows = availableSizes
    .map((s) => ({ size: s, inches: sizeToInches(s) }))
    .filter((r): r is { size: string; inches: number } => r.inches !== null)
    .sort((a, b) => a.inches - b.inches);

  return (
    <div className="relative" id="my-size">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) track('my_size_open', {});
        }}
        className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs cursor-pointer transition-colors flex-row-reverse ${
          waistInches
            ? 'border-stone-900 bg-stone-900 text-white'
            : 'border-stone-300 bg-white text-stone-700 hover:border-stone-900'
        }`}
      >
        <Ruler className="w-3.5 h-3.5" />
        <span>{waistInches ? `המידה שלי: ${waistInches}״` : 'מה המידה שלי?'}</span>
      </button>

      {open && (
        <div className="absolute z-40 mt-2 right-0 w-[19rem] bg-white border border-stone-300 shadow-lg p-4 text-right">
          <div className="flex items-start justify-between flex-row-reverse mb-2">
            <button type="button" onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-stone-900">מה המידה שלי?</div>
          </div>

          <p className="text-[11px] text-stone-500 leading-relaxed mb-3">
            הכנס את מידת המותן שאתה לובש בג׳ינס. נראה לך איך כל מידה בחנות תשב עליך.
          </p>

          <div className="flex items-center gap-2 justify-start flex-row-reverse">
            <input
              type="number"
              inputMode="numeric"
              min={24}
              max={48}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="32"
              className="w-20 border border-stone-300 px-2 py-1.5 text-sm font-mono text-center focus:outline-none focus:border-stone-900"
              id="my-size-input"
            />
            <span className="text-xs text-stone-400">אינץ׳</span>
            <button
              type="button"
              onClick={save}
              className="mr-auto bg-stone-900 text-white text-xs px-4 py-1.5 hover:bg-stone-700 cursor-pointer"
            >
              הצג
            </button>
          </div>

          {waistInches && rows.length > 0 && (
            <div className="mt-3 border-t border-stone-200 pt-3" id="my-size-table">
              <div className="text-[11px] text-stone-500 mb-2">
                המידות שיש עכשיו בקטגוריה הזו:
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {rows.map(({ size, inches }) => {
                  const v = verdictFor(inches, waistInches);
                  return (
                    <div
                      key={size}
                      className={`flex items-center justify-between flex-row-reverse border px-2.5 py-1.5 text-xs ${TONE_CLASS[v.tone]}`}
                    >
                      <span className="font-mono font-bold">{size}</span>
                      <span className="flex items-center gap-1.5 flex-row-reverse">
                        <strong>{v.label}</strong>
                        <span className="opacity-70 text-[10px]">{v.note}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={clear}
                className="mt-3 text-[11px] text-stone-400 hover:text-stone-900 underline cursor-pointer"
              >
                נקה את המידה שלי
              </button>
            </div>
          )}

          <p className="mt-3 text-[10px] leading-relaxed text-stone-400">
            הערכה בלבד. וינטג׳ נתפר לפי תקני המידות של שנות ה-90 וה-2000, שהיו צרים
            מהיום. בפריטים שנמדדו ידנית תמצא בעמוד הפריט את המידות המדויקות.
          </p>
        </div>
      )}
    </div>
  );
}
