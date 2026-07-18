import { Product } from './types';

// Push a named event into the GTM dataLayer. Safe to call even if GTM is
// blocked (ad-blockers) — it just accumulates in the array.
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(event: string, data: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...data });
}

export function trackProduct(event: string, product: Product, extra: Record<string, unknown> = {}) {
  track(event, {
    product_id: product.id,
    product_name: product.name,
    product_brand: product.brand,
    product_price: product.price,
    product_category: product.category,
    product_size: product.sizes[0] || '',
    product_sold: product.isSold === true,
    ...extra,
  });
}
