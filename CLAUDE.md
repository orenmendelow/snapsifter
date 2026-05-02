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

- `server.js` — Express backend. All API endpoints, sips conversion, sessions, file sorting with filetype subfolders, camera bridge endpoints.
- `public/index.html` — Single-file frontend. Inline CSS + JS. Landing screen (tree browser + preview) and viewer (image + filmstrip + filters).
- `camera-bridge.js` — Node module that spawns Swift helper and provides Promise-based camera API. JSON-RPC over stdio.
- `camera-helper/` — Swift Package (SPM). Builds a CLI binary that uses ImageCaptureCore for PTP camera communication.
  - `Sources/main.swift` — ICDeviceBrowser, PTP command construction, JSON-RPC protocol, all camera operations.
  - `Sources/Info.plist` — NSCameraUsageDescription, embedded in binary via linker.
  - `camera-helper.entitlements` — `com.apple.security.device.camera`.
  - `Package.swift` — SPM config, links ImageCaptureCore framework.
  - Build: `cd camera-helper && swift build && codesign --entitlements camera-helper.entitlements --force -s - .build/debug/camera-helper`
- `test-raf/` — Test RAF files and conversion outputs (gitignored). Contains DSCF6740.RAF and rendered JPEGs from 6 film sims.
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

Currently: Distributed as a zip (`SnapSifter.zip` on Desktop). Contains launch.command for double-click start. macOS only (requires sips). Brother (Eytan) testing — needs `xattr -cr ~/Downloads/SnapSifter` after download to bypass Gatekeeper.

**Future: macOS app bundle for commercial distribution.** Two packaging options under consideration:
- **Electron** — wraps existing web UI + Node server, bundles Swift helper in `Contents/Resources/`. Familiar stack, faster to ship.
- **Native Swift app with WKWebView** — Swift helper becomes the app itself, embeds web UI. Smaller footprint, proper macOS citizen.

Either way requires:
- Apple Developer Program ($99/yr) for Developer ID certificate
- Hardened runtime enabled
- `com.apple.security.device.camera` entitlement
- `NSCameraUsageDescription` in Info.plist
- Notarization via `notarytool` + stapling
- No App Store or sandbox required

## Recipe Editor — Film Simulation Workflow

New mode in SnapSifter for dialing in Fujifilm film simulation recipes and batch-applying them to liked RAFs via X RAW Studio.

### Camera
- Model: X100VI
- Serial: 5AA21758
- FP1 device string: `X100VI`, version: `X100VI_0100` (verify from existing FP1 or X RAW Studio)

### Architecture

**SnapSifter owns**: recipe editing UI, recipe storage, FP1 export, diverse grid selection, grid display with before/after toggle, recipe card view, swap/shuffle grid photos.

**Simulation / rendering**: Camera hardware does the actual RAF→JPEG conversion via direct PTP over USB.

**SOLVED in session 10**: The macOS PTP blocker is resolved. `ptpcamerad` is NOT the enemy — it's the gatekeeper. Apple's `ImageCaptureCore` framework works THROUGH `ptpcamerad` via XPC, providing full PTP command access to properly entitled apps. No sudo, no daemon killing, no hacks.

**Architecture (working)**:
```
Node server (port 4000) → camera-bridge.js → Swift helper (stdin/stdout JSON-RPC) → ImageCaptureCore → ptpcamerad (XPC) → USB → X100VI
```

- **Swift helper binary** (`camera-helper/`): Uses `ICDeviceBrowser` for camera discovery, `ICCameraDevice.requestSendPTPCommand()` for PTP operations. Communicates with Node via JSON-RPC over stdio.
- **camera-bridge.js**: Node module that spawns the Swift helper and provides Promise-based API to server.js.
- **Entitlement**: `com.apple.security.device.camera` (standard, no special Apple approval needed). Works with Developer ID signing for non-App Store distribution.
- **Info.plist**: Embedded in binary via `__TEXT,__info_plist` linker section. Contains `NSCameraUsageDescription`.

