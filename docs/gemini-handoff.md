# חפיפה לג'ימני — העתק את כל הטקסט מכאן ומטה כהודעה ראשונה

---

אני מעביר אליך פרויקט באמצע עבודה. קרא הכל לפני שאתה עונה, ואז תוביל אותי שלב אחר שלב.

## מי אני ומה אני צריך ממך

אני בעל חנות בגדי וינטג', לא מפתח. אני צריך שתסביר בעברית, בשפה פשוטה, **שלב אחד בכל פעם** — תגיד לי מה ללחוץ, אני מבצע, אני מדווח, ואז תיתן את הבא. אל תיתן לי 10 שלבים ביחד. אם משהו לא ברור לך לגבי המצב שלי — תשאל לפני שתנחש.

## הפרויקט

**HighTide Vintage** — חנות אונליין לבגדי גלישה וינטג', בעברית (RTL).

- **סטאק:** React 19 + TypeScript + Vite 6 + Tailwind 4
- **אחסון:** GitHub (ריפו ציבורי `nave11001/hightide-vintage`) → Netlify עם deploy אוטומטי בכל push
- **דומיין:** `hightide-vintage.netlify.app`
- **מחשב:** Windows 11, עובד ב-PowerShell
- **אנליטיקס:** Google Analytics 4 מחובר ועובד (לא קשור למשימה הזו)
- **הזמנות:** אין עגלת קניות — כל פריט מוביל להודעת וואטסאפ

## איך המלאי עובד היום (המצב שאני רוצה לשנות)

```
קבצי אקסל ב-OneDrive
    ↓  scripts/sync_inventory.py  (פייתון, openpyxl)
src/inventory_db.json
    ↓  Vite bundler
האתר
```

התמונות יושבות בתקיות `assets/inventory/<קטגוריה>/` ונטענות בזמן build דרך `import.meta.glob`.
מוסכמת שמות: `47.jpeg` = פריט 47 תמונה ראשית, `47a.jpeg` = אותו פריט, זווית שנייה.

**הנתונים כרגע:**
- 45 פריטים ב-`inventory_db.json`
- 115 תמונות, 88 MB סה"כ (ממוצע 784KB לתמונה)
- תקיות: `bordies` (43 תמונות), `T-shirts` (10), `women` (2), `all_clothes_79-128` (60 — **לא מוצגות באתר כרגע**, אין להן קטגוריה)

**מבנה שורה ב-`inventory_db.json`:**
```json
{ "num": 30, "name": "T&C SHIRTS", "size": "L", "date": "2026-07-14",
  "sold": false, "price": 140, "categories": ["boardies","shirts","accessories","women"] }
```

**הבעיות שבגללן אני עובר ל-Supabase:**
1. כל עדכון מלאי (אפילו לסמן פריט אחד כ"נמכר") דורש commit + push לגיטהאב + build מחדש ב-Netlify
2. שיתפתי שותף שיעדכן מלאי, אבל שניהם לא יכולים לערוך את אותו קובץ אקסל בלי לדרוס אחד את השני
3. אני לא רוצה שלשותף תהיה גישה לשנות מחירים

## היעד

האתר קורא ישירות מ-Supabase בזמן ריצה. מסמן "נמכר" בדפדפן → האתר מתעדכן ברענון, בלי גיט ובלי deploy.

## איפה אני עומד עכשיו

פתחתי פרויקט ב-Supabase אבל בטעות ב-region של **טוקיו**, ואני בתהליך של יצירת פרויקט חדש ב-**Central EU (Frankfurt)** ומחיקת הישן. הפרויקט עדיין **ריק לגמרי** — אין טבלאות, אין נתונים.

**מה שכבר הוחלט ואין צורך לדון בו מחדש:**
- עוברים ל-Supabase (לא Firebase, לא MongoDB, לא CMS אחר)
- התמונות עוברות ל-Supabase Storage, לא נשארות בגיט
- Region: Frankfurt
- 60 התמונות של `all_clothes_79-128` יעלו בלי קטגוריה, ואשייך אותן אחר כך מהטבלה

