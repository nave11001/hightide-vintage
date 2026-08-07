# מעבר מאקסל ל-Supabase — תוכנית ביצוע

**מצב היום:** אקסל ב-OneDrive → `scripts/sync_inventory.py` → `src/inventory_db.json` → Vite בונה → Netlify.
כל שינוי מלאי דורש commit + push + build.

**היעד:** האתר קורא ישירות מ-Supabase. מסמן "נמכר" בדפדפן → האתר מתעדכן מיד, בלי גיט ובלי deploy.

**זמן משוער:** 4-6 שעות, מחולק ל-7 שלבים. כל שלב נגמר בבדיקה — אל תמשיך הלאה עד שהבדיקה עוברת.

> **חשוב:** אל תמחק כלום מהאקסלים או מ-`assets/inventory` עד שסיימת את שלב 7.
> כל התהליך הפיך — עד שלב 5 האתר החי ממשיך לעבוד מהאקסל כרגיל.

---

## נתונים נוכחיים (נמדד ב-2 באוגוסט 2026)

| | |
|---|---|
| פריטים ב-`inventory_db.json` | 45 |
| תמונות בסך הכל | 115 קבצים, 88 MB |
| `bordies` | 43 תמונות |
| `T-shirts` | 10 תמונות |
| `women` | 2 תמונות |
| `all_clothes_79-128` | 60 תמונות — **לא מוצגות באתר** (ראה שלב 0) |

---

## שלב 0 — החלטה על התקייה `all_clothes_79-128`

התקייה הזו לא קיימת ב-`FOLDER_TO_CATEGORY` ב-[src/data.ts](../src/data.ts), ולכן 60 התמונות שבה לא עולות לאתר.

**מה לעשות:** תחליט לאיזו קטגוריה כל פריט שייך. שלוש אפשרויות:

1. **לפצל ידנית** — להעביר כל תמונה לתקייה הנכונה (`bordies` / `T-shirts` / `women` / `accessories`). הכי נקי.
2. **הכל לקטגוריה אחת** — אם כולם מאותו סוג, פשוט תשנה את שם התקייה.
3. **לדחות** — נעלה אותם ל-Supabase בלי קטגוריה ותשייך אחר כך מהדפדפן. הכי מהיר, ואפשרי רק כי עוברים ל-DB.

**המלצה:** אפשרות 3. אחרי המעבר, שיוך קטגוריה זה שינוי תא בטבלה — הרבה יותר קל מלהזיז קבצים.

- [ ] החלטתי איך לטפל ב-60 התמונות

---

## שלב 1 — פתיחת פרויקט Supabase

