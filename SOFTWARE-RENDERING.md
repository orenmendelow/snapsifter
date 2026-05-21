# Software-Based Film Simulation Rendering

## Summary

Software preview at ~90-93% accuracy is feasible. Camera rendering remains 100% accurate gold standard. Software mode enables preview without USB-connected camera (v1.1).

## Pipeline Architecture

```
RAF -> libraw (Markesteijn 3-pass X-Trans demosaicing) -> .cube LUT (film simulation) -> Core Image filter chain (tone/sat/sharp/WB/DR/clarity/grain/color chrome)
```

All on macOS. GPU-accelerated via Core Image.

## Parameter Accuracy Breakdown

| Parameter | Implementation | Accuracy |
|-----------|---------------|----------|
| Film Simulation base | 3D LUT (.cube) | ~95% |
| Highlight Tone (-2 to +4) | CIToneCurve | ~98% |
| Shadow Tone (-2 to +4) | CIToneCurve | ~98% |
| Color/Saturation (-4 to +4) | CIColorControls | ~98% |
| Sharpness (-4 to +4) | CIUnsharpMask | ~98% |
| White Balance + WB Shift | Color temperature filter | ~98% |
| Dynamic Range (100/200/400) | Push processing / tone mapping | ~90% |
| Clarity (-5 to +5) | Local contrast enhancement | ~90% |
| High ISO NR (-4 to +4) | Variable-strength noise reduction | ~85% |
| Grain Effect (size + roughness) | Luminance-dependent noise generator | ~70-80% |
| Color Chrome Effect | Saturation mask + curve targeting saturated zones | ~75-85% |
| Color Chrome FX Blue | Blue-channel saturation mask + curve | ~75-85% |

## LUT Sourcing Options

### Option 1: Generate Own LUTs (RECOMMENDED)

Shoot X-Rite ColorChecker Passport through all 20 film sims on X100VI. Script extracts color transform from RAW-JPEG pairs and builds .cube files.

- Pros: Clean IP, no license restrictions, calibrated to real camera output
- Cons: Medium effort (weekend of shooting + build script)
- This is how Capture One and Stuart Sowerby both built their profiles

### Option 2: Fujifilm Official .cube LUTs

Free download from fujifilm-x.com/en-us/support/download/lut/

- 10 film sims (Velvia, Provia, Astia, Classic Chrome, Eterna, etc.)
- Designed for F-Log2 video input -- needs input space conversion for stills RAW
- Redistribution terms unclear -- needs legal review before bundling
- Missing several sims (no Classic Neg, no Nostalgic Neg, no Acros variants)

### Option 3: Stuart Sowerby's HaldCLUTs

https://blog.sowerby.me/fuji-film-simulation-profiles/

- 15 sims including Acros variants. Reverse-engineered from SILKYPIX output.
- "Almost indistinguishable from OOC JPEG on every image tested"
- Known limitation: Acros grain is ISO-dependent, not captured by static LUT
- License: Not explicitly stated, likely non-commercial. Cannot use without clarification.

### Option 4: abpy/FujifilmCameraProfiles

https://github.com/abpy/FujifilmCameraProfiles

- DCP profiles, .cube LUTs (DisplayP3 + sRGB), HaldCLUT PNGs, ICC profiles
- 11 sims. Created from Adobe Camera Raw matching profiles.
- License: CC-BY-NC-SA 4.0 -- BLOCKS COMMERCIAL USE. Cannot bundle in paid app.

### Option 5: Fujify (Commercial)

https://fujify.me -- Per-camera calibrated LUTs for Lightroom.

- No embedding license available without custom negotiation.

### Option 6: Fujifilm's Official F-Log2 LUTs (for reference)

Free, but designed for video (F-Log2 input). Would need linear-to-log conversion step.

## X-Trans Demosaicing

- Fujifilm uses 6x6 X-Trans CFA pattern (not standard 2x2 Bayer)
- libraw with Frank Markesteijn's 3-pass algorithm is production-grade
- Output "identical to Iridient even under 1:1 inspection" per detailed testing
- The "worm artifact" that plagued early Adobe X-Trans support is solved
- Available via libraw C++ API -- needs Node native addon or Swift helper extension

## Key Libraries

| Library | Purpose | Integration |
|---------|---------|-------------|
| libraw | RAF unpacking + X-Trans demosaicing | C++, needs native addon or Swift bridge |
| Core Image (macOS) | GPU-accelerated filter chain | Native Swift/ObjC. CIColorCubeWithColorSpace for LUTs, CIToneCurve, CIColorControls, CIUnsharpMask |
| SwiftCube | .cube LUT to Core Image filter | https://github.com/ronan18/SwiftCube |
| CocoaLUT | LUT import/export/manipulation | Obj-C/Swift |

## Fujifilm Source Code Access

No. Fully proprietary. No leaked specs, no documented algorithms. Patents exist (image processing, color reproduction) but describe high-level approaches only. The d185 profile format (625 bytes) is reverse-engineered by the community (FilmKit project) -- drkrm already reads/writes it -- but that encodes parameters, not the rendering engine.

## Proof That Software-Only Works

SILKYPIX RAW File Converter (free, Fujifilm-authorized partner) processes RAF files with full film sim support, no camera required. Closed-source, can't embed. But proves the approach is viable.

Capture One's Fujifilm film simulations use custom ICC profile curves from a data-sharing arrangement with Fujifilm. Not available to third parties.

## Existing Open Source Pattern

bastibe/Fujifilm-Auto-Settings-for-Darktable (https://github.com/bastibe/Fujifilm-Auto-Settings-for-Darktable) -- Lua plugin that reads film simulation from RAF EXIF, auto-applies matching LUT. Uses Sowerby's HaldCLUTs. Demonstrates the pattern drkrm needs: read recipe metadata, apply matching LUT, adjust params.

## Implementation Plan

1. Shoot ColorChecker through all 20 film sims on X100VI
2. Build script to extract color transforms and generate .cube LUT files
3. Extend Swift helper (or add Node native addon) for libraw X-Trans demosaicing
4. Build Core Image filter chain for remaining recipe parameters
5. Add Preview / Camera Render toggle in UI
6. Add preview caching layer (rendered previews stored alongside .sim-cache/)
7. Ship as v1.1 free update

## AI/Neural Network Approaches (for reference, not planned)

- fylm.ai / NeuralFilmAI uses DNNs trained on cinematic frames. Cloud SaaS, not embeddable.
- Academic research (arxiv.org/pdf/2104.05237) on neural camera simulators could theoretically model Fuji rendering from paired RAF+JPEG training data. Significant ML engineering effort. Future possibility if LUT approach proves insufficient.
