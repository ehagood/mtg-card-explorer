#!/usr/bin/env python3
"""Download Scryfall bulk card data and build compressed browser-search shards."""
import datetime as dt
import gzip
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "scryfall"
BULK_URL = "https://api.scryfall.com/bulk-data"
USER_AGENT = "MTG-Card-Explorer-GitHub-Action/2.1 (bulk data updater)"
HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/json;q=0.9,*/*;q=0.8"}
BUCKETS = [
    ("A-C", set("abc")), ("D-F", set("def")), ("G-I", set("ghi")),
    ("J-L", set("jkl")), ("M-O", set("mno")), ("P-R", set("pqr")),
    ("S-U", set("stu")), ("V-Z", set("vwxyz")), ("0-9", set("0123456789")),
    ("other", set()),
]

def request(url):
    return urllib.request.Request(url, headers=HEADERS)

def get_json(url):
    with urllib.request.urlopen(request(url), timeout=180) as response:
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
        "id": card.get("id", ""), "oracle_id": card.get("oracle_id", ""),
        "name": card.get("name", ""), "set": card.get("set", ""),
        "set_name": card.get("set_name", ""),
        "collector_number": str(card.get("collector_number", "")),
        "type_line": combined_face_field(card, "type_line"),
        "oracle_text": combined_face_field(card, "oracle_text"),
        "flavor_text": combined_face_field(card, "flavor_text"),
        "colors": card.get("colors") or [], "color_identity": card.get("color_identity") or [],
        "mana_cost": card.get("mana_cost") or ((card.get("card_faces") or [{}])[0].get("mana_cost", "")),
        "cmc": card.get("cmc", 0), "rarity": card.get("rarity", ""),
        "image_url": first_image(card), "layout": card.get("layout", ""),
    }

def iter_cards(url, is_jsonl):
    """Stream newer .jsonl.gz exports; support older JSON-array exports too."""
    with urllib.request.urlopen(request(url), timeout=300) as response:
        if is_jsonl or url.lower().endswith((".jsonl.gz", ".ndjson.gz")):
            stream = gzip.GzipFile(fileobj=response) if url.lower().endswith(".gz") else response
            for line in stream:
                line = line.strip()
                if not line or line in (b"[", b"]", b"[,"):
                    continue
                if line.endswith(b","):
                    line = line[:-1]
                try:
                    item = json.loads(line.decode("utf-8"))
                except json.JSONDecodeError:
                    # Some exports wrap objects in a JSON array, so ignore only wrapper lines.
                    if line in (b"{", b"}"):
                        continue
                    raise
                if isinstance(item, dict):
                    yield item
        else:
            # Legacy bulk files are a JSON array rather than JSON Lines.
            data = json.loads(response.read().decode("utf-8"))
            if not isinstance(data, list):
                raise RuntimeError("Scryfall bulk file was not a JSON array or JSON Lines file.")
            yield from data

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print("Checking Scryfall bulk-data metadata…", flush=True)
    metadata = get_json(BULK_URL)
    entries = metadata.get("data", []) if isinstance(metadata, dict) else []
    bulk = next((item for item in entries if item.get("type") == "default_cards"), None)
    if not bulk:
        details = metadata.get("details") or metadata.get("message") or metadata.get("object") if isinstance(metadata, dict) else type(metadata).__name__
        raise RuntimeError(f"Could not find default_cards in Scryfall metadata. Response detail: {details!r}")
    # Newer Scryfall exports may expose JSON Lines separately from the legacy download_uri.
    download_url = bulk.get("jsonl_download_uri") or bulk.get("download_uri")
    if not download_url:
        raise RuntimeError("Scryfall returned default_cards metadata but no jsonl_download_uri or download_uri. Available fields: " + ", ".join(sorted(bulk.keys())))
    is_jsonl = bool(bulk.get("jsonl_download_uri"))
    print(f"Downloading default card catalog ({'JSON Lines' if is_jsonl else 'legacy JSON'} format; not every duplicate printing)…", flush=True)
    groups = {name: [] for name, _ in BUCKETS}
    count = 0
    for card in iter_cards(download_url, is_jsonl):
        if not card.get("name"):
            continue
        groups[bucket_for(card["name"])].append(simplify(card))
        count += 1
        if count % 100000 == 0:
            print(f"  Processed {count:,} cards…", flush=True)
    if not count:
        raise RuntimeError("Scryfall bulk file contained no card records.")
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
        "status": "ready", "source": "Scryfall default_cards bulk data", "updated_at": now,
        "scryfall_updated_at": bulk.get("updated_at", ""), "card_count": count,
        "compressed_bytes": total_bytes, "shards": shards,
        "notes": "Default card dataset provides a representative card entry, not every set printing. Card images are hosted by Scryfall.",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Done: {count:,} cards across {len(shards)} shards; {total_bytes / 1024 / 1024:.2f} MiB compressed.", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
