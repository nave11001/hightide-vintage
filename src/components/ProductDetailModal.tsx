import React, { useState, useRef, useEffect } from 'react';
import { Product } from '../types';
import { X, ShieldCheck, RefreshCw, Star, Share2, Check, Link2 } from 'lucide-react';
import WhatsAppMark from './WhatsAppMark';
import { trackProduct } from '../analytics';
import saleStampUrl from '@/assets/photos/sale_stamp.webp';
import { onPhotoError, srcSetFor } from '../photos';
import { navigate } from '../router';
import { productPath } from '@/shared/slug.mjs';
import { buyOnWhatsApp, productUrl } from '../whatsapp';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onEditProduct?: (product: Product) => void;
  /**
   * 'modal' lays the garment over the shop, for a click inside it.
   * 'page' is the same card standing on its own, for someone who arrived on
   * the garment's own address — there is no shop behind them to cover.
   */
  variant?: 'modal' | 'page';
  /** The rest of the shop, for the row of suggestions underneath. */
  catalogue?: Product[];
}

/**
 * Four garments to show under this one, best first.
 *
 * Every piece here is one of one, so the usual "more of this product" has
 * nothing to point at — and that is exactly why the row matters. A shopper who
 * likes this pair but cannot wear a 32 has, at this moment, no reason left to
 * stay. Brand first because someone looking at Billabong is looking at
 * Billabong; then size, because a size that fits is the scarcest thing in a
 * vintage shop; then the same rail, then a near price.
 */
