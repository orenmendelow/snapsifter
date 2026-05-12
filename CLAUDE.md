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

- **S23-48**: Standard baseline — skeptical, needs re-verify with camera connected.
- **S23-63b**: Audit all simulate/variant edge cases — partial/full sim, recipe load, photo switch, baseline switch.
- **S23-80**: Per-photo param state — sidebar should save/restore params per photo. Switching photos changes sidebar.
- **S23-81**: Clicking diff-badge photo should update right panel to that photo's as-shot params.
- **S23-82**: Recipe versioning — updating recipe creates v1/v2 history. Previous shots preserved.
- **S23-83**: Main view simulate progress bar — full progress treatment like variant test (clip-path dual-text, linear-gradient, "Simulating x/y (~Ns)").
- **S23-84**: Variant test from collage still flashes white outline. Select-photo mode must persist until CANCEL.
- **S23-85**: Variant test select-photo mode should disable all other actions (modal lockout).
- **S23-86**: Tooltip in variant view extends past right screen edge — viewport clamping needed.
- **S23-87**: SAVE should be a BUTTON next to the RECIPE dropdown, NOT inside the dropdown.
- **No logo**: Favicon is aperture SVG. No app logo yet. Will rename app soon.

### Session 16 changes (2026-05-05)

**IMPLEMENTED:**
- Stale simulation cache fix — `simTimestamps` tracks per-photo timestamps, appended as `?t=` to sim image URLs in `toggleBeforeAfter()` and `renderFocusMode()`. Re-simulating with different params now shows updated output.
- Live/manual toggle removed entirely (HTML, CSS, JS event listener). `liveSimulate` state property removed.
- Focus mode redesign:
  - Collage click → focus with left vertical gallery strip of collage thumbs
  - Filmstrip click → browse focus, no gallery strip, photo fills full center
  - `findOrAddToCollage()` now swaps focused photo when grid full (was returning 0)
  - Toolbar removed from focus mode — collage grid icon button lives in center toolbar beside folder/shuffle/pick
  - Filename + capture metadata (shutter, ISO, aperture, focal length) in centered bottom info bar
  - Film simulation and white balance removed from metadata display (belong in recipe drawer)
- Image serving: `Cache-Control: public, max-age=3600` added to `preview-thumb` and `preview-image` endpoints (browser caches after first load)

### Session 18 feedback (2026-05-05, verbatim from Oren)

**AS-SHOT LABEL / RECIPE MATCHING:**
- Film simulation name alone (e.g. "RealaACE") is not helpful — it's just ONE param of the recipe.
- Should say "As Shot" OR if it matches a saved recipe, show the RECIPE NAME.
- Question: can we pull saved recipes off the camera into our library? — DONE (session 19). `POST /api/camera/scan-presets` reads all 7 Custom slots via PTP, "IMPORT FROM CAMERA" button in Cookbook.

**SAVE AS NEW / LOAD RECIPE PLACEMENT:**
- SAVE AS NEW RECIPE should ONLY appear if current params don't match any existing saved recipe.
- LOAD RECIPE belongs at the TOP of the right panel drawer, not the bottom.
- SAVE AS NEW should also be near the top, next to/near load.

