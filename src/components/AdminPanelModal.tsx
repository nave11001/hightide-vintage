import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { X, Save, Plus, Edit2, RotateCcw, Link2, DollarSign, Image as ImageIcon, Lock, ShieldAlert } from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSaveProducts: (newProducts: Product[]) => void;
  onResetToDefault: () => void;
  initialProductToEdit?: Product | null;
}

export default function AdminPanelModal({
  isOpen,
  onClose,
  products,
  onSaveProducts,
  onResetToDefault,
  initialProductToEdit,
}: AdminPanelModalProps) {
  if (!isOpen) return null;

  // Security & Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [showSimulationPrompt, setShowSimulationPrompt] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Check secure session token on mount or when modal opens
  useEffect(() => {
    if (isOpen) {
      const savedToken = sessionStorage.getItem('hightide_admin_token');
      if (savedToken) {
        setIsCheckingToken(true);
        fetch('/api/admin/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: savedToken })
        })
        .then(async (res) => {
          if (res.ok) {
            setIsAuthenticated(true);
          } else {
            sessionStorage.removeItem('hightide_admin_token');
            setIsAuthenticated(false);
          }
        })
        .catch(() => {
          // Fallback if server is starting or network is slow
          setIsAuthenticated(false);
        })
        .finally(() => {
          setIsCheckingToken(false);
        });
      } else {
        setIsAuthenticated(false);
        setIsCheckingToken(false);
      }
    }
  }, [isOpen]);

  // Listen to Google OAuth popups postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      
      if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS') {
        const token = event.data.token;
        sessionStorage.setItem('hightide_admin_token', token);
        setIsAuthenticated(true);
        setAuthError('');
        setIsVerifying(false);
      } else if (event.data?.type === 'GOOGLE_OAUTH_FAILURE') {
        setAuthError(event.data.error || 'התחברות Google נכשלה');
        setIsVerifying(false);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGoogleLogin = async () => {
    setIsVerifying(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();
      
      if (res.ok && data.configured && data.url) {
        const width = 500;
        const height = 650;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.url,
          'google_oauth_popup',
          `width=${width},height=${height},left=${left},top=${top}`
        );
        
        if (!popup) {
          setAuthError('חלון קופץ נחסם בדפדפן. אנא אפשר פופ-אפים לאתר זה.');
          setIsVerifying(false);
        }
      } else {
        // If not configured, prompt simulation
        setShowSimulationPrompt(true);
        setIsVerifying(false);
      }
    } catch (e) {
      setAuthError('שגיאה בתקשורת עם השרת');
      setIsVerifying(false);
    }
  };

  const handleSimulateLogin = async () => {
    setIsVerifying(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/google/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nave1237@gmail.com' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem('hightide_admin_token', data.token);
        setIsAuthenticated(true);
        setShowSimulationPrompt(false);
      } else {
        setAuthError(data.error || 'שגיאה באימות מדומה');
      }
    } catch (e) {
      setAuthError('שגיאה בתקשורת עם שרת הסימולציה');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) return;
    setIsVerifying(true);
    setAuthError('');

    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput })
    })
    .then(async (res) => {
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem('hightide_admin_token', data.token);
        setIsAuthenticated(true);
        setAuthError('');
        setPasswordInput('');
      } else {
        setAuthError(data.error || 'שגיאת אימות סיסמה');
      }
    })
    .catch(() => {
      setAuthError('שגיאה בחיבור לשרת האימות המאובטח');
    })
    .finally(() => {
      setIsVerifying(false);
    });
  };


  // Form State
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState<'pants' | 'shirts' | 'boardies' | 'accessories'>('shirts');
  const [sizes, setSizes] = useState<string[]>(['M']);
  const [condition, setCondition] = useState('וינטג׳ במצב מצוין');
  const [description, setDescription] = useState('');
  const [colors, setColors] = useState<string[]>(['כחול']);

  const handleStartEdit = (prod: Product) => {
    setEditingProduct(prod);
    setIsAddingNew(false);
    setName(prod.name);
    setBrand(prod.brand);
    setPrice(prod.price);
    setImageUrl(prod.image);
    setCategory(prod.category);
    setSizes(prod.sizes);
    setCondition(prod.condition);
    setDescription(prod.description);
    setColors(prod.colors);
  };

  useEffect(() => {
    if (isOpen && initialProductToEdit) {
      handleStartEdit(initialProductToEdit);
    }
  }, [isOpen, initialProductToEdit]);

  const handleStartAdd = () => {
    setEditingProduct(null);
    setIsAddingNew(true);
    setName('');
    setBrand('');
    setPrice(150);
    setImageUrl('https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80');
    setCategory('shirts');
    setSizes(['M', 'L']);
    setCondition('וינטג׳ במצב מצוין 9/10');
    setDescription('תיאור קצר של פריט הוינטג׳...');
    setColors(['שחור']);
  };

  const handleSave = () => {
    if (!name || !brand || price <= 0 || !imageUrl) {
      alert('נא למלא את כל שדות החובה: שם, מותג, מחיר ותמונת פריט');
      return;
    }

    if (isAddingNew) {
      const newProd: Product = {
        id: 'user_prod_' + Date.now(),
        name,
        brand,
        price,
        image: imageUrl,
        borderType: 'retro-wave',
        sizes,
        condition,
        category,
        description,
        colors,
      };
      onSaveProducts([newProd, ...products]);
      setIsAddingNew(false);
    } else if (editingProduct) {
      const updatedList = products.map((p) => {
        if (p.id === editingProduct.id) {
          return {
            ...p,
            name,
            brand,
            price,
            image: imageUrl,
            category,
            sizes,
            condition,
            description,
            colors,
          };
        }
        return p;
      });
      onSaveProducts(updatedList);
      setEditingProduct(null);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק פריט זה מהמלאי?')) {
      const updatedList = products.filter((p) => p.id !== id);
      onSaveProducts(updatedList);
      if (editingProduct?.id === id) {
        setEditingProduct(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="admin-panel-modal">
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs" onClick={onClose}></div>

      <div className="bg-[#fdfcf9] border border-stone-200 w-full max-w-4xl h-[85vh] relative z-10 shadow-2xl flex flex-col rounded-none animate-scale-up overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between flex-row-reverse bg-stone-50">
          <div className="text-right">
            <h2 className="text-base sm:text-lg font-medium text-stone-900 font-serif flex items-center gap-1.5 justify-end">
              <span>ניהול מלאי ועדכון פריטים</span>
              <Lock className="w-4 h-4 text-stone-500" />
            </h2>
            <p className="text-[11px] text-stone-500 font-normal">ממשק כניסה וניהול מאובטח לבעל החנות בלבד</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
            id="close-admin-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isCheckingToken ? (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-stone-600 bg-[#fdfcf9]">
            <div className="w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs font-medium font-serif tracking-wide">בודק חיבור מאובטח...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex-grow flex items-center justify-center p-4 sm:p-8 bg-stone-50/50">
            <div className="w-full max-w-sm bg-white border border-stone-200/80 p-6 sm:p-8 shadow-sm rounded-none">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 bg-stone-100 flex items-center justify-center rounded-full mb-3 text-stone-800 animate-pulse">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-stone-900 font-serif uppercase tracking-wider">נדרש אימות בעלים</h3>
                <p className="text-[11px] text-stone-500 mt-1 max-w-[240px]">
                  המערכת מוגנת באמצעות הצפנה קריפטוגרפית. אנא הזן סיסמת מנהל או התחבר באמצעות חשבון ה-Google שלך.
                </p>
              </div>

              {showSimulationPrompt ? (
                <div className="space-y-4 text-right animate-scale-up">
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-normal leading-relaxed rounded-none">
                    <p className="font-bold mb-1 text-xs">מצב פיתוח / בדיקה פעיל 🛠️</p>
                    <p>
                      חשבון ה-Google של החברה אינו מוגדר עדיין בשרת פיתוח זה.
                      כדי להפעיל כניסת Google אמתית, עליך להגדיר את המשתנים <strong>GOOGLE_CLIENT_ID</strong> ו-<strong>GOOGLE_CLIENT_SECRET</strong> בהגדרות המערכת.
                    </p>
                    <p className="mt-2 text-[10px] text-amber-700 font-mono">
                      אימייל מורשה להרשאות אדמין: nave1237@gmail.com
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleSimulateLogin}
                    disabled={isVerifying}
                    className="w-full py-2.5 px-4 text-xs font-medium text-white transition-all bg-amber-600 hover:bg-amber-700 flex items-center justify-center gap-2 cursor-pointer font-bold rounded-none"
                  >
                    {isVerifying ? 'מתחבר בסימולציה...' : 'כניסה מדומה עם nave1237@gmail.com'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setShowSimulationPrompt(false)}
                    className="w-full text-center text-[10px] text-stone-500 hover:underline hover:text-stone-800 cursor-pointer block mt-1"
                  >
                    חזור לאפשרויות התחברות
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Google Sign-In button */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isVerifying}
                    className="w-full py-2.5 px-4 text-xs font-medium border border-stone-300 hover:border-stone-950 hover:bg-stone-50 bg-white text-stone-900 transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xs hover:shadow-sm rounded-none"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>התחבר באמצעות Google</span>
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-stone-200"></div>
                    <span className="flex-shrink mx-4 text-[10px] text-stone-400 uppercase tracking-widest font-medium">או באמצעות סיסמה</span>
                    <div className="flex-grow border-t border-stone-200"></div>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="space-y-4 text-right">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">סיסמת מנהל</label>
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="הזן סיסמת אבטחה..."
                        className="w-full text-right p-2.5 border border-stone-200 bg-white text-xs outline-none focus:border-stone-900 transition-all font-mono placeholder:font-sans placeholder:text-stone-400 rounded-none"
                        disabled={isVerifying}
                        autoFocus
                      />
                    </div>

                    {authError && (
                      <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-[11px] font-normal flex items-start gap-2 flex-row-reverse text-right leading-relaxed rounded-none">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isVerifying || !passwordInput}
                      className={`w-full py-2.5 px-4 text-xs font-medium text-white transition-all bg-stone-950 hover:bg-stone-800 flex items-center justify-center gap-2 cursor-pointer rounded-none ${
                        isVerifying ? 'opacity-80 cursor-not-allowed' : ''
                      }`}
                    >
                      {isVerifying ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>מאמת סיסמה...</span>
                        </>
                      ) : (
                        <span>התחברות מאובטחת</span>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Workspace layout split */
          <div className="flex-grow flex flex-col md:flex-row overflow-hidden flex-row-reverse text-right">
          
          {/* Right Side: Product list to choose what to edit */}
          <div className="w-full md:w-2/5 border-b md:border-b-0 md:border-l border-stone-200 overflow-y-auto p-4 flex flex-col">
            <div className="flex justify-between items-center mb-3 flex-row-reverse">
              <span className="text-xs font-bold text-stone-600 uppercase font-mono">רשימת פריטים קיימים</span>
              <button
                type="button"
                onClick={handleStartAdd}
                className="bg-stone-900 text-white text-xs font-normal py-1.5 px-3 hover:bg-stone-800 transition-colors flex items-center gap-1 flex-row-reverse cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>הוסף מוצר חדש</span>
              </button>
            </div>

            <div className="space-y-2 flex-grow overflow-y-auto pr-1">
              {products.map((p) => (
                <div 
                  key={p.id}
                  className={`flex items-center gap-3 p-2 border transition-all justify-between flex-row-reverse cursor-pointer ${
                    editingProduct?.id === p.id 
                      ? 'border-stone-950 bg-stone-50' 
                      : 'border-stone-200 bg-white hover:border-stone-400'
                  }`}
                  onClick={() => handleStartEdit(p)}
                >
                  <div className="flex items-center gap-2 flex-row-reverse">
                    <img 
                      src={p.image} 
                      alt={p.name} 
                      className="w-10 h-10 object-cover border border-stone-100 bg-stone-50 flex-shrink-0" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-right">
                      <p className="text-xs font-normal text-stone-900 truncate max-w-[150px]">{p.name}</p>
                      <p className="text-[10px] font-mono text-stone-400">{p.brand} • ₪{p.price}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(p);
                      }}
                      className="text-stone-500 hover:text-stone-950 p-1"
                      title="ערוך"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id);
                      }}
                      className="text-stone-400 hover:text-red-600 p-1"
                      title="מחק"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-stone-200 mt-4 flex justify-between flex-row-reverse">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('האם אתה בטוח שברצונך לשחזר את מלאי ברירת המחדל המקורי?')) {
                    onResetToDefault();
                    setEditingProduct(null);
                    setIsAddingNew(false);
                  }
                }}
                className="text-stone-400 hover:text-stone-950 text-[10px] font-normal flex items-center gap-1 flex-row-reverse cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>שחזר מלאי ברירת מחדל</span>
              </button>
              <span className="text-[10px] text-stone-400 font-mono">סה״כ מוצרים: {products.length}</span>
            </div>
          </div>

          {/* Left Side: Detail edit / Creation Form */}
          <div className="w-full md:w-3/5 p-4 sm:p-6 overflow-y-auto flex flex-col justify-between">
            {editingProduct || isAddingNew ? (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider font-mono border-b border-stone-100 pb-2">
                  {isAddingNew ? 'הוספת מוצר חדש לחנות' : `עריכת מוצר: ${editingProduct?.name}`}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-stone-700 mb-1">שם הפריט *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-right p-2 border border-stone-200 bg-white text-xs outline-none focus:border-stone-900"
                      placeholder="למשל: Vintage Stussy Tee"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-stone-700 mb-1">מותג / קולקציה *</label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full text-right p-2 border border-stone-200 bg-white text-xs outline-none focus:border-stone-900"
                      placeholder="למשל: Stussy"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-stone-700 mb-1">מחיר בש״ח (מספר בלבד) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        className="w-full text-right p-2 pr-7 border border-stone-200 bg-white text-xs outline-none focus:border-stone-900"
                        placeholder="240"
                      />
                      <span className="absolute right-2.5 top-2.5 text-xs text-stone-400 font-mono">₪</span>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-stone-700 mb-1">קטגוריה</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full text-right p-2 border border-stone-200 bg-white text-xs outline-none focus:border-stone-900"
                    >
                      <option value="boardies">בורדיז (Boardies)</option>
                      <option value="shirts">חולצות (Shirts/Hoodies)</option>
                      <option value="pants">מכנסיים (Pants/Denim)</option>
                      <option value="accessories">אקססוריז (Accessories)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">קישור ישיר לתמונה (URL) *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-grow text-left p-2 border border-stone-200 bg-white text-xs outline-none focus:border-stone-900"
                      placeholder="https://images.unsplash.com/... או כתובת אחרת"
                    />
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">תוכל להעתיק קישור של כל תמונה מהאינטרנט או להשתמש בקישורי Unsplash קיימים</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">מידות קיימות (מופרדות בפסיק)</label>
                    <input
                      type="text"
                      value={sizes.join(', ')}
                      onChange={(e) => setSizes(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      className="w-full text-right p-2 border border-stone-200 bg-white text-xs outline-none focus:border-stone-900 font-mono"
                      placeholder="M, L, XL"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">מצב הפריט</label>
                    <input
                      type="text"
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full text-right p-2 border border-stone-200 bg-white text-xs outline-none focus:border-stone-900"
                      placeholder="למשל: וינטג׳ שמור במיוחד 9/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">תיאור המוצר</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full text-right p-2 border border-stone-200 bg-white text-xs outline-none focus:border-stone-900 resize-none"
                    placeholder="הסבר קצר על הסיפור או האיכות של פריט זה..."
                  />
                </div>

                <div className="pt-3 border-t border-stone-100 flex justify-end gap-3 flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="bg-stone-900 hover:bg-stone-800 text-white font-normal text-xs py-2 px-5 transition-colors flex items-center gap-1.5 flex-row-reverse cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>שמור שינויים בחנות</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setIsAddingNew(false);
                    }}
                    className="text-stone-500 hover:text-stone-800 border border-stone-200 py-2 px-4 text-xs font-normal bg-white cursor-pointer"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-[#f6f5f0] border border-dashed border-stone-200 h-full">
                <Edit2 className="w-8 h-8 text-stone-400 mb-2 stroke-1" />
                <h4 className="text-sm font-medium text-stone-800">אנא בחר פריט מהרשימה</h4>
                <p className="text-xs text-stone-500 max-w-xs mt-1 leading-relaxed">
                  לחץ על אחד ממוצרי החנות בצד ימין כדי לעדכן את המחיר שלו, להחליף קישור לתמונה או לערוך פרטים, או הוסף פריט חדש לגמרי.
                </p>
                <div className="mt-5 p-4 bg-white border border-stone-200/60 max-w-sm text-right">
                  <span className="text-[10px] font-bold text-stone-800 block mb-1">כיצד לעדכן קבוע בקוד?</span>
                  <p className="text-[11px] text-stone-600 leading-relaxed font-normal">
                    לשינוי קבוע לכל המשתמשים שיקראו את האתר מהשרת:
                  </p>
                  <ol className="text-[10.5px] text-stone-500 list-decimal list-inside space-y-1 mt-2.5 font-mono">
                    <li>פתח את הקובץ <strong className="text-stone-800">src/data.ts</strong></li>
                    <li>תחת המערך <strong className="text-stone-800">INITIAL_PRODUCTS</strong> עדכן את המחירים או קישורי התמונות</li>
                    <li>שמור את הקובץ - והחנות תתעדכן מיד!</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

        </div>
        )}
      </div>
    </div>
  );
}