1. היכנס ל-[supabase.com](https://supabase.com) → **Start your project** → התחבר עם GitHub
2. **New project**:
   - Name: `hightide-vintage`
   - Database Password: **צור סיסמה חזקה ושמור אותה במנהל סיסמאות** — לא תראה אותה שוב
   - Region: `Central EU (Frankfurt)` — הכי קרוב לישראל
   - Plan: **Free**
3. חכה ~2 דקות עד שהפרויקט קם

### מה לאסוף מהדשבורד

**Settings** (⚙️ למטה בסרגל) → **API**:

| מה | איפה | לאן |
|---|---|---|
| `Project URL` | Settings → API | `.env` + Netlify |
| `anon public` key | Settings → API | `.env` + Netlify |
| `service_role` key | Settings → API → Reveal | **רק** לסקריפט המיגרציה |

> ⚠️ ה-`anon` key **גלוי לכל גולש** — זה בסדר, ככה זה מתוכנן. ההגנה היא ה-RLS שנגדיר בשלב 2.
> ה-`service_role` key עוקף את כל ההגנות. **אף פעם לא בקוד, אף פעם לא בגיט.**

- [ ] הפרויקט קם
- [ ] שמרתי את שלושת המפתחות במקום בטוח

---

## שלב 2 — יצירת הטבלאות

בדשבורד: **SQL Editor** (בסרגל השמאלי) → **New query** → הדבק את כל הבלוק → **Run**.

```sql
-- ── פריטים ──────────────────────────────────────────────
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

-- ── תמונות (פריט אחד = כמה זוויות) ──────────────────────
create table item_photos (
  id       bigint generated always as identity primary key,
  item_id  bigint not null references items(id) on delete cascade,
  path     text   not null,
  position integer not null default 0,   -- 0 = תמונה ראשית
  unique (item_id, path)
);

create index on item_photos (item_id);

-- ── סימון נמכר מתעד אוטומטית את התאריך ─────────────────
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

**הרצה שנייה** — הרשאות (RLS). בלי זה כל אחד יוכל לשנות לך מחירים:

```sql
alter table items       enable row level security;
alter table item_photos enable row level security;

-- כל אחד קורא (האתר צריך את זה)
create policy "public read"  on items       for select using (true);
create policy "public read"  on item_photos for select using (true);

-- רק מי שמחובר כותב
create policy "auth write"   on items       for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth write"   on item_photos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
```

**בדיקה:** Table Editor → אתה אמור לראות `items` ו-`item_photos` ריקות, ולידן תג `RLS enabled`.

- [ ] שתי הטבלאות נוצרו
- [ ] RLS מופעל על שתיהן

---

## שלב 3 — יצירת ה-bucket לתמונות

**Storage** → **New bucket**:

- Name: `inventory`
- **Public bucket: ✅ מסומן** (התמונות צריכות להיות גלויות לגולשים)
- Run → צור

עכשיו הרשאות ההעלאה — SQL Editor:

```sql
create policy "public read images" on storage.objects
  for select using (bucket_id = 'inventory');

create policy "auth upload images" on storage.objects
  for insert to authenticated with check (bucket_id = 'inventory');

create policy "auth delete images" on storage.objects
  for delete to authenticated using (bucket_id = 'inventory');
```

- [ ] bucket `inventory` קיים ומסומן Public

---

## שלב 4 — יצירת המשתמשים

**Authentication** → **Users** → **Add user** → **Create new user**:

1. המייל שלך + סיסמה → ✅ **Auto Confirm User**
2. חזור על זה עבור `galnimrod9@gmail.com` (או מי שיעדכן מלאי)

> **Email confirm** חייב להיות מסומן, אחרת המשתמש לא יוכל להתחבר.

- [ ] שני משתמשים קיימים ומאושרים

---

## שלב 5 — העברת הנתונים

זה השלב היחיד שדורש הרצת קוד. **תגיד לי כשאתה כאן ואני אכתוב את `scripts/migrate_to_supabase.py`** — הוא יקרא את `src/inventory_db.json` ואת תקיות התמונות, יעלה הכל, ויוודא שהספירות תואמות.

מה שתצטרך להכין מראש:

```bash
pip install supabase
```

ואת ה-`service_role` key בקובץ `.env` בשורש הפרויקט (הוא כבר ב-`.gitignore`):

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
```

**בדיקה אחרי ההרצה:** Table Editor → `items` → אמורות להיות **45 שורות** (או 105 אם החלטת להעלות גם את `all_clothes_79-128`). `item_photos` → 55 שורות (או 115).

- [ ] `pip install supabase` הורץ
- [ ] `.env` מוכן
- [ ] הסקריפט רץ והספירות תואמות

---

## שלב 6 — חיבור האתר

גם כאן אני כותב את הקוד. השינויים:

| קובץ | מה משתנה |
|---|---|
| `src/supabase.ts` | **חדש** — יצירת ה-client |
| `src/data.ts` | `INITIAL_PRODUCTS` (סינכרוני) → `loadProducts()` (אסינכרוני) |
| `src/App.tsx` | `useEffect` שטוען את המלאי + מצב טעינה |
| `.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

מבנה ה-`Product` **לא משתנה** — `ProductCard` ו-`ProductDetailModal` נשארים בדיוק כמו שהם.

מה שאתה צריך לעשות ידנית: **Netlify** → Site configuration → Environment variables → הוסף:

```
VITE_SUPABASE_URL        = https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY   = eyJhbGci...
```

> בלי זה ה-build ב-Netlify יעבור אבל האתר יעלה ריק.

**בדיקה:** `npm run dev` → המלאי מופיע. ואז — שנה מחיר של פריט ב-Table Editor, רענן את הדפדפן, וראה שהמחיר השתנה **בלי לבנות מחדש**. זה הרגע שבו כל המעבר מוכיח את עצמו.

- [ ] משתני הסביבה ב-Netlify
- [ ] המלאי עולה ב-`npm run dev`
- [ ] שינוי ב-Table Editor מופיע ברענון

---

## שלב 7 — ניקוי וכיבוי הישן

רק אחרי שהאתר החי עובד מ-Supabase לפחות יום.

**מה מת:**
- `scripts/sync_inventory.py`
- `src/inventory_db.json`
- ה-watcher ב-`server.ts` (`watchInventory`)

**מה משתנה:**
- `scripts/reset_inventory.py` — במקום openpyxl, שאילתה אחת:
  ```sql
  delete from items where sold = true;
  ```
  ה-GitHub Action של ה-1 וה-15 לחודש נשאר, רק קורא ל-Supabase במקום לערוך אקסל.
- `scripts/find_duplicates.py` — ממשיך לעבוד, מוריד תמונות מ-Storage במקום מהדיסק.

**מה לשמור לנצח:**
- האקסלים ב-`assets/inventory/excel/` — גיבוי היסטורי
- `sold_log.csv` — רישום המכירות

- [ ] האתר החי רץ מ-Supabase יום שלם ללא תקלות
- [ ] הסקריפטים הישנים הוסרו
- [ ] גיבוי האקסלים במקום בטוח

---

## אחרי המעבר — איך מעדכנים מלאי

**פריט נמכר:** Table Editor → `items` → סמן ✅ בעמודה `sold` → האתר מתעדכן ברענון. `sold_at` נרשם אוטומטית.

**פריט חדש:** Storage → העלה תמונה ל-`inventory/bordies/` → Table Editor → הוסף שורה ב-`items` ושורה ב-`item_photos`.

**שינוי מחיר:** תא בטבלה. זהו.

**אף אחד מהם לא דורש גיט, לא דורש deploy, ולא דורש אותי.**

---

## שיפורים אופציונליים (אחרי שהכל עובד)

| שיפור | מה זה נותן |
|---|---|
| **Realtime** | האתר מתעדכן **בלי רענון** — פריט נמכר נעלם מהמסך של הגולש בזמן אמת |
| **הרשאות ברמת עמודה** | `grant update (sold) on items to collaborator` — הם מסמנים נמכר, לא נוגעים במחיר |
| **דף ניהול באתר** | טופס פשוט ב-`/admin` במקום להיכנס לדשבורד של Supabase |
| **דחיסת תמונות** | 784KB לתמונה בממוצע — דחיסה ל-WebP תוריד ~70% ותאיץ את האתר משמעותית |

---

## אם משהו נשבר

| תסמין | סיבה סבירה |
|---|---|
| האתר ריק, קונסול נקי | משתני הסביבה חסרים ב-Netlify |
| `row-level security policy` בקונסול | ה-policy של `public read` לא נוצר — הרץ שוב את שלב 2 |
| תמונות שבורות | ה-bucket לא Public, או ה-`path` ב-`item_photos` לא תואם למה שב-Storage |
| לא מצליח להתחבר | המשתמש לא אושר — Authentication → Users → צריך `Confirmed` |

**חזרה אחורה:** עד שלב 7 הכל עדיין בגיט. `git revert` על ה-commit של שלב 6 מחזיר את האתר לעבוד מהאקסל.
