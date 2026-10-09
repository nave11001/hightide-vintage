import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Menu, X, Heart, Trash2, ChevronDown } from 'lucide-react';
import { Product } from '../types';
import Logo from './Logo';
import HightideLogo from './HightideLogo';
import CategoryBar from './CategoryBar';
import { onPhotoError, srcSetFor } from '../photos';
import { buyOnWhatsApp, englishOrder } from '../whatsapp';
import { WhatsAppBadge } from './WhatsAppMark';
import { useScrollLock } from '../useScrollLock';
import { CATEGORY_EN, currentLang, money, setLang, tr } from '../i18n';

interface HeaderProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  categories: { id: string; name: string }[];

  // The search bar itself lives in App, not here — see SearchBar.tsx for why.
  // The header only opens it.
  isSearchOpen: boolean;
  onOpenSearch: () => void;

  // Favorites Support:
  favoriteItems: Product[];
  onToggleFavorite: (product: Product) => void;
  isTransparent?: boolean;
}

export default function Header({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  categories,
  isSearchOpen,
  onOpenSearch,
  favoriteItems,
  onToggleFavorite,
  isTransparent = false,
}: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Folded by default so the drawer stays short; the count shows either way.
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  useScrollLock(isMobileMenuOpen);

  // Escape closes the drawer, the way it closes every other layer in the shop.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);

  const iconColorClass = isTransparent 
    ? "text-white hover:text-stone-200 hover:bg-white/10 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.6))]" 
    : "text-black hover:text-stone-800 hover:bg-stone-50";

  return (
    <header 
      className={`w-full transition-all duration-300 z-40 ${
        isTransparent 
          ? "bg-transparent border-b-0 shadow-none text-white relative" 
          : "sticky top-0 bg-white border-b border-gray-100 shadow-xs"
      }`} 
      id="store-header"
    >
      {/* Main Navbar */}
      {/* Full width on every page, so the menu and search sit against the
          left edge of the screen and the logo on its true centre. It was
          capped at the catalogue's width everywhere but the homepage, which
          on a wide screen left the icons floating inward and the header not
          matching the one above the photograph.

          No fixed height: the row is the logo plus a little air above and
          almost none below, so the category row sits right under it. A fixed
          80px row left the logo floating in the middle of empty space. */}
      <div className="px-4 sm:px-6 pt-3 pb-1 sm:pt-4 flex items-center justify-between relative">
        
        {/* Left Side: Hamburger (Three lines) & Search */}
        <div className="flex items-center gap-3 md:gap-4 w-1/3 justify-start">
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`p-1.5 sm:p-2 rounded-full transition-colors relative cursor-pointer ${iconColorClass}`}
            aria-label="Menu"
            id="menu-btn"
          >
            <Menu className="w-5 h-5 sm:w-6 h-6" />
            {/* Tiny indicator badge for favorites inside hamburger menu */}
            {favoriteItems.length > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-mono ${
                isTransparent ? "bg-white text-stone-950" : "bg-stone-900 text-white"
              }`}>
                {favoriteItems.length}
              </span>
            )}
          </button>
          
          <button
            type="button"
            onClick={onOpenSearch}
            className={`p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer ${iconColorClass}`}
            aria-label={tr('חיפוש', 'Search')}
            aria-expanded={isSearchOpen}
            id="search-toggle-btn"
          >
            <Search className="w-5 h-5 sm:w-6 h-6" />
          </button>
        </div>

        {/* Center: Brand Bubble Logo or Elegant Cursive Text depending on transparency */}
        <div className="flex justify-center w-1/3 select-none">
          <button 
            type="button" 
            onClick={(e) => {
              e.preventDefault();
              onSelectCategory('none');
              onSearchChange('');
            }}
            className="flex flex-col items-center cursor-pointer" 
            id="logo-link"
          >
            {/* One size on every page — only the colour changes. It shrank
                a step on the way from the homepage into a category. */}
            <HightideLogo
              className="h-10 sm:h-12 md:h-14 lg:h-16 transition-all duration-300 hover:scale-105"
              color={isTransparent ? 'white' : 'black'}
            />
          </button>
        </div>

        <div className="flex items-center gap-3 md:gap-4 w-1/3 justify-end" />
      </div>

      {/* Category links over the hero. They only change the category — App
          scrolls to the top of the page on every change, which is where the
          filters are. These used to scroll themselves to #catalog-section,
          an anchor that sat below the filter bar and under the sticky header,
          so a shopper arrived past the very controls they might not know were
          there.

          This is the catalogue's own category bar, drawn in white, a pixel
          below the header exactly where the black one sits on a category page
          — on a phone as on a computer — so choosing one does not move a
          single word. Each word sits on a soft dark shadow of its own; plain
          white went grey against the sky and vanished into the palms. */}
      {isTransparent && (
        <div className="pt-px">
          <CategoryBar
            tone="light"
            selected="none"
            onSelect={(id) => {
              onSearchChange('');
              onSelectCategory(id);
            }}
          />
        </div>
      )}

      {/* The drawer is portalled to <body>. Rendered inside the header it was
          position:fixed in name only — on the homepage the header sits inside
          the hero, and an ancestor there makes a containing block for fixed
          children, so "the whole screen" meant "the hero" and the drawer
          stopped at the hero's bottom edge with the shop showing below it.
          From <body> there is no ancestor to capture it. h-dvh rather than
          h-full so it follows a phone's collapsing address bar. */}
      {isMobileMenuOpen && createPortal(
        <div className="fixed left-0 top-0 w-full h-dvh z-[70]" id="mobile-menu-drawer">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={() => setIsMobileMenuOpen(false)}></div>
          
          {/* Drawer Content */}
          <div role="dialog" aria-modal="true" aria-label={tr('תפריט', 'Menu')} className="absolute inset-y-0 left-0 bg-[#fdfcf9] w-80 max-w-[85vw] h-dvh p-6 flex flex-col shadow-2xl overflow-y-auto overscroll-contain text-right animate-drawer-in">
            
            {/* Header of Drawer */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <button 
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 hover:bg-stone-100 rounded-full text-stone-800 transition-colors"
                aria-label={tr('סגירת התפריט', 'Close menu')}
                id="close-menu-btn"
              >
                <X className="w-6 h-6" />
              </button>
              
              <Logo className="w-16 h-16" showText={false} />
            </div>

            {/* Section 1: Categories */}
            <div className="mt-5">
              <h3 className="font-medium text-xs text-stone-500 uppercase tracking-widest mb-2">{tr('קטגוריות', 'Categories')}</h3>
              <div className="flex flex-col gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSelectCategory(cat.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`text-right py-2 px-3 font-normal text-sm transition-colors rounded-none ${
                      selectedCategory === cat.id
                        ? 'bg-stone-900 text-white'
                        : 'hover:bg-stone-100 text-stone-800'
                    }`}
                  >
                    {tr(cat.name, CATEGORY_EN[cat.id] ?? cat.name)}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 2: FAVORITES SECTION (יצירת סל מועדפים ישירות מתחת לשלושת הפסים) */}
            <div className="mt-6 pt-5 border-t border-stone-200">
              <h3>
                <button
                  type="button"
                  onClick={() => setFavoritesOpen((open) => !open)}
                  aria-expanded={favoritesOpen}
                  aria-controls="drawer-favorites"
                  className="w-full py-1 flex items-center justify-between flex-row-reverse cursor-pointer text-stone-500 hover:text-stone-800 transition-colors"
                >
                  <span className="flex items-center gap-1.5 flex-row-reverse">
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${favoritesOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs">({favoriteItems.length})</span>
                  </span>
                  <span className="font-medium text-xs uppercase tracking-widest flex items-center gap-1 flex-row-reverse">
                    <Heart className="w-3.5 h-3.5 text-black stroke-[2px]" aria-hidden="true" />
                    <span>{tr('המועדפים שלי', 'My favourites')}</span>
                  </span>
                </button>
              </h3>

              <div id="drawer-favorites" hidden={!favoritesOpen} className="mt-3">
              {favoriteItems.length === 0 ? (
                <div className="text-center py-6 px-4 bg-stone-50 border border-stone-100 rounded-sm">
                  <p className="text-sm text-stone-600 leading-relaxed">{tr('אין עדיין פריטים במועדפים.', 'No favourites yet.')}</p>
                  <p className="text-xs text-stone-500 mt-1">{tr('לחצו על הלב במוצרים שאהבתם כדי לראות אותם כאן!', 'Tap the heart on anything you like to keep it here.')}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
                  {favoriteItems.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center gap-3 p-2 bg-white border border-stone-100 rounded-none text-right flex-row-reverse hover:bg-stone-50/50 transition-colors"
                    >
                      {/* Favorite Item Image */}
                      <img 
                        src={item.image}
                        srcSet={srcSetFor(item.image)}
                        sizes="48px"
                        alt={item.name}
                        onError={onPhotoError}
                        className="w-12 h-12 object-cover object-center flex-shrink-0 border border-stone-100"
                      />

                      {/* Favorite Item Details */}
                      <div className="flex-grow min-w-0">
                        <h4 className="text-xs font-normal text-stone-800 truncate leading-tight">
                          {item.name}
                        </h4>
                        <p className="text-xs font-normal text-stone-900 mt-0.5">
                          {money(item.price)}
                          {item.isSold && (
                            <span className="mr-2 text-xs text-stone-600 font-medium">{tr('נמכר', 'Sold')}</span>
                          )}
                        </p>
                      </div>

                      {/* Favorite Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Buy on WhatsApp directly from Favorites list (in-stock items only) */}
                        {!item.isSold && (
                        <a
                          href={buyOnWhatsApp(
                            item,
                            tr(
                              `שלום! ראיתי במועדפים באתר את הפריט "${item.name}" במחיר ₪${item.price} ואני מעוניין לרכוש אותו. האם הוא זמין?`,
                              englishOrder(item.name, money(item.price)),
                            ),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="p-1.5 text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors flex items-center justify-center"
                          title={tr('רכישה בווטסאפ', 'Buy on WhatsApp')}
                        >
                          <WhatsAppBadge className="w-5 h-5" />
                        </a>
                        )}

                        {/* Remove from favorites */}
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(item)}
                          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                          title={tr('הסר מהמועדפים', 'Remove from favourites')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>

            {/* General links */}
            <div className="mt-6 pt-5 border-t border-stone-200 flex flex-col gap-2.5">
              <button 
                type="button"
                onClick={() => {
                  onSelectCategory('none');
                  onSearchChange('');
                  setIsMobileMenuOpen(false);
                }}
                className="text-right font-normal text-sm text-stone-800 hover:text-stone-950 transition-colors cursor-pointer"
              >
                {tr('עמוד הבית', 'Home')}
              </button>
              {/* Was href="#" with no handler at all — the one link in the menu
                  that did nothing whatsoever. There is no about page to send it
                  to, but the shop's story is written in the footer, so that is
                  where it goes until there is one. */}
              <a
                href="#store-footer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="font-normal text-sm text-stone-800 hover:text-stone-950 transition-colors text-right"
              >
                {tr('אודות HIGHTIDE VINTAGE', 'About HIGHTIDE VINTAGE')}
              </a>
              <a 
                href="#store-footer" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="font-normal text-sm text-stone-800 hover:text-stone-950 transition-colors text-right"
              >
                {tr('צור קשר', 'Contact')}
              </a>
            </div>

            {/* The language, for anyone the country guessed wrong for — an
                Israeli on a VPN, a tourist on Israeli wifi. Each option is
                written in its own language, the way language switches are. */}
            <div className="mt-6 pt-5 border-t border-stone-200 flex items-center gap-2 flex-row-reverse" role="group" aria-label={tr('שפה', 'Language')}>
              {(['he', 'en'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  lang={option}
                  onClick={() => option !== currentLang() && setLang(option)}
                  aria-pressed={option === currentLang()}
                  className={`min-h-[44px] px-4 text-sm border transition-colors cursor-pointer ${
                    option === currentLang()
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-800 border-stone-200 hover:border-stone-900'
                  }`}
                >
                  {option === 'he' ? 'עברית' : 'English · $'}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-auto text-xs text-stone-500 font-mono text-center pt-5 border-t border-stone-100">
              © 2026 HIGHTIDE VINTAGE.
            </div>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
