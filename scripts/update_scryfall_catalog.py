#!/usr/bin/env python3
"""Download Scryfall default-card bulk data and build compressed site shards.

Uses only Python's standard library. The output is optimized for browser search,
not a mirror of every field in Scryfall's raw bulk file.
"""
import datetime as dt
import gzip
import io
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "scryfall"
BULK_URL = "https://api.scryfall.com/bulk-data"
USER_AGENT = "MTG-Card-Explorer-GitHub-Action/2.0 (bulk data updater)"
HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/json;q=0.9,*/*;q=0.8"}
BUCKETS = [
    ("A-C", set("abc")), ("D-F", set("def")), ("G-I", set("ghi")),
    ("J-L", set("jkl")), ("M-O", set("mno")), ("P-R", set("pqr")),
    ("S-U", set("stu")), ("V-Z", set("vwxyz")), ("0-9", set("0123456789")),
    ("other", set()),
]

def get_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=180) as response:
        return json.loads(response.read().decode("utf-8"))

def bucket_for(name):
    first = (name or "").lstrip().casefold()[:1]
    for bucket, chars in BUCKETS:
        if first in chars:
            return bucket
    return "other"

def first_image(card):
    image_uris = card.get("image_uris") or {}
    if not image_uris:
        faces = card.get("card_faces") or []
        if faces:
            image_uris = faces[0].get("image_uris") or {}
    return image_uris.get("normal") or image_uris.get("small") or image_uris.get("large") or ""

def combined_face_field(card, key):
    direct = card.get(key)
    if direct:
        return direct
    faces = card.get("card_faces") or []
    values = [face.get(key, "").strip() for face in faces if face.get(key, "").strip()]
    return "\n//\n".join(values)

def simplify(card):
    return {
        "id": card.get("id", ""),
        "oracle_id": card.get("oracle_id", ""),
        "name": card.get("name", ""),
        "set": card.get("set", ""),
        "set_name": card.get("set_name", ""),
        "collector_number": str(card.get("collector_number", "")),
        "type_line": combined_face_field(card, "type_line"),
        "oracle_text": combined_face_field(card, "oracle_text"),
        "flavor_text": combined_face_field(card, "flavor_text"),
        "colors": card.get("colors") or [],
        "color_identity": card.get("color_identity") or [],
        "mana_cost": card.get("mana_cost") or ((card.get("card_faces") or [{}])[0].get("mana_cost", "")),
        "cmc": card.get("cmc", 0),
        "rarity": card.get("rarity", ""),
        "image_url": first_image(card),
        "layout": card.get("layout", ""),
    }

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print("Checking Scryfall bulk-data metadata…", flush=True)
    metadata = get_json(BULK_URL)
    bulk = next((item for item in metadata.get("data", []) if item.get("type") == "default_cards"), None)
    if not bulk or not bulk.get("download_uri"):
        raise RuntimeError("Scryfall did not return a default_cards download URI.")
    print("Downloading default card catalog (not every duplicate printing)…", flush=True)
    cards = get_json(bulk["download_uri"])
    if not isinstance(cards, list) or not cards:
        raise RuntimeError("Scryfall bulk file was empty or had an unexpected format.")
    groups = {name: [] for name, _ in BUCKETS}
    for card in cards:
        if not card.get("name"):
            continue
        groups[bucket_for(card["name"])].append(simplify(card))
    shards = []
    total_bytes = 0
    for name, _ in BUCKETS:
        items = groups[name]
        if not items:
            continue
        items.sort(key=lambda c: (c["name"].casefold(), c["set_name"].casefold(), c["collector_number"]))
        filename = "cards-" + name.replace("-", "_") + ".json.gz"
        target = OUT / filename
        raw = json.dumps(items, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        with target.open("wb") as raw_file:
            with gzip.GzipFile(fileobj=raw_file, mode="wb", filename="", mtime=0, compresslevel=7) as gz:
                gz.write(raw)
        size = target.stat().st_size
        total_bytes += size
        shards.append({"file": filename, "bucket": name, "count": len(items), "bytes": size})
        print(f"  {filename}: {len(items):,} cards, {size / 1024 / 1024:.2f} MiB compressed", flush=True)
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    manifest = {
        "status": "ready",
        "source": "Scryfall default_cards bulk data",
        "updated_at": now,
        "scryfall_updated_at": bulk.get("updated_at", ""),
        "card_count": sum(len(v) for v in groups.values()),
        "compressed_bytes": total_bytes,
        "shards": shards,
        "notes": "Default card dataset provides a representative English card entry, not every set printing. Card images are hosted by Scryfall.",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Done: {manifest['card_count']:,} cards across {len(shards)} shards; {total_bytes / 1024 / 1024:.2f} MiB compressed.", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
