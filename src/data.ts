import { Product } from './types';
import { selectRows } from './supabase';
import { storageUrl } from './photos';
import snapshot from './catalog-snapshot.json';

// Inventory lives in Supabase — see supabase/schema.sql and docs/inventory-guide.md.
// Nothing here is baked in at build time, so marking an item sold in the
// dashboard shows up on the site as soon as a visitor reloads.

const CATEGORY_LABELS: Record<string, { name: string; description: string }> = {
  boardies: { name: 'HIGHTIDE Boardies', description: 'מכנסי גלישה וינטג׳' },
  shirts: { name: 'HIGHTIDE Tee', description: 'חולצת וינטג׳' },
  accessories: { name: 'HIGHTIDE Accessory', description: 'אקססורי וינטג׳' },
  women: { name: 'HIGHTIDE Women', description: 'פריט נשים וינטג׳' },
};

interface PhotoRow {
  path: string;
  position: number;
}

interface ItemRow {
  num: number;
  category: string | null;
  name: string;
  size: string;
  price: number;
  original_price: number | null;
  drop_date: string | null;
  sold: boolean;
  waist_cm: number | null;
  length_cm: number | null;
  views: number | null;
  item_photos: PhotoRow[];
}

function toProduct(row: ItemRow, latestDropDate: string): Product | null {
  // Items still waiting to be filed into a category are uploaded but not listed.
  const category = row.category;
  if (!category || !CATEGORY_LABELS[category]) return null;

  const images = [...row.item_photos]
    .sort((a, b) => a.position - b.position || a.path.localeCompare(b.path))
    .map((p) => storageUrl(p.path));
  if (images.length === 0) return null;

  const labels = CATEGORY_LABELS[category];
  return {
    id: `${category}-${row.num}`,
    num: row.num,
    name: `${row.name} #${row.num}`,
    brand: row.name,
    price: row.price,
    // Set in the dashboard to mark a sale — renders struck through beside the price.
    originalPrice: row.original_price ?? undefined,
    image: images[0],
    images,
    borderType: 'retro-wave',
    sizes: [row.size],
    condition: 'וינטג׳ במצב מעולה',
    category: category as Product['category'],
    description: `${labels.description} — פריט מס׳ ${row.num}`,
    colors: [],
    // Sold items stay listed (marked נמכר, ordering blocked) until the
    // scheduled reset on the 1st/15th clears them — see scripts/reset_inventory.py
    isSold: row.sold,
    isLatestDrop: Boolean(row.drop_date) && row.drop_date === latestDropDate,
    // Left out until measured — the size block hides itself rather than guess.
    waistCm: row.waist_cm ?? undefined,
    lengthCm: row.length_cm ?? undefined,
    views: row.views ?? 0,
  };
}

export async function loadProducts(): Promise<Product[]> {
  const rows = await selectRows<ItemRow>('items', {
    select:
      'num,category,name,size,price,original_price,drop_date,sold,waist_cm,length_cm,views,item_photos(path,position)',
    order: 'num.asc',
  });

  // The latest drop = the most recent arrival date in the whole catalogue.
  const latestDropDate =
    rows
      .map((r) => r.drop_date)
      .filter((d): d is string => Boolean(d))
      .sort()
      .pop() || '';

  return rows
    .map((row) => toProduct(row, latestDropDate))
    .filter((p): p is Product => p !== null);
}

// ── the catalogue that ships with the site ──────────────────────────────
//
// A copy of the shop taken at build time, read only when Supabase cannot be
// reached. On the night Supabase restricted the project for exceeding its
// bandwidth allowance the shop had nothing to show at all — not the garments,
// not the photographs. With this it stays open, one deploy behind.
//
// Deliberately never the first choice: prices and sold marks change in the
// dashboard without a deploy, so the live catalogue wins whenever it answers.
//
// Rebuild it with `python scripts/make_catalog_snapshot.py`.

interface SnapshotRow {
  n: number; // catalogue number
  c: string; // category
  b: string; // brand
  s: string; // size
  p: number; // price
  o?: number; // original price, when on sale
  ph: string[]; // photo paths, in order
  v?: number; // views
  sold?: number;
  new?: number; // part of the latest drop
  w?: number; // waist cm
  l?: number; // length cm
}

export function snapshotProducts(): Product[] {
  const rows = (snapshot.items ?? []) as SnapshotRow[];
  return rows
    .filter((row) => CATEGORY_LABELS[row.c] && row.ph.length > 0)
    .map((row) => ({
      id: `${row.c}-${row.n}`,
      num: row.n,
      name: `${row.b} #${row.n}`,
      brand: row.b,
      price: row.p,
      originalPrice: row.o,
      image: storageUrl(row.ph[0]),
      images: row.ph.map(storageUrl),
      borderType: 'retro-wave' as const,
      sizes: [row.s],
      condition: 'וינטג׳ במצב מעולה',
      category: row.c as Product['category'],
      description: `${CATEGORY_LABELS[row.c].description} — פריט מס׳ ${row.n}`,
      colors: [],
      isSold: row.sold === 1,
      isLatestDrop: row.new === 1,
      waistCm: row.w,
      lengthCm: row.l,
      views: row.v ?? 0,
    }));
}

// Re-exported rather than defined here: the same list has to reach the Netlify
// function that writes each category's search and share tags, and that cannot
// import TypeScript. See shared/categories.mjs.
export { CATEGORIES } from '@/shared/categories.mjs';
