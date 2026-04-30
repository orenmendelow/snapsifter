# ShotSifter

Local web app for quickly scrubbing through photos (HEIF/HIF and JPG/JPEG) from an external SSD. Rate photos with keyboard shortcuts, filter by rating, then sort later.

## How to run

```
node server.js
```

Opens on port 4000. No arguments needed — the web UI provides a folder browser to select a photo directory at runtime. Auto-resumes the last loaded directory on startup (state saved to `~/.shotsifter/state.json`).

## Architecture

- **Backend**: Express server converts HEIF to JPEG on the fly via sips, caches results in `.cache/` inside the photo directory. JPG/JPEG files served directly (no conversion). Separate cache for full-size (2000px) and thumbnails (300px). EXIF parsed with exifr.
- **Frontend**: Single HTML file with inline CSS/JS. No frameworks. Dark aesthetic — deep black background, warm amber accent, high-contrast white text.
- **Folder picker**: On startup, shows a directory browser. User navigates to a folder containing photos and clicks Load. Volumes from /Volumes/ shown as quick-jump shortcuts.
- **Ratings**: Stored in `ratings.json` in the photo directory. Written to disk on every change. Keyed by filename stem (e.g. `DSCF6733`).
- **Rating values**: 1 = ditch, 2 = maybe, 3 = like. Backend stores numbers only.
- **Filter modes**: All / Unrated / Like / Ditch / Maybe. Tab cycles through them. Navigation stays within the filtered subset.
- **Preloading**: Next and previous images preloaded in background for instant scrubbing.
- **Thumbnails**: Lazy-loaded via IntersectionObserver as filmstrip scrolls.
- **Supported extensions**: .HIF, .HEIF, .JPG, .JPEG (all case insensitive).
- **Auto-resume**: Last loaded directory saved to `~/.shotsifter/state.json`. On server startup, if the saved directory still exists, it auto-loads.

## Files

- `server.js` — Express backend (~780 lines). All API endpoints, sips conversion, sessions, file sorting.
- `public/index.html` — Single-file frontend (~2300 lines). Inline CSS + JS. Landing screen (tree browser + preview) and viewer (image + filmstrip + filters).
- `~/.shotsifter/sessions.json` — Persists sessions (id, dir, name, lastOpened, lastPosition, fileCount, ratedCount).
- `ratings.json` — Written into each photo directory. Keyed by filename stem.

## API endpoints

- `GET /api/status` — whether a directory is loaded, which one, file count
- `GET /api/browse?dir=/path` — list subdirectories with photo counts (default: home dir)
- `GET /api/volumes` — mounted volumes from /Volumes/
- `POST /api/load` `{dir: "/path"}` — set active photo directory
- `GET /api/files` — list of photo files (requires loaded dir)
- `GET /api/ratings` — current ratings object
- `POST /api/rate` `{filename, rating}` — rate a file
- `GET /api/image/{*filepath}` — full-size image (HEIF converted to JPEG, JPG served directly)
- `GET /api/thumb/{*filepath}` — 300px thumbnail
- `GET /api/meta/{*filepath}` — EXIF metadata
- `GET /api/sessions` — sessions list with accessibility check
- `POST /api/save-position` `{position}` — save viewer position in session
- `GET /api/preview-thumb/:dir/{*filepath}` — preview thumbnail (dir is base64-encoded)
- `GET /api/session-thumb/:sessionId/{*filepath}` — session thumbnail
- `POST /api/sort` `{mode: "move"|"copy"}` — sort files into Liked/Maybe/Ditch subfolders
- `POST /api/unsort` — reverse sort, move files back to root

## Key shortcuts

1/2/3 = rate (ditch/maybe/like) + auto-advance, 0 = clear, arrows = navigate, K = like over previous, Tab = filter, Space = metadata toggle, F = fullscreen, Z = zoom, Escape = back to folder picker (when at first photo), ? = help

## Open bugs / unresolved feedback (verbatim from Oren)

- "zoom is still broken- way too zoomed in and zoom out doesnt work, it goes to a drag hand.. why cant you follow simple fucking instruction?" — Zoom must: click to zoom in (to where cursor is), click again to zoom out. Two-finger scroll = pan. Capped at 2x. Currently broken: zooms too far, zoom-out doesn't work (shows drag hand instead of zooming out).
- "Seems like you cant display all image types?" — Some thumbnails show as broken/blank in preview grid. Likely non-HEIF/JPG files or conversion failures. Investigate what file types are failing.
- Grouped preview layout is broken — subfolder names run together with photo counts ("Applicationsprivate 2 photos Users 867 photos"), thumbnails misaligned, broken image icons visible. Spacing and alignment need fixing.
- "Filtering should adjust what's shown in the film reel." — Implemented but needs verification.
- "sort button shouldn't be where it is and should be more self-explanatory" — Moved to topbar-left, text changed to "SORT INTO FOLDERS". Needs Oren review.
- "much of the UI/UX needs to be more intuitive"
- "'select a folder to preview' is a massive waste of space" — Changed to quick-start card. Needs Oren review.
- "Recent shows breadcrumbs in a way that's ugly" — Changed to parent/folder single line. Needs Oren review.
- "Progress bar, etc? Is that what's at the top? I didnt notice it." — Increased to 5px, added hover text. Still may be too subtle.
- "Wheres favicon? or logo?" — Added inline SVG favicon. No logo yet.
- "Photo preview within larger directories should offer suggested groupings/imports instead of just blindly displaying photos on my entire fucking drive" — Grouped preview by subfolder implemented but layout is broken (see screenshot feedback above).