**Verified end-to-end in session 10**:
- Camera discovery: X100VI found via ICDeviceBrowser (VID=0x04CB, PID=0x0305)
- PTP session open/close
- GetDeviceInfo: model X100VI, firmware 1.31, serial 5935373131322503252913201629C3, 20 operations, 61 properties
- Property read/write (D001 FilmSim, D18C PresetSlot, D186 Firmware, etc.)
- Full RAF conversion pipeline: upload RAF (39MB, ~1s) → read d185 base profile (625 bytes) → patch film simulation → set modified profile → trigger conversion → poll GetObjectHandles → download result JPEG (3.5-4.5MB, full resolution 3888x2592)
- Tested 6 different film simulations on same RAF (Provia, Velvia, Astia, ClassicChrome, ClassicNeg, NostalgicNeg) — all produced visibly different renders

**Performance**: ~1 second per render. For 9-photo collage = ~9 seconds total.

**Previous approaches (superseded)**:
- X RAW Studio AppleScript automation — no longer needed
- Direct libusb/pyusb/WebUSB — blocked by ptpcamerad, replaced by ImageCaptureCore
- PTP test files (`ptp-test.py`, `ptp-session-test.py`, `ptp-direct-test.py`, `public/webusb-test.html`) — can delete

### PTP research artifacts
- `/tmp/rawji/` — Python PTP tool (pyusb), tested X-T30, profile format differs from X100VI
- `/tmp/filmkit/` — TypeScript WebUSB tool, **verified on X100VI**, proper d185 profile patching, command queue with latest-wins render cancellation. Protocol code ported to Swift helper via ImageCaptureCore.
  - `src/ptp/constants.ts` — PTP opcodes, Fuji property IDs (D001-D1A5), response codes, USB identifiers
  - `src/ptp/session.ts` — FujiCamera class: connect, loadRaf, reconvert, writePreset, command queue with latest-wins
  - `src/ptp/transport.ts` — WebUSB bulk transfer I/O (replaced by ImageCaptureCore in Swift helper)
  - `src/ptp/container.ts` — PTP container pack/unpack (12-byte header + payload)
  - `src/profile/d185.ts` — Native d185 profile patching (625-byte format), NativeIdx field map, encoding conversions
  - `src/profile/enums.ts` — FilmSim, WBMode, GrainEffect, ColorChrome enum values
  - `src/profile/preset-translate.ts` — Camera preset (D18E-D1A5) ↔ UI value translation, NR_ENCODE/NR_DECODE tables
  - `src/util/binary.ts` — LE pack/unpack helpers, PTP string parsing, PTPReader cursor class
  - `QUICK_REFERENCE.md` — RAW conversion workflow (9 steps), preset read/write protocol, d185 field indices