function similarTo(product: Product, catalogue: Product[]): Product[] {
  const size = product.sizes[0];
  const ranked = catalogue
    .filter((p) => p.num !== product.num && !p.isSold)
    .map((p) => {
      let score = 0;
      if (p.brand && p.brand === product.brand) score += 4;
      if (size && p.sizes.includes(size)) score += 3;
      if (p.category === product.category) score += 2;
      if (Math.abs(p.price - product.price) <= product.price * 0.2) score += 1;
      return { p, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (b.p.views ?? 0) - (a.p.views ?? 0));

  // At most two from any one brand.
  //
  // Score alone filled the row with four Quiksilvers, three of them in sizes
  // the shopper had just not chosen — the same garment four times, in the wrong
  // size. Two of the brand and two that fit is a row worth looking at. The
  // second pass fills from what is left if the cap runs the row short.
  const perBrand: Record<string, number> = {};
  const picked: Product[] = [];
  for (const { p } of ranked) {
    if (picked.length === 4) break;
    const seen = perBrand[p.brand] ?? 0;
    if (seen >= 2) continue;
    perBrand[p.brand] = seen + 1;
    picked.push(p);
  }
  for (const { p } of ranked) {
    if (picked.length === 4) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked;
}

export default function ProductDetailModal({
  product,
  onClose,
  onEditProduct,
  variant = 'modal',
  catalogue = [],
}: ProductDetailModalProps) {
  if (!product) return null;

  const [selectedSize, setSelectedSize] = useState(product.sizes[0] || 'One Size');
  const [activeTab, setActiveTab] = useState<'details' | 'sizing' | 'shipping'>('details');
  const gallery = product.images && product.images.length > 0 ? product.images : [product.image];
  const [activeImage, setActiveImage] = useState(0);

  const isPage = variant === 'page';

  // Handing the garment's address to the person looking at it.
  //
  // On a phone the address bar shows the domain and nothing else — hightide-
  // vintage.netlify.app, never /product/billabong-63 — so the one thing this
  // shop is built on, a garment with an address of its own, is on screen and
  // unreachable. There is no right-click to copy a link and no visible path to
  // read. This is the way a phone gives it back.
  //
  // Three named destinations rather than the system share sheet. The sheet is
  // one tap shorter on a phone and does not exist at all on a desktop, and it
  // offers whatever that device happens to have installed — which for a shop
  // whose whole trade runs through two apps is both less and less predictable.
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareBox = useRef<HTMLDivElement>(null);

  // A menu that will not close is a menu that traps the page under it.
  useEffect(() => {
    if (!shareOpen) return;
    const outside = (event: MouseEvent) => {
      if (!shareBox.current?.contains(event.target as Node)) setShareOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShareOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [shareOpen]);

  /** Put the address on the clipboard, and say so where the tap happened. */
  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      return true;
    } catch {
      // No clipboard permission — an insecure origin, or a browser that refuses
      // outside a user gesture it recognises. Put the address somewhere it can
      // be copied by hand rather than let the tap do nothing at all.
      window.prompt('העתיקו את הקישור לפריט:', url);
      return false;
    }
  };

  // Instagram was a third option here and is removed: it has no web address
  // that accepts a link the way wa.me does, and neither route to one worked
  // well enough to keep — the share sheet is a phone-only thing that offers
  // whatever is installed, and the desktop fallback ended in a paste the
  // shopper had to be told about. Copy the link and paste it wherever it needs
  // to go; that is what the option was doing anyway, with more steps.
  const shareVia = async (target: 'copy' | 'whatsapp') => {
    const url = productUrl(product);
    trackProduct('product_share', product, { method: target });

    if (target === 'copy') {
      await copyLink(url);
      return; // the menu stays open, holding the "הועתק" it just earned
    }

    // wa.me with no number opens WhatsApp on the contact picker, so this is
    // "send this garment to someone" rather than "message the shop" — which is
    // what the buy button below already does.
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${product.name} — ₪${product.price}\n\n${url}`)}`,
      '_blank',
      'noopener,noreferrer',
    );
    setShareOpen(false);
  };

  // Real hrefs, so a crawler and a long-press both see a destination, but
  // handled in the router rather than reloading the whole shop.
  const routed = (to: string) => (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };

  // The card itself is identical in both. What changes is the frame: a modal
  // scrolls inside its own box against a darkened shop, a page scrolls with
  // the document like any other page.
  const card = (
      <div className="bg-[#fdfcf9] border border-stone-200/60 w-full relative rounded-none flex flex-col md:flex-row">

        {/* Left close button — on a page it is the way back to the shop, which
            is a different promise from dismissing a layer, so it says so. */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 z-20 min-w-[44px] min-h-[44px] px-3 bg-white text-stone-700 hover:text-blue-600 border border-stone-200 rounded-none hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5"
          id="close-detail-modal-btn"
          aria-label={isPage ? 'חזרה לחנות' : 'סגירה'}
        >
          <X className="w-4 h-4" />
          {isPage && <span className="text-xs font-medium pl-1">לחנות</span>}
        </button>

        {/* Product Visual Container */}
        {/* shrink-0 so the modal's flex column cannot squeeze this panel below
            the height its aspect-ratio image needs — without it the image
            overflowed the panel and landed on top of the title and thumbnails. */}
        <div className="w-full md:w-1/2 shrink-0 p-4 sm:p-6 bg-stone-50/50 flex flex-col border-b md:border-b-0 md:border-l border-stone-100">
          <div 
            onClick={() => onEditProduct && onEditProduct(product)}
            className={`relative w-full shrink-0 bg-stone-50 flex items-center justify-center overflow-hidden aspect-[4/5] border border-stone-100 group ${
              onEditProduct ? 'cursor-pointer' : ''
            }`}
            title="לחץ לעריכת הפריט (תמונה ומחיר)"
          >
            {/* The detail view is where the buyer decides, so nothing is cropped
                here: a square frame with object-cover took 20% off a 4:5 photo,
                usually the waistband. Contain fits whatever shape came in. */}
            <img
              src={gallery[activeImage] || product.image}
              srcSet={srcSetFor(gallery[activeImage] || product.image)}
              // The page a buyer decides on. Half the window with room to spare,
              // full width on a phone — so a sharp phone still reaches 1200px.
              sizes="(min-width: 768px) 50vw, 100vw"
              alt={product.name}
              referrerPolicy="no-referrer"
              onError={onPhotoError}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-103"
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
                  <img src={img} alt={`זווית ${i + 1}`} className="w-full h-full object-contain bg-white" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Meta & Configuration (Right Side) */}
        <div className="w-full md:w-1/2 p-6 flex flex-col text-right">
          {/* Share sits in this row, not floating in the card's corner.
              Absolutely positioned at top-right it landed on top of the brand
              name — OCEAN PACIFIC reading "OC" behind a button — because on a
              wide screen this panel is the right half of the card and its own
              first line starts exactly there. In the row it cannot collide
              with anything: the layout keeps them apart. */}
          <div className="flex justify-between items-center flex-row-reverse mb-1 gap-2">
            <span className="text-xs font-mono font-medium text-stone-500 uppercase tracking-widest min-w-0 truncate">
              {product.brand}
            </span>

            <div className="relative shrink-0" ref={shareBox}>
              <button
                type="button"
                onClick={() => setShareOpen((open) => !open)}
                className="min-h-[44px] px-3 -my-1 text-stone-600 hover:text-stone-900 rounded-none transition-colors flex items-center gap-1.5 cursor-pointer"
                id="share-product-btn"
                aria-haspopup="menu"
                aria-expanded={shareOpen}
                aria-label="שיתוף הפריט"
              >
                <Share2 className="w-4 h-4" />
                <span className="text-xs font-medium">שיתוף</span>
              </button>

              {shareOpen && (
                <div
                  role="menu"
                  dir="rtl"
                  className="absolute top-full left-0 z-30 mt-1 w-52 bg-white border border-stone-200 shadow-lg py-1 animate-fade-in"
                  id="share-menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => shareVia('copy')}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2.5 text-right text-sm text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 shrink-0 text-green-700" />
                    ) : (
                      <Link2 className="w-4 h-4 shrink-0 text-stone-500" />
                    )}
                    <span className={copied ? 'text-green-700 font-medium' : undefined}>
                      {copied ? 'הקישור הועתק' : 'העתקת קישור'}
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => shareVia('whatsapp')}
                    className="w-full min-h-[44px] px-3 flex items-center gap-2.5 text-right text-sm text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <WhatsAppMark className="w-4 h-4 shrink-0 text-[#25D366]" />
                    <span>שיתוף בווטסאפ</span>
                  </button>
                </div>
              )}
            </div>

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
          {/* The HIGHTIDE › בורדיז › Billabong #63 trail used to sit here and
              is gone by request. Nothing is lost in search: Google reads that
              path from the BreadcrumbList in the JSON-LD that
              netlify/functions/product-meta.mjs writes into the page head, and
              shows it above the result in place of the bare URL. The trail on
              screen was a second copy of it, for people — and the way back to
              the shop is already the button in the corner. */}

          {/* An h1 when the garment *is* the page, an h2 when it is a layer
              over the shop — there the category heading is already the h1, and
              a second one would leave the page claiming two subjects. */}
          {React.createElement(
            isPage ? 'h1' : 'h2',
            { className: 'text-lg sm:text-xl font-normal text-stone-900 leading-tight mt-1' },
            product.name,
          )}

          {/* Price on one side, the size on the other — the two facts a shopper
              checks together, so they sit on the same line instead of being
              separated by three tabs of copy. */}
          <div className="mt-3 flex items-center justify-between gap-4 flex-row-reverse">
            <div className="flex items-center gap-3 flex-row-reverse">
              {/* On sale, the live price turns red and the old one stays struck through beside it */}
              <span
                className={
                  product.originalPrice
                    ? 'text-xl font-bold font-mono text-red-600'
                    : 'text-xl font-normal font-mono text-stone-900'
                }
              >
                ₪{product.price}
              </span>
              {product.originalPrice && (
                <>
                  <span className="text-base text-stone-500 line-through font-mono">
                    ₪{product.originalPrice}
                  </span>
                  <img
                    src={saleStampUrl}
                    alt="מבצע"
                    className="h-8 w-auto select-none"
                    draggable={false}
                  />
                </>
              )}
            </div>

            <div className="flex items-center gap-2 flex-row-reverse">
              <span className="text-xs text-stone-500 uppercase tracking-wide">מידה</span>
              {product.sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`min-w-[44px] h-11 px-3 font-mono text-sm font-bold border transition-colors ${
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
              className={`min-h-[44px] pb-2.5 pt-2 px-3 text-xs font-normal border-b transition-colors ${
                activeTab === 'details' ? 'border-stone-900 text-stone-900 font-medium' : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              פרטים נוספים
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sizing')}
              className={`min-h-[44px] pb-2.5 pt-2 px-3 text-xs font-normal border-b transition-colors ${
                activeTab === 'sizing' ? 'border-stone-900 text-stone-900 font-medium' : 'border-transparent text-stone-500 hover:text-stone-900'
              }`}
            >
              מדריך מידות
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shipping')}
              className={`min-h-[44px] pb-2.5 pt-2 px-3 text-xs font-normal border-b transition-colors ${
                activeTab === 'shipping' ? 'border-stone-900 text-stone-900 font-medium' : 'border-transparent text-stone-500 hover:text-stone-900'
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
                <p className="text-stone-500 text-xs">מומלץ למדוד מכנס קיים שלכם לפני ביצוע הרכישה לקבלת התאמה מקסימלית.</p>
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

          {/* Action buttons — a sold item cannot be ordered.
              There is no quantity picker: every garment here is a single
              vintage piece, so the only number it could ever hold is 1. */}
          {product.isSold ? (
            <div className="mt-6" id="detail-sold-notice">
              <div className="h-10 bg-stone-100 border border-stone-200 text-stone-500 font-medium flex items-center justify-center text-sm select-none cursor-not-allowed">
                הפריט נמכר ואינו זמין להזמנה
              </div>
              <p className="mt-2 text-xs text-stone-500 text-center">
                פריטי וינטג׳ הם יחידים במלאי. עקבו אחרינו כדי לא לפספס את הדרופ הבא.
              </p>
            </div>
          ) : (
          <div className="mt-6 flex flex-row-reverse gap-3 items-center">
            {/* WhatsApp Purchase button */}
            <a
              href={buyOnWhatsApp(
                product,
                `שלום! אני מעוניין לרכוש את הפריט "${product.name}" במידה ${selectedSize} במחיר ₪${product.price}. האם הוא זמין במלאי?`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackProduct('whatsapp_purchase_click', product, { source: 'detail' });
                onClose();
              }}
              // h-14, not h-10. This is the whole checkout — every sale the
              // shop makes leaves through this one control — and it measured
              // 38px tall on a phone against the 44 a thumb needs. The card
              // behind it was already fixed; this was the one that mattered.
              className="flex-grow h-14 bg-stone-900 hover:bg-stone-800 text-white font-medium transition-colors duration-200 flex items-center justify-center gap-2 text-sm cursor-pointer text-center"
              id="detail-add-btn"
            >
              <WhatsAppMark className="w-4 h-4 text-[#25D366]" />
              <span>רכישה בווטסאפ</span>
            </a>
          </div>
          )}

          {/* Guarantee / trust statements.
              These two lines are the entire argument for paying ₪250 for a
              garment somebody else already wore, and they were set at 10px in
              stone-400 — 2.5:1, the faintest thing on the page. The claim that
              carries the price should not be the hardest sentence to read. */}
          <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-stone-600 pt-4 border-t border-stone-100 font-normal text-center">
            <div className="flex items-center gap-1 justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {/* dir="auto" and not the stylesheet rule: this is a bare span in
                  a flex row, and the rule deliberately stops at block text. */}
              <span dir="auto">100% מקורי ומאומת</span>
            </div>
            <div className="flex items-center gap-1 justify-center">
              <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
              <span>ניקוי יבש וחיטוי יסודי</span>
            </div>
          </div>
        </div>
      </div>
  );

  const suggestions = similarTo(product, catalogue);

  const alsoLike = suggestions.length > 0 && (
    <section
      className="bg-[#fdfcf9] border border-t-0 border-stone-200/60 px-4 sm:px-6 py-6"
      aria-labelledby="also-like-heading"
    >
      <h2
        id="also-like-heading"
        className="text-sm font-medium text-stone-900 mb-4 text-right tracking-wide"
      >
        אולי יעניין אותך גם
      </h2>
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {suggestions.map((item) => (
          <li key={item.id}>
            <a
              href={productPath(item.brand, item.num)}
              onClick={routed(productPath(item.brand, item.num))}
              className="group block no-underline"
            >
              <div className="aspect-[4/5] overflow-hidden bg-stone-50 border border-stone-100">
                <img
                  src={item.image}
                  srcSet={srcSetFor(item.image)}
                  sizes="(min-width: 768px) 22vw, 45vw"
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={onPhotoError}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <p className="mt-2 text-xs text-stone-700 line-clamp-1 text-right group-hover:text-stone-950 transition-colors">
                {item.name}
              </p>
              <p className="mt-0.5 text-xs font-mono font-medium text-stone-900 text-right">
                ₪{item.price}
                <span className="font-sans font-normal text-stone-500"> · {item.sizes[0]}</span>
              </p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );

  if (isPage) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        {card}
        {alsoLike}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="detail-modal">
      {/* Overlay background */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      ></div>
      {/* The scroll box moved out here from the card so the suggestions ride
          inside it rather than hanging off the bottom of a fixed-height layer. */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
        {card}
        {alsoLike}
      </div>
    </div>
  );
}
