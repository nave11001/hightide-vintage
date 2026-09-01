# -*- coding: utf-8 -*-
"""Create the Cloudflare D1 database, apply the schema, and load the catalogue.

Supabase auto-paused the project after seven days of inactivity, and it cannot
be restored while the organisation is under service restrictions. The catalogue
and the photos survived locally; this rebuilds the database somewhere that will
not pause, from src/catalog-snapshot.json.

Reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from .env. Neither is ever
printed — the token is a credential and this script is quoted in chat logs.

Safe to re-run: the schema is CREATE ... IF NOT EXISTS, and the load uses
INSERT OR REPLACE keyed on (category, num), so a second run updates rather than
duplicates.

Usage:
  python scripts/d1_setup.py --check          # token, account, existing databases
  python scripts/d1_setup.py --create         # create the database
  python scripts/d1_setup.py --schema         # apply cloudflare/schema.sql
  python scripts/d1_setup.py --load           # load the catalogue snapshot
  python scripts/d1_setup.py --verify         # count what actually landed
  python scripts/d1_setup.py --all            # create, schema, load, verify
"""
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_NAME = "hightide"
API = "https://api.cloudflare.com/client/v4"


def env(name):
    """Read one value out of .env without importing a dependency."""
    path = os.path.join(ROOT, ".env")
    with io.open(path, encoding="utf-8-sig") as fh:
        for line in fh:
            match = re.match(r"^%s=(.*)$" % re.escape(name), line.strip())
            if match:
                return match.group(1).strip().strip('"').strip("'")
    sys.exit("%s is not set in .env" % name)


TOKEN = env("CLOUDFLARE_API_TOKEN")
ACCOUNT = env("CLOUDFLARE_ACCOUNT_ID")


def call(method, path, body=None):
    url = "%s%s" % (API, path)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer %s" % TOKEN)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        try:
            return json.loads(err.read().decode("utf-8"))
        except Exception:
            sys.exit("HTTP %s from %s" % (err.code, path))


def must(result, what):
    if not result.get("success"):
        msgs = "; ".join(str(e.get("message")) for e in result.get("errors", []))
        sys.exit("%s failed: %s" % (what, msgs or result))
    return result.get("result")


def find_database():
    result = must(call("GET", "/accounts/%s/d1/database" % ACCOUNT), "listing databases")
    for db in result or []:
        if db.get("name") == DB_NAME:
            return db.get("uuid") or db.get("id")
    return None


def query(db_id, sql, params=None):
    body = {"sql": sql}
    if params:
        body["params"] = params
    return call("POST", "/accounts/%s/d1/database/%s/query" % (ACCOUNT, db_id), body)


def statements(text):
    """Split the schema on semicolons, keeping CREATE TRIGGER bodies whole.

    A trigger contains its own semicolons between BEGIN and END, so a plain
    split on ';' would cut one in half and D1 would be handed nonsense.
    """
    out, buf, in_trigger = [], [], False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("--") or not stripped:
            continue
        if re.match(r"(?i)^create\s+trigger", stripped):
            in_trigger = True
        buf.append(line)
        if in_trigger:
            if re.match(r"(?i)^end\s*;", stripped):
                out.append("\n".join(buf).rstrip().rstrip(";"))
                buf, in_trigger = [], False
        elif stripped.endswith(";"):
            out.append("\n".join(buf).rstrip().rstrip(";"))
            buf = []
    if buf:
        out.append("\n".join(buf).rstrip().rstrip(";"))
    return [s for s in out if s.strip()]


def cmd_check():
    result = call("GET", "/accounts/%s/d1/database" % ACCOUNT)
    ok = result.get("success")
    print("account id length: %d (not shown)" % len(ACCOUNT))
    print("token reaches D1: %s" % ok)
    if not ok:
        print("errors:", [e.get("message") for e in result.get("errors", [])])
        return 1
    names = [db.get("name") for db in result.get("result") or []]
    print("existing databases: %s" % (names or "none"))
    return 0


def cmd_create():
    existing = find_database()
    if existing:
        print("database '%s' already exists" % DB_NAME)
        return 0
    result = must(
        call("POST", "/accounts/%s/d1/database" % ACCOUNT, {"name": DB_NAME}),
        "creating the database",
    )
    print("created '%s'" % DB_NAME)
    print("uuid length: %d (not shown)" % len(result.get("uuid") or result.get("id") or ""))
    return 0


def cmd_schema():
    db_id = find_database()
    if not db_id:
        sys.exit("no database named '%s' — run --create first" % DB_NAME)
    text = io.open(os.path.join(ROOT, "cloudflare", "schema.sql"), encoding="utf-8").read()
    for i, sql in enumerate(statements(text), 1):
        head = " ".join(sql.split())[:64]
        result = query(db_id, sql)
        if not result.get("success"):
            msgs = "; ".join(str(e.get("message")) for e in result.get("errors", []))
            sys.exit("statement %d failed (%s): %s" % (i, head, msgs))
        print("ok  %s" % head)
    print("\nschema applied.")
    return 0


