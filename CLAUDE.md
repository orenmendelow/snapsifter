# Photo Culler

Local web app for quickly scrubbing through Fujifilm X100VI photos (HEIF .HIF/.HEIF files) from an external SSD. Rate photos with keyboard shortcuts, filter by rating, then sort later.

## How to run

```
node server.js
```

Opens on port 4000. No arguments needed — the web UI provides a folder browser to select a photo directory at runtime.

## Architecture

- **Backend**: Express server converts HEIF to JPEG on the fly via sharp, caches results in `.cache/` inside the photo directory. Separate cache for full-size (2000px) and thumbnails (300px). EXIF parsed with exifr.
- **Frontend**: Single HTML file with inline CSS/JS. No frameworks. Dark UI with amber accents, monospace metadata, filmstrip navigation.
- **Folder picker**: On startup, shows a directory browser. User navigates to a folder containing .HIF/.HEIF files and clicks Load. Volumes from /Volumes/ shown as quick-jump shortcuts.
- **Ratings**: Stored in `ratings.json` in the photo directory. Written to disk on every change. Keyed by filename stem (e.g. `DSCF6733`).
- **Filter modes**: All / Unrated / Keep / Maybe / Reject. Tab cycles through them. Navigation stays within the filtered subset.
- **Preloading**: Next and previous images preloaded in background for instant scrubbing.
- **Thumbnails**: Lazy-loaded via IntersectionObserver as filmstrip scrolls.
- **Supported extensions**: .HIF and .HEIF (case insensitive).

## API endpoints

- `GET /api/status` — whether a directory is loaded, which one, file count
- `GET /api/browse?dir=/path` — list subdirectories with HEIF counts (default: home dir)
- `GET /api/volumes` — mounted volumes from /Volumes/
- `POST /api/load` `{dir: "/path"}` — set active photo directory
- `GET /api/files` — list of HEIF files (requires loaded dir)
- `GET /api/ratings` — current ratings object
- `POST /api/rate` `{filename, rating}` — rate a file
- `GET /api/image/:filename` — full-size JPEG conversion
- `GET /api/thumb/:filename` — 300px thumbnail
- `GET /api/meta/:filename` — EXIF metadata

## Key shortcuts

1/2/3 = rate (reject/maybe/keep) + auto-advance, 0 = clear, arrows = navigate, Tab = filter, Space = metadata toggle, F = fullscreen, Escape = back to folder picker (when at first photo), ? = help
