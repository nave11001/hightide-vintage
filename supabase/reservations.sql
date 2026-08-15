-- Hold requests from the Instagram bot ("שריון").
--
-- Run once in the Supabase SQL Editor. DDL cannot go through PostgREST, so this
-- is the one part of the setup that has to be pasted by hand.
--
-- The important line is the missing one: there is no SELECT policy. The anon
-- key is public — it ships inside the website — so anything anon can read is
-- effectively published. These rows hold customers' phone numbers, so anon may
-- add a row and nothing else. Reading happens in the Supabase dashboard, which
-- authenticates as the owner and bypasses RLS.

create table if not exists public.reservations (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  -- What the customer typed when asked which piece they want held.
  description    text        not null,
  phone          text        not null,
  -- Whoever ManyChat says is on the other end, for matching the conversation.
  instagram_user text,
  -- Filled only when the description is plainly an item number.
  item_num       integer,
  -- new -> contacted -> held -> done / cancelled. Yours to move.
  status         text        not null default 'new'
);

comment on table public.reservations is
  'Hold requests from the Instagram bot. Insert-only for anon; read as owner.';

create index if not exists reservations_created_at_idx
  on public.reservations (created_at desc);

alter table public.reservations enable row level security;

-- Adding a request is allowed. Reading, changing and deleting are not.
drop policy if exists "anon may request a hold" on public.reservations;
create policy "anon may request a hold"
  on public.reservations
  for insert
  to anon
  with check (
    length(description) between 1 and 500
    and length(phone) between 6 and 30
  );
