# MTG Card Explorer (GitHub Pages)

A responsive, client-side card catalog with search across card names, rules text, flavor text, card type, set, and color. Includes the current 2,392-card Goblin catalog as the initial dataset, but is designed to load other MTG catalogs.

## Features
- Search card name, rules text, flavor text, card type, set, and color
- Filter by set and color; sort by name or set
- Responsive image grid; tap/click a card for full details
- Load another CSV or JSON locally using **Load my catalog** (the file is processed in your browser and is not uploaded)
- Lazy-loads cards into the page for smoother browsing

## Publish to GitHub Pages
1. Create a GitHub repository, for example `mtg-card-explorer`.
2. Upload the contents of this folder to the repository root (so `index.html` is at the root).
3. In GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. Wait for deployment and open the Pages URL shown there.

## Use another catalog
Click **Load my catalog** and select a CSV or JSON file. CSV columns may use the original names `Card Name`, `Card Type`, `Set Name`, `Casting Color`, `Card Text`, `Flavor Text`, `Current Value`, and `Image URL`; a JSON array with equivalent keys is also accepted. The app normalizes either style.

For another permanent catalog, replace `data/goblin-cards.json` with a JSON array using fields `name`, `type`, `set`, `color`, `text`, `flavor`, `value`, and `image`, then commit the file.

## Notes
- Card images in this catalog are loaded from Scryfall URLs and require an internet connection.
- Searching and filtering happen locally in the browser. Uploaded files are not sent to a server.
- This is a static site; no backend or API key is required.
