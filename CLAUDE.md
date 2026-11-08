# Milo & Miles: notes for working on this repo

- The app ships as one self-contained `index.html`, built from the readable sources in `src/` with `python3 src/build.py`. Edit `src/`, never `index.html` by hand, and commit both together.
- External scripts only from cdnjs. The one exception is Google's own Maps loader (from `maps.googleapis.com`), which is loaded only when a Google key is set, because Google Maps cannot run without it. Fonts come from Google Fonts as a stylesheet.
- `sw.js` and `manifest.webmanifest` are the only other files the app loads.
- Never break old saves or backups. Any change to a saved trip's shape goes through `migrateState()`, and to the library as a whole through `migrateLibrary()`. Storage keys keep their `trip-tracker-*` names on purpose.
- Keep Google costs at zero: Place Details asks only for `location` and `formattedAddress`. Never add `editorialSummary`, ratings or hours.
- No keys or tokens in this repo. The keys listed in `SHARED_KEYS` sync through the private `Trip-Tracker-data` repo; the GitHub token stays on each device and never goes into a sync, an export or a backup.
- Dark mode has one colour scheme (onyx, midnight indigo, tropical mint). In `src/extra.css`, write each dark rule once inside a `/*@dark*/ … /*@end*/` block using `:dark` as the selector; the build writes it out for both "Automatic" and "Dark".
- Must work well on iPad, including touch drag-and-drop.
- Deploying means pushing to `main` (GitHub Pages).
