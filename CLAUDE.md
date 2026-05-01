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

- **General UI/UX**: "much of the UI/UX needs to be more intuitive" — ongoing.
- **Progress bar**: Increased to 5px with hover text. May still be too subtle.
- **No logo**: Favicon is aperture SVG. No app logo yet.

## Distribution

Distributed as a zip (`SnapSifter.zip` on Desktop). Contains launch.command for double-click start. macOS only (requires sips). Brother (Eytan) testing — needs `xattr -cr ~/Downloads/SnapSifter` after download to bypass Gatekeeper.

## Recipe Editor — Film Simulation Workflow

New mode in SnapSifter for dialing in Fujifilm film simulation recipes and batch-applying them to liked RAFs via X RAW Studio.

### Camera
- Model: X100VI
- Serial: 5AA21758
- FP1 device string: `X100VI`, version: `X100VI_0100` (verify from existing FP1 or X RAW Studio)

### Architecture

**SnapSifter owns**: recipe editing UI, recipe storage, FP1 export, diverse grid selection, grid display with before/after toggle, recipe card view, swap/shuffle grid photos.

**X RAW Studio owns**: actual RAF→HIF rendering via camera hardware. Manual step — user connects camera via USB, loads FP1, processes files.

### Recipe data model (`recipes.json` in photo directory)

```json
{
  "recipes": {
    "recipe-id-uuid": {
      "id": "uuid",
      "title": "Warm Street",
      "created": "2026-05-01T...",
      "modified": "2026-05-01T...",
      "params": {
        "filmSimulation": "ClassicNeg",
        "grainEffect": "Strong",
        "grainSize": "Small",
        "colorChromeEffect": "Weak",
        "colorChromeFXBlue": "Off",
        "whiteBalance": "Auto",
        "wbShiftR": 3,
        "wbShiftB": -2,
        "dynamicRange": 200,
        "highlightTone": -1,
        "shadowTone": 2,
        "color": 1,
        "sharpness": -2,
        "noiseReduction": -4,
        "clarity": 0
      }
    }
  },
  "activeRecipe": "recipe-id-uuid"
}
```

### X100VI recipe parameters (complete)

| Parameter | Key | Values |
|-----------|-----|--------|
| Film Simulation | filmSimulation | Provia, Velvia, Astia, Classic, ClassicNeg, Nostalgic, RealaACE, ProNegStd, ProNegHi, Eterna, BleachBypass, Acros, AcrosYe, AcrosR, AcrosG, Mono, MonoYe, MonoR, MonoG, Sepia |
| Grain Effect | grainEffect | Off, Weak, Strong |
| Grain Size | grainSize | Small, Large |
| Color Chrome Effect | colorChromeEffect | Off, Weak, Strong |
| Color Chrome FX Blue | colorChromeFXBlue | Off, Weak, Strong |
| White Balance | whiteBalance | Auto, AutoWhite, AutoAmbiance, Daylight, Shade, Fluorescent1, Fluorescent2, Fluorescent3, Incandescent, Underwater, ColorTemp, Custom1, Custom2, Custom3 |
| WB Shift R | wbShiftR | -9 to +9 |
| WB Shift B | wbShiftB | -9 to +9 |
| Color Temperature | colorTemperature | 2500-10000 (when whiteBalance=ColorTemp) |
| Dynamic Range | dynamicRange | 100, 200, 400 |
| Highlight Tone | highlightTone | -2 to +4 |
| Shadow Tone | shadowTone | -2 to +4 |
| Color | color | -4 to +4 |
| Sharpness | sharpness | -4 to +4 |
| Noise Reduction | noiseReduction | -4 to +4 |
| Clarity | clarity | -5 to +5 |

### FP1 generation

XML format for X RAW Studio. Saved to `~/Library/Application Support/com.fujifilm.denji/X RAW STUDIO/X100VI/X100VI_0100/`. X RAW Studio must be quit and reopened to pick up new/changed FP1 files.

