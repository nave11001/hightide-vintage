import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { track } from '../analytics';

// The ten most-viewed items, straight from the view counter each item carries.
// No editing, no curation: whatever the shop is actually looking at rises.

interface TopWantedProps {
  products: Product[];
  onViewDetails: (product: Product) => void;
}

const HOW_MANY = 10;

export default function TopWanted({ products, onViewDetails }: TopWantedProps) {
  const rail = useRef<HTMLDivElement>(null);

  // Sold items keep their views but stop being something to want.
  const top = [...products]
    .filter((p) => !p.isSold && (p.views ?? 0) > 0)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, HOW_MANY);

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
          className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 cursor-pointer shadow-sm"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => scroll('next')}
          aria-label="הבא"
          className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 cursor-pointer shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={rail}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          id="top-wanted-rail"
        >
          {top.map((product, i) => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                track('top_wanted_click', { product_id: product.id, rank: i + 1 });
                onViewDetails(product);
              }}
              className="snap-start shrink-0 w-[46%] sm:w-[31%] lg:w-[23%] text-right group cursor-pointer"
              id={`top-wanted-${product.id}`}
            >
              <div className="relative aspect-[4/5] bg-stone-50 border border-gray-100 overflow-hidden">
                <img
                  src={product.image}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-103"
                />
                <span className="absolute top-2 right-2 bg-stone-900 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center select-none">
                  {i + 1}
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
                {product.originalPrice && (
                  <span className="text-xs text-gray-400 line-through">
                    ₪{product.originalPrice}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
