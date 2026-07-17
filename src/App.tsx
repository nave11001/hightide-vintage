import { useState, useEffect } from 'react';
import { Product } from './types';
import { INITIAL_PRODUCTS, CATEGORIES } from './data';
import Header from './components/Header';
import ProductCard from './components/ProductCard';
import ProductDetailModal from './components/ProductDetailModal';
import AdminPanelModal from './components/AdminPanelModal';
import HightideLogo from './components/HightideLogo';
import heroImageUrl from '@/assets/homepage_photo.png';
import catBoardiesImg from '@/assets/photos/boardshorts.jpg';
import catShirtsImg from '@/assets/photos/T-shirts.jpg';
import catAccessoriesImg from '@/assets/photos/accessories.jpeg';
import catWomenImg from '@/assets/photos/Women (1).jpeg';
import catAllImg from '@/assets/photos/all products.jpg';
import { Info, Settings, Play, Pause, Video, Image as ImageIcon, Search, User, ShoppingBag } from 'lucide-react';

export default function App() {
  // Store Core State
  const [products, setProducts] = useState<Product[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminSession, setIsAdminSession] = useState(() => {
    return !!sessionStorage.getItem('hightide_admin_token');
  });
  const [preselectedEditProduct, setPreselectedEditProduct] = useState<Product | null>(null);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);
  
  // Secret Brand Clicks state
  const [brandClickCount, setBrandClickCount] = useState(0);
  const [lastBrandClickTime, setLastBrandClickTime] = useState(0);
  
  // Favorites State
  const [favoriteItems, setFavoriteItems] = useState<Product[]>([]);
  
  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('none');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  // Size filter resets when switching category
  useEffect(() => {
    setSelectedSizes([]);
  }, [selectedCategory]);

  // Interactive Media Placeholder States
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [simulatedTime, setSimulatedTime] = useState(12); // seconds counter for VHS simulator

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Secret admin trigger listeners (Query param & Keyboard shortcut)
  useEffect(() => {
    // 1. Check for URL parameters (?admin=true or ?manage=true or ?owner=true)
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true' || params.get('manage') === 'true' || params.get('owner') === 'true') {
      setIsAdminOpen(true);
      // Clean up URL parameters secretly so nobody else sees it in the address bar
      const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
      showToast('🔓 מצב ניהול מאובטח זוהה!');
    }

    // 2. Keyboard shortcut listener (Ctrl + Alt + A)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsAdminOpen(true);
        showToast('🔓 פתיחת ממשק ניהול באמצעות מקשי קיצור!');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBrandClick = () => {
    const now = Date.now();
    if (now - lastBrandClickTime < 2000) {
      const newCount = brandClickCount + 1;
      if (newCount >= 5) {
        setIsAdminOpen(true);
        setBrandClickCount(0);
        showToast('🔓 ממשק ניהול מאובטח נפתח באמצעות לחיצות סודיות!');
      } else {
        setBrandClickCount(newCount);
      }
    } else {
      setBrandClickCount(1);
    }
    setLastBrandClickTime(now);
  };

  // Load cart, favorites, and custom products from server, falling back to localStorage
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const serverProducts = await res.json();
          if (serverProducts && Array.isArray(serverProducts) && serverProducts.length > 0) {
            setProducts(serverProducts);
            localStorage.setItem('higetide_products_v2', JSON.stringify(serverProducts));
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load products from server, trying local storage:', e);
      }

      // Fallback
      const savedProducts = localStorage.getItem('higetide_products_v2');
      if (savedProducts) {
        try {
          setProducts(JSON.parse(savedProducts));
        } catch (e) {
          setProducts(INITIAL_PRODUCTS);
        }
      } else {
        setProducts(INITIAL_PRODUCTS);
      }
    };

    loadProducts();

    const savedFavs = localStorage.getItem('higetide_favorites');
    if (savedFavs) {
      try {
        setFavoriteItems(JSON.parse(savedFavs));
      } catch (e) {
        console.error('Failed to load favorites state', e);
      }
    }
  }, []);

  const handleToggleFavorite = (product: Product) => {
    const isFav = favoriteItems.some((item) => item.id === product.id);
    let updated: Product[];
    if (isFav) {
      updated = favoriteItems.filter((item) => item.id !== product.id);
      showToast(`הוסר מהמועדפים: ${product.name}`);
    } else {
      updated = [...favoriteItems, product];
      showToast(`נוסף למועדפים: ${product.name}`);
    }
    setFavoriteItems(updated);
    localStorage.setItem('higetide_favorites', JSON.stringify(updated));
  };

  // VHS Simulated Time Effect
  useEffect(() => {
    let interval: any;
    if (isVideoPlaying && mediaType === 'video') {
      interval = setInterval(() => {
        setSimulatedTime((prev) => (prev >= 59 ? 0 : prev + 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isVideoPlaying, mediaType]);

  // Toast notifier helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Live Inventory Modifiers
  const handleSaveProducts = async (newProducts: Product[]) => {
    setProducts(newProducts);
    localStorage.setItem('higetide_products_v2', JSON.stringify(newProducts));
    
    // Save to server-side if logged in
    const token = sessionStorage.getItem('hightide_admin_token');
    if (token) {
      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: newProducts, token })
        });
        if (res.ok) {
          showToast('מלאי החנות עודכן ונשמר בשרת בהצלחה!');
        } else {
          const data = await res.json();
          showToast(`שגיאה בשמירה בשרת: ${data.error || 'נסה שוב'}`);
        }
      } catch (e) {
        showToast('שגיאה בתקשורת עם השרת, נשמר מקומית בלבד');
      }
    } else {
      showToast('מלאי החנות עודכן מקומית (נא להתחבר כמנהל לשמירה קבועה)');
    }
  };

  const handleResetToDefaultProducts = async () => {
    setProducts(INITIAL_PRODUCTS);
    localStorage.removeItem('higetide_products_v2');
    
    // Reset on server-side if logged in
    const token = sessionStorage.getItem('hightide_admin_token');
    if (token) {
      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: INITIAL_PRODUCTS, token })
        });
        if (res.ok) {
          showToast('מלאי החנות שוחזר לברירת המחדל בשרת!');
        } else {
          showToast('שגיאה בשחזור המלאי בשרת');
        }
      } catch (e) {
        showToast('שגיאה בתקשורת עם השרת');
      }
    } else {
      showToast('מלאי החנות שוחזר לברירת המחדל מקומית!');
    }
  };

  // Sizes are stored inconsistently in the sheets (s / L / xl) — normalize for
  // display and comparison
  const normalizeSize = (s: string) => s.trim().toUpperCase();

  // Filter items based on selected category (All, Latest, Boardies, Shirts, Accessories)
  const categoryProducts = products.filter((prod) => {
    let matchesCategory = true;
    if (selectedCategory === 'latest') {
      matchesCategory = prod.isLatestDrop === true;
    } else if (selectedCategory !== 'all' && selectedCategory !== 'none') {
      matchesCategory = prod.category === selectedCategory;
    }

    const matchesSearch =
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Sizes available within the current category view, numbers first then S-XL
  const LETTER_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const availableSizes = Array.from(new Set<string>(
    categoryProducts.flatMap((p) => p.sizes.map(normalizeSize)).filter((s) => s && s !== 'ONE SIZE')
  )).sort((a, b) => {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return LETTER_ORDER.indexOf(a) - LETTER_ORDER.indexOf(b);
  });

  const filteredProducts = selectedSizes.length === 0
    ? categoryProducts
    : categoryProducts.filter((p) => p.sizes.some((s) => selectedSizes.includes(normalizeSize(s))));

  return (
    <div className="min-h-screen bg-white text-stone-950 flex flex-col font-sans text-right" id="app-root">
      
      {/* Standard White Sticky Header: only shown when NOT on the homepage landing view */}
      {(selectedCategory !== 'none' || searchTerm !== '') && (
        <Header
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categories={CATEGORIES}
          favoriteItems={favoriteItems}
          onToggleFavorite={handleToggleFavorite}
          isTransparent={false}
        />
      )}

      {/* Homepage Landing View Hero & Navigation (Seamlessly integrated with NO gaps) */}
      {selectedCategory === 'none' && searchTerm === '' && (
        <div className="w-full flex flex-col" id="landing-page-hero-wrapper">
          {/* Announcement Strip at the absolute top of the viewport */}
          <div className="bg-white py-2 text-center border-b border-stone-100 flex items-center justify-center select-none" id="global-announcement-strip">
            <span className="text-[10px] sm:text-xs font-medium tracking-[0.25em] uppercase text-stone-900 font-display">
              NEW DROP EVERY WEEK
            </span>
          </div>

          {/* Full-bleed Immersive Hero Canvas stretching edge-to-edge */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/7] md:aspect-[21/9] bg-stone-950 overflow-hidden" id="homepage-hero">
            
            {/* Background Editorial Image - Warm-toned sun-soaked fashion group */}
            <img
              src={heroImageUrl}
              alt="Higetide Vintage New Drop Editorial"
              className="absolute inset-0 w-full h-full object-cover object-[40%_75%]"
            />

            {/* Dark elegant dual-gradients for perfect contrast overlay (top & bottom) */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 pointer-events-none"></div>

            {/* Transparent Header overlaid elegantly at the top of the Hero image */}
            <div className="absolute inset-x-0 top-0 z-30">
              <Header
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                categories={CATEGORIES}
                favoriteItems={favoriteItems}
                onToggleFavorite={handleToggleFavorite}
                isTransparent={true}
              />
            </div>

            {/* Bottom Center Action Button: NEW DROP */}
            <div className="absolute bottom-6 sm:bottom-12 inset-x-0 flex justify-center z-20">
              <button 
                onClick={() => {
                  setSelectedCategory('latest');
                  setTimeout(() => {
                    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 80);
                }}
                className="px-8 py-2.5 sm:px-10 sm:py-3 border border-white text-white text-xs sm:text-sm font-light uppercase tracking-[0.25em] bg-black/10 backdrop-blur-xs hover:bg-white hover:text-stone-950 transition-all duration-300 cursor-pointer hover:shadow-[0_0_15px_rgba(255,255,255,0.4)]"
              >
                NEW DROP
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Dynamic Categories Filtering Bar below the header (Visual helper) - Only visible when in catalog view */}
      {(selectedCategory !== 'none' || searchTerm !== '') && (
        <section className="bg-white border-b border-stone-100 py-3 px-4 shadow-xs animate-fade-in" id="categories-bar">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-2 items-center justify-between flex-row-reverse">
            <span className="text-xs font-normal text-stone-400 uppercase tracking-widest ml-2 hidden sm:inline">
              סנן פריטים:
            </span>
            <div className="flex flex-wrap gap-1.5 justify-start flex-row-reverse w-full sm:w-auto">
              {/* Home button to return to category navigation */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('none');
                  setSearchTerm('');
                }}
                className={`py-1.5 px-4 text-xs font-normal border transition-all rounded-none cursor-pointer flex-grow sm:flex-grow-0 text-center ${
                  selectedCategory === 'none'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-800 hover:bg-stone-50'
                }`}
                id="cat-filter-home"
              >
                קטגוריות
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`py-1.5 px-4 text-xs font-normal border transition-all rounded-none cursor-pointer flex-grow sm:flex-grow-0 text-center ${
                    selectedCategory === cat.id
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-800 border-stone-200 hover:border-stone-800 hover:bg-stone-50'
                  }`}
                  id={`cat-filter-${cat.id}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Scroll anchor target for smooth scrolling to catalog / category selector */}
      <div id="catalog-section" className="scroll-mt-10"></div>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-6 sm:py-8">
        
        {/* Homepage Category Navigation OR Filtered Product Catalog */}
        {selectedCategory === 'none' && searchTerm === '' ? (
          <section className="space-y-6 sm:space-y-8 animate-fade-in" id="homepage-categories">
            <div className="text-center mb-8 max-w-lg mx-auto">
              <h2 className="text-xl sm:text-2xl font-groovy font-normal text-stone-900 mt-1 uppercase">Choose Your Vintage</h2>
              <div className="w-12 h-[1px] bg-stone-800 mx-auto mt-3"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {[
                {
                  id: 'boardies',
                  name: 'בורדיז',
                  subText: 'BOARDSHORTS',
                  image: catBoardiesImg,
                  className: 'md:col-span-1 h-[280px] sm:h-[380px]'
                },
                {
                  id: 'shirts',
                  name: 'חולצות',
                  subText: 'VINTAGE TEES & HOODIES',
                  image: catShirtsImg,
                  className: 'md:col-span-1 h-[280px] sm:h-[380px]'
                },
                {
                  id: 'accessories',
                  name: 'אקססוריז',
                  subText: 'ACCESSORIES',
                  image: catAccessoriesImg,
                  className: 'md:col-span-1 h-[280px] sm:h-[380px]'
                },
                {
                  id: 'women',
                  name: 'נשים',
                  subText: 'WOMEN',
                  image: catWomenImg,
                  className: 'md:col-span-1 h-[280px] sm:h-[380px]'
                },
                {
                  id: 'all',
                  name: 'כל הפריטים',
                  subText: 'ALL VINTAGE ITEMS',
                  image: catAllImg,
                  className: 'md:col-span-2 h-[300px] sm:h-[450px]'
                }
              ].map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category.id);
                    // Scroll to catalog section for visibility
                    setTimeout(() => {
                      document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 80);
                  }}
                  className={`group relative overflow-hidden flex items-center justify-center border border-stone-200/40 shadow-xs cursor-pointer ${category.className}`}
                  id={`home-cat-card-${category.id}`}
                >
                  {/* Category Image with dark elegant overlay */}
                  <div className="absolute inset-0 bg-stone-950 transition-colors duration-500 group-hover:bg-stone-900/40">
                    <img
                      src={category.image}
                      alt={category.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                  </div>

                  {/* Centered White Card overlay (Exactly like the Malboshim style!) */}
                  <div className="relative z-10 bg-white/95 backdrop-blur-xs px-8 py-3.5 sm:px-12 sm:py-5 min-w-[200px] text-center border border-stone-200/50 shadow-md transform transition-all duration-300 group-hover:scale-105 group-hover:bg-white select-none">
                    <h3 className="text-base sm:text-lg font-groovy font-normal tracking-wide text-stone-900 leading-tight uppercase">
                      {category.subText}
                    </h3>
                    <span className="hidden">
                      {category.subText}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          /* Catalog Grid Area */
          <section id="catalog-section" className="animate-fade-in">
            {/* Active filter display */}
            <div className="flex items-center justify-between mb-5 flex-row-reverse border-b border-stone-100 pb-3">
              <h2 className="text-sm sm:text-base font-normal tracking-widest text-stone-900 flex items-center gap-2 flex-row-reverse uppercase">
                <span>{selectedCategory === 'latest' ? 'הדרופ האחרון' : CATEGORIES.find((c) => c.id === selectedCategory)?.name || 'תוצאות חיפוש'}</span>
                <span className="text-xs text-stone-400 font-mono font-normal bg-stone-100 px-2 py-0.5 border border-stone-200/60">
                  ({filteredProducts.length} פריטים)
                </span>
              </h2>
              
              {/* Back to categories link */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('none');
                  setSearchTerm('');
                }}
                className="text-xs text-stone-500 hover:text-stone-900 font-normal hover:underline cursor-pointer flex items-center gap-1.5 flex-row-reverse"
              >
                <span>חזרה לקטגוריות ←</span>
              </button>
            </div>

            {/* Size filter dropdown (Excel data-validation style) */}
            {availableSizes.length > 1 && (
              <div dir="rtl" className="flex items-center gap-2 mb-6" id="size-filter">
                <label htmlFor="size-select" className="text-xs text-stone-500 font-normal">
                  סינון לפי מידה:
                </label>
                <select
                  id="size-select"
                  value={selectedSizes[0] || ''}
                  onChange={(e) => setSelectedSizes(e.target.value ? [e.target.value] : [])}
                  className="border border-stone-300 bg-white text-stone-900 text-xs font-mono px-3 py-1.5 cursor-pointer focus:outline-none focus:border-stone-900 min-w-[110px]"
                >
                  <option value="">כל המידות</option>
                  {availableSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Grid of Items */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-24 bg-white border border-dashed border-gray-200 p-8 rounded-none">
                <p className="text-lg font-normal text-gray-700">לא נמצאו פריטים העונים לחיפוש שלך</p>
                <p className="text-sm text-gray-400 mt-1">נסו לשנות את מילות החיפוש או לבחור קטגוריה אחרת</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchTerm('');
                  }}
                  className="mt-6 px-6 py-2 bg-stone-900 text-white font-normal border border-stone-900 cursor-pointer"
                >
                  חזור לכל המוצרים
                </button>
              </div>
            ) : (
              /* grid-cols-2 is STRICTLY enforced on mobile to look exactly like the reference image! */
              <div 
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 sm:gap-6"
                id="products-grid"
              >
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isFavorite={favoriteItems.some((item) => item.id === product.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onViewDetails={(p) => setSelectedProductForDetails(p)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Vintage Care Tip section */}
        <div className="mt-12 bg-stone-50 border-2 border-stone-200 p-5 rounded-none flex flex-col md:flex-row-reverse gap-4 items-start text-right" id="care-tips">
          <div className="p-2.5 bg-stone-100 border border-stone-300 text-stone-800 flex-shrink-0">
            <Info className="w-6 h-6" />
          </div>
          <div dir="rtl">
            <h4 className="font-extrabold text-stone-900" style={{ fontFamily: 'Rubik, sans-serif', fontSize: '26px' }} dir="rtl">אהבתם מה שראיתם?</h4>
            <p className="text-xs text-stone-700 mt-1 leading-relaxed" dir="rtl">
              תשלחו לנו הודעה בקישור למטה , באינסטגרם ובווצאפ
            </p>
          </div>
        </div>
      </main>

      {/* Footer component */}
      <footer className="bg-black text-gray-400 border-t-4 border-black py-10 mt-16 px-4" id="store-footer">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-right">
          
          {/* Logo and store pitch */}
          <div className="flex flex-col items-end">
            <div className="mb-3 cursor-pointer">
              <HightideLogo 
                className="h-10 transition-all duration-300 hover:scale-105" 
                color="white" 
                onClick={handleBrandClick} 
              />
            </div>
            <p className="text-xs leading-relaxed max-w-xs text-gray-400">
              חנות הוינטג׳ הבלעדית למכנסי גלישה, חולצות, סווטשרטים ואקססוריז של תור הזהב של מותגי הגלישה והספורט משנות ה-2000.
            </p>
            <div className="mt-4 flex gap-3 flex-row-reverse">
              <a 
                href="https://www.instagram.com/_hightide_vintage?igsh=M2xrYTI0eHZ0YjY0&utm_source=qr"
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs bg-gray-900 border border-gray-800 px-3 py-1.5 hover:text-white transition-colors cursor-pointer font-mono font-bold"
              >
                INSTAGRAM
              </a>
              <a 
                href="https://wa.me/972528879922" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs bg-gray-900 border border-gray-800 px-3 py-1.5 hover:text-white transition-colors cursor-pointer font-mono font-bold"
              >
                WHATSAPP
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div className="flex flex-col items-end">
            <span className="font-extrabold text-sm text-white uppercase tracking-wider mb-3 font-mono">תפריט מהיר</span>
            <ul className="space-y-2 text-xs">
              <li><a href="#" className="hover:text-white transition-colors" onClick={(e) => { e.preventDefault(); setSelectedCategory('all'); setSearchTerm(''); }}>כל קטלוג המוצרים</a></li>
              <li><a href="#" className="hover:text-white transition-colors" onClick={(e) => { e.preventDefault(); setSelectedCategory('boardies'); setSearchTerm(''); }}>מכנסי גלישה (Boardshorts)</a></li>
              <li><a href="#" className="hover:text-white transition-colors" onClick={(e) => { e.preventDefault(); setSelectedCategory('shirts'); setSearchTerm(''); }}>חולצות וינטג׳</a></li>
            </ul>
          </div>

          {/* Physical Address / Contact */}
          <div className="flex flex-col items-end">
            <span className="font-extrabold text-sm text-white uppercase tracking-wider mb-3 font-mono">צור קשר ואיסוף</span>
            <div dir="rtl" className="text-xs leading-relaxed text-gray-400 space-y-1 text-right">
              <div>טלפון: <a href="tel:0528879922" className="hover:text-white transition-colors font-mono font-bold">052-8879922</a></div>
              <div>מייל: <a href="mailto:hightide1620@gmail.com" dir="ltr" className="hover:text-white transition-colors font-mono font-bold">hightide1620@gmail.com</a></div>
              <div className="mt-1 text-stone-500">הגבעה 28 כפר האורנים (בתיאום מראש)</div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-gray-800 text-center text-xs text-gray-500 font-mono">
          © 2026 HIGETIDE VINTAGE LTD. ALL RIGHTS RESERVED. CRAFTED FOR VINTAGE LOVERS.
        </div>
      </footer>

      {/* Product detailed popup view */}
      <ProductDetailModal
        product={selectedProductForDetails}
        onClose={() => setSelectedProductForDetails(null)}
        onEditProduct={isAdminSession ? (prod) => {
          setPreselectedEditProduct(prod);
          setSelectedProductForDetails(null);
          setIsAdminOpen(true);
        } : undefined}
      />

      {/* Admin Panel Inventory Control Overlay */}
      <AdminPanelModal
        isOpen={isAdminOpen}
        onClose={() => {
          setIsAdminOpen(false);
          setPreselectedEditProduct(null);
          setIsAdminSession(!!sessionStorage.getItem('hightide_admin_token'));
        }}
        products={products}
        onSaveProducts={handleSaveProducts}
        onResetToDefault={handleResetToDefaultProducts}
        initialProductToEdit={preselectedEditProduct}
      />

      {/* Interactive floating accessibility and WhatsApp controls on bottom-left corner */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-3 items-center">
        {/* WhatsApp Icon */}
        <a
          href="https://wa.me/972528879922"
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 hover:rotate-6 transition-all duration-300 cursor-pointer group relative"
          title="צ׳אט איתנו ב-WhatsApp"
        >
          <svg 
            className="w-6.5 h-6.5 fill-current" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.58 1.981 14.11 1.012 11.48 1.01 6.046 1.01 1.622 5.38 1.618 10.807c-.001 1.701.453 3.361 1.314 4.815L1.879 21.16l5.768-1.506zM17.91 14.9c-.31-.155-1.832-.9-2.115-1.002-.282-.102-.489-.153-.695.155-.205.308-.797 1.002-.976 1.207-.18.205-.359.231-.669.077-.31-.155-1.307-.481-2.49-1.534-.92-.818-1.541-1.83-1.722-2.138-.18-.308-.02-.475.135-.629.14-.138.31-.36.465-.54.155-.18.205-.308.31-.514.105-.205.051-.385-.026-.54-.077-.155-.695-1.673-.951-2.29-.25-.6-.54-.515-.744-.526-.192-.01-.41-.01-.628-.01-.218 0-.573.082-.873.411-.3.308-1.148 1.121-1.148 2.733 0 1.612 1.174 3.172 1.336 3.393.162.22 2.311 3.52 5.597 4.939.781.337 1.39.539 1.86.688.784.249 1.497.214 2.061.13.629-.094 1.832-.749 2.088-1.439.256-.689.256-1.284.18-1.402-.077-.117-.282-.18-.592-.336z"/>
          </svg>
          <span className="absolute left-14 bg-stone-900 text-white text-[10px] py-1 px-2.5 whitespace-nowrap shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            דברו איתנו בווטסאפ! 💬
          </span>
        </a>

      </div>

      {/* Interactive floating feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-black text-white px-5 py-3 border-2 border-stone-800 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] text-right font-bold text-xs sm:text-sm max-w-xs sm:max-w-md animate-scale-up">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
