import React from 'react';
import { Product } from '../types';
import { Heart } from 'lucide-react';
import soldStampUrl from '@/assets/photos/sold_stamp.png';

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
  return (
    <div
      className="flex flex-col group h-full bg-[#fdfcf9] border border-gray-100 rounded-none overflow-hidden transition-all duration-300 hover:shadow-sm"
      id={`product-card-${product.id}`}
    >
      {/* Product Image - Completely clean container with NO vintage frame, just like the jewelry screenshot */}
      <div 
        className="relative cursor-pointer overflow-hidden aspect-[4/5] bg-gray-50" 
        onClick={() => onViewDetails(product)}
      >
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center transform transition-transform duration-500 group-hover:scale-103"
          id={`product-img-${product.id}`}
        />
        {/* Second angle revealed on hover */}
        {product.images && product.images[1] && (
          <img
            src={product.images[1]}
            alt={`${product.name} - זווית נוספת`}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        )}
      </div>

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
          <h3
            className="text-sm sm:text-base font-normal text-gray-800 leading-snug hover:text-stone-950 transition-colors cursor-pointer line-clamp-1 flex-grow"
            onClick={() => onViewDetails(product)}
          >
            {product.name}
          </h3>
        </div>

        {/* Row 2: Price (Formatted clean) */}
        <div className="mt-1 flex items-center gap-2 justify-start flex-row-reverse">
          <span className="text-base font-medium text-stone-900">
            ₪{product.price}
          </span>
          {product.originalPrice && (
            <span className="text-xs text-gray-400 line-through">
              ₪{product.originalPrice}
            </span>
          )}
          {/* Small SOLD stamp at the left edge of the price row */}
          {product.isSold && (
            <img
              src={soldStampUrl}
              alt="נמכר"
              className="h-9 w-auto mr-auto select-none"
              draggable={false}
            />
          )}
        </div>

        {/* Row 3: Product Description snippet */}
        <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed font-light flex-grow">
          {product.description}
        </p>

        {/* Row 4: Clean, elegant minimalist button "רכישה בווטסאפ" in white style */}
        {product.isSold ? (
          <span className="mt-3.5 w-full bg-stone-100 text-stone-400 border border-stone-200 font-medium py-2 px-4 flex items-center justify-center text-xs text-center cursor-not-allowed select-none">
            נמכר
          </span>
        ) : (
        <a
          href={`https://wa.me/972528879922?text=${encodeURIComponent(`שלום! אני מעוניין לרכוש את הפריט "${product.name}" במחיר ₪${product.price}. האם הוא זמין במלאי?`)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="mt-3.5 w-full bg-white hover:bg-stone-50 text-[#128C7E] border border-stone-200 hover:border-[#128C7E] font-medium py-2 px-4 rounded-none transition-colors duration-200 flex items-center justify-center gap-2 text-xs cursor-pointer text-center"
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
