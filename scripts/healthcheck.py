# -*- coding: utf-8 -*-
"""Watch the shop's backend, and fail loudly when something is wrong.

Why this exists
---------------
Supabase did not fall over in one go. It ran 56GB through a 5GB allowance,
was restricted, then auto-paused for inactivity, then lost its hostname — and
nobody was told at any step. The shop kept trading on its shipped fallback,
which is exactly what the fallback is for, and that is also why the failure was
invisible for weeks.

So: the automatic part is the fallback, which already works. This is the part
that says so out loud. It runs on a schedule and exits non-zero when a
threshold trips, which makes GitHub send an email.

What it checks
--------------
  1. the shop's own catalogue endpoint answers, with JSON, with a sane count
  2. it answers quickly enough to be used rather than timed out — measured both
     cold and cached, because those are different numbers with different risks
  3. the database is nowhere near its size limit
  4. the row counts are what a shop this size should have
  5. the shipped fallback has not drifted far from the database
  6. usage against the daily limits — only if the token may read analytics

Point 6 is the one that would have caught Supabase early, and it needs
"Account Analytics: Read" on the Cloudflare token. Without it this says so
rather than pretending to have looked. Everything else works either way.

Usage:
  python scripts/healthcheck.py            # report and exit 0/1
  python scripts/healthcheck.py --quiet    # only print problems
"""
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import d1

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOP = "https://hightide-vintage.netlify.app"
CATALOGUE = SHOP + "/api/catalogue"
SNAPSHOT = os.path.join(ROOT, "src", "catalog-snapshot.json")

# Cloudflare's documented free-tier D1 limits at the time of writing. They are
# thresholds to warn at, not guarantees — check the current ones if this ever
# trips, because a limit that moved is not the same as usage that grew.
STORAGE_LIMIT_MB = 5 * 1024      # 5 GB
ROWS_READ_PER_DAY = 5_000_000
ROWS_WRITTEN_PER_DAY = 100_000

# Warn at four fifths. Late enough not to cry wolf, early enough to act — the
# whole complaint about Supabase is that the first warning was the outage.
WARN_AT = 0.80

# What a shop this size looks like. Far outside either bound means something
# has gone wrong in a way row counts alone cannot explain — a bad migration, a
# truncated table, a runaway import.
MIN_ITEMS, MAX_ITEMS = 20, 500

# How slow is too slow. src/catalogue.ts gives up at 5 seconds and drops the
# visitor onto the shipped fallback, so 4 means the margin is nearly gone.
#
# It is deliberately one loose bound rather than a tight one. Each request here
# opens its own TLS connection, and from a cold runner the handshake alone can
# be a second — measured times swing by more than the thing being measured, and
# a threshold tuned to a fast morning would cry wolf on a slow one. Whether the
# edge cache is working is read from the Cache-Status header below, which says
# so directly instead of being guessed at from a stopwatch.
SLOW_SECONDS = 4.0

problems = []
notes = []


def problem(line):
    problems.append(line)


def note(line):
    notes.append(line)