def cmd_load():
    db_id = find_database()
    if not db_id:
        sys.exit("no database named '%s' — run --create first" % DB_NAME)

    snapshot = json.load(io.open(os.path.join(ROOT, "src", "catalog-snapshot.json"), encoding="utf-8"))
    items = snapshot.get("items", [])
    print("loading %d items from the snapshot" % len(items))

    loaded_items = 0
    loaded_photos = 0
    for row in items:
        result = query(
            db_id,
            "INSERT INTO items (num, category, name, size, price, original_price, "
            "waist_cm, length_cm, views, sold) VALUES (?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT (category, num) DO UPDATE SET "
            "name=excluded.name, size=excluded.size, price=excluded.price, "
            "original_price=excluded.original_price, waist_cm=excluded.waist_cm, "
            "length_cm=excluded.length_cm, views=excluded.views, sold=excluded.sold",
            [
                row["n"], row["c"], row["b"], row["s"], row["p"],
                row.get("o"), row.get("w"), row.get("l"),
                row.get("v", 0), 1 if row.get("sold") == 1 else 0,
            ],
        )
        if not result.get("success"):
            msgs = "; ".join(str(e.get("message")) for e in result.get("errors", []))
            sys.exit("item #%s failed: %s" % (row["n"], msgs))
        loaded_items += 1

        for position, path in enumerate(row.get("ph", [])):
            photo = query(
                db_id,
                "INSERT INTO item_photos (item_id, path, position) "
                "SELECT id, ?, ? FROM items WHERE category = ? AND num = ? "
                "ON CONFLICT (item_id, path) DO UPDATE SET position = excluded.position",
                [path, position, row["c"], row["n"]],
            )
            if not photo.get("success"):
                msgs = "; ".join(str(e.get("message")) for e in photo.get("errors", []))
                sys.exit("photo %s failed: %s" % (path, msgs))
            loaded_photos += 1

    print("%d items, %d photos" % (loaded_items, loaded_photos))
    return 0


def cmd_verify():
    db_id = find_database()
    if not db_id:
        sys.exit("no database named '%s'" % DB_NAME)
    checks = [
        ("items", "SELECT COUNT(*) AS n FROM items"),
        ("  of them sold", "SELECT COUNT(*) AS n FROM items WHERE sold = 1"),
        ("  with a sale price", "SELECT COUNT(*) AS n FROM items WHERE original_price IS NOT NULL"),
        ("photos", "SELECT COUNT(*) AS n FROM item_photos"),
        ("reservations", "SELECT COUNT(*) AS n FROM reservations"),
        ("distinct categories", "SELECT COUNT(DISTINCT category) AS n FROM items"),
    ]
    for label, sql in checks:
        result = query(db_id, sql)
        if not result.get("success"):
            print("%-22s ERROR" % label)
            continue
        rows = (result.get("result") or [{}])[0].get("results") or [{}]
        print("%-22s %s" % (label, rows[0].get("n")))

    # The trigger is the one piece of behaviour that had to be rewritten, so it
    # is worth proving rather than assuming — but on a row of its own. An
    # earlier version of this check flipped whichever garment happened to have
    # the lowest number, and left one that was genuinely sold showing as in
    # stock. A verification step must not be able to change what it verifies.
    query(db_id, "DELETE FROM items WHERE num = -1")
    query(db_id, "INSERT INTO items (num, category, name) VALUES (-1, 'boardies', 'TRIGGER TEST')")
    query(db_id, "UPDATE items SET sold = 1 WHERE num = -1")
    res = query(db_id, "SELECT sold_at FROM items WHERE num = -1")
    stamped = bool((((res.get("result") or [{}])[0].get("results") or [{}])[0]).get("sold_at"))
    query(db_id, "UPDATE items SET sold = 0 WHERE num = -1")
    res = query(db_id, "SELECT sold_at FROM items WHERE num = -1")
    cleared = (((res.get("result") or [{}])[0].get("results") or [{}])[0]).get("sold_at") is None
    query(db_id, "DELETE FROM items WHERE num = -1")
    left = query(db_id, "SELECT COUNT(*) AS n FROM items WHERE num = -1")
    gone = (((left.get("result") or [{}])[0].get("results") or [{}])[0]).get("n") == 0
    print("%-22s stamps=%s clears=%s (test row removed: %s)"
          % ("sold_at trigger", stamped, cleared, gone))
    return 0


COMMANDS = {
    "--check": cmd_check,
    "--create": cmd_create,
    "--schema": cmd_schema,
    "--load": cmd_load,
    "--verify": cmd_verify,
}


def main(argv):
    if not argv:
        sys.exit(__doc__)
    if "--all" in argv:
        for step in (cmd_create, cmd_schema, cmd_load, cmd_verify):
            print("\n=== %s ===" % step.__name__)
            code = step()
            if code:
                return code
        return 0
    for arg in argv:
        fn = COMMANDS.get(arg)
        if not fn:
            sys.exit("unknown option: %s" % arg)
        code = fn()
        if code:
            return code
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
