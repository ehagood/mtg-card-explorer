MTG Card Explorer V20 - Mobile catalog compatibility

Replace these files in your GitHub repository:
  index.html
  app.js
  scripts/update_scryfall_catalog.py

Keep your existing styles.css, icons, site.webmanifest, data/my-collection.json,
and your current GitHub Actions workflow.

Then commit and push. After the new files are published, open GitHub Actions and
run the existing "Update Scryfall Catalog" workflow. The updated updater writes
all-printings data in 5,000-card compressed shards instead of a handful of very
large files. The manifest is written last, so the site will use the new shard list
once the workflow completes.

The website cache version is bumped to v20. After the workflow finishes, reload
the site on the iPhone. The first load will download the smaller shards.

No ManaBox CSV re-export is required. Keep data/my-collection.json as it is.
