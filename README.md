# Milo & Miles

A personal travel planner: a world map of where you've been, and for each trip an overview, a day-by-day itinerary with a live map, and a budget. Formerly Trip Tracker.

Live: https://vibe-coder-milo.github.io/milo-and-miles/

## Files

- `index.html` is the whole app (HTML, CSS and JavaScript in one file; Leaflet comes from cdnjs).
- `sw.js` lets the app open without internet once it has been opened online.
- `manifest.webmanifest` lets you add it to the iPad home screen.

## Where trips are saved

- In the browser on each device. Trip Tracker used the same storage on the same site, so its trips show up here.
- Optionally in the **private** repo `Trip-Tracker-data`, so every device matches (Settings, Sync). Each device keeps its own GitHub token, and no token is ever in this repo or a backup file.
- The Google Maps key lives in the private data repo, never here. Restrict it to `vibe-coder-milo.github.io` in Google Cloud.
