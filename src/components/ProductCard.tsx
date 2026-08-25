import React from 'react';
import { Product } from '../types';
import { Heart } from 'lucide-react';
import soldStampUrl from '@/assets/photos/sold_stamp.webp';
// Downscaled from Sale.png — the original is 1536px wide for a 40px badge.
import saleStampUrl from '@/assets/photos/sale_stamp.webp';
import { trackProduct } from '../analytics';
import { onPhotoError, srcSetFor } from '../photos';
import { productPath } from '@/shared/slug.mjs';
import { buyOnWhatsApp } from '../whatsapp';

interface ProductCardProps {
  product: Product;
  isFavorite: boolean;
  onToggleFavorite: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  key?: string;
}

export default function ProductCard({
  product,
  isFavorite,
  onToggleFavorite,
  onViewDetails,
}: ProductCardProps) {
  // The second angle is not fetched until a pointer actually asks for it.
  //
  // It used to download with the card. On a category page of 45 items that was
  // 45 extra photographs nobody had asked to see — and on a phone, where there
  // is no hover at all, not one of them could ever be shown. Half the shop's
  // image traffic was spent on pictures no customer saw.
  //
  // Once loaded it stays mounted, so a second hover is instant.
  const [angleWanted, setAngleWanted] = React.useState(false);
  const hasAngle = Boolean(product.images && product.images[1]);

  // The garment's own address, on the picture and on the name.
  //
  // They were divs with an onClick, which works for exactly one gesture: a
  // plain tap. Tabbing through a category went heart, buy, heart, buy — never
  // reaching a single garment — and a long press offered no "open in new tab"
  // and no link to copy, because there was no link. A real href fixes all of
  // it at once and the browser handles the modifier keys itself.
  //
  // Still routed rather than reloaded: the plain click is taken over, and
  // anything the customer means as "open this somewhere else" is left alone.
  const href = productPath(product.brand, product.num);
  const open = (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    event.preventDefault();
    onViewDetails(product);
  };

  return (
    <div
      className="flex flex-col group h-full bg-[#fdfcf9] border border-gray-100 rounded-none overflow-hidden transition-all duration-300 hover:shadow-sm"
      id={`product-card-${product.id}`}
    >
      {/* Product Image - Completely clean container with NO vintage frame, just like the jewelry screenshot */}
      <a
        href={href}
        onClick={open}
        className="relative block cursor-pointer overflow-hidden aspect-[4/5] bg-gray-50"
        onMouseEnter={hasAngle ? () => setAngleWanted(true) : undefined}
      >
        {/* Loaded outright, not on scroll.
            Lazy loading was worth its risk when each photograph was 564KB and
            came from a metered bucket. It is not worth it now: they are 58KB
            and served from this site, so the whole of a category page is a
            couple of megabytes. Against that, lazy loading hands the decision
            to the browser, and on iOS Safari it left cards blank in front of
            customers. A shop that shows its garments beats a shop that saves
            two megabytes. */}
        <img
          src={product.image}
          srcSet={srcSetFor(product.image)}
          // Two per row on a phone, three on a tablet, four on a desktop — the
          // same breakpoints as the grid this card sits in.
          sizes="(min-width: 1024px) 23vw, (min-width: 768px) 31vw, 47vw"
          alt={product.name}
          referrerPolicy="no-referrer"
          decoding="async"
          onError={onPhotoError}
          className="w-full h-full object-cover object-center transform transition-transform duration-500 group-hover:scale-103"
          id={`product-img-${product.id}`}
        />
        {/* Second angle revealed on hover */}
        {hasAngle && angleWanted && (
          <img
            src={product.images![1]}
            srcSet={srcSetFor(product.images![1])}
            sizes="(min-width: 1024px) 23vw, (min-width: 768px) 31vw, 47vw"
            alt={`${product.name} - זווית נוספת`}
            referrerPolicy="no-referrer"
            decoding="async"
            onError={onPhotoError}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        )}
      </a>

      {/* Item info - Structured exactly like the jewelry screenshot */}
      <div className="p-3.5 flex flex-col flex-grow text-right">
        {/* Row 1: Title and Heart (Favorite Button) */}
        <div className="flex items-start justify-between gap-2 flex-row-reverse">
          {/* Heart Favorite Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(product);
            }}
            className="p-1.5 text-gray-400 hover:text-stone-900 hover:scale-110 active:scale-95 transition-all cursor-pointer rounded-full hover:bg-stone-50"
            title={isFavorite ? "הסר מהמועדפים" : "הוסף למועדפים"}
            id={`fav-btn-${product.id}`}
          >
            <Heart
              className={`w-5 h-5 transition-colors duration-200 ${
                isFavorite ? 'fill-none stroke-black stroke-[2.5px]' : 'stroke-gray-400'
              }`}
            />
          </button>

          {/* Name / Title */}
          <h3 className="line-clamp-1 flex-grow">
            <a
              href={href}
              onClick={open}
              className="text-sm sm:text-base font-normal text-gray-800 leading-snug hover:text-stone-950 transition-colors cursor-pointer no-underline"
            >
              {product.name}
            </a>
          </h3>
        </div>

        {/* Row 2: Price (Formatted clean)
            Wraps rather than overflows: a garment that is both sold and
            discounted puts a price, a struck price and two stamps on one line,
            which on a phone ran past the edge of the card and left half a SOLD
            stamp floating outside it. */}
        <div className="mt-1 flex flex-wrap items-center gap-2 justify-start flex-row-reverse">
          {/* On sale, the live price turns red and the old one stays struck through beside it */}
          <span
            className={
              product.originalPrice
                ? 'text-base font-bold text-red-600'
                : 'text-base font-medium text-stone-900'
            }
          >
            ₪{product.price}
          </span>
          {product.originalPrice && (
            <>
              {/* The saving is the reason this card sells, and it was set in
                  12px gray-400 — 2.5:1 against the card, under half the
                  readable minimum. A shopper could see the red price had a
                  companion and not make out what it said. */}
              <span className="text-sm text-stone-500 line-through">
                ₪{product.originalPrice}
              </span>
              <img
                src={saleStampUrl}
                alt="מבצע"
                className="h-7 w-auto shrink-0 select-none"
                draggable={false}
              />
            </>
          )}
          {/* Small SOLD stamp at the left edge of the price row */}
          {product.isSold && (
            <img
              src={soldStampUrl}
              alt="נמכר"
              className="h-9 w-auto shrink-0 mr-auto select-none"
              draggable={false}
            />
          )}
        </div>

        {/* Row 3: Product Description snippet */}
        <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed font-light flex-grow">
          {product.description}
        </p>

        {/* Row 4: the only thing on this card that sells anything.
            It was white with a pale border and teal text at 4.1:1 — under the
            readable minimum, and quieter than the price above it and the heart
            beside it, on a shop whose entire checkout is this message.
            Filled, and filled in the same stone-900 the item page already uses
            for the identical action, with WhatsApp's green kept on the mark.
            Not a green fill: forty-five of those down a category page would be
            louder than the clothes, and the clothes are the product.
            py-3.5 rather than py-2 because it measured 38px tall and a thumb
            wants 44 — the one control on the card nobody should have to aim
            for twice. */}
        {product.isSold ? (
          <span className="mt-3.5 w-full bg-stone-100 text-stone-600 border border-stone-200 font-medium py-2 px-4 flex items-center justify-center text-xs text-center cursor-not-allowed select-none">
            נמכר
          </span>
        ) : (
        <a
          href={buyOnWhatsApp(product)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            trackProduct('whatsapp_purchase_click', product, { source: 'card' });
          }}
          className="mt-3.5 w-full bg-stone-900 hover:bg-stone-800 text-white border border-stone-900 hover:border-stone-800 font-medium py-3.5 px-4 rounded-none transition-colors duration-200 flex items-center justify-center gap-2 text-xs cursor-pointer text-center no-underline"
          id={`quick-buy-btn-${product.id}`}
        >
          <svg className="w-4 h-4 fill-current text-[#25D366]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.58 1.981 14.11 1.012 11.48 1.01 6.046 1.01 1.622 5.38 1.618 10.807c-.001 1.701.453 3.361 1.314 4.815L1.879 21.16l5.768-1.506zM17.91 14.9c-.31-.155-1.832-.9-2.115-1.002-.282-.102-.489-.153-.695.155-.205.308-.797 1.002-.976 1.207-.18.205-.359.231-.669.077-.31-.155-1.307-.481-2.49-1.534-.92-.818-1.541-1.83-1.722-2.138-.18-.308-.02-.475.135-.629.14-.138.31-.36.465-.54.155-.18.205-.308.31-.514.105-.205.051-.385-.026-.54-.077-.155-.695-1.673-.951-2.29-.25-.6-.54-.515-.744-.526-.192-.01-.41-.01-.628-.01-.218 0-.573.082-.873.411-.3.308-1.148 1.121-1.148 2.733 0 1.612 1.174 3.172 1.336 3.393.162.22 2.311 3.52 5.597 4.939.781.337 1.39.539 1.86.688.784.249 1.497.214 2.061.13.629-.094 1.832-.749 2.088-1.439.256-.689.256-1.284.18-1.402-.077-.117-.282-.18-.592-.336z"/>
          </svg>
          <span>רכישה בווטסאפ</span>
        </a>
        )}
      </div>
    </div>
  );
}