**FP1 format constraints (hard-won):**
- Filename MUST use `.FP1` (uppercase extension). Lowercase `.fp1` is silently ignored.
- Label attribute MUST NOT contain dashes (`-`). Dashes cause silent rejection. Use alphanumeric + spaces only.
- `version` on ConversionProfile: `1.12.0.0` (matches X RAW Studio V1.31)
- `SerialNumber`: `5935373131322503252913201629C3` (full hex from camera)
- `TetherRAWConditonCode`: `X100VI_0100` (not empty)
- `IOPCode`: `FF179503` (X100VI-specific)
- Required structural elements: `SourceFileName/`, `Fileerror`, `RotationAngle`, `StructVer` (65536), `ShootingCondition`, `FileType`, `ImageSize`, `ImageQuality`, `WBShootCond`, `HDR/`, `DigitalTeleConv`, `PortraitEnhancer/`
- Film simulation names differ from display names: ClassicNeg→ClassicNEGA, Nostalgic→NostalgicNEGA, ProNegStd→NEGAStd, ProNegHi→NEGAhi, Mono→BW
- `ExposureBias`: `0` for zero (not `P0P0`)
- `WideDRange`: `0` (not `OFF`)
- X RAW Studio cannot browse ExFAT volumes — needs Full Disk Access + Removable Volumes permission in System Settings

### Diverse grid selection algorithm

1. Extract EXIF from all RAFs in Liked/RAF/ (focal length, ISO, time of day, WB)
2. Generate JPEG thumbs via sips for image analysis
3. Compute feature vector per image via Sharp .stats() (R/G/B mean, stdev, entropy)
4. Farthest-point sampling: pick first randomly, then greedily maximize minimum distance to selected set
5. Default grid size: 9 photos (3x3)

### API endpoints (new)

- `GET /api/recipes` — list saved recipes
- `POST /api/recipe` `{title, params}` — create recipe draft
- `PUT /api/recipe/:id` `{title?, params?}` — update recipe
- `DELETE /api/recipe/:id` — delete recipe
- `POST /api/recipe/:id/fp1` — generate and save FP1 file for X RAW Studio
- `GET /api/grid-select?dir=...&count=9` — select diverse photos, return file list + feature data
- `POST /api/grid-replace` `{current[], replace: index}` — swap one grid photo for next best diverse pick
- `POST /api/grid-shuffle` `{count: 9}` — fully re-randomize grid selection

### UI screens

**Recipe Editor** (new screen, accessible from viewer or folder picker):
- Left: recipe parameter controls (dropdowns + sliders matching Fuji menu structure)
- Right: photo grid (3x3 default) with before/after toggle
- Top: recipe title (editable), save/load/export buttons
- Grid photos individually swappable (click X → replaced with next diverse pick) or shuffle all
- Toggle button: "RAW" vs recipe title — cycles grid between unedited renders and processed versions

### Implementation phases

**Phase 1 — Foundation (COMPLETE)**
- A: Recipe data model + CRUD endpoints in server.js — DONE
- B: Diverse grid selection algorithm + endpoint (EXIF-based farthest-point sampling) — DONE
- C: FP1 XML generation module — DONE, validated end-to-end with X RAW Studio + X100VI

**Phase 2 — UI (after Phase 1)**
- D: Recipe editor UI (parameter controls, save/load)
- E: Grid display UI (responsive grid, swap/shuffle)

**Phase 3 — Comparison + Polish**
- F: Before/after toggle (detect processed files in preview folder, show side by side in grid)
- G: Recipe card view (printable/copyable format)
- H: Batch workflow guidance (instructions for X RAW Studio step, status tracking)

### Workflow (user perspective)

1. Sort photos in SnapSifter (existing feature) → Liked/RAF/ has the keepers
2. Open Recipe Editor → grid auto-populates with diverse picks from Liked/RAF/
3. Dial in recipe params → save draft with a title
4. Export FP1 → file appears in X RAW Studio's profile directory
5. Connect X100VI via USB → open X RAW Studio → select grid RAFs → apply profile → convert to HIF → output to a preview folder
6. Back in SnapSifter → toggle grid to show processed versions → evaluate
7. Tweak recipe → repeat 4-6 until satisfied
8. Batch-apply: in X RAW Studio, select all Liked/RAF/ files → convert → output HIF to Liked/HIF/ (overwrites)
9. RAFs in Liked/RAF/ are never modified

## Anti-patterns discovered

- **Zoom math with translate + transform-origin: 0 0**: Failed repeatedly. Flex centering offsets, maxWidth/maxHeight changes, and stale imgRect all cause position errors. The working approach is: keep image flex-centered, use `transform-origin` at the desired point + `scale()` only. No translate. Mouse pan = moving transform-origin.
- **Server restart required**: After editing server.js, the server MUST be restarted (`kill port 4000, node server.js`). Forgetting this caused sort bugs that appeared unfixed.
- **walkDir only finds supported images**: For sort stem-matching (RAW pairs), must scan ALL files in directory, not use walkDir which filters by isSupportedImage.
