-- HighTide Vintage — the Supabase schema, translated for Cloudflare D1.
--
-- D1 is SQLite. Four things in the Postgres original have no direct equivalent
-- and are handled rather than dropped:
--
--   1. `bigint generated always as identity` -> INTEGER PRIMARY KEY AUTOINCREMENT
--   2. `boolean`      -> INTEGER 0/1. SQLite has no boolean type.
--   3. `timestamptz`  -> TEXT holding ISO-8601 UTC, which sorts correctly as text.
--   4. Row level security -> gone, and replaced rather than lost. See the note
--      above `reservations` below; this is the one change that matters.
--
-- Apply with scripts/d1_setup.py, which sends each statement separately so a
-- failure names the statement that failed.

-- ─────────────────────────────────────────────────────────────
-- Items. One row per garment, identified by (category, num) the
-- same way the photo folders are: boardies/47.jpeg = boardies #47.
-- category stays NULL for items not yet sorted — uploaded, but
-- hidden from the shop until assigned.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  num            INTEGER NOT NULL,
  category       TEXT    CHECK (category IN ('boardies','shirts','accessories','women')),
  name           TEXT    NOT NULL DEFAULT 'HIGHTIDE',
  size           TEXT    NOT NULL DEFAULT 'ONE SIZE',
  price          INTEGER NOT NULL DEFAULT 150,
  -- Fill this in to put an item on sale: the shop shows `price` beside
  -- `original_price` struck through. Leave empty for a normal item.
  original_price INTEGER,
  drop_date      TEXT,
  -- Measured on the garment laid flat. The label size on vintage says little.
  -- Leave them empty and the size block simply does not render.
  waist_cm       INTEGER,
  length_cm      INTEGER,
  -- Filled from PostHog by scripts/sync_top_wanted.py. This orders the
  -- Most Wanted rail on the homepage.
  views          INTEGER NOT NULL DEFAULT 0,
  sold           INTEGER NOT NULL DEFAULT 0 CHECK (sold IN (0,1)),
  sold_at        TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (category, num)
);

-- Photos. position 0 = the main shot, 1+ = extra angles (47a, 47b…).
CREATE TABLE IF NOT EXISTS item_photos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id  INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  path     TEXT    NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE (item_id, path)
);

CREATE INDEX IF NOT EXISTS item_photos_item_id_idx ON item_photos (item_id);

-- Ticking `sold` stamps the date, un-ticking clears it. Postgres did this in
-- one BEFORE trigger; SQLite has no BEFORE-with-assignment, so it is two
-- AFTER triggers guarded by WHEN — same behaviour, and each one only fires on
-- the transition it cares about.
CREATE TRIGGER IF NOT EXISTS items_sold_at_set
AFTER UPDATE OF sold ON items
FOR EACH ROW WHEN NEW.sold = 1 AND OLD.sold = 0
BEGIN
  UPDATE items SET sold_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS items_sold_at_clear
AFTER UPDATE OF sold ON items
FOR EACH ROW WHEN NEW.sold = 0
BEGIN
  UPDATE items SET sold_at = NULL WHERE id = NEW.id;
END;

-- ─────────────────────────────────────────────────────────────
-- Hold requests from the Instagram bot ("שריון").
--
-- In Supabase this table was protected by row level security: anon could
-- INSERT and nothing else, because the anon key ships inside the website and
-- anything anon can read is effectively published. These rows hold customers'
-- phone numbers.
--
-- D1 has no row level security — and does not need it in the same way, because
-- nothing in the browser holds a D1 credential. The database is reachable only
-- through code we write, holding a token that never leaves the server.
--
-- That moves the guarantee from the database to the code, so it has to be
-- stated somewhere it can be checked: NO ENDPOINT MAY SELECT FROM THIS TABLE.
-- The bot writes rows; they are read by the shop's owner, and by nothing that
-- answers a request from the internet.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  -- What the customer typed when asked which piece they want held.
  description    TEXT    NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
  phone          TEXT    NOT NULL CHECK (length(phone) BETWEEN 6 AND 30),
  -- Whoever ManyChat says is on the other end, for matching the conversation.
  instagram_user TEXT,
  -- Filled only when the description is plainly an item number.
  item_num       INTEGER,
  -- new -> contacted -> held -> done / cancelled. Yours to move.
  status         TEXT    NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS reservations_created_at_idx
  ON reservations (created_at DESC);
