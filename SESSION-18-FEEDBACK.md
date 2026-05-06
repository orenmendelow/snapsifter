# Session 18 Feedback (Raw, verbatim from Oren)

## Round 1 (first feedback after initial implementation)

1. It shows the film simulation (ex: RealaACE) which is just ONE aspect of the entire recipe. So that's not exactly helpful. Should say As Shot OR if we have the NAME OF THE RECIPE, display that-- if it matches a recipe we have on file. Any way to pull the saved recipes off the camera and into our library?
2. Save as new recipe should only be an option if i change it to a set of parameters that dont match an existing recipe. Load recipe should be offered at the top, not the bottom.
3. Simulate needs to be clearer-- just show a simulate button please. Default should be to simulate what's in view so single photo when in single photo view, collage in collage view. Simulate should have dropdown from within single photo view when one of the collage to simulate the collage. To simulate the entire library let's have a button somewhere else with an are you sure. Rename library top right to cookbook since thats where people keep recipes! Click and hold to compare works great.
4. Fantastic. Can we make click hold a touch faster maybe 150ms? thanks.
5. Addressed earlier. I like the revert button if the settings dont match as shot-- just have two buttons side-by-side, thanks. Save new recipe should be up top where we can load recipes in that right-side drawer. Understand the flow?
6. Nice (layout shift)
7. Nice (714 available removed)
8. OK. Compare button is up there and confusing, didn't see it there! I feel like it should also be on the right since when we're in compare mode we wont need access to the right drawer as it typically exists. Testing compare functionality: how do I change selections? It just gives me 6 film simulations. Actually-- this is cool, I like how you did it, a lot. Rendering the button is confusing on compare where to click but youll fix that when you relocate this functionality to the right. There are only 6 film simulations? No way. Ack-- I clicked to render collage and it did the 9 photo collage instead of rendering the compare.. see the problem? Final comment- the folder to open the left side file browse drawer needs to stay above in line with the collage grid button and the back button when the drawer is open (collage button disappears but both states should exist at same UI height). ALSO-- I think we need a back button EXAMPLE: If Im looking at an individual photo from the collage, then click a photo from the timeline-- I should have option to go back and view the individual photo from collage OR click collage button. So same thing if I click photo and then another photo from the timeline and want to go back. Is that possible? not a big deal if not.

## Round 2 (post-implementation feedback)

1. BUG: If I open the file browse drawer and then click the directory that Im already in, it loads it anew and loads a new collage- it should know and just close the drawer instead of loading the same directory again.
2. Center the collage button over the left bar collage. horizontally and the folder button vertically.
3. There's no back button- thats intentional?
4. Compare right side has no simulate button.
5. Also I dont mind that you offer all values but let me x out some values and if i want to add them back ill open the dropdown and check them back. Or better maybe have the boxes fill/no fill so I can select-- default to as-shot checked and then I can check off more or less as I want-- let those options depending on how many fill the right side view and then of course have simulate button down there, makes sense?
6. How are we comparing this many variants? If I change settings I should be able to simulate or cancel (sets settings to what they were at last simulate).
7. Then a button maybe up top near "as shot" to "revert to as shot".
8. "this photo" dropdown just have it as a subtext of simulate button with a dropdown built into the button.
9. Load recipe should be at the top and make all dropdowns fit the UI style- square, orange and outlines, etc.
10. Question mark tooltips on recipe options doesnt do anything, FYI.
11. Why does my cookbook have so many "no recipe" cards? That makes no sense.

## Round 3

12. Vertically center the collage squares (gallery strip) to the main photo in individual photo view.

---

## Audit: Code vs. Claims

### Round 1