def fetch_catalogue():
    """One request. Returns (seconds, headers, body) or None on failure."""
    started = time.time()
    try:
        request = urllib.request.Request(CATALOGUE, headers={"Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=20) as response:
            return time.time() - started, response.headers, response.read()
    except urllib.error.HTTPError as err:
        problem("catalogue endpoint returned HTTP %s" % err.code)
    except Exception as err:
        problem("catalogue endpoint unreachable: %s" % type(err).__name__)
    return None


def check_endpoint():
    """The shop's own catalogue endpoint — the thing a customer depends on."""
    first = fetch_catalogue()
    if first is None:
        return None
    elapsed, headers, body = first
    content_type = headers.get("Content-Type", "")

    # A 200 that is not JSON means the function did not answer and netlify.toml's
    # catch-all served index.html instead. The shop then falls back silently and
    # looks perfectly fine while ignoring the database.
    if "json" not in content_type:
        problem("catalogue endpoint answered %s, not JSON — the function is not "
                "running and the shop is on its shipped fallback" % (content_type or "nothing"))
        return None

    try:
        rows = json.loads(body)
    except ValueError:
        problem("catalogue endpoint returned something that is not valid JSON")
        return None

    note("catalogue endpoint  %d items in %.2fs" % (len(rows), elapsed))

    # Is the answer being cached at all? Read it from the header rather than
    # timing a second request: a hit and a miss are told apart by what Netlify
    # says, not by a stopwatch that is mostly measuring a TLS handshake.
    #
    # The question is "cached", not "hit". Two requests from here rarely reach
    # the same edge node — this job runs from a GitHub runner — so a second one
    # landing on a fresh node and missing is normal and healthy. What matters is
    # what the node did about it: `hit` served it from cache, `stored` put it in
    # cache. Either means the caching works. `bypass` means it does not, and
    # then every visitor waits on D1.
    second = fetch_catalogue()
    if second is not None:
        # Netlify sends Cache-Status more than once — one line per layer, the
        # durable cache and the edge. .get() would return only the first, which
        # is the layer that always says bypass, so read every one of them.
        status = ", ".join(second[1].get_all("Cache-Status") or [])
        cached = "hit" in status or "stored" in status
        note("edge cache          %s" % ("working" if cached
                                         else "NOT caching — %s" % (status or "no header")))
        if not cached:
            problem("the catalogue is not being cached at the edge, so every "
                    "visitor waits on D1 — check the Cache-Control header in "
                    "netlify/functions/catalogue.mjs")

    if elapsed > SLOW_SECONDS:
        problem("the catalogue took %.1fs and the shop gives up at 5s — the "
                "margin is nearly gone, and past it every visitor silently "
                "gets the fallback" % elapsed)
    if not MIN_ITEMS <= len(rows) <= MAX_ITEMS:
        problem("catalogue has %d items, outside the sane range %d-%d"
                % (len(rows), MIN_ITEMS, MAX_ITEMS))
    return rows


# The tables the shop cannot do without, and what stops working without each.
#
# Checked by name, and the list is deliberately short. On the 8th of October
# the owner removed `reservations` — the Instagram hold flow is not in use —
# and the morning check answered with this, and nothing else:
#
#     D1 refused: no such table: reservations: SQLITE_ERROR
#
# One line of SQLite naming a table the reader has no reason to recognise,
# with no hint of what it was for or whether it mattered; and because
# d1.query raises SystemExit the run stopped there, so the catalogue, the
# cache, the size, the usage and the fallback went unchecked that morning
# too. An alarm that rings this way costs more than it saves — the morning
# went on chasing a fault that was a decision.
#
# So: a table nobody is required to keep is not listed here, and anything
# listed says in words what its absence costs. Add a row when something is
# genuinely load-bearing, not merely present.
NEEDED_TABLES = (
    ("items", "the catalogue itself — the shop would be trading entirely on its shipped copy"),
    ("item_photos", "the garment photographs"),
)


def ask(sql):
    """d1.query, but a refusal is an answer rather than the end of the run.

    d1.query raises SystemExit, which is the right thing for a script that
    does one job and stops. Here it is wrong: this is the alarm, and an alarm
    that stops at the first thing it finds reports one fault and hides the
    rest. SystemExit does not descend from Exception, so it is named.
    """
    try:
        return d1.query(sql)
    except (SystemExit, Exception) as err:  # noqa: B014 - SystemExit is the point
        problem(str(err) or type(err).__name__)
        return None


def check_tables():
    """Is every table the shop depends on actually there?"""
    rows = ask("SELECT name FROM sqlite_master WHERE type = 'table'")
    if rows is None:
        return set()
    present = {row["name"] for row in rows}
    for name, consequence in NEEDED_TABLES:
        if name not in present:
            problem("the `%s` table is MISSING from the database — %s. "
                    "`python scripts/d1_setup.py --schema` puts it back; it only "
                    "creates what is absent and touches nothing that is there."
                    % (name, consequence))
    return present


def check_database():
    """Size and row counts, straight from D1."""
    account, database, token = d1.credentials()
    request = urllib.request.Request(
        "%s/accounts/%s/d1/database/%s" % (d1.API, account, database),
        headers={"Authorization": "Bearer %s" % token},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            info = json.load(response).get("result") or {}
    except Exception as err:
        problem("cannot read the database's own details: %s" % type(err).__name__)
        return

    size_mb = (info.get("file_size") or 0) / (1024 * 1024)
    share = size_mb / STORAGE_LIMIT_MB
    note("database size       %.2f MB of %d MB  (%.3f%%)" % (size_mb, STORAGE_LIMIT_MB, share * 100))
    if share > WARN_AT:
        problem("database is at %.0f%% of its storage limit" % (share * 100))

    present = check_tables()
    if not present:
        return

    # Only the tables that are there. The one query asking for all four at once
    # is what turned a missing `reservations` into a single line of SQLite and
    # nothing else: SQLite answers "no such table" for the whole statement, so
    # the counts that were available went unreported along with it.
    # reservations is counted when it is there and passed over when it is not:
    # it is the owner's to keep or drop, and either way it is not a fault.
    wanted = [("items", "items"), ("photos", "item_photos"), ("reservations", "reservations")]
    parts = ["(SELECT COUNT(*) FROM %s) AS %s" % (table, label)
             for label, table in wanted if table in present]
    if "items" in present:
        parts.append("(SELECT COUNT(*) FROM items WHERE sold = 1) AS sold")
    if not parts:
        return
    counts = ask("SELECT " + ", ".join(parts))
    if counts is None:
        problem("the row counts could not be read")
        return
    counts = counts[0]
    note("rows                " + " | ".join("%s %s" % (name, value)
                                             for name, value in counts.items()))
    if counts.get("items") == 0:
        problem("the items table is EMPTY — the shop is running entirely on its fallback")


def check_usage():
    """Rows read and written today. Needs Account Analytics: Read on the token."""
    account, _, token = d1.credentials()
    query = ("query{viewer{accounts(filter:{accountTag:\"%s\"})"
             "{d1AnalyticsAdaptiveGroups(limit:1,orderBy:[date_DESC]"
             ",filter:{date_geq:\"%s\"})"
             "{sum{rowsRead rowsWritten}dimensions{date}}}}}"
             % (account, time.strftime("%Y-%m-%d")))
    request = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/graphql",
        data=json.dumps({"query": query}).encode("utf-8"),
        headers={"Authorization": "Bearer %s" % token, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except Exception:
        note("usage               not checked (analytics unreadable)")
        return

    if payload.get("errors"):
        # Say what Cloudflare said. The first version of this collapsed every
        # error into "the token may not read analytics", which is a guess — and
        # it read the same whether the permission was missing, the query was
        # malformed, or the dataset had been renamed. A check that reports its
        # own guess instead of the answer sends you looking in the wrong place.
        said = "; ".join(str(e.get("message")) for e in payload["errors"]) or "no message"
        note("usage               NOT CHECKED - Cloudflare said: %s" % said)
        note("                    'not authorized' means the token is missing "
             "'Account Analytics: Read'. Everything above works without it; "
             "this is the check that would have caught Supabase early.")
        return

    groups = []
    for acct in (payload.get("data") or {}).get("viewer", {}).get("accounts") or []:
        groups.extend(acct.get("d1AnalyticsAdaptiveGroups") or [])
    if not groups:
        note("usage               no data reported for today yet")
        return

    total = groups[0]["sum"]
    for label, used, limit in (
        ("rows read", total.get("rowsRead", 0), ROWS_READ_PER_DAY),
        ("rows written", total.get("rowsWritten", 0), ROWS_WRITTEN_PER_DAY),
    ):
        share = used / limit if limit else 0
        note("%-19s %s of %s today  (%.2f%%)" % (label, f"{used:,}", f"{limit:,}", share * 100))
        if share > WARN_AT:
            problem("%s is at %.0f%% of the daily limit — this is how Supabase went "
                    "down, and it went down without warning" % (label, share * 100))


def check_fallback_drift(live):
    """How far the shipped copy has drifted from the database.

    The fallback is what a customer sees the moment the database is
    unreachable. Stale, it shows wrong sizes and offers sold garments.
    """
    if live is None:
        return
    try:
        shipped = json.load(io.open(SNAPSHOT, encoding="utf-8")).get("items", [])
    except Exception:
        problem("the shipped fallback catalogue cannot be read")
        return

    by_num = {row["num"]: row for row in live}
    drift = 0
    for item in shipped:
        row = by_num.get(item["n"])
        if not row:
            drift += 1
            continue
        if (str(row["size"]) != str(item["s"]) or row["price"] != item["p"]
                or bool(row["sold"]) != (item.get("sold") == 1)):
            drift += 1
    missing = len(by_num) - len(shipped)

    note("fallback drift      %d of %d garments differ%s"
         % (drift, len(shipped), (", %d not in it at all" % missing) if missing else ""))
    # The six-hourly job rebuilds it, so a handful is normal between runs.
    if drift > max(5, len(shipped) // 10):
        problem("the shipped fallback is %d garments out of date — if the database "
                "goes down now, customers see stale sizes and sold items" % drift)


def main(argv):
    quiet = "--quiet" in argv
    live = check_endpoint()
    check_database()
    check_usage()
    check_fallback_drift(live)

    if not quiet:
        print("HighTide backend health\n")
        for line in notes:
            print("  " + line)
        print()

    if problems:
        print("PROBLEMS (%d):\n" % len(problems))
        for line in problems:
            print("  ! " + line)
        print("\nThe shop itself keeps trading on its shipped catalogue while this "
              "is true — that is what the fallback is for. It is the database side "
              "that needs attention.")
        return 1

    if not quiet:
        print("all clear.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
