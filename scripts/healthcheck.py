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

    # The first request has just filled the edge cache, so a second one should
    # be served from it. This reads the header rather than timing the request:
    # a hit and a miss are told apart by what Netlify says, not by a stopwatch
    # that is mostly measuring a TLS handshake.
    second = fetch_catalogue()
    if second is not None:
        # Netlify sends Cache-Status more than once — one line per layer, the
        # durable cache and the edge. .get() would return only the first, which
        # is the layer that always says bypass, so read every one of them.
        status = ", ".join(second[1].get_all("Cache-Status") or [])
        note("edge cache          %s" % ("serving hits" if "hit" in status
                                         else "NOT serving hits — %s" % (status or "no header")))
        if "hit" not in status:
            # Not an alarm on its own: a second request can land on a different
            # edge node, or on the far side of the 30s TTL. Worth seeing, and
            # worth checking if it says this every morning.
            note("                    (every visitor then waits on D1 — check "
                 "the Cache-Control header on netlify/functions/catalogue.mjs "
                 "if this persists)")

    if elapsed > SLOW_SECONDS:
        problem("the catalogue took %.1fs and the shop gives up at 5s — the "
                "margin is nearly gone, and past it every visitor silently "
                "gets the fallback" % elapsed)
    if not MIN_ITEMS <= len(rows) <= MAX_ITEMS:
        problem("catalogue has %d items, outside the sane range %d-%d"
                % (len(rows), MIN_ITEMS, MAX_ITEMS))
    return rows


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

    counts = d1.query(
        "SELECT (SELECT COUNT(*) FROM items) AS items,"
        " (SELECT COUNT(*) FROM item_photos) AS photos,"
        " (SELECT COUNT(*) FROM reservations) AS reservations,"
        " (SELECT COUNT(*) FROM items WHERE sold = 1) AS sold"
    )[0]
    note("rows                items %(items)s | photos %(photos)s | sold %(sold)s "
         "| reservations %(reservations)s" % counts)
    if counts["items"] == 0:
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
        note("usage               NOT CHECKED - the token may not read analytics. "
             "Add 'Account Analytics: Read' to it to enable this, or leave it off "
             "and rely on the checks above.")
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
