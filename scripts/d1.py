# -*- coding: utf-8 -*-
"""Cloudflare D1 over its HTTP API, for the Python scripts.

The Node side has the same thing in shared/d1.mjs. This one exists so the
scheduled jobs need no dependency at all: `pip install supabase` was a package
download on every workflow run, and urllib is in the standard library.

Credentials come from the environment, and from .env when running by hand:

    CLOUDFLARE_ACCOUNT_ID
    CLOUDFLARE_D1_DATABASE_ID
    CLOUDFLARE_API_TOKEN

In GitHub Actions they are repository secrets. Nothing here ever prints them.
"""
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.cloudflare.com/client/v4"


def load_env():
    """Fill in anything missing from .env. A real environment variable wins."""
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with io.open(path, encoding="utf-8-sig") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def credentials():
    load_env()
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    database = os.environ.get("CLOUDFLARE_D1_DATABASE_ID")
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    missing = [name for name, value in (
        ("CLOUDFLARE_ACCOUNT_ID", account),
        ("CLOUDFLARE_D1_DATABASE_ID", database),
        ("CLOUDFLARE_API_TOKEN", token),
    ) if not value]
    if missing:
        sys.exit("Missing: %s" % ", ".join(missing))
    return account, database, token


def query(sql, params=None):
    """Run one statement and return its rows.

    Parameters are bound, never interpolated. Raises on refusal, with the
    message but never the statement — a statement can carry a phone number.
    """
    account, database, token = credentials()
    body = {"sql": sql}
    if params:
        body["params"] = list(params)

    request = urllib.request.Request(
        "%s/accounts/%s/d1/database/%s/query" % (API, account, database),
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": "Bearer %s" % token,
                 "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as err:
        try:
            payload = json.loads(err.read().decode("utf-8"))
        except Exception:
            raise SystemExit("D1 HTTP %s" % err.code)

    if not payload.get("success"):
        raise SystemExit("D1 refused: %s" % "; ".join(
            str(e.get("message")) for e in payload.get("errors", [])))

    return payload["result"][0]["results"]


def execute(sql, params=None):
    """Run a statement for its effect. Returns the number of rows changed."""
    account, database, token = credentials()
    body = {"sql": sql}
    if params:
        body["params"] = list(params)

    request = urllib.request.Request(
        "%s/accounts/%s/d1/database/%s/query" % (API, account, database),
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": "Bearer %s" % token,
                 "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as err:
        try:
            payload = json.loads(err.read().decode("utf-8"))
        except Exception:
            raise SystemExit("D1 HTTP %s" % err.code)

    if not payload.get("success"):
        raise SystemExit("D1 refused: %s" % "; ".join(
            str(e.get("message")) for e in payload.get("errors", [])))

    return payload["result"][0].get("meta", {}).get("changes", 0)
