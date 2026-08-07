-- HighTide Vintage — inventory schema
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-read; every statement is a one-time create.

-- ─────────────────────────────────────────────────────────────
-- Items. One row per garment, identified by (category, num) the
-- same way the photo folders were: bordies/47.jpeg = boardies #47.
-- category stays NULL for items that have not been sorted yet —
-- those are uploaded but hidden from the site until assigned.
-- ─────────────────────────────────────────────────────────────
create table items (
  id         bigint generated always as identity primary key,
  num        integer not null,
  category   text    check (category in ('boardies','shirts','accessories','women')),
  name       text    not null default 'HIGHTIDE',
  size       text    not null default 'ONE SIZE',
  price      integer not null default 150,
  -- Fill this in to put an item on sale: the shop shows `price` next to
  -- `original_price` struck through. Leave empty for a normal item.
  original_price integer,
  drop_date  date,
  sold       boolean not null default false,
  sold_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (category, num)
);

-- Photos. position 0 = the main shot, 1+ = extra angles (47a, 47b…).
create table item_photos (
  id       bigint generated always as identity primary key,
  item_id  bigint not null references items(id) on delete cascade,
  path     text   not null,
  position integer not null default 0,
  unique (item_id, path)
);

create index on item_photos (item_id);

-- Ticking `sold` stamps the date automatically, un-ticking clears it.
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

-- ─────────────────────────────────────────────────────────────
-- Row level security: the whole world may read the catalogue,
-- only a signed-in user may change it. This is what stops a
-- visitor from editing prices with the public anon key.
-- ─────────────────────────────────────────────────────────────
alter table items       enable row level security;
alter table item_photos enable row level security;

create policy "public read" on items       for select using (true);
create policy "public read" on item_photos for select using (true);

create policy "auth write" on items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth write" on item_photos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- Storage. Create a PUBLIC bucket named `inventory` in the
-- dashboard first (Storage → New bucket), then run this.
-- ─────────────────────────────────────────────────────────────
create policy "public read images" on storage.objects
  for select using (bucket_id = 'inventory');

create policy "auth upload images" on storage.objects
  for insert to authenticated with check (bucket_id = 'inventory');

create policy "auth delete images" on storage.objects
  for delete to authenticated using (bucket_id = 'inventory');
