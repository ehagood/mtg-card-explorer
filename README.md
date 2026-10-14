# MTG Card Explorer — Version 2 starter

A responsive GitHub Pages card explorer with the existing 2,392-card Goblin catalog and an optional wider Scryfall search catalog. Search card name, rules text, flavor text, card type, set, color, rarity, and collector number. Click a card for full details.

## What is new in V2

- Keeps the existing Goblin catalog and responsive card-grid UI.
- Adds a catalog selector: **My Goblin catalog**, **All Scryfall cards**, or **Both catalogs**.
- Adds an **Update card catalog** button that opens this repository's GitHub Actions workflow. No GitHub token is placed in the public website.
- GitHub Actions downloads Scryfall's `default_cards` bulk dataset, trims it to search/display fields, splits it into small compressed shards, and commits the shards plus a manifest.
- The workflow can be run manually and also refreshes weekly (Sunday 09:20 UTC).
- The first Scryfall search loads compressed data shards in the browser and caches them according to normal browser cache rules.

## Publish/update this project

1. Extract this ZIP. Upload the **contents** of this folder into the root of your GitHub repository. Keep the `.github/workflows/update-scryfall-catalog.yml` file and the `scripts` folder; GitHub's web uploader can sometimes make hidden `.github` folders awkward, so GitHub Desktop or `git` is recommended.
2. In repository **Settings → Actions → General**, ensure workflow permissions allow the workflow to write to the repository. The workflow declares `contents: write`; organization policies may override it.
3. In **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/(root)`.
4. Go to **Actions → Update Scryfall Catalog → Run workflow** for the first download. Wait for the job to complete successfully. It commits generated shards into `data/scryfall/`.
5. Open/reload the Pages site and choose **All Scryfall cards**. The website button opens the same workflow; on GitHub, click **Run workflow** to start the update.

### Why the website button opens GitHub Actions

A public static GitHub Pages site cannot securely write to your repository on its own. Doing so would require exposing a write token in browser code. Instead, the button opens the authenticated GitHub Actions page, where you can trigger the updater safely.

## Important Scryfall dataset distinction

This starter uses Scryfall's `default_cards` bulk dataset: a representative English card entry rather than every separate printing of every card. It includes the card's text, flavor text, type, colors, mana cost, image, and an example set/collector number. If you later want every printing, we can switch to `all_cards`, but that catalog is much larger and will need a more careful storage/search strategy. Card images remain hosted on Scryfall.

## Search behavior

The Goblin catalog is loaded immediately. Selecting **All Scryfall cards** or **Both catalogs** loads the compressed Scryfall shards. A modern browser with `DecompressionStream` support is required (current Chrome, Edge, Firefox, and Safari). The first load takes longer than later loads. The current page loads all Scryfall shards for broad text search; a future optimization could add a search index so it downloads only matching records.

## Files

- `index.html`, `styles.css`, `app.js`: site UI and search.
- `data/goblin-cards.json`: current 2,392-card catalog.
- `data/scryfall/manifest.json`: status and shard list; initially says not generated.
- `scripts/update_scryfall_catalog.py`: standard-library Python updater.
- `.github/workflows/update-scryfall-catalog.yml`: manual and scheduled GitHub Actions workflow.

## Scryfall usage

This project downloads bulk data rather than querying the API for each search. It identifies itself with `User-Agent` and `Accept` headers. Please respect Scryfall's API/bulk-data policies and terms.
