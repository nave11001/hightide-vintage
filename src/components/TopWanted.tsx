import { Product } from '../types';
import { track } from '../analytics';
import CircularGallery, { GalleryItem } from './CircularGallery';

// The ten most-viewed items, straight from the view counter each item carries.
// No editing, no curation: whatever the shop is actually looking at rises.

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

export default function TopWanted({ products, onViewDetails }: TopWantedProps) {
  const top = pickTopWanted(products);

  // Nothing viewed yet — say nothing rather than show an empty rail.
  if (top.length < 3) return null;

  const items: GalleryItem[] = top.map((p, i) => ({
    id: p.id,
    image: p.image,
    hoverImage: p.images?.[1],
    title: p.name,
    price: p.price,
    originalPrice: p.originalPrice,
    badge: String(i + 1),
  }));

  return (
    <section className="mb-12" id="top-wanted" dir="rtl">
      <div className="text-center mb-5">
        <h2 className="text-xl sm:text-2xl font-groovy font-normal text-stone-900 uppercase">
          Our Most Wanted Pieces
        </h2>
        <div className="w-12 h-[1px] bg-stone-800 mx-auto mt-3"></div>
      </div>

      <CircularGallery
        items={items}
        className="h-[360px] sm:h-[460px] lg:h-[500px]"
        bend={4}
        borderRadius={0.05}
        scrollSpeed={2.4}
        scrollEase={0.06}
        onNudge={(direction) => track('top_wanted_scroll', { direction })}
        onSelect={(item) => {
          const rank = items.findIndex((x) => x.id === item.id) + 1;
          track('top_wanted_click', { product_id: item.id, rank });
          const product = top.find((p) => p.id === item.id);
          if (product) onViewDetails(product);
        }}
      />
    </section>
  );
}
