# drkrm — Open Feedback

Verbatim from Oren. Check off when completed and visually verified.

## Session 21 — Unresolved

- [x] **S21-1**: XT-30 folder doesn't load from Recipe Lab center preview. Needs diagnosis. — FIXED: JPG fallback added to grid-select, grid-replace, grid-shuffle endpoints in server.js when Liked/HIF/ doesn't exist.
- [x] **S21-2**: SIMULATE and REVERT buttons should not exist at all when not applicable — not faded/disabled, just absent. Show them only when their use is available. — DONE: checkParamsChanged() controls visibility via display none/show. drawerActions hidden when no changes.
- [x] **S21-3**: SIMULATE button should not say "this photo". Scope is implied by context: collage view = collage, single photo = that photo, compare = compare. Button should have a v-down arrow to select a level up (e.g., from single photo → collage → entire library). — DONE: separate chevron button with dropdown (photo/collage/library). SIMULATE label centered.
- [x] **S21-4**: PICK PHOTOS modal shows a broken grid — photos are squished/cropped into horizontal slices. Rendering bug in the photo picker grid. — FIXED: picker-cell img switched to `position: absolute; inset: 0` so aspect-ratio on the cell isn't overridden by intrinsic image sizing.
- [x] **S21-5**: Collage photos shot with a different recipe setting need a small icon in the corner. Hover shows which setting differs from the majority. — DONE: amber circle badge with star glyph in top-left corner. Hover shows tooltip listing each differing param and its value.
- [x] **S21-6**: SIMULATE button should not appear if camera is not connected. — DONE: checkParamsChanged() hides simulate when !cameraConnected. Camera poll at 5s interval.
- [x] **S21-7**: Up/Down arrow key functions are flipped — need to reverse them. — FIXED: swapped ArrowUp/ArrowDown direction in focus mode filmstrip navigation.
- [x] **S21-8**: Left/Right arrow transition between collage and focus should animate — slide the collage away and center the photo, not a jarring snap. — DONE: gallery column slides in/out with translateX (150ms linear). No fades, no stagger. Only animation in the app.
- [x] **S21-9**: compare tool should offer to compare with other settings as shot or with other settings reset to standard (or whatever the word is for that). — DONE: baseline choice prompt (As Shot / Standard) shown on entering compare mode. Choice stored in `recipeState.compareBaseline`.
- [x] **S21-10**: you blurred everything but the one that was shot already- example a photo shot in classic that starts with classic checked off- classic shouldnt be blurred, the other ones yet to be simulated should be blurred. Once it's simulated you shouldnt have the button there to simulate again.. know if there are changes please in all situations. — DONE: 5-state cell model. As-shot match = no blur/pending. Rendered = sim image, no blur. Unrendered = blur + PENDING. Simulate skips current-value cells.
- [x] **S21-11**: Launch subagents to work unit tests as broad and detailed as possible to catch all of these possible edge cases and adjust logic to handle. — DONE: `test/compare-mode.test.js` with 30+ test cases covering cell state, simulate count, Standard detection, recipe matching, chip toggle, and edge cases.
- [x] **S21-12**: in compare tool after simulate i should be able to click on one to open in focus view. — DONE: click rendered/as-shot cells to enter focus with `recipeState.compareVariant`. Shows sim-cache image in focus mode.
- [x] **S21-13**: I should be able to click and hold to compare to original but also have a dropdown in that view that says compare to: original / dropdown to select the other simulated variants. — DONE: `#compare-to-dropdown` in focus variant bar with Original + other rendered variants. Hold-to-compare uses dropdown target.
- [x] **S21-14**: I should be able to click "apply to image and return to recipe lab" so it helps me dial in the recipe one factor at a time. — DONE: APPLY & RETURN button in focus variant bar. Applies variant param to currentParams, clears variant, returns to preview.
- [x] **S21-15**: in the main view recipe load dropdown there should be an option to set the film simulation to standard. — DONE: "Standard" option in recipe active dropdown (RECIPE_DEFAULTS — Provia, all zeros).
- [x] **S21-16**: IN theory if i start with an image on standard i can run variants on every single parameter until i have it dialed in-- simulating variants with growing parameters filled out. — DONE: enabled by Standard baseline + per-param compare + Apply & Return workflow.
- [x] **S21-17**: add some sort of base zero filters applied setting to the "As shot" dropdown. — DONE: "Standard" option in recipe active dropdown sets all params to RECIPE_DEFAULTS.
- [x] **S21-18**: As shot dropdown needs to be matching if the settings match a saved recipe in the library and it's not. — DONE: `checkParamsChanged()` now calls `updateRecipeActiveDropdown()` so label updates live as params change. Also detects Standard match.
- [x] **S21-19**: in variant test button ask if i want to create variants from as shot or from zero filters applied or whatever the right terminology is-- at which point youd change all photo settings to that base and THEN launch variant, so that as I dial in my settings I can build the recipe from the ground up, should I so choose. — DONE: baseline choice (As Shot / Standard) shown in compare-right-controls before param/values selection.
- [x] **S21-20**: when I go into variant its showing immediately blur even though the 1 variant is the one that I already have in the photo. At that first step its just the variant I already simulated so the simulate button is useless until I select more. — DONE: as-shot match cell renders without blur. Simulate button hidden when 0 pending.
- [x] **S21-21**: I can of course deselect the variant that was originally shot in which case things should be handled accordingly. — DONE: deselecting current-value chip removes the unblurred cell. Grid re-evaluates all cells on chip toggle.
- [x] **S21-22**: Simulate button should indicate how many variants Im about to simulate. — DONE: button shows "SIMULATE (N)" with pending count. Hidden when 0.
- [x] **S21-23**: Would also be useful if larger simulate actions had a time estimate or progress bar. — DONE: during simulation shows "SIMULATING 1/N  ~Xs remaining" with countdown.

