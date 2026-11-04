V22 iPhone icon metadata fix

Replace only index.html in the root of your GitHub Pages repository. Keep mtg-home-icon-v21.png in the repository root (the image URL is explicitly referenced by the HTML). The 32x32 browser favicon is embedded directly in index.html as a data URI. Commit and push, then remove the old iPhone home-screen shortcut and add it again from Safari. No catalog, JavaScript, CSS, collection, or workflow changes are included.
