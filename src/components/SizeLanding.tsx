import React, { type ReactNode } from 'react';
import { Product } from '../types';
import { track } from '../analytics';
import { onPhotoError, srcSetFor } from '../photos';
import Logo from './Logo';
import {
  splitByWaist,
  shirtsByLetter,
  nearestWaists,
  availableShirtLetters,
  categoryForGender,
  byViews,
} from '@/shared/sizing.mjs';

// Where a shopper lands when the Instagram bot sends them here with their
// sizes. The bot asks for a waist and a shirt letter, then hands over a single
// link — so this page has to answer both in one screen.
//
// Each garment type gets its own rail. Within the trousers, pieces labelled
// the size asked for are separated from pieces whose letter merely covers it:
// both are true, but the second is a weaker claim and saying so is the honest
// version.

const HOW_MANY = 5;

interface CardProps {
  product: Product;
  /** A rank in the main rail, the garment's own letter in the wider one. */
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
          srcSet={srcSetFor(product.image)}
          sizes="(min-width: 1024px) 19vw, (min-width: 640px) 31vw, 46vw"
          alt={product.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={onPhotoError}
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
          {/* This is the page the Instagram bot sends people to — the warmest
              traffic the shop gets — and the discount on it was the one thing
              too faint to read. */}
          {product.originalPrice && (
            <span className="text-sm text-stone-500 line-through">₪{product.originalPrice}</span>
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

/** The sizes that do have stock, when the one asked for has none. */
function Suggestions({
  options,
  onPick,
}: {
  options: { size: string; count: number }[];
  onPick: (size: string) => void;
}) {
  if (options.length === 0) {
    return <p className="text-center text-[15px] text-stone-600 mt-4">דרופ חדש נכנס כל שבוע — שווה לעקוב.</p>;
  }
  return (
    <>
      <p className="text-center text-[15px] text-stone-800 mt-4">אבל יש לנו במידות האלה:</p>
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {options.map((o) => (
          <button
            key={o.size}
            type="button"
            onClick={() => onPick(o.size)}
            className="px-5 py-3 border border-stone-300 hover:border-stone-900 text-stone-900 text-sm cursor-pointer"
          >
            <span className="font-medium">מידה {o.size}</span>
            <span className="text-stone-500"> · {o.count}</span>
          </button>
        ))}
      </div>
    </>
  );
}

interface SizeLandingProps {
  products: Product[];
  gender: 'men' | 'women';
  /** A waist in inches. Absent when the shopper only gave a shirt size. */
  waist?: number;
  /** A shirt letter. Absent when the shopper only gave a waist. */
  shirt?: string;
  onViewDetails: (product: Product) => void;
  /** Show every match, not just the top five. */
  onShowAll: (sizes: string[], category: string) => void;
  onBrowseAll: () => void;
  /** Jump to a size that does have stock. */
  onPickSize: (kind: 'waist' | 'shirt', size: string) => void;
}

export default function SizeLanding({
  products,
  gender,
  waist,
  shirt,
  onViewDetails,
  onShowAll,
  onBrowseAll,
  onPickSize,
}: SizeLandingProps) {
  const bottomsCategory = categoryForGender(gender);
  const trouserWord = gender === 'women' ? 'מכנסי נשים' : 'מכנסיים';

  const { exact: pants, maybe: alsoPants } = (
    waist !== undefined
      ? splitByWaist(products, waist, { category: bottomsCategory })
      : { exact: [], maybe: [] }
  ) as { exact: Product[]; maybe: Product[] };

  const shirts = (shirt ? shirtsByLetter(products, shirt) : []) as Product[];

  const nearerWaists = (
    waist !== undefined && pants.length === 0 && alsoPants.length === 0
      ? nearestWaists(products, waist, { category: bottomsCategory })
      : []
  ) as { size: number; count: number }[];

  const nearerShirts = (
    shirt && shirts.length === 0
      ? availableShirtLetters(products).filter((s: { letter: string }) => s.letter !== shirt)
      : []
  ) as { letter: string; count: number }[];

  const both = waist !== undefined && shirt !== undefined;
  const totals = [
    pants.length > 0 ? `${pants.length} ${trouserWord}` : '',
    shirts.length > 0 ? `${shirts.length} חולצות` : '',
  ].filter(Boolean);

  const showAll = (list: Product[], category: string, label: string, noun: string) =>
    list.length > HOW_MANY ? (
      <button
        type="button"
        onClick={() => {
          track('size_landing_show_all', { size: label, category, count: list.length });
          onShowAll(list.flatMap((p) => p.sizes), category);
        }}
        className="block w-full mt-5 py-4 bg-stone-900 hover:bg-black text-white text-[15px] cursor-pointer"
        id={`size-landing-show-all-${category}`}
      >
        {`לכל ${list.length} ה${noun} במידה ${label} ←`}
      </button>
    ) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-16" id="size-landing" dir="rtl">
      <header className="text-center pt-8 pb-6 border-b border-stone-200">
        <button type="button" onClick={onBrowseAll} className="cursor-pointer" aria-label="לדף הבית">
          <Logo className="w-14 h-14 mx-auto" />
        </button>
        <p className="mt-3 text-[15px] tracking-[0.16em] uppercase text-stone-500 font-groovy">
          {both ? 'Your Sizes' : 'Your Size'}
        </p>

        {both ? (
          <div className="flex items-start justify-center gap-8 mt-2">
            <div>
              <p className="text-4xl sm:text-5xl font-light leading-none text-stone-900">{waist}</p>
              <p className="mt-1.5 text-[13px] text-stone-500">{trouserWord}</p>
            </div>
            <div className="w-[1px] self-stretch bg-stone-200"></div>
            <div>
              <p className="text-4xl sm:text-5xl font-light leading-none text-stone-900">{shirt}</p>
              <p className="mt-1.5 text-[13px] text-stone-500">חולצות</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-5xl sm:text-6xl font-light leading-none mt-1 text-stone-900">
              {waist !== undefined ? waist : shirt}
            </p>
            <p className="mt-1.5 text-[13px] text-stone-500">
              {waist !== undefined ? trouserWord : 'חולצות'}
            </p>
          </>
        )}

        <div className="w-12 h-[1px] bg-stone-800 mx-auto my-4"></div>
        <p className="text-[15px] text-stone-800">
          {totals.length > 0 ? `${totals.join(' ו-')} במידות שלך` : 'אין כרגע פריטים במידות שלך'}
        </p>
      </header>

      {/* ── trousers ─────────────────────────────────────────────────────── */}
      {waist !== undefined && (
        <>
          {pants.length > 0 && (
            <section className="mt-8" id="size-landing-exact">
              <Heading
                en="Most Wanted In Your Size"
                he={`${trouserWord} — המבוקשים ביותר במידה ${waist}`}
              />
              <Rail>
                {pants
                  .slice()
                  .sort(byViews)
                  .slice(0, HOW_MANY)
                  .map((product, i) => (
                    <Card
                      key={product.id}
                      product={product}
                      badge={String(i + 1)}
                      onViewDetails={onViewDetails}
                    />
                  ))}
              </Rail>
              {showAll(pants, bottomsCategory, String(waist), trouserWord)}
            </section>
          )}

          {alsoPants.length > 0 && (
            <section className="mt-10 pt-7 border-t border-stone-200" id="size-landing-maybe">
              <Heading en="Might Also Fit" he={`מסומנים באות שמכסה מותן ${waist}`} />
              <Rail>
                {alsoPants
                  .slice()
                  .sort(byViews)
                  .slice(0, HOW_MANY)
                  .map((product) => (
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

          {pants.length === 0 && alsoPants.length === 0 && (
            <section className="mt-8" id="size-landing-empty-pants">
              <Heading en="Nothing In That Waist" he={`אין כרגע ${trouserWord} במידה ${waist}`} />
              <Suggestions
                options={nearerWaists.map((s) => ({ size: String(s.size), count: s.count }))}
                onPick={(size) => {
                  track('size_landing_suggestion', { from: String(waist), to: size });
                  onPickSize('waist', size);
                }}
              />
            </section>
          )}
        </>
      )}

      {/* ── shirts ───────────────────────────────────────────────────────── */}
      {shirt !== undefined && (
        <>
          {shirts.length > 0 ? (
            <section className="mt-10 pt-7 border-t border-stone-200" id="size-landing-shirts">
              <Heading en="Shirts In Your Size" he={`חולצות — המבוקשות ביותר במידה ${shirt}`} />
              <Rail>
                {shirts
                  .slice()
                  .sort(byViews)
                  .slice(0, HOW_MANY)
                  .map((product, i) => (
                    <Card
                      key={product.id}
                      product={product}
                      badge={String(i + 1)}
                      onViewDetails={onViewDetails}
                    />
                  ))}
              </Rail>
              {showAll(shirts, 'shirts', shirt, 'חולצות')}
            </section>
          ) : (
            <section className="mt-10 pt-7 border-t border-stone-200" id="size-landing-empty-shirts">
              <Heading en="Nothing In That Size" he={`אין כרגע חולצות במידה ${shirt}`} />
              <Suggestions
                options={nearerShirts.map((s) => ({ size: s.letter, count: s.count }))}
                onPick={(size) => {
                  track('size_landing_suggestion', { from: shirt, to: size });
                  onPickSize('shirt', size);
                }}
              />
            </section>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onBrowseAll}
        className="block mx-auto mt-10 text-[13px] text-stone-500 underline hover:text-stone-900 cursor-pointer"
      >
        לחנות המלאה
      </button>
    </div>
  );
}
