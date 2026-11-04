V21 iPhone Home Screen Icon Fix

Upload these three files to the ROOT of your existing GitHub Pages repository, replacing index.html and site.webmanifest if present:
- index.html
- site.webmanifest
- mtg-home-icon-v21.png

Keep app.js, styles.css, your Scryfall data, and ManaBox collection unchanged. Commit and push. Then remove the old MTG Explorer home-screen shortcut from the iPhone, open the site in Safari, refresh, and use Share > Add to Home Screen. The new icon has a unique filename and the HTML uses an absolute GitHub Pages URL to avoid relative-path and stale-icon caching issues.
