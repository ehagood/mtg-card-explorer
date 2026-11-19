MTG Card Explorer — Combo Dashboard + Collection-Aware Card Combos

This patch is based on the Background Combo Scanner V2 files.

INSTALLATION
1. Back up your current public/app.js and functions/api/combos.js.
2. Replace public/app.js with the app.js in this ZIP.
3. Place combo-worker.js in public/combo-worker.js.
4. Place combos.js in functions/api/combos.js (rename combos.js to combos.js).
5. Deploy the site to Cloudflare Pages.

WHAT CHANGED
- My Collection combo results now show a compact summary list instead of rendering every full combo at once.
- Only 12 combos are shown per page; use Previous / Next to navigate.
- Each combo expands on demand to show its full details and card links.
- The single-card Explorer Combos tab now has Ready to play, Missing cards, and All filters when a ManaBox collection is imported.
- Required cards are labeled Owned or Missing in that tab.
- The V2 background worker and Cloudflare Pages proxy are retained.

NOTES
- Your ManaBox collection and cached combo results remain local to the browser.
- Existing IndexedDB scan results are not intentionally cleared by this patch.
- JavaScript syntax checks passed for app.js, combo-worker.js, and the Pages Function proxy.
- This patch was not live-tested against your deployed site or your local collection.
