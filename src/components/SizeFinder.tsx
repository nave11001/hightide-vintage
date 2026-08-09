import { useState } from 'react';
import { Product } from '../types';
import { track } from '../analytics';

// Vintage is one-of-a-kind: a 32 from 2003 Billabong and a 32 from 2009
// Quiksilver are not the same trousers. The label is a hint; the tape measure
// is the answer. This block shows the garment's own measurements and turns the
// shopper's usual jeans size into a straight fits / does-not-fit verdict.

interface SizeFinderProps {
  product: Product;
}

// Measurements are taken across the garment laid flat, so the waistband
// circumference is twice the number on the tag.
const flatToCircumference = (flat: number) => flat * 2;

// Boardshorts run on a drawstring, so a few cm of slack is comfort, not a
// mistake. Negative slack means the waistband has to stretch to close.
function verdict(slackCm: number) {
  if (slackCm < -3) return { label: 'קטן מדי', tone: 'bad', note: 'המותן צר מהמידה שלך' };
  if (slackCm < 1) return { label: 'צמוד', tone: 'warn', note: 'ייסגר, אבל בלי מרווח' };
  if (slackCm <= 8) return { label: 'מתאים', tone: 'good', note: 'זו המידה שלך' };
  if (slackCm <= 15) return { label: 'רפוי', tone: 'warn', note: 'ישב רחב — השרוך יחזיק' };
  return { label: 'גדול מדי', tone: 'bad', note: 'רחב מדי גם עם השרוך' };
}

const TONES: Record<string, string> = {
  good: 'bg-emerald-50 border-emerald-300 text-emerald-900',
  warn: 'bg-amber-50 border-amber-300 text-amber-900',
  bad: 'bg-red-50 border-red-300 text-red-900',
};

export default function SizeFinder({ product }: SizeFinderProps) {
  const [jeans, setJeans] = useState('');

  // Nothing measured yet — say nothing rather than guess.
  if (!product.waistCm && !product.lengthCm) return null;

  const inches = parseFloat(jeans);
  const valid = !Number.isNaN(inches) && inches >= 24 && inches <= 46;
  const result =
    valid && product.waistCm
      ? verdict(flatToCircumference(product.waistCm) - inches * 2.54)
      : null;

  return (
    <div className="mt-4 border border-stone-200 bg-[#fbfaf6]" id="size-finder">
      <div className="px-3 py-2 border-b border-stone-200 text-xs font-bold tracking-wide text-stone-700">
        מידות הפריט הזה
      </div>

      <div className="px-3 py-3">
        <div className="flex gap-6 justify-start flex-row-reverse text-sm">
          {product.waistCm && (
            <div className="text-right">
              <div className="text-stone-400 text-[11px]">מותן (שטוח)</div>
              <div className="font-mono font-bold text-stone-900">{product.waistCm} ס״מ</div>
              <div className="text-stone-400 text-[11px]">
                היקף {flatToCircumference(product.waistCm)} ס״מ
              </div>
            </div>
          )}
          {product.lengthCm && (
            <div className="text-right">
              <div className="text-stone-400 text-[11px]">אורך</div>
              <div className="font-mono font-bold text-stone-900">{product.lengthCm} ס״מ</div>
              <div className="text-stone-400 text-[11px]">חגורה עד סוף</div>
            </div>
          )}
        </div>

        {product.waistCm && (
          <>
            <div className="mt-3 pt-3 border-t border-stone-200 flex items-center gap-2 justify-start flex-row-reverse">
              <label htmlFor="jeans-size" className="text-xs text-stone-600 whitespace-nowrap">
                מידת הג׳ינס שלך:
              </label>
              <input
                id="jeans-size"
                type="number"
                inputMode="numeric"
                min={24}
                max={46}
                value={jeans}
                onChange={(e) => setJeans(e.target.value)}
                onBlur={() => {
                  if (valid) track('size_check', { product_id: product.id, jeans_size: inches });
                }}
                placeholder="32"
                className="w-20 border border-stone-300 bg-white px-2 py-1 text-sm font-mono text-center focus:outline-none focus:border-stone-900"
              />
              <span className="text-xs text-stone-400">אינץ׳</span>
            </div>

            {result && (
              <div
                className={`mt-2 border px-3 py-2 text-sm flex items-center gap-2 justify-start flex-row-reverse ${TONES[result.tone]}`}
                id="size-verdict"
              >
                <strong>{result.label}</strong>
                <span className="text-xs opacity-80">— {result.note}</span>
              </div>
            )}
          </>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
          נמדד ידנית על הפריט כשהוא שטוח, סטייה של 1-2 ס״מ אפשרית. הבגד וינטג׳ —
          המידה שרשומה על התווית היא של היצרן המקורי ולא תמיד תואמת למידות של היום.
        </p>
      </div>
    </div>
  );
}
