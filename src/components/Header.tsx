import React, { useState } from 'react';
import { Search, Menu, X, Heart, Trash2 } from 'lucide-react';
import { Product } from '../types';
import Logo from './Logo';
import HightideLogo from './HightideLogo';

interface HeaderProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  categories: { id: string; name: string }[];
  
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
  favoriteItems,
  onToggleFavorite,
  isTransparent = false,
}: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const iconColorClass = isTransparent 
    ? "text-white hover:text-stone-200 hover:bg-white/10" 
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
      <div className="max-w-7xl mx-auto px-4 h-20 sm:h-28 flex items-center justify-between relative">
        
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
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-1.5 sm:p-2 rounded-full transition-colors cursor-pointer ${iconColorClass}`}
            aria-label="Search"
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
            {isTransparent ? (
              <HightideLogo 
                className="h-10 sm:h-12 md:h-14 lg:h-16 transition-all duration-300 hover:scale-105" 
                color="white" 
              />
            ) : (
              <HightideLogo
                className="h-8 sm:h-10 md:h-12 transition-all duration-300 hover:scale-105"
                color="black"
              />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 md:gap-4 w-1/3 justify-end" />
      </div>

      {/* Overlaid Navigation Links for Transparent Hero View (flanking desktop) */}
      {isTransparent && (
        <div className="hidden md:flex items-center justify-center gap-6 lg:gap-8 xl:gap-10 text-white/90 text-xs font-light tracking-wider flex-row-reverse w-full pb-6 select-none translate-x-3">
          <button 
            onClick={() => {
              onSelectCategory('all');
              onSearchChange('');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="hover:text-white transition-colors cursor-pointer border-b border-transparent hover:border-white py-0.5"
          >
            כל הפריטים
          </button>
          <button
            onClick={() => {
              onSelectCategory('shirts');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="hover:text-white transition-colors cursor-pointer border-b border-transparent hover:border-white py-0.5"
          >
            חולצות
          </button>
          <button
            onClick={() => {
              onSelectCategory('boardies');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="hover:text-white transition-colors cursor-pointer border-b border-transparent hover:border-white py-0.5 font-medium tracking-wide"
          >
            בורדיז
          </button>
          <button 
            onClick={() => {
              onSelectCategory('accessories');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="hover:text-white transition-colors cursor-pointer border-b border-transparent hover:border-white py-0.5"
          >
            אקססוריז
          </button>
          <button
            onClick={() => {
              onSelectCategory('women');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="hover:text-white transition-colors cursor-pointer border-b border-transparent hover:border-white py-0.5"
          >
            נשים
          </button>
        </div>
      )}

      {/* Mobile Horizontal Navigation Links Scroll for Transparent Hero View */}
      {isTransparent && (
        <div className="md:hidden flex items-center gap-4 text-white/95 text-[11px] overflow-x-auto px-4 pb-4 max-w-full no-scrollbar flex-row-reverse select-none">
          <button 
            onClick={() => {
              onSelectCategory('all');
              onSearchChange('');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="shrink-0 hover:text-white transition-colors cursor-pointer px-1"
          >
            כל הפריטים
          </button>
          <span className="text-white/20 shrink-0">|</span>
          <button
            onClick={() => {
              onSelectCategory('shirts');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="shrink-0 hover:text-white transition-colors cursor-pointer px-1"
          >
            חולצות
          </button>
          <span className="text-white/20 shrink-0">|</span>
          <button
            onClick={() => {
              onSelectCategory('boardies');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="shrink-0 hover:text-white transition-colors cursor-pointer px-1 font-medium"
          >
            בורדיז
          </button>
          <span className="text-white/20 shrink-0">|</span>
          <button 
            onClick={() => {
              onSelectCategory('accessories');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="shrink-0 hover:text-white transition-colors cursor-pointer px-1"
          >
            אקססוריז
          </button>
          <span className="text-white/20 shrink-0">|</span>
          <button
            onClick={() => {
              onSelectCategory('women');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="shrink-0 hover:text-white transition-colors cursor-pointer px-1"
          >
            נשים
          </button>
        </div>
      )}

      {/* Slide-down Search Bar */}
      {isSearchOpen && (
        <div className="bg-stone-50/50 border-y border-stone-100 py-3 px-4 animate-fade-in" id="search-bar-container">
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="חפש בגדים, חולצות, מכנסי גלישה..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-white border border-stone-200 py-2.5 pl-4 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-stone-800 font-normal"
                autoFocus
                id="search-input"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black"
                  id="clear-search-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                onSearchChange('');
              }}
              className="px-4 py-2 bg-stone-900 text-white text-sm font-normal hover:bg-stone-800"
              id="close-search-btn"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Mobile Drawer Menu featuring Categories AND My Favorites directly below the menu lines */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-row-reverse" id="mobile-menu-drawer">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)}></div>
          
          {/* Drawer Content */}
          <div className="relative bg-[#fdfcf9] w-80 max-w-sm h-full p-6 flex flex-col shadow-2xl z-10 overflow-y-auto transition-transform duration-300 mr-auto text-right">
            
            {/* Header of Drawer */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <button 
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 hover:bg-stone-100 rounded-full text-stone-800 transition-colors"
                id="close-menu-btn"
              >
                <X className="w-6 h-6" />
              </button>
              
              <Logo className="w-16 h-16" showText={false} />
            </div>

            {/* Section 1: Categories */}
            <div className="mt-5">
              <h3 className="font-medium text-xs text-stone-400 uppercase tracking-widest mb-2">קטגוריות</h3>
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
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 2: FAVORITES SECTION (יצירת סל מועדפים ישירות מתחת לשלושת הפסים) */}
            <div className="mt-6 pt-5 border-t border-stone-200">
              <div className="flex items-center justify-between flex-row-reverse mb-3">
                <span className="font-mono text-xs text-stone-400">({favoriteItems.length})</span>
                <h3 className="font-medium text-xs text-stone-400 uppercase tracking-widest flex items-center gap-1 flex-row-reverse">
                  <Heart className="w-3.5 h-3.5 text-black stroke-[2px]" />
                  <span>המועדפים שלי</span>
                </h3>
              </div>

              {favoriteItems.length === 0 ? (
                <div className="text-center py-6 px-4 bg-stone-50 border border-stone-100 rounded-sm">
                  <p className="text-xs text-stone-400 leading-relaxed">אין עדיין פריטים במועדפים.</p>
                  <p className="text-[10px] text-stone-400 mt-1">לחצו על הלב במוצרים שאהבתם כדי לראות אותם כאן!</p>
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
                        alt={item.name} 
                        className="w-12 h-12 object-cover object-center flex-shrink-0 border border-stone-100"
                      />

                      {/* Favorite Item Details */}
                      <div className="flex-grow min-w-0">
                        <h4 className="text-xs font-normal text-stone-800 truncate leading-tight">
                          {item.name}
                        </h4>
                        <p className="text-xs font-normal text-stone-900 mt-0.5">
                          ₪{item.price}
                        </p>
                      </div>

                      {/* Favorite Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Buy on WhatsApp directly from Favorites list */}
                        <a
                          href={`https://wa.me/972528879922?text=${encodeURIComponent(`שלום! ראיתי במועדפים באתר את הפריט "${item.name}" במחיר ₪${item.price} ואני מעוניין לרכוש אותו. האם הוא זמין?`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="p-1.5 text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors flex items-center justify-center"
                          title="רכישה בווטסאפ"
                        >
                          <svg className="w-4 h-4 fill-current text-[#25D366]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.58 1.981 14.11 1.012 11.48 1.01 6.046 1.01 1.622 5.38 1.618 10.807c-.001 1.701.453 3.361 1.314 4.815L1.879 21.16l5.768-1.506zM17.91 14.9c-.31-.155-1.832-.9-2.115-1.002-.282-.102-.489-.153-.695.155-.205.308-.797 1.002-.976 1.207-.18.205-.359.231-.669.077-.31-.155-1.307-.481-2.49-1.534-.92-.818-1.541-1.83-1.722-2.138-.18-.308-.02-.475.135-.629.14-.138.31-.36.465-.54.155-.18.205-.308.31-.514.105-.205.051-.385-.026-.54-.077-.155-.695-1.673-.951-2.29-.25-.6-.54-.515-.744-.526-.192-.01-.41-.01-.628-.01-.218 0-.573.082-.873.411-.3.308-1.148 1.121-1.148 2.733 0 1.612 1.174 3.172 1.336 3.393.162.22 2.311 3.52 5.597 4.939.781.337 1.39.539 1.86.688.784.249 1.497.214 2.061.13.629-.094 1.832-.749 2.088-1.439.256-.689.256-1.284.18-1.402-.077-.117-.282-.18-.592-.336z"/>
                          </svg>
                        </a>
                        
                        {/* Remove from favorites */}
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(item)}
                          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                          title="הסר מהמועדפים"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                עמוד הבית
              </button>
              <a href="#" className="font-normal text-sm text-stone-800 hover:text-stone-950 transition-colors">אודות HIGETIDE VINTAGE</a>
              <a 
                href="#store-footer" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="font-normal text-sm text-stone-800 hover:text-stone-950 transition-colors text-right"
              >
                צור קשר
              </a>
            </div>

            {/* Footer */}
            <div className="mt-auto text-[10px] text-stone-400 font-mono text-center pt-5 border-t border-stone-100">
              © 2026 HIGETIDE VINTAGE LTD.
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
