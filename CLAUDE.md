# Milo & Miles: notes for working on this repo

- Keep the app one self-contained `index.html`. External scripts only from cdnjs. `sw.js` and `manifest.webmanifest` are the only other files.
- Never break old saves or backups. Any change to the saved data shape goes through `migrateState()`. Storage keys keep their `trip-tracker-*` names on purpose.
- Keep Google costs at zero: Place Details asks only for `location` and `formattedAddress`. Never add `editorialSummary`, ratings or hours.
- No keys or tokens in this repo. The Google key syncs through the private `Trip-Tracker-data` repo; the GitHub token stays on each device.
- Must work well on iPad, including touch drag-and-drop.
- Deploying means pushing to `main` (GitHub Pages).
