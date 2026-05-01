# SnapSifter

Local web app for quickly scrubbing through photos (HEIF/HIF and JPG/JPEG) from an external SSD. Rate photos with keyboard shortcuts, filter by rating, then sort into folders by rating and filetype.

## How to run

```
node server.js
```

Opens on port 4000. No arguments needed — the web UI provides a folder browser to select a photo directory at runtime. Auto-resumes the last loaded directory on startup (state saved to `~/.snapsifter/sessions.json`).

## Architecture

- **Backend**: Express server converts HEIF to JPEG on the fly via sips, caches results in `.cache/` inside the photo directory. JPG/JPEG files served directly (no conversion). Separate cache for full-size (2000px) and thumbnails (300px). EXIF parsed with exifr (full parse, not filtered).
- **Frontend**: Single HTML file with inline CSS/JS. No frameworks. Dark aesthetic — deep black background, warm amber accent, high-contrast white text.
- **Folder picker**: On startup, shows a directory browser. User navigates to a folder containing photos and clicks Load. Volumes from /Volumes/ shown as quick-jump shortcuts. System directories (Library, Applications, node_modules, etc.) filtered from browse.
- **Ratings**: Stored in `ratings.json` in the photo directory. Written to disk on every change. Keyed by filename stem (e.g. `DSCF6733`).
- **Rating values**: 1 = ditch, 2 = maybe, 3 = like. Backend stores numbers only.
- **Filter modes**: All / Unrated / Like / Ditch / Maybe. Tab cycles through them. Navigation stays within the filtered subset. Filmstrip reflects current filter.
- **Preloading**: Next and previous images preloaded in background for instant scrubbing.
- **Thumbnails**: Lazy-loaded via IntersectionObserver as filmstrip scrolls.
- **Supported extensions**: .HIF, .HEIF, .JPG, .JPEG (all case insensitive). RAF and other RAW files are carried along during sort (matched by filename stem) but not displayed.
- **Zoom**: Click to zoom in (3x max), click again to zoom out. Mouse position controls pan via transform-origin (no translate). Moving mouse across viewport maps to moving across zoomed image.
- **Sort**: Moves rated files into `Liked/`, `Maybe/`, `Ditch/` subfolders, each with filetype subfolders (`HIF/`, `JPG/`, `RAF/`). All files sharing a stem are moved together (RAW+JPG pairs). Unsort reverses the operation.
- **Sessions**: Persisted in `~/.snapsifter/sessions.json`. Resume lands on first unrated photo.

## Files

- `server.js` — Express backend. All API endpoints, sips conversion, sessions, file sorting with filetype subfolders.
- `public/index.html` — Single-file frontend. Inline CSS + JS. Landing screen (tree browser + preview) and viewer (image + filmstrip + filters).
- `launch.command` — Double-click launcher for distribution. Checks for Node.js, runs npm install, starts server, opens browser.
- `README.txt` — Minimal usage instructions for distribution.
- `~/.snapsifter/sessions.json` — Persists sessions (id, dir, name, lastOpened, lastPosition, fileCount, ratedCount).
- `ratings.json` — Written into each photo directory. Keyed by filename stem.

## API endpoints

- `GET /api/status` — whether a directory is loaded, which one, file count
- `GET /api/browse?dir=/path` — list subdirectories with photo counts (default: home dir, system dirs filtered)
- `GET /api/volumes` — mounted volumes from /Volumes/
- `POST /api/load` `{dir: "/path"}` — set active photo directory
- `GET /api/files` — list of photo files (requires loaded dir)
- `GET /api/ratings` — current ratings object
- `POST /api/rate` `{filename, rating}` — rate a file
- `GET /api/image/{*filepath}` — full-size image (HEIF converted to JPEG, JPG served directly)
- `GET /api/thumb/{*filepath}` — 300px thumbnail
- `GET /api/meta/{*filepath}` — full EXIF metadata (date, camera, lens, exposure, dimensions, file size, GPS, film simulation)
- `GET /api/sessions` — sessions list with accessibility check
- `POST /api/save-position` `{position}` — save viewer position in session
- `GET /api/preview-thumb/:dir/{*filepath}` — preview thumbnail (dir is base64-encoded)
- `GET /api/session-thumb/:sessionId/{*filepath}` — session thumbnail
- `POST /api/sort` `{mode: "move"|"copy"}` — sort files into Rating/EXT/ subfolders (e.g. Liked/HIF/, Ditch/RAF/)
- `POST /api/unsort` — reverse sort, move files back to root (handles both nested and legacy flat structure)

## Key shortcuts

1/2/3 = rate (ditch/maybe/like) + auto-advance to next sequential, 0 = clear rating, arrows = navigate, N = jump to next unrated, K = like over previous, Tab = cycle filter, Space = toggle metadata, F = fullscreen, Z = zoom, Escape = back to folder picker (when at first photo), ? = help

## Open bugs / unresolved feedback (verbatim from Oren)

- **Rating mark overlaps metadata**: `#rating-mark` is positioned `bottom: 24px; right: 28px`. `#metadata` is `bottom: 16px`. When metadata is visible and a photo is rated, the rating icon sits on top of the metadata. Move rating mark higher (e.g. above metadata) or to a non-overlapping position. Both should be visible simultaneously.
- **Progress counter "50/901" position**: `#counter` is in `#topbar-center`. Oren says it's in an odd spot — should be more to the right. Consider moving it to `#topbar-right` or adjusting layout.
- **General UI/UX**: "much of the UI/UX needs to be more intuitive" — ongoing.
- **Progress bar**: Increased to 5px with hover text. May still be too subtle.
- **No logo**: Favicon is aperture SVG. No app logo yet.

## Distribution

Distributed as a zip (`SnapSifter.zip` on Desktop). Contains launch.command for double-click start. macOS only (requires sips). Brother (Eytan) testing — needs `xattr -cr ~/Downloads/SnapSifter` after download to bypass Gatekeeper.

## Anti-patterns discovered

- **Zoom math with translate + transform-origin: 0 0**: Failed repeatedly. Flex centering offsets, maxWidth/maxHeight changes, and stale imgRect all cause position errors. The working approach is: keep image flex-centered, use `transform-origin` at the desired point + `scale()` only. No translate. Mouse pan = moving transform-origin.
- **Server restart required**: After editing server.js, the server MUST be restarted (`kill port 4000, node server.js`). Forgetting this caused sort bugs that appeared unfixed.
- **walkDir only finds supported images**: For sort stem-matching (RAW pairs), must scan ALL files in directory, not use walkDir which filters by isSupportedImage.
