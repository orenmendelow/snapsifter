# SnapSifter — Open Feedback

Verbatim from Oren. Check off when completed and visually verified.

## Session 18 — Unresolved

- [x] **R1-1b**: Any way to pull the saved recipes off the camera and into our library? — IMPLEMENTED: `POST /api/camera/scan-presets` + "IMPORT FROM CAMERA" in Cookbook. Global recipe storage (`~/.snapsifter/recipes.json`). Oren reported "0 imported" on first try (was blocked by requireRecipeDir — fixed). Also said "some have names" — needs re-test with camera connected. Scan returns 4 presets: NORDIC, ETERNA, KGOLDEXP, ICELAND.
- [ ] **R2-2**: Center the collage button over the left bar collage. horizontally and the folder button vertically. (CSS applied — `align-self: flex-start` — but not visually verified on device.)
- [ ] **R2-3**: There's no back button- thats intentional? (Grid icon IS the back button but may not be obvious. No explicit back arrow or label added.)
- [ ] **R1-8c**: I clicked to render collage and it did the 9 photo collage instead of rendering the compare.. see the problem? (Dedicated compare handler exists, but having both simulate buttons visible could still confuse.)

## Older — Unresolved

- [ ] **Progress bar**: Increased to 5px with hover text. May still be too subtle.
- [ ] **No logo**: Favicon is aperture SVG. No app logo yet.
