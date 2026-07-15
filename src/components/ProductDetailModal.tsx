import React, { useState } from 'react';
import { Product } from '../types';
import { X, ShieldCheck, RefreshCw, Star } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onEditProduct?: (product: Product) => void;
}

export default function ProductDetailModal({ product, onClose, onEditProduct }: ProductDetailModalProps) {
  if (!product) return null;

  const [selectedSize, setSelectedSize] = useState(product.sizes[0] || 'One Size');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'sizing' | 'shipping'>('details');
  const gallery = product.images && product.images.length > 0 ? product.images : [product.image];
  const [activeImage, setActiveImage] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="detail-modal">
      {/* Overlay background */}
      <div 
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Main product card container */}
      <div className="bg-[#fdfcf9] border border-stone-200/60 w-full max-w-3xl relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto rounded-none flex flex-col md:flex-row animate-scale-up">
        
        {/* Left close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 z-20 p-2 bg-white text-stone-700 hover:text-blue-600 border border-stone-200 rounded-none hover:bg-stone-50 transition-colors"
          id="close-detail-modal-btn"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Product Visual Container */}
        <div className="w-full md:w-1/2 p-4 sm:p-6 bg-stone-50/50 flex flex-col justify-center border-b md:border-b-0 md:border-l border-stone-100 min-h-[300px]">
          <div 
            onClick={() => onEditProduct && onEditProduct(product)}
            className={`relative w-full h-full bg-stone-50 flex items-center justify-center overflow-hidden aspect-square border border-stone-100 group ${
              onEditProduct ? 'cursor-pointer' : ''
            }`}
            title="לחץ לעריכת הפריט (תמונה ומחיר)"
          >
            <img
              src={gallery[activeImage] || product.image}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
            />
            {onEditProduct && (
              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1.5 p-4 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="text-xs font-bold font-sans bg-stone-900/90 py-1 px-2 border border-white/20">לחץ לשינוי תמונה / מחיר</span>
              </div>
            )}
          </div>

          {/* Angle thumbnails */}
          {gallery.length > 1 && (
            <div className="flex gap-2 mt-3 justify-center">
              {gallery.map((img, i) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`w-14 h-14 overflow-hidden border-2 transition-colors cursor-pointer ${
                    i === activeImage ? 'border-stone-900' : 'border-stone-200 hover:border-stone-400'
                  }`}
                >
                  <img src={img} alt={`זווית ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Meta & Configuration (Right Side) */}
        <div className="w-full md:w-1/2 p-6 flex flex-col text-right">
          <div className="flex justify-between items-center flex-row-reverse mb-1">
            <span className="text-xs font-mono font-normal text-stone-400 uppercase tracking-widest">
              {product.brand}
            </span>
            {onEditProduct && (
              <button
                type="button"
                onClick={() => onEditProduct(product)}
                className="px-3 py-1 text-xs font-bold border-2 border-stone-900 text-stone-900 hover:text-white hover:bg-stone-900 transition-all flex items-center gap-1.5 flex-row-reverse cursor-pointer bg-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>ערוך תמונה ומחיר פריט</span>
              </button>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-normal text-stone-900 leading-tight mt-1">
            {product.name}
          </h2>

          {/* Price display */}
          <div className="mt-2 flex items-baseline gap-3 justify-start flex-row-reverse">
            <span className="text-xl font-normal text-stone-900 font-mono">
              ₪{product.price}
            </span>
            {product.originalPrice && (
              <span className="text-xs text-stone-400 line-through font-mono">
                ₪{product.originalPrice}
              </span>
            )}
          </div>

          {/* Condition banner */}
          <div className="mt-4 bg-[#fbfaf6] border border-stone-200/50 p-2.5 text-xs text-stone-700 font-normal flex items-center gap-2 justify-start flex-row-reverse">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>מצב הפריט: {product.condition}</span>
          </div>

          {/* Navigation tabs inside detail card */}
          <div className="mt-6 border-b border-stone-200 flex gap-1 justify-start">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`pb-2 px-3 text-xs font-normal border-b transition-colors ${
                activeTab === 'details' ? 'border-stone-900 text-stone-900 font-medium' : 'border-transparent text-stone-400 hover:text-stone-800'
              }`}
            >
              פרטים נוספים
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sizing')}
              className={`pb-2 px-3 text-xs font-normal border-b transition-colors ${
                activeTab === 'sizing' ? 'border-stone-900 text-stone-900 font-medium' : 'border-transparent text-stone-400 hover:text-stone-800'
              }`}
            >
              מדריך מידות
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shipping')}
              className={`pb-2 px-3 text-xs font-normal border-b transition-colors ${
                activeTab === 'shipping' ? 'border-stone-900 text-stone-900 font-medium' : 'border-transparent text-stone-400 hover:text-stone-800'
              }`}
            >
              משלוחים והחזרות
            </button>
          </div>

          {/* Tab content panel */}
          <div className="py-4 text-xs sm:text-sm text-stone-600 leading-relaxed min-h-[100px] flex-grow font-light">
            {activeTab === 'details' && (
              <p className="font-normal text-right">{product.description}</p>
            )}
            {activeTab === 'sizing' && (
              <div className="space-y-2 text-right font-normal">
                <p>פריטי וינטג׳ משנות ה-90 וה-2000 יכולים להשתנות במידותיהם מהרשום בתווית.</p>
                {(() => {
                  const sizeNum = parseInt(product.sizes[0], 10);
                  if (isNaN(sizeNum)) return null;
                  const waistCm = Math.round(sizeNum * 2.54 / 2);
                  return (
                    <p className="font-normal text-stone-900">
                      מידה: {sizeNum} | רוחב מותן (שטוח): כ-{waistCm} ס״מ
                    </p>
                  );
                })()}
                <p className="text-stone-400 text-[11px]">מומלץ למדוד מכנס קיים שלכם לפני ביצוע הרכישה לקבלת התאמה מקסימלית.</p>
              </div>
            )}
            {activeTab === 'shipping' && (
              <div className="space-y-2 text-right font-normal">
                <p>משלוחים מהירים עד הבית בפריסה ארצית (2-4 ימי עסקים).</p>
                <p>איסוף עצמי בחינם: הגבעה 28 כפר האורנים - להגעה יש לתאם מראש.</p>
                <p>מאחר ומדובר בפריטי וינטג׳ ייחודיים (One of One), לא ניתן לבצע החלפה של אותו הפריט במידה אחרת.</p>
              </div>
            )}
          </div>

          {/* Size Selector */}
          <div className="mt-4 pt-4 border-t border-stone-100">
            <span className="block text-xs font-normal text-stone-500 uppercase mb-2">מידה קיימת במלאי:</span>
            <div className="flex gap-2 justify-start">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`min-w-[44px] h-9 px-3 font-mono text-xs font-normal border transition-colors ${
                    selectedSize === size
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                  id={`detail-size-btn-${size}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex flex-row-reverse gap-3 items-center">
            {/* Quantity select */}
            <div className="flex items-center border border-stone-200 w-24 h-10 bg-white flex-shrink-0 select-none">
              <button
                type="button"
                onClick={() => setQuantity((q) => (q > 1 ? q - 1 : 1))}
                className="w-8 h-full flex items-center justify-center hover:bg-stone-50 active:bg-stone-100 font-normal"
              >
                -
              </button>
              <span className="flex-grow text-center font-normal font-mono text-xs text-stone-800">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-full flex items-center justify-center hover:bg-stone-50 active:bg-stone-100 font-normal"
              >
                +
              </button>
            </div>

            {/* WhatsApp Purchase button */}
            <a
              href={`https://wa.me/972528879922?text=${encodeURIComponent(`שלום! אני מעוניין לרכוש את הפריט "${product.name}" במידה ${selectedSize} ובכמות ${quantity} במחיר כולל של ₪${product.price * quantity}. האם הוא זמין במלאי?`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex-grow h-10 bg-stone-900 hover:bg-stone-800 text-white font-medium transition-colors duration-200 flex items-center justify-center gap-2 text-sm cursor-pointer text-center"
              id="detail-add-btn"
            >
              <svg className="w-4 h-4 fill-current text-[#25D366]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.58 1.981 14.11 1.012 11.48 1.01 6.046 1.01 1.622 5.38 1.618 10.807c-.001 1.701.453 3.361 1.314 4.815L1.879 21.16l5.768-1.506zM17.91 14.9c-.31-.155-1.832-.9-2.115-1.002-.282-.102-.489-.153-.695.155-.205.308-.797 1.002-.976 1.207-.18.205-.359.231-.669.077-.31-.155-1.307-.481-2.49-1.534-.92-.818-1.541-1.83-1.722-2.138-.18-.308-.02-.475.135-.629.14-.138.31-.36.465-.54.155-.18.205-.308.31-.514.105-.205.051-.385-.026-.54-.077-.155-.695-1.673-.951-2.29-.25-.6-.54-.515-.744-.526-.192-.01-.41-.01-.628-.01-.218 0-.573.082-.873.411-.3.308-1.148 1.121-1.148 2.733 0 1.612 1.174 3.172 1.336 3.393.162.22 2.311 3.52 5.597 4.939.781.337 1.39.539 1.86.688.784.249 1.497.214 2.061.13.629-.094 1.832-.749 2.088-1.439.256-.689.256-1.284.18-1.402-.077-.117-.282-.18-.592-.336z"/>
              </svg>
              <span>רכישה בווטסאפ</span>
            </a>
          </div>

          {/* Guarantee / trust statements */}
          <div className="mt-5 grid grid-cols-2 gap-2 text-[10px] text-stone-400 pt-4 border-t border-stone-100 font-normal text-center">
            <div className="flex items-center gap-1 justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% מקורי ומאומת</span>
            </div>
            <div className="flex items-center gap-1 justify-center">
              <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
              <span>ניקוי יבש וחיטוי יסודי</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
