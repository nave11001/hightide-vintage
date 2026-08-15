import React, { type ReactNode } from 'react';
import { Product } from '../types';
import { track } from '../analytics';
import Logo from './Logo';
import {
  splitByWaist,
  shirtsByLetter,
  nearestWaists,
  availableShirtLetters,
  categoryForGender,
  byViews,
} from '@/shared/sizing.mjs';

// Where a shopper lands when the Instagram bot sends them here with their size.
// The shop's own filters are for browsing; this is for someone who already
// knows their number and wants to see what of it exists.
//
// Two rails, because two different claims are being made. The first is pieces
// labelled that size. The second is pieces labelled with a letter that covers
// it — true, but a weaker claim, so it gets its own heading rather than being
// blended in.

const HOW_MANY = 5;

interface SizeLandingProps {
  products: Product[];
  gender: 'men' | 'women';
  /** A waist in inches, or a shirt letter. */
  query: { kind: 'waist'; waist: number } | { kind: 'letter'; letter: string };
  onViewDetails: (product: Product) => void;
  /** Show every match, not just the top five. */
  onShowAll: (sizes: string[], category: string) => void;
  onBrowseAll: () => void;
  /** Jump to a size that does have stock. */
  onPickSize: (size: string) => void;
}

interface CardProps {
  product: Product;
  /** A rank in the first rail, the garment's own letter in the second. */
  badge: string;
  onViewDetails: (p: Product) => void;
  // Declared here because the project carries no @types/react — same as ProductCard.
  key?: string;
}

function Card({ product, badge, onViewDetails }: CardProps) {
  return (
    <button
      type="button"
      onClick={() => onViewDetails(product)}
      className="snap-start shrink-0 w-[46%] sm:w-[31%] lg:w-[18.4%] text-right group cursor-pointer"
      id={`size-landing-${product.id}`}
    >
      <div className="relative aspect-[4/5] bg-stone-50 border border-gray-100 overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-103"
        />
        <span
          className={
            /^\d+$/.test(badge)
              ? 'absolute top-2 right-2 bg-stone-900 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center select-none'
              : 'absolute top-2 right-2 bg-white border border-stone-300 text-stone-900 text-[10px] font-bold px-2 py-[3px] select-none'
          }
        >
          {badge}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-normal text-gray-800 line-clamp-1">{product.name}</h3>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <span className="flex items-center gap-1.5 flex-row-reverse">
          <span
            className={
              product.originalPrice
                ? 'text-sm font-bold text-red-600'
                : 'text-sm font-medium text-stone-900'
            }
          >
            ₪{product.price}
          </span>
          {product.originalPrice && (
            <span className="text-xs text-gray-400 line-through">₪{product.originalPrice}</span>
          )}
        </span>
        <span className="text-xs text-stone-500">מידה {product.sizes[0]}</span>
      </div>
    </button>
  );
}