**SIMULATE BUTTON:**
- Revert to a SINGLE simulate button. Default behavior = simulate what's in view (single photo in focus mode, collage in collage mode).
- In focus mode: add dropdown/option to simulate entire collage from within focus view.
- Library-wide batch simulate should be a separate button ELSEWHERE with "are you sure?" confirmation.
- Rename LIBRARY button (top right) to COOKBOOK (that's where you keep recipes).
- REVERT + SIMULATE should be side-by-side (two buttons in a row).

**HOLD-TO-COMPARE TIMING:**
- Works great. Reduce threshold from 200ms to 150ms (both collage and focus).

**COMPARE MODE PLACEMENT & UX:**
- Compare button in the center toolbar is confusing / easy to miss.
- Move compare functionality INTO the right panel — when in compare mode, right panel content changes to compare controls (param select, value chips, etc.) instead of normal recipe params.
- Film simulation dropdown shows only 6 options — should show ALL 20.
- BUG: clicking "simulate collage" from compare context simulated the 9-photo collage instead of rendering compare variants. Scope confusion.
- Rendering individual compare cells: button placement unclear, needs to be obvious within each cell or as single action.

**LEFT PANEL FOLDER TOGGLE:**
- Folder drawer toggle icon must stay at the SAME vertical height as the collage grid button and back button.
- Both the drawer-open and drawer-closed states should exist at the same UI height (consistent toolbar row).
- Currently the folder icon position shifts or disappears between states.

**NAVIGATION / BACK HISTORY:**
- If viewing a collage photo in focus, then clicking a filmstrip photo, should have option to go BACK to the previous collage photo (not just back to collage grid).
- Same pattern: click photo → click another from filmstrip → back should return to previous photo.
- Essentially a navigation stack for focus mode (push/pop photo history).
- Document as future enhancement if complex — not blocking.

### Session 23 changes (2026-05-07)

**IMPLEMENTED (S21-9 through S23-9 — Complete Variant Test rework):**

*Session 23a (S21-9 through S21-23):*
- "Standard" baseline: RECIPE_DEFAULTS (Provia, all zeros) added to recipe active dropdown alongside "As Shot" and saved recipes.
- Compare cell blur fix: 5-state cell model. As-shot match = no blur. Rendered = sim image. Pending = blur + PENDING.
- Recipe dropdown live matching: `checkParamsChanged()` calls `updateRecipeActiveDropdown()` so label updates as params change.
- Value-based sim-cache filenames: `_cmp_{param}_{value}.jpg` instead of index-based.
- Unit tests: `test/compare-mode.test.js` with 59 test cases.

*Session 23b (S23-1 through S23-9):*
- Baseline selector: chevron dropdown (not two buttons), defaults to "As Shot", immediately enters compare mode
- Synced zoom: click ANY compare cell → all cells zoom 1x/3x with shared transform-origin. Replaces old click-to-focus.
- Camera state: simulate button shows "Connect camera to simulate" greyed out when disconnected. `window._compareUpdateSimBtn` called from camera poll.
- Progress bar: button fills via `linear-gradient(to right, var(--amber) P%, ...)`, text "Simulating x/y (~Ns)", color flips #000 at 50%
- Post-simulation workflow: rendered cells become selectable (click = amber border + checkmark). Current value pre-selected. Five action buttons: RESIMULATE, CANCEL, APPLY & RETURN TO COLLAGE, SIMULATE COLLAGE, NEXT PARAMETER
- Side-by-side comparison: `#compare-side-by-side` with two panels, each with dropdown (Original/current/rendered variants), synced zoom
- Simulate after recipe load: `selectRecipe()` sets `cleanParams = exifBaseline` so loaded recipe shows simulate button
- Reset on re-entry: `enterCompareMode()` clears all compare state. Sim-cache files left on disk (overwritten on re-sim).
- Dead code cleanup: removed `compareVariant`, `#focus-variant-bar`, `#compare-to-dropdown`, `#focus-apply-return-btn`, `getCompareTargetUrl()` — all superseded by in-grid workflow

*Session 23c (S23-10 through S23-16):*
- Chevron+dropdown on VARIANT TEST button itself (not inside compare view). Baseline dropdown removed from right panel.
- Simulate+STOP in flex row. STOP shows during sim, sets `compareSimCancelled` flag. Cancel hidden when no simulate.
- RESIMULATE removed. Checkmark/selected outline removed. AS SHOT/STANDARD tag badge on current-value cell.
- SIMULATE COLLAGE removed. Per-cell ⋮ action menu with APPLY & RETURN and APPLY & NEXT PARAMETER.
- SBS dropdowns show param values with "(As Shot)" suffix. Back button handles SBS-to-grid navigation.

*Session 23d (S23-17 through S23-25 — Round 3):*
- Zoom equality: percentage-based `transformOrigin` on all compare cells, resolution-independent.
- AS SHOT tag: orange SVG camera icon. STANDARD: sliders SVG icon.
- Simulate button stays full opacity during simulation via `_compareSimulating` flag + `.simulating` CSS class.
- Mousemove pan zoom on all compare cells when zoomed to 3x.
- Compare button: two-rectangles SVG icon.
- Per-cell actions: 28px bold dots, `background: none`, double text-shadow, `color: var(--amber)`.
- `#compare-meta-row` in right sidebar with thumbnail + metadata above PARAMETER select.
- SBS panels: `.sbs-panel-actions` with dots + camera icon in each panel.

*Session 23e (S23-26 through S23-35 — Round 4):*
- Reverted param-dropdown-trigger/list borders to original `rgba(255,255,255,0.15)` (were accidentally changed to orange site-wide).
- REVERT ALL button removed entirely. `checkParamsChanged()` guards hide `recipe-drawer-actions` in compare mode.
- `renderValues()` now uses `currentParams[key]` (not `exifBaseline`) — Standard baseline correctly pre-selects Provia.
- Cell tags use `isExifMatch` (exifBaseline) and `isStandardMatch` (RECIPE_DEFAULTS) independently.
- Compare simulate button always visible with orange outline; transparent bg when 0 pending, filled when active.
- Failed sim cells show "FAILED" in amber (not red — site is monochrome + orange only).

*Session 23f (S23-36 through S23-44 — Round 5, verified by Oren in R6):*
- RECIPE label + dropdown now inline (same row via `#recipe-label-row` flex container).
- Focus mode zoom: fixed 3x scale with percentage-based `transformOrigin`.
- Focus mode pan: percentage-based `transformOrigin` in mousemove handler.
- Standard baseline cell rendering: `isExifMatch` determines unblurred state.
- Dots: changed to `●●●` filled circles, 10px font, `letter-spacing: -1px`, amber color.
- SBS dropdown border: `rgba(255,255,255,0.15)` (removed orange).
- Action tooltips: custom instant tooltip via `attachCellTagTooltip()` (replaces slow native `title`).

*Session 23g (S23-45 through S23-59 — Rounds 6-7, implemented but NOT yet verified by Oren):*
- SBS view: removed BACK TO GRID button. Right panel condenses to 200px (`sbs-condensed` class) with CSS transition, hides param/values/actions.
- Grid↔SBS transition: 150ms opacity crossfade.
- STOP/CANCEL button always visible. Text toggles: "CANCEL" normally, "STOP" during sim. STOP set immediately on click (before async).
- Simulate progress: clip-path dual-text approach (`.sim-text-back` white, `.sim-text-front` black clipped to progress %). Replaced broken `mix-blend-mode: difference`.
- Icons (AS SHOT/STANDARD) + dots grouped in single `.compare-cell-overlay` div with shared `rgba(0,0,0,0.5)` background.
- Native `<select>` replaced with custom dropdowns: `#compare-param-dropdown` and `.sbs-custom-dropdown` use `param-dropdown` pattern. `window._compareParamSelect` proxy object preserves `.selectedIndex`/`.value`/`.options` API. `populateSbsDropdowns()` builds custom options.
- Failed sim cells show clickable RETRY button (`retryCompareCell()` re-runs single-cell simulate).
- COMPARE button: `line-height:1`, SVG height=11 matched to font.
- VARIANT TEST button/chevron/dropdown borders: `rgba(255,255,255,0.15)` (removed orange).
- `#compare-param-select` border: `rgba(255,255,255,0.15)` (removed orange).
- Directory browser: hover on name OR images highlights directory name in amber. Click on either navigates. Both Cull and Recipe Lab.
- Landing page: "Recently Completed" sections on both Cull and Recipe Lab. `isSessionCompleted()`, `buildSessionRow()`, `buildCompletedCard()` shared helpers.
- PICK PHOTOS: SHUFFLE SELECTED button with Fisher-Yates shuffle.
- Recipe matching fix (server.js): `F0/Standard (Provia)`, `Nostalgic Neg`, `Classic Neg` added to `FUJI_FILM_SIM_MAP`. Parenthetical extraction fallback. `grainSize` defaults to `'Small'`. `findMatchingRecipe()` uses numeric + case-insensitive comparison with `RECIPE_DEFAULTS` fallback for missing keys.
- NEW RECIPE: `#new-recipe-widget` overlay with name input + all 15 param controls from `PARAM_DEFS`. SAVE persists via POST /api/recipe.

*Session 23h (S23-60, S23-61, S23-53b, S23-56b, S23-58b — Round 8):*
- Cull volumes refresh: &#x21bb; button on Cull tree "Volumes" label + 10s auto-refresh interval for both Cull and Recipe Lab.
- VARIANT TEST from collage view: button now shows in preview mode. Click from collage → toast "Select a photo" + crosshair cursor + amber outline hover on cells. Selecting a cell enters focus then compare. Escape cancels. Chevron dropdown also supports collage-mode selection.
- Compare cell icon priority: when both `isExifMatch` and `isStandardMatch` are true, icon shown based on `recipeState.compareBaseline` (camera for as-shot, sliders for standard). `cell-action-camera-icon` gets `position: relative` for tooltip positioning.
- SHUFFLE SELECTED: changed from `primary` to light button. LOAD SELECTED: `primary` class only when exactly 9 photos selected. Toast z-index bumped to 300 (above picker modal at 200).
- NEW RECIPE widget: native `<select>` replaced with `param-dropdown` pattern (trigger + list + options). Native `<input type="number">` replaced with `<input type="range">` slider + value label. Document-level click handler closes NRW dropdowns.
- Grid cells get `data-index` attribute for variant-select-mode click handling.

*Session 23i (S23-62 through S23-79 — Rounds 9-10):*
- Pre-simulated photos in variant test: `renderGrid()` checks `simulatedPhotos[photo.file]` for currentVal cell, shows sim image instead of original. `updateSimulateButton()`, `checkAllSimulated()`, and simulate handler all skip pre-simulated currentVal cells.
- Main view simulate button: orange outline style matching variant test pattern. Always visible when params changed. "Connect camera to simulate" when disconnected.
- `.cell-action-menu` position changed to `position: fixed; z-index: 100` — fixes overflow:hidden clipping on compare cells.
- `.cell-tag-tip` tooltips: `attachCellTagTooltip()` now uses `position: fixed` with bounding rect calculation for proper positioning.
- `saveRecipeState()` / `restoreRecipeState()`: localStorage persistence for `currentParams`, `currentId`, `currentTitle`, `cleanParams`.
- `renderGrid()` image logic reordered: isRendered first → isCurrentVal+pre-sim → isExifMatch||isCurrentVal (no blur) → pending (blur).
- `enterCompareMode()` NO LONGER resets `currentParams` — preserves working recipe edits when entering variant test.
- "Current" pencil icon: shown on cells matching working params that aren't as-shot or standard. `attachCellTagTooltip()` tooltip.
- `checkParamsChanged()`: simulate button always visible when changed, orange outline, "Connect camera to simulate" when disconnected.
- `updateRecipeActiveDropdown()`: shows "Modified (unsaved)" when params differ from any baseline. Has "Save as new recipe..." and "Update [name]..." dropdown options (NOTE: Oren wants these as a BUTTON next to dropdown, not inside it — S23-87, NOT YET DONE).
- Variant-test-from-collage: set state directly (focusIndex, mode, etc.) instead of calling `enterFocusMode` — eliminates flash (but Oren reports white outline flash persists — S23-84).
- `recipe-compare-row` always `display: flex` — variant test button always visible.
- Apply handlers (4 locations): close menu first, try/catch, `cleanParams` set to `exifBaseline`.
- `#sim-scope-toggle` chevron hidden during simulation, restored on completion.
- `_compareRenderGrid()` called after simulation loop to refresh all cell states.

**ARCHITECTURAL:**
- `recipeState.compareBaseline` — 'asshot' | 'standard', set by baseline dropdown
- `recipeState.compareRendered` — Set of value strings simulated, cleared on param change and re-entry
- `recipeState.compareSelectedFavorite` — value string of user's selected favorite cell
- `compareZoomLevel` — local var in initCompareMode scope, 1 or 3
- `#compare-baseline-row` — dropdown with chevron in `#compare-right-controls`
- `#compare-post-actions` — div with action buttons, shown after all cells simulated
- `#compare-side-by-side` — two `.sbs-panel` divs with custom dropdowns (`.sbs-custom-dropdown`) and synced zoom
- `#compare-param-dropdown` — custom dropdown replacing native `<select>`. `window._compareParamSelect` proxy with `.selectedIndex`/`.value`/`.options`.
- `.compare-cell-overlay` — single container for icons + dots per cell, shared dark background
- `updateSimulateButton()` — counts pending cells using `exifVal` (not `currentVal`), handles camera state, button always visible
- `window._compareUpdateSimBtn` — exposed for camera poll to update compare simulate button
- Guard flag `recipeState._updatingDropdown` prevents infinite loop between `checkParamsChanged()` ↔ `updateRecipeActiveDropdown()`
- `isExifMatch` / `isStandardMatch` — per-cell booleans in `renderGrid()` for tag display, independent of `isCurrentVal`
- `isSessionCompleted(s)` / `buildSessionRow()` / `buildCompletedCard()` — shared session helpers for landing pages
- `retryCompareCell(cell, val, paramKey)` — re-runs single-cell simulation on failure
- `showNewRecipeWidget()` — opens overlay form for manual recipe creation
- Focus zoom: fixed `scale(3)` with `pctX + '% ' + pctY + '%'` transformOrigin. NEVER use naturalWidth/clientWidth calculation.
- Palette: monochrome + orange ONLY. No red, green, blue, or other hues. Error states use `var(--amber)`.
- Dropdown borders: `rgba(255,255,255,0.15)` default, NOT orange. Only active/selected states use amber.

### Session 22 changes (2026-05-07)

**IMPLEMENTED:**
- Photo picker grid fix: `#photo-picker-grid` wrapped in `#photo-picker-scroll` container — grid was inside a flex child with definite height, causing CSS grid rows to compress instead of overflow-scroll. Picker cell img uses `position: absolute; inset: 0`.
- Arrow keys swapped: Up/Down cycles collage photos, Left/Right cycles filmstrip photos (was reversed).
- Gallery column slide animation: `#focus-gallery` uses `transition: transform 0.15s linear` with `.hidden` class (`translateX(-88px)`) for slide in/out. Slides in when entering collage focus from collage view, slides out when returning to collage or switching to filmstrip browse. No opacity/fade.
- Film sim diff badge: `.cell-diff-badge` (amber circle, top-left) on collage photos whose `filmSimulation` differs from majority. Tooltip shows matched recipe name or lists all differing params. Uses `findMatchingRecipe()` for recipe name lookup.
- Focus mode thumbnail preload: shows cached 300px thumbnail immediately via `/api/preview-thumb/`, swaps to full 2000px image via `new Image()` preload when ready.
- Skeleton loading (left panel + center resume): pulsing placeholder shapes while sessions API loads. Left panel shows "Recent" label + session-shaped bars. Center shows resume card shapes with thumbnail strips.

**ARCHITECTURAL:**
- `#photo-picker-scroll` wraps `#photo-picker-grid` — scroll container is the flex child, grid flows freely inside.
- `#focus-gallery.hidden` uses `position: absolute; left: 0; transform: translateX(-88px)` so it slides off without affecting layout. `#focus-body` has `position: relative; overflow: hidden`.
- `enterFocusMode()` tracks `wasFocus`, `wasBrowse`, `isNowBrowse` to determine when gallery slide should fire vs photo-to-photo cycling (no animation).
- `showRecipePreview()` delays `focus-view` hide by 160ms so gallery slide-out completes.
- Diff badge only compares `filmSimulation` key (not all recipe params) to avoid false positives from minor param variations.
- Skeleton CSS classes: `.skel-bar`, `.skel-session`, `.skel-resume-card`, `.skel-thumb` — all use `cell-pulse` keyframe.

**ANIMATION ANTI-PATTERNS (hard-won):**
- No slide-in or ease-in animations on mode transitions — Oren finds them dizzying/janky.
- No staggered cell animations on collage load — load immediately.
- No opacity fades on view swaps.
- Gallery column slide is the ONLY animation: pure translateX, no opacity, 150ms linear.

### Session 21 changes (2026-05-06)

**IMPLEMENTED:**
- Disabled right panel pattern: per-control `pointer-events: none`, en-dash `–` placeholders with `var(--amber-dim)`, scroll preserved, tooltips still interactive
- Tooltip restructured: HTML with `.tip-title` (amber, uppercase) and `.tip-body` (line-broken sentences), fade-out via CSS `transition: opacity 0.3s` + `.fading` class
- PARAM_DEFS first group renamed to empty string with separate "RECIPE" header above dropdown in drawer-top HTML
- "Open a folder to start" hint in recipe active dropdown when no baseline loaded
- XT-30 JPG fallback: grid-select, grid-replace, grid-shuffle endpoints fall back to `Liked/JPG/` when `Liked/HIF/` doesn't exist
- Recipe Lab center preview: `renderRecipeResumeSection()` with JPG fallback for resume thumbnails
- SIMULATE/REVERT buttons completely absent when not applicable (not faded). `checkParamsChanged()` is single source of truth for `#recipe-drawer-actions` visibility
- SIMULATE button redesigned: just "SIMULATE" centered, separate chevron button on right opens dropdown (This photo / Entire collage / Entire library). Scope implied by context.
- SIMULATE hidden when camera not connected (`recipeState.cameraConnected` check). Camera poll at 5s interval, `await checkCameraStatus()` on Recipe Lab entry.
- REVERT renamed to REVERT ALL (per-item revert icons already exist)
- Per-item revert icons moved to left side next to tooltip `?` icon (was on right by value)
- `/feedback` skill created for documenting feedback verbatim to FEEDBACK.md

**ARCHITECTURAL:**
- `checkParamsChanged()` now controls `#recipe-drawer-actions` display directly (show when changed, hide when matching or no cleanParams). Removed redundant drawerActions handling from `renderParams()` and `restoreRightPanel()`.
- `#sim-scope-dropdown` replaces old `#simulate-scope-select`. Dropdown anchored to `#simulate-row` (position: relative). Options filtered by context (photo option hidden in collage mode).
- `#sim-scope-toggle` is now a separate `<button>` sibling of `#simulate-btn`, not a child span.

### Session 20 changes (2026-05-06)

**IMPLEMENTED:**
- Camera import conflict resolution: same-name presets with different params show Skip/Overwrite/Save Duplicate modal. Same params = silent skip. New names import automatically. `#import-conflict-modal` with `paramsIdentical()`, `showImportConflictModal()`, `nextDuplicateName()`.
- Import feedback: shows "Found N presets: NAME, NAME..." toast before processing results.
- Camera polling: 5s intervals until connected, then 30s. Camera status text is clickable to force immediate check.
- Folder/grid button alignment: `#recipe-left-toggle` moved inside `#recipe-center-toolbar` (same flex row).
- Same-directory click fix: session row click handler returns early if `s.dir === recipeLoadedDir`.
- Grid back button: remembers collage focus state via `recipeState.savedCollageFocus`. Collage focus → filmstrip → grid returns to collage focus first, then grid again returns to full collage.
- Arrow key navigation in focus mode: left/right cycles through collage photos (if entered from collage) or filmstrip photos (if entered from filmstrip browse). Uses `recipeState.filmstripPhotos` stored on filmstrip load.
- Filmstrip active highlight: `renderFocusMode()` sets `.active` class on matching `thumb-wrapper` in filmstrip, with `scrollIntoView`.
- DITCH button: `#focus-ditch-btn` in `#focus-photo-info`, absolute-positioned right. `confirm()` dialog before action. `POST /api/recipe-cull` endpoint moves file + all stem-mates from Liked/ subdirs to Ditch/ subdirs. Removes from grid/filmstrip, advances to next photo.
- Focus gallery column: left side with 20px left padding, no border divider, 88px width.
- Focus photo sizing: `width: 100%; height: 100%` (was max-width/max-height).
- Focus info bar: metadata stays centered (ditch button absolute-positioned), 6px vertical padding.

**ARCHITECTURAL:**
- `recipeState.filmstripPhotos` — array of all filmstrip photos, populated in `loadRecipeFilmstrip()`
- `recipeState.savedCollageFocus` — `{index}` saved when entering filmstrip browse from collage focus
- `POST /api/recipe-cull` — moves stem-matched files from Liked/{EXT}/ to Ditch/{EXT}/
- Focus history stack no longer used for filmstrip-to-filmstrip navigation (only collage-to-filmstrip saves state)
- `enterFocusMode()` no longer pushes to focusHistory on every call

### Session 19 changes (2026-05-06)

**IMPLEMENTED:**
- Camera preset import: `POST /api/camera/scan-presets` endpoint scans all 7 Custom preset slots (D18E-D1A5) via PTP. Reads D18C (active slot), switches to each slot, reads D18D (name) + all recipe properties, translates to recipe-compatible params, restores original slot. Skips empty slots.
- "IMPORT FROM CAMERA" button in Cookbook — scans camera, saves non-duplicate presets as recipes, shows import count toast.
- Global recipe storage: recipes moved from `{recipeDir}/recipes.json` to `~/.snapsifter/recipes.json`. Recipe CRUD no longer requires a loaded directory. One-time migration copies existing per-dir recipes to global on first load.
- `requireRecipeDir` removed from recipe CRUD endpoints (GET/POST/PUT/DELETE recipes). Kept on FP1, scan-outputs, preview-output-image.

**ARCHITECTURAL:**
- PTP decode helpers in server.js: `decodePtpUint16()`, `decodePtpInt16()`, `decodePtpString()`, `encodeSlotValue()`, value maps (FILM_SIM_MAP, WB_MAP, GRAIN_MAP, EFFECT_MAP, NR_DECODE)
- `loadRecipes()` checks global path first, then migrates from per-dir if global doesn't exist
- `loadRecipes()` called on Recipe Lab re-entry even without a directory loaded

**RESOLVED:**
- Camera preset names DO come through (D18D PTP string decode works — NORDIC/ETERNA/KGOLDEXP/ICELAND). The "0 imported" was the `requireRecipeDir` issue, not a name issue. Confirmed working with camera connected.

### Session 18 changes (2026-05-05)

**IMPLEMENTED (session 18a — pre-feedback):**
- Recipe match badge, inline LOAD/SAVE, Compare Mode, Click-to-zoom, Simulate scope buttons

**IMPLEMENTED (session 18b — post-feedback):**
- As-Shot label: shows recipe name if matched, otherwise just "As Shot" (no film sim name)
- Hold-to-compare reduced to 150ms (both collage and focus)
- LIBRARY renamed to COOKBOOK (top-right button)
- Right panel restructured: LOAD RECIPE dropdown at top, SAVE AS NEW (conditional — only shows if no recipe match), COMPARE button (shows in focus mode)
- Single SIMULATE button with REVERT side-by-side. Scope dropdown (this photo / entire collage) appears in focus mode only.
- Compare Mode moved to right panel: entering compare swaps right panel content to compare controls (param select + value chips). Center shows compare grid. All film sim options shown (full list, not 6).
- Folder drawer toggle moved to `align-self: flex-start` (top-aligned with toolbar row)
- Focus mode navigation history: entering focus from focus pushes to stack, back button pops (allows returning to previous photo before going to collage)

**ARCHITECTURAL:**
- `#recipe-drawer-top` — new section above params panel (load select + save-as + compare btn)
- `#compare-right-controls` — replaces params panel when in compare mode
- `restoreRightPanel()` — helper to show params/drawer-top/actions and hide compare controls
- `recipeState.focusHistory` — array of `{index, browse, photo}` for back navigation in focus mode
- `#simulate-row` wraps simulate + revert side-by-side (flex row)
- `#simulate-scope-select` — dropdown for photo/collage scope in focus mode
- `findMatchingRecipe(params)` — compares all 15 recipe keys against saved recipes
- `enterCompareMode()` / `initCompareMode()` — renders param select + value grid for comparison
- `_focusResetZoom()` — global function to reset zoom state, called on mode transitions
- `updateInlineLoadSelect()` — populates load-recipe dropdown, called after `loadRecipes()`
- Focus photo container gets `overflow: hidden` for zoom containment

### Session 17 changes (2026-05-05)

**IMPLEMENTED (all session 15 feedback items):**
- On-image hold-to-compare (Snapseed-style): press+hold collage photo (200ms threshold) or focus photo to flash to original. "ORIGINAL" pill indicator. Toolbar toggle removed entirely.
- Folder icon moved to left screen edge as drawer affordance tab (rounded right corners, attached to panel edge)
- SIMULATE button moved into recipe drawer (right panel bottom), full-width, appears when params differ from as-shot
- REVERT TO AS-SHOT button in recipe drawer, resets to EXIF baseline
- As-shot baseline visual diff: "(was X)" on changed dropdowns, amber marker on slider tracks, "As-Shot: {film sim}" label at top of params panel
- Shuffle/pick buttons hidden before directory is loaded
- Recipe Lab directory browser shows up to 8 HIF preview thumbnails when selecting a folder
- Collage padding/gap increased (4px→12px/8px) to match recipe drawer spacing
- Tooltip `?` icons on all 16 recipe parameters with Fujifilm-specific descriptions
- Date taken (DateTimeOriginal) added to focus mode metadata bar
- Load priority: collage renders before filmstrip, batch EXIF awaited before filmstrip loads
- Focus photo gets `fetchpriority="high"`

**ARCHITECTURAL:**
- `#recipe-right-panel` wrapper added around `#recipe-right-panel-params` — params scroll in flex:1, `#recipe-drawer-actions` pinned to bottom
- `#recipe-left-toggle` moved from `#recipe-center-toolbar` to `#recipe-shell-body` (between left panel and center)
- `batch-recipe-exif` endpoint now extracts `-ShutterSpeed -ISO -Aperture -FocalLength -DateTimeOriginal`, returns as `_shutterSpeed`, `_iso`, `_aperture`, `_focalLength`, `_dateTaken` on perFile objects
- `loadBatchExif()` enriches `recipeState.gridPhotos` with capture metadata after fetch

### Session 15 feedback (2026-05-05, verbatim from Oren)

**SHUFFLE / PICK PHOTOS BUTTONS:**
- ~~Visible before any directory is loaded. Should be hidden until a directory is loaded and photos are in the grid.~~ DONE — session 17.

**RECIPE LAB DIRECTORY BROWSER:**
- ~~Clicking a directory in Recipe Lab doesn't show image preview thumbnails like Photo Cull does. Should match Photo Cull's preview behavior.~~ DONE — session 17.

**LEFT PANEL / FOLDER ICON:**
- ~~Folder icon should be attached to the left side of the screen to visually indicate it opens a drawer. Currently floating in toolbar.~~ DONE — session 17.

**LIVE/MANUAL TOGGLE:**
- ~~Doesn't do anything. Non-functional. Either wire it up or remove it.~~ DONE — removed entirely in session 16.

**ORIGINAL/SIMULATED TOGGLE (toolbar):**
- ~~Don't want it in the toolbar above the collage.~~ DONE — session 17. Replaced with on-image hold-to-compare.
- ~~Want something clickable ON the image itself to toggle between original and simulated (like Snapseed hold-to-compare).~~ DONE — session 17.

**SIMULATION STATE:**
- ~~After simulating a recipe, have to reload the page for the new simulation to show over a previously simulated photo. Stale cache not invalidated.~~ DONE — cache-buster timestamps in session 16.

**FOCUS MODE (click collage photo to expand):**
- ~~Current behavior: rest of collage photos drop below as a row + carousel below that. Bad UI.~~ DONE — redesigned in session 16.
- ~~Can't click photos from the carousel when in expanded view — broken interaction.~~ DONE — filmstrip clicks now open browse focus mode (no collage modification).
- ~~Desired: selected photo fills center/right. Other collage photos displayed on the LEFT SIDE as vertical strip. Carousel below always accessible and clickable to switch active photo.~~ DONE — collage click shows left gallery strip, filmstrip click shows photo only.

**METADATA IN FOCUS MODE:**
- ~~Current metadata is in the upper breadcrumb/back-button area — wrong placement.~~ DONE — moved to centered bottom info bar.
- ~~Should be displayed LOWER on the photo view, not in that top bar.~~ DONE.
- ~~Should include ONLY photo capture info: date taken, shutter speed, ISO, aperture, focal length — things that CANNOT be changed by a recipe.~~ DONE — all fields including date taken (session 17).
- ~~Should NOT include recipe/film simulation settings (those belong in the right panel).~~ DONE.
- Question: do these photos have geo/GPS data? Check EXIF. — ANSWERED: No, X100VI lacks built-in GPS.

**RIGHT PANEL / RECIPE DRAWER:**
- ~~For each photo: show the EXACT recipe as-shot. As soon as any param changes, make it VERY clear that params have been modified vs as-shot.~~ DONE — session 17 (as-shot baseline + visual diff).
- ~~SIMULATE button belongs IN the recipe drawer (not toolbar), appears when params differ from as-shot.~~ DONE — session 17.
- ~~REVERT TO AS-SHOT button should also appear when params are modified.~~ DONE — session 17.
- ~~If a photo's as-shot params match a saved recipe, indicate this with a tag/badge in the recipe drawer.~~ DONE — session 18.
- ~~Loading existing recipes is not intuitive. Need ability to LOAD a recipe and SAVE AS NEW RECIPE directly from this drawer while editing.~~ DONE — session 18.
- ~~A button to manage full recipe catalogue/collection is fine, but editing workflow needs inline load/save.~~ DONE — session 18.

**SPACING / PADDING:**
- ~~Recipe drawer has generous padding — good. Collage padding is much tighter — mismatch. Match padding throughout.~~ DONE — session 17.
- Carousel photo spacing is good — leave as-is.

**TOOLTIPS / PARAM EDUCATION:**
- ~~Each adjustment in recipe drawer needs a tooltip explaining what it does.~~ DONE — session 17.
- ~~Film simulation names need descriptions of the look they produce.~~ DONE — included in film sim tooltip.

**MISSING FEATURES (documented, not yet built):**
- ~~Simulate buttons needed for: single photo, entire collage, entire library (batch).~~ DONE — session 18, three scope buttons.
- ~~Compare variants: same photo rendered with different param values side-by-side (Phase I Compare Mode from session 9).~~ DONE — session 18, wired with param select + grid.
- ~~Click-to-zoom on photos in Recipe Lab (matching Photo Cull zoom behavior).~~ DONE — session 18.
- Side-by-side comparison view (original vs simulated, synced zoom). WANT this but lower priority.
- ~~On-image toggle (tap/click to flash between original and simulated). HIGHER priority than side-by-side.~~ DONE — session 17.
- Slider comparison (drag divider) — NOT needed. Skip this.
- Slider comparison (drag divider) — NOT needed. Skip this.

### Session 15 audit findings (2026-05-05, technical investigation)

**GPS DATA:**
- X100VI RAFs do NOT contain GPS/geo data. Camera lacks built-in GPS (requires Fujifilm app phone pairing). Metadata display should omit any GPS fields.

**STALE SIMULATION CACHE (root cause identified):**
- Simulated output path is always `.sim-cache/{stem}_sim.jpg` — same filename regardless of recipe params.
- When re-simulating with different params, file on disk is overwritten but browser serves cached image from same URL.
- Fix: append `?t={timestamp}` to simulated image src URLs after each simulation. One-line fix in `simulateOnePhoto()` where it sets `recipeState.simulatedPhotos[photo.file]`.

**FILMSTRIP CLICK IN FOCUS MODE (broken):**
- `findOrAddToCollage()` returns 0 when grid is already full (9 photos) and target isn't in grid. Click does nothing useful — navigates to first photo instead of swapping.
- Fix: either swap out the focused photo for the filmstrip pick, or show a toast explaining grid is full.

**FOCUS GALLERY CLICKS (working):**
- `#focus-gallery` thumbs (the collage photos shown as horizontal strip inside focus mode) DO have working click handlers calling `enterFocusMode(i)`. These work. The "can't click carousel" report likely refers to the bottom filmstrip (broken per above).

**PERFORMANCE OPPORTUNITIES:**
- `preview-image` endpoint for JPGs does `fs.readFileSync` on every request (no cache headers). Adding `Cache-Control: max-age=3600` for original images (not sim outputs) would speed up repeated views.
- Grid-select now uses random on first load (session 14 fix), but the filmstrip still calls `grid-select?count=999` which hits exiftool if cache is warm. For 714 files this is fine (cached), but if cache misses it blocks. Consider making filmstrip also skip exiftool.
- Sips conversion for HIF thumbnails is ~0.5s each. Already parallelized via prewarm. No further optimization without switching to a faster decoder (vips/sharp would require native deps).

**UI/INTERACTION ISSUES FOUND:**
- Recipe params panel has no scroll indicator — long param list (16 controls) may not be obvious that it scrolls on shorter screens.
- No keyboard navigation in focus mode (arrow keys don't cycle photos).
- Focus mode gallery shows all grid photos but doesn't indicate which have been simulated vs original.
- `findOrAddToCollage` silently fails when grid is full — no user feedback.
- Before-after toggle in toolbar uses `display: none/flex` which can still cause minor reflow of toolbar items when it appears.
- No loading/busy state on recipe library load — clicking LIBRARY with many recipes may feel unresponsive.

**SPEED: SIMULATION PIPELINE:**
- Current: ~1s per photo (upload RAF ~1s, patch profile <10ms, convert <100ms, download JPEG ~500ms).
- For 9-photo collage: ~9-12s total (sequential). Bottleneck is USB transfer (39MB RAF upload per photo).
- Optimization: if same RAF was already uploaded and camera still has it, skip re-upload. Would require tracking last-uploaded stem and checking camera handles. Could reduce collage sim to ~5s for re-renders of same photos with different params.
- Parallel simulation not possible — camera processes one RAF at a time (single PTP session).

### Session 14 feedback (2026-05-02, verbatim from Oren)

**TOPBAR / NAVIGATION:**
- Recipe title removed from topbar — DONE
- Tabs now match position between Photo Cull and Recipe Lab — DONE
- Empty filmstrip band hidden when no directory loaded — DONE

**LEFT PANEL / FILE EXPLORER:**
- Left panel collapses into drawer — DONE (folder icon toggle in toolbar, left-arrow inside panel to collapse, CSS transition)
- Photos not rendering in collage after loading directory — needs investigation.
- SSD plug-in is not detected without page reload. Needs a refresh button in the left nav.
- Recipe Lab file browser should show image previews when browsing, matching Photo Cull.

**LOADING / PERFORMANCE:**
- Directories take WAY too long to load. 15+ seconds. Need to investigate bottleneck.
- Loading state is horizontal bars — should be a collage-shaped grid placeholder.

**SIMULATE BUTTON:**
- Shows when no camera is plugged in — shouldn't. CODE DONE (hides when !cameraConnected), needs testing.
- Scope labeling — DONE ("SIMULATE PHOTO" in focus mode, "SIMULATE COLLAGE" in preview mode).
- PTP pipeline — WORKING (stale object clearing, auto-create output dir, focus mode image swap all fixed).
- ~~Causes layout shift. Pushes "714 available" count.~~ FIXED — session 18 (simulate moved to right panel, no center impact).
- ~~"714 available" — why is that stat even there?~~ FIXED — removed (no longer in codebase).
- ~~UI elements should not push or rearrange other elements. EVER.~~ FIXED — simulate in fixed right panel.

**SAVE BUTTON:**
- ~~After changing params and changing them back, save lingers for a bit then disappears. Weird. Should clear immediately when params match clean state.~~ FIXED — `markDirty()` immediately clears save + cancels autosave timer when params match cleanParams.

**RECIPE LIBRARY:**
- Empty on first use. Should ship with 3-5 sample recipes.
- No dropdown to load existing recipe.
- Loading recipes is confusing overall.

### Session 13 feedback (2026-05-02, verbatim from Oren)

**RECIPE TITLE BAR — REMOVE "No recipe" / "As Shot" FROM TOPBAR ENTIRELY:**
- "WHY IS IT THERE. I KEEP ASKING WHY THE RECIPE IS LISTED THERE IT DOESNT MAKE SENSE TO BE THERE."
- The recipe title/name does NOT belong in the shell topbar. It's confusing, purposeless, and Oren has asked 3+ times to remove it. The recipe name (if any) belongs in the params panel or nowhere visible until a recipe is saved. REMOVE from topbar completely. Not "fix" — REMOVE.

**LEFT PANEL / FILE EXPLORER:**
- Once a directory is loaded, the left panel tree MUST collapse into a drawer (hamburger or toggle). It wastes space showing the tree when the user is working with photos.
- Directories take WAY too long to load. Loading state is horizontal bars — should be a collage-shaped grid placeholder.
- SSD plug-in is not detected without page reload. Volumes must poll/refresh.

**CAMERA DETECTION:**
- Takes ~15 seconds to notice camera after plug-in. Too slow. Need faster polling on initial connect (every 3-5s), then slow down once connected.

**COLLAGE:**
- Photos crop (`object-fit: cover`). Show full photos.
- Loading/swapping is janky and slow.
- Loading state should match the collage grid shape, not horizontal bars.

**FOCUS MODE (single photo view):**
- Photo is too small. Should fill available space, especially after left panel collapses.
- Two carousels stacked (gallery + filmstrip at bottom) is weird. Collage thumbnails should maybe move to the side, not stack below.
- Metadata shown but too faded and confusing — unclear if film settings on right panel are for this photo, all photos, or leftover settings. Needs clear labeling.
- "(from camera settings)" label is there but why? No context. Too faded. Persists even after editing settings — stale indicator.

**LIVE / MANUAL TOGGLE:**
- Not explained anywhere in UI. "Live" should auto-simulate on param change. Currently does nothing — SIMULATE button still shows even when set to Live. The toggle is broken/unwired.
- In Focus Mode with Live enabled, changing a param should auto-simulate just that photo with debounce. No SIMULATE button needed when Live is on.

**SIMULATE BUTTON:**
- Shows next to "714 available" count — confusing. Am I simulating 1 photo? 9? 714?
- Shifts the UI layout when it appears. Should not cause layout shift.
- Needs progress indicator (how many done / total) instead of just "Simulating..."
- No cancel button.
- Simulates all 9 collage photos even from within Focus Mode — should only simulate the focused photo when in Focus Mode.
- Language inconsistent: says "Simulating" then "Rendered" — pick one.
- After simulate completes, nothing visually changes. No before/after comparison offered.
- Button should be disabled/show progress when already clicked, not re-clickable.

**SIMULATE PLACEMENT:**
- Should NOT be in the center toolbar next to SHUFFLE/PICK PHOTOS.
- Should be in the params panel (right side) — that's where the user changes settings, that's where "apply these settings" belongs.
- Or auto-triggered (Live mode) with no button at all.
- Separate concept: "simulate this photo" (Focus Mode) vs "simulate entire collage" (Preview Mode) vs "batch process directory" (future). These are different actions.

**BEFORE/AFTER:**
- After simulation, there's no way to A/B compare. Toggle exists but nothing visually changes after simulate.
- Need actual comparison modes: toggle, side-by-side, drag divider.

**PARAMS PANEL DROPDOWNS:**
- Bullet character appears next to selected dropdown items. This indents them from other options. Use a different selection indicator that doesn't shift layout (background highlight, checkmark, bold, etc.).

**RECIPE LIBRARY:**
- Shows no recipes. Should ship with 3-5 sample recipes so the library isn't empty on first use.

**WINDOW RESIZE:**
- Layout breaks on window resize.

**APP vs WEBSITE:**
- Oren is confused about whether this is being packaged as a macOS app or a web app like Photopea. This needs to be clear in documentation and UX. (Answer: macOS app via Electron or native Swift, per CLAUDE.md Distribution section. Currently runs as local web server for development.)

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
- **Camera retains stale objects — must clear before upload**: SendObjectInfo (0x900C) returns AccessDenied (0x2019) if the camera already has an object loaded from a previous (possibly failed) upload. Fix: call GetObjectHandles (0x1007) + DeleteObject (0x100B) for each existing handle before every upload. The Swift helper does this automatically in `clearStaleObjects()`.
- **Output directory must exist before writing JPEG**: The Swift helper's `pollForResult` writes the converted JPEG to `outputPath`. If the parent directory (`.sim-cache/`) doesn't exist, the write fails silently (500 error). Fixed: `createDirectory(withIntermediateDirectories: true)` before write.
- **Focus mode needs separate image swap**: `toggleBeforeAfter()` only updates grid cell images. When in focus mode, must also update `#focus-photo` src to show the simulated JPEG.
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
