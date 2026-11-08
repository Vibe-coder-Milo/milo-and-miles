# Milo & Miles: notes for working on this repo

- The app ships as one self-contained `index.html`, built from the readable sources in `src/` with `python3 src/build.py`. Edit `src/`, never `index.html` by hand, and commit both together.
- External scripts only from cdnjs. The one exception is Google's own Maps loader (from `maps.googleapis.com`), which is loaded only when a Google key is set, because Google Maps cannot run without it. Fonts come from Google Fonts as a stylesheet.
- `sw.js` and `manifest.webmanifest` are the only other files the app loads.
- Never break old saves or backups. Any change to a saved trip's shape goes through `migrateState()`, and to the library as a whole through `migrateLibrary()`. Storage keys keep their `trip-tracker-*` names on purpose.
- Keep Google costs at zero: Place Details asks only for `location` and `formattedAddress`. Never add `editorialSummary`, ratings or hours.
- No keys or tokens in this repo. The keys listed in `SHARED_KEYS` sync through the private `Trip-Tracker-data` repo; the GitHub token stays on each device and never goes into a sync, an export or a backup.
- Dark mode has one colour scheme (onyx, midnight indigo, tropical mint). In `src/extra.css`, write each dark rule once inside a `/*@dark*/ … /*@end*/` block using `:dark` as the selector; the build writes it out for both "Automatic" and "Dark".
- Security, because trips arrive from backup files and from sync:
  - `migrateState()` / `migrateLibrary()` check every field's kind (ids, currencies, dates, times, numbers, shared keys). Keep doing that for any new field.
  - Every value put into HTML goes through `esc()`, ids and numbers included. Never use inline `on…=` handlers or `javascript:` links: the Content Security Policy blocks them.
  - The policy is written by `src/build.py`, with a hash of the app's script. A new outside service must be added to it there.
  - The lock (`trip-tracker-vault-v1`, offered on a device's first open): a login screen before the app. When on, the whole library and the GitHub token are stored only inside the encrypted vault; `saveNow()` writes nothing plain and `saveSync()` blanks the token. A passcode and, optionally, a passkey (WebAuthn PRF) each unlock the vault key. Keep any new data or secret inside the vault.
  - Cost guard: `nearCap()` switches a Google service to the free one at 90% of its monthly free allowance. Any new Google call goes through `trackApiCall()` and a `nearCap()` check.
  - Saved keys are never put back into the page in full (only "ends in …"). The token only ever goes to `api.github.com`.
- Must work well on iPad, including touch drag-and-drop.
- Deploying means pushing to `main` (GitHub Pages).