function Rail({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 mt-4 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

function Heading({ en, he }: { en: string; he: string }) {
  return (
    <div className="text-center">
      <h2 className="text-xl sm:text-2xl font-groovy font-normal text-stone-900 uppercase">{en}</h2>
      <p className="mt-1 text-[13px] text-stone-500">{he}</p>
    </div>
  );
}

export default function SizeLanding({
  products,
  gender,
  query,
  onViewDetails,
  onShowAll,
  onBrowseAll,
  onPickSize,
}: SizeLandingProps) {
  const isWaist = query.kind === 'waist';
  const category = isWaist ? categoryForGender(gender) : 'shirts';
  const label = isWaist ? String(query.waist) : query.letter;

  // The rules live in shared/sizing.mjs so the bot and the shop cannot drift
  // apart; it is plain JS, so name the shapes on the way back in.
  const { exact, maybe } = (
    isWaist
      ? splitByWaist(products, query.waist, { category })
      : { exact: shirtsByLetter(products, query.letter), maybe: [] }
  ) as { exact: Product[]; maybe: Product[] };

  const top = [...exact].sort(byViews);
  const alsoFits = [...maybe].sort(byViews).slice(0, HOW_MANY);

  const who = isWaist ? (gender === 'women' ? 'מכנסי נשים' : 'מכנסי גברים') : 'חולצות';
  const noun = isWaist ? 'מכנסיים' : 'חולצות';

  // Nothing at all in this size — offer the sizes that do have stock rather
  // than a dead end.
  const suggestions = isWaist
    ? nearestWaists(products, query.waist, { category })
    : availableShirtLetters(products)
        .filter((s) => s.letter !== query.letter)
        .map((s) => ({ size: s.letter, count: s.count }));

  return (
    <div className="max-w-6xl mx-auto px-4 pb-16" id="size-landing" dir="rtl">
      <header className="text-center pt-8 pb-6 border-b border-stone-200">
        <button type="button" onClick={onBrowseAll} className="cursor-pointer" aria-label="לדף הבית">
          <Logo className="w-14 h-14 mx-auto" />
        </button>
        <p className="mt-3 text-[15px] tracking-[0.16em] uppercase text-stone-500 font-groovy">
          Your Size
        </p>
        <p className="text-5xl sm:text-6xl font-light leading-none mt-1 text-stone-900">{label}</p>
        <p className="mt-1.5 text-[13px] text-stone-500">{who}</p>
        <div className="w-12 h-[1px] bg-stone-800 mx-auto my-4"></div>
        <p className="text-[15px] text-stone-800">
          {exact.length > 0
            ? `${exact.length} ${noun} במידה שלך`
            : `אין כרגע ${noun} במידה ${label}`}
        </p>
      </header>

      {exact.length > 0 && (
        <section className="mt-8" id="size-landing-exact">
          <Heading en="Most Wanted In Your Size" he={`המבוקשים ביותר במידה ${label}`} />
          <Rail>
            {top.slice(0, HOW_MANY).map((product, i) => (
              <Card
                key={product.id}
                product={product}
                badge={String(i + 1)}
                onViewDetails={onViewDetails}
              />
            ))}
          </Rail>
          {exact.length > HOW_MANY && (
            <button
              type="button"
              onClick={() => {
                track('size_landing_show_all', { size: label, category, count: exact.length });
                onShowAll(exact.flatMap((p) => p.sizes), category);
              }}
              className="block w-full mt-5 py-4 bg-stone-900 hover:bg-black text-white text-[15px] cursor-pointer"
              id="size-landing-show-all"
            >
              {`לכל ${exact.length} ה${noun} במידה ${label} ←`}
            </button>
          )}
        </section>
      )}

      {alsoFits.length > 0 && (
        <section className="mt-10 pt-7 border-t border-stone-200" id="size-landing-maybe">
          <Heading en="Might Also Fit" he={`מסומנים באות שמכסה מותן ${label}`} />
          <Rail>
            {alsoFits.map((product) => (
              <Card
                key={product.id}
                product={product}
                badge={String(product.sizes[0] ?? '').toUpperCase()}
                onViewDetails={onViewDetails}
              />
            ))}
          </Rail>
        </section>
      )}

      {exact.length === 0 && alsoFits.length === 0 && (
        <section className="mt-8 text-center" id="size-landing-empty">
          {suggestions.length > 0 ? (
            <>
              <p className="text-[15px] text-stone-800">אבל יש לנו במידות האלה:</p>
              <div className="flex flex-wrap justify-center gap-3 mt-5">
                {suggestions.map((s) => (
                  <button
                    key={s.size}
                    type="button"
                    onClick={() => {
                      track('size_landing_suggestion', { from: label, to: String(s.size) });
                      onPickSize(String(s.size));
                    }}
                    className="px-5 py-3 border border-stone-300 hover:border-stone-900 text-stone-900 text-sm cursor-pointer"
                  >
                    <span className="font-medium">מידה {s.size}</span>
                    <span className="text-stone-500"> · {s.count}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[15px] text-stone-600">
              דרופ חדש נכנס כל שבוע — שווה לעקוב.
            </p>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={onBrowseAll}
        className="block mx-auto mt-8 text-[13px] text-stone-500 underline hover:text-stone-900 cursor-pointer"
      >
        לחנות המלאה
      </button>
    </div>
  );
}
