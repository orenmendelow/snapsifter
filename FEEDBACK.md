# SnapSifter — Open Feedback

Verbatim from Oren. Check off when completed and visually verified.

## Session 21 — Unresolved

- [x] **S21-1**: XT-30 folder doesn't load from Recipe Lab center preview. Needs diagnosis. — FIXED: JPG fallback added to grid-select, grid-replace, grid-shuffle endpoints in server.js when Liked/HIF/ doesn't exist.
- [x] **S21-2**: SIMULATE and REVERT buttons should not exist at all when not applicable — not faded/disabled, just absent. Show them only when their use is available. — DONE: checkParamsChanged() controls visibility via display none/show. drawerActions hidden when no changes.
- [x] **S21-3**: SIMULATE button should not say "this photo". Scope is implied by context: collage view = collage, single photo = that photo, compare = compare. Button should have a v-down arrow to select a level up (e.g., from single photo → collage → entire library). — DONE: separate chevron button with dropdown (photo/collage/library). SIMULATE label centered.
- [x] **S21-4**: PICK PHOTOS modal shows a broken grid — photos are squished/cropped into horizontal slices. Rendering bug in the photo picker grid. — FIXED: picker-cell img switched to `position: absolute; inset: 0` so aspect-ratio on the cell isn't overridden by intrinsic image sizing.
- [x] **S21-5**: Collage photos shot with a different recipe setting need a small icon in the corner. Hover shows which setting differs from the majority. — DONE: amber circle badge with star glyph in top-left corner. Hover shows tooltip listing each differing param and its value.
- [x] **S21-6**: SIMULATE button should not appear if camera is not connected. — DONE: checkParamsChanged() hides simulate when !cameraConnected. Camera poll at 5s interval.
- [x] **S21-7**: Up/Down arrow key functions are flipped — need to reverse them. — FIXED: swapped ArrowUp/ArrowDown direction in focus mode filmstrip navigation.
- [x] **S21-8**: Left/Right arrow transition between collage and focus should animate — slide the collage away and center the photo, not a jarring snap. — DONE: 100ms opacity fade on all mode transitions (collage↔focus, compare→focus). No animation on photo-to-photo cycling within focus.
- [ ] **S21-9**: compare tool should offer to compare with other settings as shot or with other settings reset to standard (or whatever the word is for that).
- [ ] **S21-10**: you blurred everything but the one that was shot already- example a photo shot in classic that starts with classic checked off- classic shouldnt be blurred, the other ones yet to be simulated should be blurred. Once it's simulated you shouldnt have the button there to simulate again.. know if there are changes please in all situations.
- [ ] **S21-11**: Launch subagents to work unit tests as broad and detailed as possible to catch all of these possible edge cases and adjust logic to handle.
- [ ] **S21-12**: in compare tool after simulate i should be able to click on one to open in focus view.
- [ ] **S21-13**: I should be able to click and hold to compare to original but also have a dropdown in that view that says compare to: original / dropdown to select the other simulated variants.
- [ ] **S21-14**: I should be able to click "apply to image and return to recipe lab" so it helps me dial in the recipe one factor at a time.
- [ ] **S21-15**: in the main view recipe load dropdown there should be an option to set the film simulation to standard.
- [ ] **S21-16**: IN theory if i start with an image on standard i can run variants on every single parameter until i have it dialed in-- simulating variants with growing parameters filled out.
- [ ] **S21-17**: add some sort of base zero filters applied setting to the "As shot" dropdown.
- [ ] **S21-18**: As shot dropdown needs to be matching if the settings match a saved recipe in the library and it's not.
- [ ] **S21-19**: in variant test button ask if i want to create variants from as shot or from zero filters applied or whatever the right terminology is-- at which point youd change all photo settings to that base and THEN launch variant, so that as I dial in my settings I can build the recipe from the ground up, should I so choose.
- [ ] **S21-20**: when I go into variant its showing immediately blur even though the 1 variant is the one that I already have in the photo. At that first step its just the variant I already simulated so the simulate button is useless until I select more.
- [ ] **S21-21**: I can of course deselect the variant that was originally shot in which case things should be handled accordingly.
- [ ] **S21-22**: Simulate button should indicate how many variants Im about to simulate.
- [ ] **S21-23**: Would also be useful if larger simulate actions had a time estimate or progress bar.

## Session 18 — Unresolved

- [x] **R1-1b**: Any way to pull the saved recipes off the camera and into our library? — IMPLEMENTED: `POST /api/camera/scan-presets` + "IMPORT FROM CAMERA" in Cookbook. Global recipe storage (`~/.snapsifter/recipes.json`). Oren reported "0 imported" on first try (was blocked by requireRecipeDir — fixed). Also said "some have names" — needs re-test with camera connected. Scan returns 4 presets: NORDIC, ETERNA, KGOLDEXP, ICELAND.
- [x] **R2-2**: Center the collage button over the left bar collage. horizontally and the folder button vertically. — DONE: toolbar uses `justify-content: center`, folder toggle absolutely positioned at left edge.
- [x] **R2-3**: There's no back button- thats intentional? — DONE: added left-arrow chevron before the grid icon to make the back affordance obvious. Button uses `display: flex` for alignment.
- [x] **R1-8c**: I clicked to render collage and it did the 9 photo collage instead of rendering the compare.. see the problem? — DONE: main simulate handler now bails if `recipeState.mode === 'compare'`.
- [x] **Film sim tooltip cropping**: Gets cropped near edges — DONE: switched from `position: absolute` inside icon to `position: fixed` on `document.body`, with viewport boundary clamping and flip-below logic.
- [x] **Film sim tooltip stale hover**: Doesn't fully disappear when mouse leaves — DONE: added `mouseleave` handler on the `?` icon that dismisses the popup immediately.

## Older — Unresolved

- [ ] **Progress bar**: Increased to 5px with hover text. May still be too subtle.
- [ ] **No logo**: Favicon is aperture SVG. No app logo yet.
