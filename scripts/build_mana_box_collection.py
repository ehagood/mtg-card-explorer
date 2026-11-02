#!/usr/bin/env python3
"""Convert a ManaBox collection CSV to the compact MTG Card Explorer collection JSON."""
import csv, json, sys
from collections import defaultdict
from pathlib import Path
source=Path(sys.argv[1] if len(sys.argv)>1 else "ManaBox_Collection.csv")
target=Path(sys.argv[2] if len(sys.argv)>2 else "data/my-collection.json")
items={}
with source.open(newline="",encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        name=(row.get("Name") or "").strip()
        if not name: continue
        key=" ".join(name.casefold().split())
        try: qty=int(float(row.get("Quantity") or 1))
        except ValueError: qty=1
        if key not in items: items[key]={"name":name,"quantity":0,"printings":0}
        items[key]["quantity"]+=qty; items[key]["printings"]+=1
cards=sorted(items.values(),key=lambda x:x["name"].casefold())
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps({"version":1,"source":"ManaBox CSV export","card_names":len(cards),"total_cards":sum(x["quantity"] for x in cards),"cards":cards},ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
print(f"Wrote {len(cards):,} card names / {sum(x['quantity'] for x in cards):,} cards to {target}")
