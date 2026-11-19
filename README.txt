MTG Card Explorer — Combo Insights + Build Planner

INSTALLATION
1. Back up your current public/app.js and functions/api/combos.js.
2. Replace public/app.js with the app.js in this ZIP.
3. Place combo-worker.js in public/combo-worker.js.
4. Place combos.js in functions/api/combos.js.
5. Deploy the site to Cloudflare Pages.

WHAT CHANGED
- My Collection combo results use a compact, paginated dashboard (12 combos per page).
- Combo details and card images load only when a combo is expanded.
- New “What can I build?” view ranks incomplete combos by the number of missing cards and lists the missing pieces.
- New “Cards in the most owned combos” ranking counts how many fully owned combos each card participates in.
- The ranking section can now be collapsed or expanded.
- Selecting a ranked card opens an inline list of its complete combos; each combo can be expanded to reveal its full details and lazy-loaded images.
- Existing “Ready to play” and “All” combo views remain available.
- Card Explorer retains its collection-aware Ready to play / Missing cards / All filters and Owned/Missing labels.
- The V2 background worker and Cloudflare Pages proxy are retained.

NOTES
- Your ManaBox collection and cached combo results remain local to the browser.
- Existing IndexedDB scan results are not intentionally cleared by this patch.
- The new build-planner views analyze the raw combo results already saved by the background scan; no new network scan is required.
- JavaScript syntax and ZIP integrity checks were run. This patch has not been live-tested against your deployed site or collection.
