import { Product } from './types';
import inventoryDb from './inventory_db.json';

// All inventory images, auto-loaded from assets/Inventory.
// File naming: "16.jpeg" = product 16 main photo, "16a.jpeg" = same product, second angle.
// Spaces in filenames ("12 a.jpeg", "17 .jpeg") are tolerated.
const inventoryImages = import.meta.glob('../assets/Inventory/*/*.{jpeg,jpg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const FOLDER_TO_CATEGORY: Record<string, Product['category']> = {
  'bordies': 'boardies',
  't-shirts': 'shirts',
  'accessories': 'accessories',
  'women': 'women',
};

const CATEGORY_LABELS: Record<string, { name: string; description: string }> = {
  boardies: { name: 'HIGETIDE Boardies', description: 'מכנסי גלישה וינטג׳' },
  shirts: { name: 'HIGETIDE Tee', description: 'חולצת וינטג׳' },
  accessories: { name: 'HIGETIDE Accessory', description: 'אקססורי וינטג׳' },
  women: { name: 'HIGETIDE Women', description: 'פריט נשים וינטג׳' },
};

// Inventory database synced from ALL Excel sheets in assets/Inventory.
// Auto-refreshed by the dev server on every sheet save (npm run sync-inventory manually).
interface DbItem {
  num: number;
  name: string;
  size: string;
  date: string;
  sold: boolean;
  price: number;
  categories: string[];
}

// (category, number) -> item
const DB = new Map<string, DbItem>();
for (const item of inventoryDb as DbItem[]) {
  for (const cat of item.categories) {
    DB.set(`${cat}-${item.num}`, item);
  }
}

// The latest drop = the most recent arrival date across all sheets
const LATEST_DROP_DATE = (inventoryDb as DbItem[])
  .map((i) => i.date)
  .sort()
  .pop() || '';

function buildProducts(): Product[] {
  // group[category][number] = { main, angles[] }
  const groups = new Map<string, Map<number, { main?: string; angles: string[] }>>();

  for (const [path, url] of Object.entries(inventoryImages)) {
    const parts = path.split('/');
    const folder = parts[parts.length - 2].toLowerCase();
    const category = FOLDER_TO_CATEGORY[folder];
    if (!category) continue;

    const base = parts[parts.length - 1]
      .replace(/\.(jpeg|jpg|png|webp)$/i, '')
      .replace(/\s+/g, '')
      .toLowerCase();
    const m = base.match(/^(\d+)([a-z]?)$/);
    if (!m) continue;

    const num = parseInt(m[1], 10);
    if (!groups.has(category)) groups.set(category, new Map());
    const catMap = groups.get(category)!;
    if (!catMap.has(num)) catMap.set(num, { angles: [] });
    const entry = catMap.get(num)!;
    if (m[2]) entry.angles.push(url);
    else entry.main = url;
  }

  const products: Product[] = [];
  for (const [category, catMap] of groups) {
    const labels = CATEGORY_LABELS[category];
    const nums = [...catMap.keys()].sort((a, b) => a - b);
    for (const num of nums) {
      const entry = catMap.get(num)!;
      const images = [entry.main, ...entry.angles.sort()].filter(Boolean) as string[];
      if (images.length === 0) continue;
      const detail = DB.get(`${category}-${num}`);
      products.push({
        id: `${category}-${num}`,
        name: detail ? `${detail.name} #${num}` : `${labels.name} #${num}`,
        brand: detail ? detail.name : 'HIGETIDE',
        price: detail ? detail.price : 150,
        image: images[0],
        images,
        borderType: 'retro-wave',
        sizes: detail ? [detail.size] : ['ONE SIZE'],
        condition: 'וינטג׳ במצב מעולה',
        category: category as Product['category'],
        description: `${labels.description} — פריט מס׳ ${num}`,
        colors: [],
        isSold: detail ? detail.sold : false,
        isLatestDrop: detail ? detail.date === LATEST_DROP_DATE : false,
      });
    }
  }
  return products;
}

export const INITIAL_PRODUCTS: Product[] = buildProducts();

export const CATEGORIES = [
  { id: 'all', name: 'כל הפריטים' },
  { id: 'boardies', name: 'בורדיז' },
  { id: 'shirts', name: 'חולצות' },
  { id: 'accessories', name: 'אקססוריז' },
  { id: 'women', name: 'נשים' }
];
