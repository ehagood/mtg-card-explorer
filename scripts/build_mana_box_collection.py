#!/usr/bin/env python3
"""Convert a ManaBox CSV export to an exact-printing MTG Card Explorer collection JSON."""
import csv, json, sys
from pathlib import Path
source=Path(sys.argv[1] if len(sys.argv)>1 else "ManaBox_Collection.csv")
target=Path(sys.argv[2] if len(sys.argv)>2 else "data/my-collection.json")
items={}
with source.open(newline="",encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        sid=(row.get("Scryfall ID") or "").strip()
        name=(row.get("Name") or "").strip()
        if not sid or not name: continue
        try: qty=int(float(row.get("Quantity") or 1))
        except (ValueError,TypeError): qty=1
        item=items.setdefault(sid,{"id":sid,"name":name,"setCode":(row.get("Set code") or "").strip().lower(),"setName":(row.get("Set name") or "").strip(),"collectorNumber":(row.get("Collector number") or "").strip(),"quantity":0,"printings":0})
        item["quantity"]+=qty; item["printings"]+=1
cards=sorted(items.values(),key=lambda x:(x["name"].casefold(),x["setCode"],x["collectorNumber"]))
data={"version":2,"source":"ManaBox CSV export","match_strategy":"exact Scryfall ID / printing","card_names":len({x["name"].casefold() for x in cards}),"unique_printings":len(cards),"total_cards":sum(x["quantity"] for x in cards),"cards":cards}
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
print(f"Wrote {data['card_names']:,} card names / {data['unique_printings']:,} unique printings / {data['total_cards']:,} cards to {target}")