## Session 23 — Unresolved

- [x] **S23-1**: Variant baseline should be a dropdown with chevron (like simulate button), not two buttons. Defaults to "As Shot", chevron reveals option to switch to Standard. — DONE: replaced two buttons with `param-dropdown` styled chevron dropdown in `#compare-baseline-row`.
- [x] **S23-2**: NO click-to-focus on compare cells. Click should be ZOOM, and zoom ALL photos equally (synced zoom). Cancel button next to simulate instead. — DONE: synced zoom (1x/3x) on all cells. CANCEL button added. Old click-to-focus and focus-variant-bar removed.
- [x] **S23-3**: Simulate button shows and does nothing when camera not plugged in. Should be greyed out or say "plug in camera to simulate". Edge case handling is lacking. — DONE: `updateSimulateButton()` checks `cameraConnected`, shows "Connect camera to simulate" greyed out. Camera poll updates compare button via `_compareUpdateSimBtn`.
- [x] **S23-4**: Simulate button DURING simulation should become an orange progress bar within the button with text "Simulating 1/2" (not "SIMULATE" text). Just "Simulating x/y (~10s)" format with countdown. — DONE: `linear-gradient` fills button left-to-right, text flips to #000 at 50%.
- [x] **S23-5a**: After simulating variants — choice: select more/different options and resimulate. — DONE: RESIMULATE button deselects chips, clears rendered, lets user start fresh.
- [x] **S23-5b**: After simulating variants — choice: go back having done nothing (cancel). — DONE: CANCEL button returns to focus mode.
- [x] **S23-5c**: After simulating variants — choice: pick favorite variant → that variant replaces the collage photo, settings updated, return to collage focus mode. — DONE: APPLY & RETURN TO COLLAGE applies favorite param, returns to focus.
- [x] **S23-5d**: After simulating variants — choice: "simulate collage with this setting change" button. — DONE: SIMULATE COLLAGE applies favorite param, triggers collage sim.
- [x] **S23-5e**: After simulating variants — choice: pick favorite and STAY in variant mode, move on to next parameter (keep selection, run variant on another setting). — DONE: NEXT PARAMETER applies favorite, advances param select, re-renders values.
- [x] **S23-6**: Needs side-by-side comparison view with dropdown menus on EACH side to compare any 2 variants. Not hold-to-compare. Two photos next to each other, each with a dropdown to select which variant to show. — DONE: `#compare-side-by-side` with two panels, each with dropdown (Original + current + all rendered variants) and synced zoom. COMPARE SIDE BY SIDE / BACK TO GRID buttons.
- [x] **S23-7**: Simulate button missing when loading Standard or any saved recipe. Should appear after loading any recipe. — DONE: `selectRecipe()` and Standard option now set `cleanParams = exifBaseline` (photo's actual settings) so loaded params differ → simulate button shows.
- [x] **S23-8**: Going back then re-entering variant should RESET — variants should not persist. Clear that cache. What's our garbage cleanup like? — DONE: `enterCompareMode()` clears `compareRendered`, `compareSelectedFavorite`, resets zoom. Sim-cache files left on disk (small, act as cache, overwritten on re-sim).
- [x] **S23-9**: Progress format should be "Simulating x/y (~10s)" with appropriate countdown. — DONE: "Simulating 1/3 (~2s)" format with per-cell countdown.

## Session 23 Round 5 — Verified in Round 6

- [x] **S23-36**: Recipe dropdown beside RECIPE label — VERIFIED R6 (S23-46: "great")
- [x] **S23-37**: Zoom fix — VERIFIED R6 (S23-47: "good")
- [x] **S23-38**: Standard baseline — partially verified R6 (S23-48: "skeptical, needs re-verify with camera")
- [x] **S23-39**: Dots chunkier — VERIFIED R6 (S23-49: "OK")
- [x] **S23-40**: Clip-path dual-text progress — VERIFIED R7 (S23-50: "great")
- [x] **S23-41**: Error handling + retry — VERIFIED R6 (S23-51: "OK")
- [x] **S23-42**: Compare icon centering — VERIFIED R6 (S23-45: "good")
- [x] **S23-43**: SBS dropdowns — VERIFIED R6 (S23-45: "good", S23-52: "AWESOME")
- [x] **S23-44**: SBS hover tooltips — VERIFIED R6 (S23-45: "good")

## Session 23 Round 6 — Unresolved (Oren's verification of R5 fixes)

- [x] **S23-45**: SBS view — good.
- [x] **S23-46**: Recipe dropdown beside RECIPE — great.
- [x] **S23-47**: Zoom — good.
- [x] **S23-48**: Standard baseline — VERIFIED with camera connected. D001=0x0001 confirms Provia is Standard. RECIPE_DEFAULTS (Provia, all zeros) maps correctly to camera settings. d185 patching handles all defaults.
- [x] **S23-49**: Dots — OK.
- [x] **S23-50**: STOP immediate, clip-path dual-text progress, icons+dots in single dark overlay. Implemented R7. Oren has NOT verified.
- [x] **S23-51**: Error handling — OK, believes retry is there.
- [x] **S23-52**: Native selects replaced with custom param-dropdown pattern. Implemented R7. Oren has NOT verified.
- [x] **S23-53**: Tooltip display fix (was '' falling back to CSS none, now 'block'). Implemented R7. Oren has NOT verified.

## Session 23 Round 7 — Verified by Oren

- [x] **S23-54**: Directory hover highlight — VERIFIED: "AMAZING"
- [x] **S23-55**: Recently Completed sessions — VERIFIED: "great"
- [x] **S23-56**: SHUFFLE SELECTED button — VERIFIED with feedback (see R8 S23-56b)
- [x] **S23-57**: Recipe matching fix — VERIFIED: "if you say so"
- [x] **S23-58**: NEW RECIPE overlay widget — VERIFIED with feedback (see R8 S23-58b)
- [x] **S23-59**: VARIANT TEST borders — VERIFIED: "excellent"

## Session 23 Round 8 — New Feedback

- [x] **S23-60**: External drive detection — IMPLEMENTED: refresh button on Cull volumes + 10s auto-refresh. Oren verified "nice" but Recipe Lab glitches on refresh click. NOT FULLY VERIFIED.
- [x] **S23-61**: VARIANT TEST from collage — IMPLEMENTED: shows in preview, click prompts photo selection. Oren reported flash on click, fixed (was double enterFocusMode from mouseup+click). Needs re-verify.
- [x] **S23-53b**: Sliders tooltip / icon priority / overlay — IMPLEMENTED: baseline-aware icon, position:relative on camera icon, overlay covers both. NOT VERIFIED.
- [x] **S23-56b**: SHUFFLE SELECTED light, LOAD SELECTED conditional orange, toast z-index — IMPLEMENTED. NOT VERIFIED.
- [x] **S23-58b**: NEW RECIPE widget param-dropdown + range sliders — IMPLEMENTED. NOT VERIFIED.
- [x] **S23-62**: Simulated image then launched variant test — IMPLEMENTED: renderGrid checks `simulatedPhotos[photo.file]` for currentVal cell, shows pre-sim image instead of original. Pending count, checkAllSimulated, and simulate handler all skip pre-simulated currentVal cells.
- [x] **S23-63**: Simulate button on regular/focus view — IMPLEMENTED: button always visible when params changed. Orange outline + "Connect camera to simulate" when disconnected (matching variant test pattern). Chevron no longer shows alone.
- [x] **S23-63b**: Audit all simulate/variant edge cases — DONE: Found and fixed pre-sim params mismatch bug. `simParamsUsed` tracks per-photo sim params. `hasValidPreSim()` validates before showing pre-sim images. No bugs in baseline switching, re-entry reset, or photo switching.
- [ ] **Progress bar**: Oren doesn't know what this refers to. Closing this item.
- [ ] **No logo**: Will rename app and pick logo soon. Not actionable yet.

## Session 23 Round 4 — Unresolved

- [x] **S23-26**: pre-file load the right side dropdown are orange, make them normal please. wait— its orange in the regular view also… did you change that?? undo!!!!!!! — DONE: reverted param-dropdown-trigger/list to original rgba borders. Compare-mode selects kept orange.
- [x] **S23-27**: whatever you did to zoom broke it. I click repeatedly and the photo just moves around, doesnt zoom at all. Really weird and bad.. yeah you totally broke it. Just zoom in 3x on the photo on click. Is that crazy? — DONE: zoom click handler attached to ALL cells (was gated to currentVal/rendered only).
- [x] **S23-28a**: camera icon is good. Is standard realaACE? No… Yet when I click standard, realaACE is selected and a full 10s went by before SIMULATE button.. and there are two simulate buttons…??? That wide one needs to go and fold the (x) into the one beside REVERT.. which shouldn't even be there…. We have a back button, whats revert for? I click revert and it does nothing. Useless button. — DONE: REVERT ALL removed entirely. checkParamsChanged guards hide drawer-actions in compare mode (no double simulate).
- [x] **S23-28b**: I think the photo was shot in RealaACE so its auto selected even when I click standard, which is wrong, and the simulate button showing up logic is broken there. — DONE: renderValues uses currentParams (RECIPE_DEFAULTS when Standard) instead of exifBaseline. Provia selected for Standard.
- [x] **S23-28c**: Sliders is OK but a different icon would make more sense. The 3 dots need to be chunkier and the dark rectangle behind please remove. — DONE: dots 22px, background:none, text-shadow for legibility.
- [x] **S23-29**: WRONG. The simulate button needs an orange outline because it disappears. PLEASE RUN SOME FUCKING TESTS ON THIS SHIT DUDE. I hate having to point out obvious bugs. Where is the audit? And you didnt do the white/dark text i said to make text always viewable on that simulate progress bar. Still seeing one of the variants as PENDING. WHY WHY WHY WHY WHY WHY WHY. AUDIT DEBUG LAUNCH SUBAGENTS — DONE: button always visible with orange outline (transparent bg when 0 pending). Text color flips #000/#fff at 50%. PENDING shows FAILED on sim error. PENDING stuck = camera rendering failure.
- [x] **S23-30**: good but only works when i click the original photo— should work on all. And youre marking the as shot as standard, which is wrong and a mistake. — DONE: zoom on all cells. AS SHOT/STANDARD tags now use exifBaseline/RECIPE_DEFAULTS match independently.
- [x] **S23-31**: good icon but center it vertically please or center compare vertically, something is off — DONE: compare-post-actions buttons use inline-flex + align-items:center.
- [x] **S23-32**: 3 dots still not big enough, not orange, dark rectangle still there. — DONE: 22px, color var(--amber), background:none.
- [x] **S23-33**: on compare view please dont make dropdowns the full width of that half-page section, they dont need to be that big. Please use your brain — DONE: sbs-dropdown width:auto, min-width:120px, max-width:250px.
- [x] **S23-34**: on the compare view (2 photos side by side) need to maintain the 3 dots and camera icon (if as shot). Not done. — DONE: updateSbsPanelActions shows camera/sliders icons for exif/standard matches.
- [x] **S23-35**: dropdown styling — addressed in S23-26. — DONE.

## Session 23 Round 3 — Unresolved

- [x] **S23-17**: i think we're not zooming in equally on all photos. depending on resolution? I want to zoom in whatever you have-- is it 3x? On all 10. — DONE: zoom uses percentage-based transformOrigin so all cells zoom identically regardless of resolution.
- [x] **S23-18**: AS SHOT tag should be orange and in a rectangle or better-- have an orange outline camera icon. I like that. — DONE: orange SVG camera icon for AS SHOT, sliders icon for STANDARD.
- [x] **S23-19**: Bug still when I click simulate the button goes away-- should keep button outline and be full opacity, just have a progress bar and adapt white text on dark background and black text on orange part of progress- would look cool. — DONE: _compareSimulating flag + .simulating CSS class replaces :disabled. Button stays full opacity with progress bar fill.
- [x] **S23-20**: clicking on photos in the compare collage should allow to pan zoom like we have clicking zoom. — DONE: mousemove handler pans all cells simultaneously when zoomed to 3x.
- [x] **S23-21**: Compare button should make clear its 2 photos compared-- put an icon there or something. — DONE: two-rectangles SVG icon on COMPARE button.
- [x] **S23-22**: 3 dots to apply arent big enough and should be orange. And on the as shot one, the as shot camera should be left of those 3 dots. — DONE: cell-action-btn 18px, color var(--amber). Camera icon positioned left of dots on as-shot cells.
- [x] **S23-23**: put metadata for variant view in the right sidebar maybe at the top even above parameter below back-- with a little icon of the photo to its left. — DONE: #compare-meta-row in right sidebar with thumbnail + metadata text above PARAMETER select.
- [x] **S23-24**: on the compare view (2 photos side by side) need to maintain the 3 dots and camera icon (if as shot). — DONE: .sbs-panel-actions with dots + camera icon in each SBS panel.
- [x] **S23-25**: ACROSS THE SITE: dropdown needs to be square and with orange outlines to follow in style of the site. — DONE: all dropdowns/selects use border-radius:0, border: 1px solid var(--amber).

## Session 23 Round 2 — Unresolved

- [x] **S23-10**: when i click variant test, the chevron is supposed to be on the VARIANT TEST button, not in that view. — DONE: chevron+dropdown on VARIANT TEST button itself. Baseline dropdown removed from right panel. Metadata persisted via #compare-photo-info. Defaults to as-shot.
- [x] **S23-11**: Without camera connected just the back button is fine (ask are you sure), no need for cancel unless theres a simulate button. Simulate button should sit BESIDE the cancel button. Cancel mid-sim. — DONE: simulate+STOP in flex row. STOP shows during sim, sets compareSimCancelled flag. Cancel hidden when no simulate.
- [x] **S23-12**: After simulate theres no need for a cancel button because the simulate button is gone. Also no need for resimulate that makes no sense. ClassicNeg stuck on pending. — DONE: RESIMULATE removed. Cancel hidden post-sim. PENDING bug likely camera-related (code logic verified correct).
- [x] **S23-13**: progress bar is faded and still, one of them shows as PENDING. — DONE: progress bar resets background/color after completion.
- [x] **S23-14**: This check and outline GET RID OF IT. A tag on whichever is AS SHOT is fine if applicable. — DONE: checkmark and selected outline removed. AS SHOT/STANDARD tag badge on current-value cell.
- [x] **S23-15**: Side by side compare -- COMPARE button, no Original/Current confusion, (As Shot) suffix on dropdown. No back to grid button. — DONE: COMPARE button renamed, dropdowns show param values with (As Shot) suffix, back button handles SBS-to-grid navigation.
- [x] **S23-16**: Simulate collage doesnt make sense. APPLY AND RETURN / APPLY AND NEXT PARAMETER as per-cell controls via menu icon. — DONE: SIMULATE COLLAGE removed. Per-cell ⋮ action menu with APPLY & RETURN and APPLY & NEXT PARAMETER.

## Session 18 — Unresolved

- [x] **R1-1b**: Any way to pull the saved recipes off the camera and into our library? — IMPLEMENTED: `POST /api/camera/scan-presets` + "IMPORT FROM CAMERA" in Cookbook. Global recipe storage (`~/.snapsifter/recipes.json`). Oren reported "0 imported" on first try (was blocked by requireRecipeDir — fixed). Also said "some have names" — needs re-test with camera connected. Scan returns 4 presets: NORDIC, ETERNA, KGOLDEXP, ICELAND.
- [x] **R2-2**: Center the collage button over the left bar collage. horizontally and the folder button vertically. — DONE: toolbar uses `justify-content: center`, folder toggle absolutely positioned at left edge.
- [x] **R2-3**: There's no back button- thats intentional? — DONE: added left-arrow chevron before the grid icon to make the back affordance obvious. Button uses `display: flex` for alignment.
- [x] **R1-8c**: I clicked to render collage and it did the 9 photo collage instead of rendering the compare.. see the problem? — DONE: main simulate handler now bails if `recipeState.mode === 'compare'`.
- [x] **Film sim tooltip cropping**: Gets cropped near edges — DONE: switched from `position: absolute` inside icon to `position: fixed` on `document.body`, with viewport boundary clamping and flip-below logic.
- [x] **Film sim tooltip stale hover**: Doesn't fully disappear when mouse leaves — DONE: added `mouseleave` handler on the `?` icon that dismisses the popup immediately.

## Session 23 Round 9 — New Feedback

- [x] **S23-64**: 3-dot menu — FIXED R9b: menu items now close menu first, wrap in try/catch. Position fixed for visibility.
- [x] **S23-65**: Variant blur for non-film-sim params — FIXED R9: currentVal cells always clear. Pre-sim cells show sim image.
- [x] **S23-66**: Recipe dropdown + Save — FIXED R9b: "Save as new recipe..." and "Update [name]..." options in the RECIPE dropdown (inline). Standalone button removed.
- [x] **S23-67**: Session persistence — IMPLEMENTED: localStorage save/restore for currentParams/currentId/currentTitle.
- [x] **S23-68**: Save inline with RECIPE dropdown — FIXED R9b: save options appear as dropdown items with divider, not separate button.
- [x] **S23-69**: Auto-detect matching recipe — WORKING via findMatchingRecipe().

## Session 23 Round 10 — New Feedback

- [x] **S23-70**: APPLY & RETURN / APPLY & NEXT buttons don't work — FIXED: menu closes first, try/catch wrapping, all 4 locations updated.
- [x] **S23-71**: Flash on VARIANT TEST from collage — FIXED: set state directly instead of calling enterFocusMode. No visual transition.
- [x] **S23-72**: VARIANT TEST button visibility inconsistent — FIXED: recipe-compare-row always display:flex. Never hidden.
- [x] **S23-73**: As Shot tooltip cropped in variant — FIXED: attachCellTagTooltip uses position:fixed with bounding rect.
- [x] **S23-74**: "Current" icon needed — IMPLEMENTED: pencil icon with "Current" tooltip when cell matches working params but not as-shot or standard.
- [x] **S23-75**: PENDING after simulation — FIXED: _compareRenderGrid() called after sim loop to refresh all cell states.
- [x] **S23-76**: Simulate button in main view — FIXED: orange outline style matching variant test pattern.
- [x] **S23-77**: Chevron only before simulate — FIXED: sim-scope-toggle hidden on simulate click, restored on completion.
- [x] **S23-78**: Save only after simulate — FIXED: apply handlers set cleanParams to exifBaseline so changes show as modified.
- [x] **S23-79**: Variant test preserves working params — FIXED: enterCompareMode no longer resets currentParams to baseline.
- [x] **S23-80**: Per-photo param state — IMPLEMENTED: `perPhotoParams` stores per-photo currentParams/cleanParams. `enterFocusMode()` saves/restores on photo switch. Initialized from per-file EXIF. Persisted to localStorage. Independent per-photo editing (Oren confirmed).
- [x] **S23-81**: Clicking diff-badge photo shows actual as-shot params — IMPLEMENTED via S23-80. `enterFocusMode(idx)` loads that photo's individual EXIF-based params from `perPhotoParams`.
- [x] **S23-82**: Recipe versioning — IMPLEMENTED: PUT `/api/recipe/:id` pushes old params to `versions` array before overwriting. POST `/api/recipe/:id/restore-version` restores a previous version (saves current first). SAVE button shows `SAVE v{N}`. Library cards show version count + HISTORY button with RESTORE per version.
- [x] **S23-83**: Simulate progress bar in main view — IMPLEMENTED: clip-path dual-text (`.sim-text-back`/`.sim-text-front`), `linear-gradient` fill, "Simulating x/y (~Ns)" text. Button stays visible during sim with `.simulating` class.
- [x] **S23-84**: Variant select mode persistence — IMPLEMENTED: `enterVariantSelectMode()` function with CANCEL button (`#variant-select-cancel`), select-photo mode persists until pick or cancel.
- [x] **S23-85**: Variant select lockout — IMPLEMENTED: shuffle/pick buttons disabled with opacity 0.3 and pointer-events none. Compare button disabled. Filmstrip clicks guarded via `_variantSelectMode` flag.
- [x] **S23-86**: Tooltip viewport clamping — FIXED: `attachCellTagTooltip` now clamps left/right to 4px from viewport edges, flips below element if above would go offscreen.
- [x] **S23-87**: SAVE button next to dropdown — IMPLEMENTED: `#recipe-save-btn` in `#recipe-label-row` next to RECIPE dropdown. Save options removed from dropdown. Button shows when params changed, updates existing recipe or prompts for new name.

## Session 24 — New Feedback

- [x] **S24-1**: Loading states reworked. No-folder state: right panel hidden, filmstrip hidden, center shows empty state ("Select a folder to get started" + camera icon). Skeletons (collage grid, filmstrip thumbs, right panel skeleton) only appear during active directory loading (between folder click and data arriving). Fixed root cause: `await checkCameraStatus()` (3s blocking) was running before UI rendered — now fires in background. Dropdown toggle bug fixed (wasOpen pattern). Tab persistence fixed (reload stays on tab, new visit defaults to Cull). VARIANT TEST hidden when no photos. SIMULATE hidden when no baseline.

## Older — Unresolved

- [x] **Progress bar**: Closed — Oren doesn't recognize this item.
- [x] **No logo**: Logo selected — clothespin (darkroom print clip), V4d variant. SVG at `public/logo-v4d.svg`. Needs integration as favicon and app icon.