| # | Feedback | Status | Evidence |
|---|----------|--------|----------|
| 1a | As-Shot label shows recipe name if matched | VERIFIED | `renderParams()` line ~5010: shows "As-Shot: {recipe.title}" badge or "As Shot" |
| 1b | Pull recipes from camera | NOT IMPLEMENTED | Researched only (D18E-D1A5 PTP). No code to read presets. |
| 2 | Save-as conditional + load at top | VERIFIED | `#recipe-save-as-btn` display controlled by `findMatchingRecipe()` in `checkParamsChanged()`. Load select is in `#recipe-drawer-top` above params. |
| 3 | Single simulate button, scope dropdown, COOKBOOK rename | VERIFIED | Single `#simulate-btn` with scope subtext. `#recipe-library-btn` says "COOKBOOK". |
| 4 | Hold-to-compare 150ms | VERIFIED | Both `focusHoldTimer` and `cellHoldTimer` use `setTimeout(..., 150)` |
| 5 | Revert + simulate side-by-side, save-as at top | VERIFIED | Both in `#simulate-row` (flex row). Save-as in `#recipe-drawer-top`. |
| 6 | Layout shift | N/A | Oren said "Nice" |
| 7 | 714 available removed | N/A | Oren said "Nice" |
| 8a | Compare moved to right panel | VERIFIED | `#compare-right-controls` exists, `enterCompareMode()` shows it and hides params |
| 8b | All film sims shown | VERIFIED | No `.slice(0, 6)` — full options array used in `initCompareMode()` |
| 8c | Simulate from compare does compare (not collage) | VERIFIED | `#compare-simulate-btn` has dedicated handler (line 6276) that renders per-value, not collage |
| 8d | Folder toggle same height as toolbar | VERIFIED | `#recipe-left-toggle` has `align-self: flex-start` |
| 8e | Focus mode nav history (back button) | VERIFIED | `recipeState.focusHistory` push/pop logic exists (lines 4530, 6256) |

### Round 2

| # | Feedback | Status | Evidence |
|---|----------|--------|----------|
| 1 | Same-dir reload bug | VERIFIED | `lastLoadedDir` check at line 5608 skips re-fetch if same dir |
| 2 | Collage button / folder button alignment | NEEDS VISUAL CHECK | CSS only — `align-self: flex-start` on toggle. No screenshot taken. |
| 3 | Back button visibility | UNCLEAR | Grid icon IS the back button. No explicit "back" arrow. May confuse users. |
| 4 | Compare simulate button | VERIFIED | `#compare-simulate-btn` in HTML (line 2581) + event listener (line 6276) |
| 5 | Value checkboxes (fill/no-fill, toggle) | VERIFIED | `.compare-value-chip.active` toggle pattern. Chips clickable. |
| 6 | Cancel (revert to last-sim state) | VERIFIED | `#cancel-to-last-sim-btn` + `lastSimParams` state + show/hide logic in `checkParamsChanged()` + click listener |
| 7 | Revert to as-shot up top | VERIFIED | `revertTop` button created inline in `renderParams()` next to "As Shot" label when params differ |
| 8 | "This photo" as subtext on simulate | VERIFIED | `#sim-scope-toggle` label inside button, click toggles photo/collage |
| 9 | Dropdowns match UI style | VERIFIED | `border-radius:0`, `appearance:none`, custom SVG chevron, orange hover on `#recipe-load-select` and `#compare-param-select` |
| 10 | Tooltip ? icons | VERIFIED | `showParamTip()` function + `.param-tip-popup` CSS + click listeners on both dropdown and slider tip icons |
| 11 | Cookbook "no recipe" cards | VERIFIED | `renderLibrary()` filters out recipes with generic titles + default params. `saveRecipe()` now requires `currentId` (no auto-creating new entries). |

### Round 3

| # | Feedback | Status | Evidence |
|---|----------|--------|----------|
| 12 | Gallery strip vertically centered | VERIFIED | `#focus-gallery` has `justify-content: center` (line 355) |

### Unresolved / Needs Attention

- **1b**: Camera recipe extraction — researched, not implemented
- **R2-2**: Button alignment — CSS applied but not visually verified
- **R2-3**: Back button affordance — grid icon may not be obvious as "back". No explicit back arrow added.
- **R1-8c**: Compare-vs-collage simulate confusion — dedicated handler exists, but the UX of having BOTH a compare simulate and a main simulate visible at once could still confuse