- `ptp-test.py`, `ptp-session-test.py`, `ptp-direct-test.py` — old test scripts (can delete)
- `public/webusb-test.html` — old WebUSB test page (can delete)
- Camera USB: VID=0x04CB (Fujifilm), PID=0x0305 (X100VI)
- FilmKit d185 profile: 625 bytes, field indices confirmed on X100VI
- Noise Reduction uses proprietary encoding (NOT ×10): {-4: 0x8000, -3: 0x7000, -2: 0x4000, -1: 0x3000, 0: 0x2000, 1: 0x1000, 2: 0x0000, 3: 0x6000, 4: 0x5000}
- Reference implementation: [ptpwebcam](https://github.com/dognotdog/ptpwebcam) — Objective-C, ImageCaptureCore, sends raw PTP commands, confirmed working pattern for requestSendPTPCommand

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

- `POST /api/recipe-load` `{dir}` — set Recipe Lab's directory (independent from Photo Cull), persists to `~/.snapsifter/recipe-session.json`
- `GET /api/recipe-status` — returns `{loaded, dir}` for Recipe Lab
- `GET /api/recipes` — list saved recipes (requires `recipeDir`)
- `POST /api/recipe` `{title, params}` — create recipe draft
- `PUT /api/recipe/:id` `{title?, params?}` — update recipe
- `DELETE /api/recipe/:id` — delete recipe
- `POST /api/recipe/:id/fp1` `{gridFiles?}` — generate FP1 + optional staging folder (`SnapSifter Preview/`) with symlinks to grid RAFs
- `GET /api/raf-count?dir=...` — count .RAF files in a directory (no middleware required)
- `GET /api/recipe-exif-defaults?dir=...` — read EXIF from first RAF in Liked/RAF/ via exiftool, return deduced recipe params (no middleware required)
- `GET /api/camera-status` — checks if Fujifilm camera is connected via USB (system_profiler SPUSBDataType)
- `GET /api/grid-select?dir=...&count=9` — select diverse photos, return file list + feature data
- `POST /api/grid-replace` `{current[], replace: index}` — swap one grid photo for next best diverse pick
- `POST /api/grid-shuffle` `{count: 9}` — fully re-randomize grid selection
- `GET /api/preview-thumb/:dir/{*filepath}` — 800px thumbnail (dir is base64-encoded), no middleware
- `GET /api/preview-image/:dir/{*filepath}` — 2000px full-size (dir is base64-encoded), no middleware
- `POST /api/scan-outputs` `{stems}` — scan for reprocessed HIFs in SnapSifter Preview/, Liked/RAF/, root
- `GET /api/preview-output-image/:stem` — serve reprocessed HIF as JPEG (2000px), cached in SnapSifter Preview/.cache/
- `POST /api/prewarm-thumbs` `{dir, files}` — parallel sips thumbnail generation for grid photos
- `POST /api/batch-recipe-exif` `{dir, files}` — per-file recipe EXIF extraction + majority params computation

### UI screens

**Recipe Lab** (persistent shell, entered from landing "Recipe Lab" tab):
- Top: `#recipe-shell-topbar` — "SnapSifter" title, recipe title (click-to-edit), camera status, SAVE button, LIBRARY button, Photo Cull / Recipe Lab tabs
- Left: `#recipe-left-panel` (280px) — directory tree browser with folder info + Load button
- Right: `#recipe-right-panel-params` (380px) — always-visible recipe params (dropdowns + sliders, grouped by Film/Color/White Balance/Tone/Detail)
- Center: `#recipe-center` — mode-dependent content area with toolbar
  - **Recipe Preview** (default): responsive CSS Grid collage of 1-9 photos with SHUFFLE/PICK PHOTOS/SIMULATE/before-after toggle. Click photo → Focus Mode.
  - **Focus Mode**: single photo large, gallery thumbnails of collage below, live/manual simulate toggle. COMPARE button (→ Compare Mode, not yet wired).
  - **Compare Mode**: (HTML exists, not wired) one photo × N param values side-by-side grid.
- Bottom: `#recipe-filmstrip-container` (96px) — horizontal scrollable strip of all available photos from directory

**Landing page architecture**: Two co-equal tools in header tabs: "Photo Cull" and "Recipe Lab". Photo Cull tab shows cull tree → cull viewer (unchanged). Recipe Lab tab opens the persistent shell (`showRecipeEditor()`). The shell has its own directory tree in the left panel. Independent server state (`activeDir` vs `recipeDir`).

### Camera PTP API endpoints (session 10)

- `GET /api/camera/list` — list connected Fujifilm cameras (waits up to 3s for discovery). Returns `{cameras: [{name, vendorId, productId}]}`
- `POST /api/camera/connect` — open PTP session with first discovered camera. Returns `{ok: true}`
- `POST /api/camera/disconnect` — close PTP session
- `GET /api/camera/info` — PTP GetDeviceInfo. Returns `{model, manufacturer, version, serial, operationCount, propertyCount}`
- `POST /api/camera/upload-raf` `{path}` — upload RAF file to camera via Fuji vendor commands (0x900C + 0x900D)
- `GET /api/camera/profile` — read d185 conversion profile (625 bytes, base64). Requires RAF loaded.
- `POST /api/camera/profile` `{data: base64}` — write modified d185 profile
- `POST /api/camera/convert` — trigger RAW conversion (SetDevicePropValue 0xD183 = 0)
- `POST /api/camera/wait-result` `{outputPath, timeout?}` — poll GetObjectHandles, download result JPEG, save to path
- `POST /api/camera/read-prop` `{propId}` — read any device property. Returns `{code, data: base64, size}`
- `POST /api/camera/write-prop` `{propId, data: base64}` — write any device property

### Recipe Lab server state

- `recipeDir` — independent from Photo Cull's `activeDir`, set via `POST /api/recipe-load`
- Persisted to `~/.snapsifter/recipe-session.json`
- Recipe CRUD endpoints use `requireRecipeDir` middleware (not `requireActiveDir`)
- `recipes.json` stored in `recipeDir` (not `activeDir`)

### Implementation phases

**Phase 1 — Foundation (COMPLETE)**
- A: Recipe data model + CRUD endpoints in server.js — DONE
- B: Diverse grid selection algorithm + endpoint (EXIF-based farthest-point sampling) — DONE
- C: FP1 XML generation module — DONE, validated end-to-end with X RAW Studio + X100VI

**Phase 2 — UI (session 9, superseded by Phase 3 rebuild)**
- Built initial Recipe Lab UI — replaced in session 11 rebuild

**Critical session 9 feedback (Oren — must address before Phase 3):**
- Recipe Lab UX is fundamentally broken. Needs complete rethink of flow, not incremental fixes.
- Grid loads too slowly (exiftool batch + sips still the bottleneck despite prewarm)
- Grid photos too small, don't fill viewport (220px target height inadequate, dead space)
- Camera detection is a lie — shows "connected" when camera is not connected. Fix or remove.
- "As Shot" recipe doesn't load — saved recipe ("Iceland") auto-loads instead of EXIF-deduced baseline
- Recipe rename doesn't update FP1 filename in X RAW Studio
- "SnapSifter Preview" folder name is nonsensical — rename to something meaningful (e.g., recipe name)
- No recipe management/library screen — nowhere to browse, view, or curate recipes
- No menu/nav structure — too few screens, no back buttons, no breadcrumbs
- No collage selection UX — user wants: random collage (with cycle-all and cycle-individual, never-repeat-in-session), OR manual photo picker modal (up to 9 photos)
- Each photo in collage should show its "as shot" recipe or film sim badge
- Different recipes in collage must be clearly indicated
- App must feel cohesive across culling and recipe workflows — sessions, back buttons, menus, persistence
- Cull directory browser should show photo previews during folder navigation (prior feedback, may be broken)

**Oren's full Recipe Lab vision (session 9, verbatim distillation):**
1. Pick a folder → random collage OR manual photo selection (up to 9)
2. Collage fills the view — no dead space, well-sized, enough photos to evaluate across scenes
3. Each photo shows its "as shot" recipe/film sim
4. Left panel shows recipe params (same as X RAW Studio / camera) starting from "as shot" baseline
5. Two ways to dial in a recipe:
   - **Single-parameter comparison**: Pick one photo + one param + handful of values → simulate same photo with each → side-by-side/slider comparison
   - **Full-recipe on collage**: Apply full recipe to all collage photos → toggle original vs simulated → click to zoom/compare individual photos
6. Simulation via camera hardware (X RAW Studio automation or direct PTP — see Architecture)
7. Recipe cookbook: named recipes with example photos, browse/modify/share/rename
8. Toggle between original and simulated collage
9. RAW files never modified. Original HIFs kept until explicit batch processing.

**Phase 3 — Recipe Lab Rebuild (sessions 11-12)**
- A: DONE — Camera communication solved via ImageCaptureCore Swift helper (session 10)
- B: DONE — Collage selection UX: SHUFFLE (re-randomize all 9), per-photo SWAP, PICK PHOTOS modal (select up to 9 from all available), never-repeat tracking via `usedPhotos` Set
- C: DONE — Grid layout: CSS Grid responsive (1-9 photos), `object-fit: cover`, photos fill center area
- D: DONE — "As Shot" baseline: always start from EXIF-deduced params, `recipeState.currentId = null` on entry, never auto-load saved recipe
- E: DONE — Recipe Library screen: `#recipe-library` overlay, card grid with title/film sim/key params/date/LOAD/DUPLICATE/RENAME/DELETE actions. Accessed via LIBRARY button in shell topbar.
- F: DONE — Navigation: shell tabs (Photo Cull / Recipe Lab), back buttons on focus mode, breadcrumb-like linear depth (preview → focus → compare)
- G: DONE — Simulate button + PTP wiring: appears when params differ from cleanParams, sequential per-photo simulation, per-cell spinner, progress text. Before/after toggle.
- H: DONE — Before/after toggle swaps grid img src between original HIF thumbnails and simulated JPEG paths
- I: NOT STARTED — Compare Mode: one photo × N values of a single parameter, side-by-side grid. HTML structure exists but not wired.
- J: PARTIAL — Rename/duplicate/delete via library screen. Example photos per recipe not yet implemented.
- K: DONE — d185 profile patching: `POST /api/camera/profile` now accepts `{data, params}` and patches the 625-byte profile with recipe params (film sim, WB, tone, grain, NR, clarity, etc.) before writing to camera. Previously `params` was ignored.
- L: DONE — Focus Mode: click collage photo → single photo large view with gallery thumbnails below, live/manual simulate toggle, back to collage. HTML/CSS/JS complete.
- M: NOT STARTED — Before/after comparison modes (side-by-side with synced zoom, drag divider). Currently only toggle mode works.

**Removed in sessions 11-12:**
- FP1 export flow (replaced by direct PTP simulation)
- Staging bar / "SnapSifter Preview" folder
- Old camera detection (`/api/camera-status` with system_profiler/ioreg)
- Justified row layout algorithm (`justifyGrid` is now a no-op)
- Params drawer (replaced by always-visible right panel)
- Recipe picker dropdown (replaced by LIBRARY button)
- Old `#recipe-topbar`, `#recipe-main`, `#recipe-grid-panel` structure

**Session 12 architectural changes (persistent shell):**
- Recipe Lab is now a persistent shell layout modeled after X RAW Studio:
  ```
  #recipe-editor (fixed, flex column, full viewport)
    #recipe-shell-topbar (SnapSifter title + recipe meta + Photo Cull / Recipe Lab tabs)
    #recipe-shell-body (flex row)
      #recipe-left-panel (280px, directory tree + folder info + Load button)
      #recipe-center (flex: 1, mode-dependent: collage / focus / compare)
      #recipe-right-panel-params (380px, always-visible recipe params)
    #recipe-filmstrip-container (96px, horizontal scrollable photo strip)
  ```
- Params panel is ALWAYS VISIBLE (not a drawer) — 380px right panel with all controls, scrollable
- Left panel contains the directory tree (moved from landing page) — persistent across recipe modes
- Bottom filmstrip shows all available photos from Liked/HIF (or root if not culled)
- Center area switches between three modes: Recipe Preview (collage), Focus Mode, Compare Mode
- `recipeState.mode`: `'preview' | 'focus' | 'compare'` tracks current mode
- `recipeState.focusIndex`: index of focused photo in gridPhotos
- `recipeState.liveSimulate`: auto-simulate on param change in Focus Mode (debounced)
- Collage grid is responsive: `updateCollageLayout(count)` sets grid-template based on 1-9 photos
- Landing page no longer has recipe tree/right panels — those moved into the shell
- Reload with recipe tab active shows landing page (not editor) — fixed

### Workflow (user perspective — session 12 shell)

1. Sort photos in SnapSifter Photo Cull → Liked/HIF/ and Liked/RAF/ have the keepers
2. Click "Recipe Lab" tab → persistent shell opens (left tree, center collage, right params, bottom filmstrip)
3. Browse directories in left panel → Load a folder with Liked/ subfolders
4. Recipe Preview: collage of 1-9 diverse photos from Liked/HIF/ fills center
5. SHUFFLE / SWAP / PICK PHOTOS to customize collage. Filmstrip shows all available photos.
6. Recipe params always visible in right panel, auto-populated from RAF EXIF ("As Shot" baseline)
7. Tweak params → SIMULATE button appears → renders all collage photos via camera PTP (~1s each)
8. Toggle ORIGINAL/SIMULATED, or click a photo for Focus Mode (single photo large, gallery below)
9. Focus Mode: live-simulate on param change (debounced), cycle through collage photos
10. (Future) Compare Mode: pick one param, select values, see same photo rendered N ways side-by-side
11. Recipe Library: LIBRARY button → save/load/duplicate/rename recipes
12. Click "Photo Cull" tab → returns to landing page
13. RAFs in Liked/RAF/ are never modified

## Anti-patterns discovered

- **Zoom math with translate + transform-origin: 0 0**: Failed repeatedly. Flex centering offsets, maxWidth/maxHeight changes, and stale imgRect all cause position errors. The working approach is: keep image flex-centered, use `transform-origin` at the desired point + `scale()` only. No translate. Mouse pan = moving transform-origin.
- **Server restart required**: After editing server.js, the server MUST be restarted (`kill port 4000, node server.js`). Forgetting this caused sort bugs that appeared unfixed.
- **CSS display:none override**: Setting `el.style.display = ''` does NOT override a CSS rule of `display: none`. Must set to explicit value like `'inline-block'` or `'flex'`.
- **Recipe Lab needs its own directory picker**: Cannot depend on cull session's `loadedDir`. Must have independent folder selection UI. DONE — uses own `recipeDir` server state.
- **The two tools are SEPARATE**: Photo Cull and Recipe Lab are independent workflows. No crossover buttons between them. Landing page is the hub where user chooses which tool to use. Both tabs share the same browser-section layout.
- **RAF thumbnails need format flag**: `sips` requires `-s format jpeg` for RAF→JPEG conversion (same as HEIF). Without it, output format is undefined.
- **Grid should show HEIF not RAF**: Loading RAFs via sips is slow. Grid should display Liked/HIF/ files (already camera-processed, fast). RAFs only used for X RAW Studio processing.
- **Grid-select is slow**: `exiftool` parsing all RAFs in a directory is inherently slow. Switching to HEIF display eliminates this for the grid. EXIF caching still useful for diverse selection algorithm.
- **No intermediate Load button for recent sessions**: When user clicks a previously culled session in Recipe Lab, load directly.
- **display: flex vs display: grid**: `showRecipeEditor()` must set `recipeMain.style.display = 'grid'` not `'flex'`. The grid-template-columns only work with display: grid. This caused the params panel to render at 155px instead of 520px.
- **exifr cannot parse RAF files**: Returns "Unknown file format" on Fujifilm RAF. Use exiftool CLI instead. The `extractRecipeFromExiftool()` function parses exiftool's human-readable JSON output (values like `"-2 (soft)"`, `"Red +40, Blue -120"`).
- **WB fine tune units**: exiftool reports WB shift as internal values (e.g. `Red +40`). Divide by 20 to get camera-display range (-9 to +9). So `+40` = `+2`, `-120` = `-6`.
- **EXIF batch is slow**: exiftool on 714 RAFs takes ~10s. Cache results in memory keyed by directory, invalidate when file count changes. grid-select/replace/shuffle all share the cache.
- **Swap must be random**: Farthest-point sampling for swap always returns the same deterministic result. Swap should pick randomly from the full HIF folder excluding current grid photos.
- **system_profiler SPUSBDataType can return empty**: On some Macs this command returns nothing. Camera detection needs `ioreg -p IOUSB -l` as fallback — camera appears as "USB PTP Camera" not "FUJIFILM".
- **FP1 export response must include `ok: true`**: Frontend checks `res.ok` to show success/failure toast. Missing this field causes false "Export failed" messages.
- **Grid cell overflow: hidden clips photos**: In old masonry layout, cells must NOT have `overflow: hidden`. In justified row layout, `overflow: hidden` is OK because cell dimensions are explicitly controlled.
- **Staging folder must not start with dot**: `.snapsifter-preview` shows up in X RAW Studio's file browser. Use `SnapSifter Preview` (no dot prefix) so it's obvious and visible in all file browsers.
- **No stray color hex values**: All UI colors must use CSS vars (--amber, --amber-dim, --text-dim, etc). Hardcoded hex colors like #c8a555, #b08d57 clash with the actual --amber (#c45a30).
- **Skip redundant grid-select**: Don't re-fetch grid-select if gridPhotos is already populated for the current directory. Track via lastLoadedDir in recipeState.
- **Parallel sips for thumbnails**: Sequential sips calls (12 x 0.5-1s) are too slow. Use prewarm endpoint with Promise.all + exec (not execSync).
- **Photo Cull keydown handler catches all keys globally**: Must check `screen !== 'recipe'` and `activeElement` is not INPUT/TEXTAREA, otherwise recipe title editing is broken (e.g., 'n' triggers jumpToNextUnrated).
- **macOS PTP access requires ImageCaptureCore, not libusb/WebUSB**: ptpcamerad claims PTP devices exclusively at IOKit level. The solution is ImageCaptureCore framework which works THROUGH ptpcamerad via XPC. Requires `com.apple.security.device.camera` entitlement and `NSCameraUsageDescription` in Info.plist. See `camera-helper/` for working implementation.
- **Camera detection shows false positives with ioreg**: ioreg fallback matches "USB PTP Camera" which appears for generic USB storage devices. Use ImageCaptureCore's ICDeviceBrowser instead — it properly identifies cameras by vendor/product ID. Old `/api/camera-status` endpoint (system_profiler + ioreg) is superseded by `/api/camera/list`.
- **Swift Data alignment crashes**: PTP response data is not memory-aligned. Using `data.withUnsafeBytes { $0.load(fromByteOffset:, as:) }` causes `Fatal error: load from misaligned raw pointer`. Must use manual byte reading: `UInt16(data[offset]) | (UInt16(data[offset + 1]) << 8)`.
- **ICDeviceBrowser needs RunLoop + time**: Camera discovery is async via delegate callbacks. The `list` command must wait for discovery if no cameras found yet (up to 3s). The Swift helper must run `RunLoop.main.run()` for ImageCaptureCore callbacks to fire.
- **Info.plist must be embedded in CLI binary**: For TCC camera permissions, CLI tools need Info.plist embedded via linker: `-sectcreate __TEXT __info_plist Sources/Info.plist`. A standalone Info.plist file next to the binary is not picked up.
- **requestSendPTPCommand wants full PTP container**: ImageCaptureCore's `requestSendPTPCommand` expects the full 12-byte PTP command container (length + type=0x0001 + opcode + transactionId + params). The `outData` parameter is raw payload (no container wrapping). The response callback's `response` parameter IS a PTP response container; `inData` is raw payload.
- **D185 profile only readable after RAF upload**: GetDevicePropValue(0xD185) returns GeneralError (0x2002) if no RAF is loaded in camera memory. Must call upload first.
- **Justified row layout fails with uniform aspect ratios**: When all photos are landscape, the algorithm packs too many per row (9 in 1 row at 220px height). CSS Grid with `repeat(3, 1fr)` and `object-fit: cover` is the correct approach for a fixed 3x3 collage — simpler and guaranteed to fill viewport.
- **Duplicate event listeners cause toggle double-fire**: Two agents adding click handlers to the same element = two toggles per click = no visible change. Always grep for existing handlers before adding new ones.
- **Params must be always-visible, not a drawer**: Session 12 moved params from slide-out drawer to persistent 380px right panel. Never hide params behind a toggle.
- **Recipe editor is a persistent shell**: `#recipe-editor` contains topbar + 3-column body + filmstrip. `recipeEditor.style.display = 'flex'` to show. No `#recipe-main` exists anymore.
- **Don't auto-enter recipe editor on reload**: Reload should show landing page. `localStorage('snapsifter-active-tool')` only switches the landing tab, never calls `showRecipeEditor()`.
- **d185 patching happens server-side**: `POST /api/camera/profile` accepts `{data, params}`. The server patches the base64 profile using NativeIdx field map before writing to camera. Frontend does NOT do binary patching.
- **Recipe tree is inside the shell**: No `#recipe-tree-panel` in landing page anymore. The tree lives in `#recipe-left-panel` inside `#recipe-editor`. `initRecipeLeftTree()` initializes it.

## Session endpoints

- `DELETE /api/session/:id` — removes a session from Recent list (sessions.json). The ratings.json in the directory is preserved for potential re-import.
- **walkDir only finds supported images**: For sort stem-matching (RAW pairs), must scan ALL files in directory, not use walkDir which filters by isSupportedImage.
