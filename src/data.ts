import { Product } from './types';
import { supabase, storageUrl } from './supabase';

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
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  const { data, error } = await supabase
    .from('items')
    .select(
      'num, category, name, size, price, original_price, drop_date, sold, waist_cm, length_cm, views, item_photos(path, position)',
    )
    .order('num', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as ItemRow[];

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

export const CATEGORIES = [
  { id: 'all', name: 'כל הפריטים' },
  { id: 'boardies', name: 'בורדיז' },
  { id: 'shirts', name: 'חולצות' },
  { id: 'accessories', name: 'אקססוריז' },
  { id: 'women', name: 'נשים' }
];
