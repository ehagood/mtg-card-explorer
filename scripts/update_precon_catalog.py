#!/usr/bin/env python3
"""Build a compact, browser-ready preconstructed-deck catalog from the MTGJSON-derived index."""
from __future__ import annotations

import concurrent.futures
import datetime as dt
import hashlib
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "data"
DATA_PATH = OUT_DIR / "precons.json"
MANIFEST_PATH = OUT_DIR / "precons-manifest.json"
DATASET = "kasper-cbx/mtg-search-index"
CONFIG = "precons"
SPLIT = "train"
PAGE_SIZE = 100
USER_AGENT = "MTG-Card-Explorer-Precon-Updater/1.0 (GitHub Actions)"


def get_json(url: str, attempts: int = 4):
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    last_error = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:  # retry transient upstream/network failures
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Request failed after {attempts} attempts: {url}: {last_error}")


def fetch_page(offset: int):
    query = urllib.parse.urlencode({
        "dataset": DATASET, "config": CONFIG, "split": SPLIT,
        "length": PAGE_SIZE, "offset": offset,
    })
    payload = get_json("https://datasets-server.huggingface.co/rows?" + query)
    rows = payload.get("rows")
    if not isinstance(rows, list):
        raise RuntimeError(f"Unexpected dataset response at offset {offset}: missing rows array")
    return rows


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Reading {DATASET} / {CONFIG} / {SPLIT}…", flush=True)
    first_query = urllib.parse.urlencode({
        "dataset": DATASET, "config": CONFIG, "split": SPLIT,
        "length": PAGE_SIZE, "offset": 0,
    })
    first = get_json("https://datasets-server.huggingface.co/rows?" + first_query)
    first_rows = first.get("rows")
    if not isinstance(first_rows, list):
        raise RuntimeError("The upstream precon dataset did not return a rows array.")
    total = int(first.get("num_rows_total") or first.get("num_rows") or len(first_rows))
    rows = list(first_rows)
    offsets = list(range(PAGE_SIZE, total, PAGE_SIZE))
    print(f"Upstream reports {total:,} rows; fetching {len(offsets)} additional pages…", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetch_page, offset): offset for offset in offsets}
        for future in concurrent.futures.as_completed(futures):
            page = future.result()
            rows.extend(page)
            print(f"  Retrieved {len(rows):,}/{total:,} rows", flush=True)

    # Preserve the row shape consumed by the site's existing normalizePrecon() function.
    normalized_rows = []
    for item in rows:
        row = item.get("row", item) if isinstance(item, dict) else None
        if not isinstance(row, dict):
            continue
        if not row.get("name") or not isinstance(row.get("cards"), list) or not row["cards"]:
            continue
        normalized_rows.append(row)
    if not normalized_rows:
        raise RuntimeError("No usable preconstructed deck records were returned; refusing to replace the existing catalog.")

    normalized_rows.sort(key=lambda d: (str(d.get("name", "")).casefold(), str(d.get("file", ""))))
    data_bytes = (json.dumps(normalized_rows, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    digest = hashlib.sha256(data_bytes).hexdigest()
    previous = {}
    if MANIFEST_PATH.exists():
        try:
            previous = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception:
            previous = {}

    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    changed = digest != previous.get("sha256") or not DATA_PATH.exists()
    if changed:
        DATA_PATH.write_bytes(data_bytes)
        generated_at = now
        print(f"Catalog changed: wrote {len(normalized_rows):,} decks ({len(data_bytes):,} bytes).", flush=True)
    else:
        generated_at = previous.get("updated_at") or now
        print("Catalog content unchanged; keeping existing data file and version.", flush=True)

    manifest = {
        "status": "ready",
        "source": "MTGJSON-derived preconstructed deck index (kasper-cbx/mtg-search-index)",
        "dataset": DATASET,
        "config": CONFIG,
        "split": SPLIT,
        "updated_at": generated_at,
        "deck_count": len(normalized_rows),
        "data_file": "data/precons.json",
        "sha256": digest,
        "notes": "Compact preconstructed deck records used by MTG Card Explorer. The upstream index is derived from MTGJSON AllDeckFiles; only records containing usable decklists are retained.",
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Manifest updated. Version: {digest[:12]}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