## המשימות שאני צריך שתעביר אותי דרכן

### שלב 2 — יצירת הטבלאות (SQL Editor בדשבורד)

הסכמה שסוכמה. תסביר לי מה כל חלק עושה לפני שאני מריץ:

```sql
create table items (
  id         bigint generated always as identity primary key,
  num        integer not null,
  category   text    check (category in ('boardies','shirts','accessories','women')),
  name       text    not null default 'HIGHTIDE',
  size       text    not null default 'ONE SIZE',
  price      integer not null default 150,
  drop_date  date,
  sold       boolean not null default false,
  sold_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (category, num)
);

create table item_photos (
  id       bigint generated always as identity primary key,
  item_id  bigint not null references items(id) on delete cascade,
  path     text   not null,
  position integer not null default 0,
  unique (item_id, path)
);

create index on item_photos (item_id);

create function mark_sold_at() returns trigger as $$
begin
  if new.sold and not old.sold then
    new.sold_at := now();
  elsif not new.sold then
    new.sold_at := null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger items_sold_at
  before update on items
  for each row execute function mark_sold_at();
```

ואז RLS:

```sql
alter table items       enable row level security;
alter table item_photos enable row level security;

create policy "public read" on items       for select using (true);
create policy "public read" on item_photos for select using (true);

create policy "auth write" on items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth write" on item_photos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
```

### שלב 3 — bucket לתמונות

bucket ציבורי בשם `inventory`, ואז policies:

```sql
create policy "public read images" on storage.objects
  for select using (bucket_id = 'inventory');
create policy "auth upload images" on storage.objects
  for insert to authenticated with check (bucket_id = 'inventory');
create policy "auth delete images" on storage.objects
  for delete to authenticated using (bucket_id = 'inventory');
```

### שלב 4 — משתמשים

שני משתמשים ב-Authentication → Users, שניהם עם Auto Confirm מסומן.

### שלב 5 — סקריפט מיגרציה (פייתון)

סקריפט שקורא את `src/inventory_db.json` ואת תקיות התמונות, מעלה את התמונות ל-Storage, ויוצר את השורות ב-`items` ו-`item_photos`. משתמש ב-`service_role` key מקובץ `.env`.

**שים לב לשתי מלכודות:**
- הנתיבים אצלי מכילים עברית ורווחים — צריך טיפול נכון בקידוד
- שמות קבצים כוללים רווחים מיותרים כמו `"12 a.jpeg"` ו-`"17 .jpeg"` — צריך normalize

### שלב 6 — חיבור הקוד

- קובץ חדש `src/supabase.ts` ליצירת ה-client
- `src/data.ts` — כרגע מייצא `INITIAL_PRODUCTS` כקבוע סינכרוני. צריך להפוך ל-`loadProducts()` אסינכרוני
- `src/App.tsx` — `useEffect` + מצב טעינה
- משתני סביבה `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY`, גם מקומית וגם ב-Netlify
- **מבנה ה-`Product` לא משתנה**, כדי שהקומפוננטות הקיימות ימשיכו לעבוד

## כללים

1. **שלב אחד בכל פעם.** תחכה שאני אדווח לפני שאתה ממשיך.
2. **תמיד תגיד לי איך לבדוק שהשלב הצליח** לפני שעוברים הלאה.
3. **PowerShell, לא bash.** אין `&&` ב-PowerShell 5.1.
4. **אל תבקש ממני להדביק את ה-`service_role` key בצ'אט.** הוא נשאר אצלי ב-`.env` בלבד.
5. אם אתה צריך לראות תוכן של קובץ מהפרויקט — תבקש ואני אדביק.

---

**התחל מכאן:** אני עכשיו מסיים ליצור את הפרויקט ב-Frankfurt. תסביר לי מה בדיוק לאסוף מהדשבורד (איזה מפתחות, מאיפה, ולמה כל אחד משמש) לפני שנתחיל בשלב 2.
