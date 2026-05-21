# drkrm — Product Requirements Document

macOS desktop app for Fujifilm X-series photographers. Two integrated tools: photo culling and film simulation recipe building/testing.

---

## Target Customer

Fujifilm X-series owners (macOS) who shoot RAW or RAW+JPEG and care about film simulation recipes.

| Segment | Description | WTP | Size |
|---|---|---|---|
| Recipe enthusiasts | SOOC JPEG shooters | $20-40 | Largest volume |
| RAW+Recipe hybrid | Core power users, highest pain | $40-60 | Core |
| New Fuji converts | Gen Z / TikTok wave, impulse-buy | $20-30 | Growing |
| Working pros | Studio/commercial | $60-100 | Smallest |

## Problem

Fuji shooters cobble together 3-4 apps to do one workflow:

- **Recipe reference** — FujiXWeekly app (read-only, no rendering)
- **Recipe rendering** — X RAW Studio (terrible UX, requires camera tethered)
- **Culling** — Photo Mechanic ($139, no recipe awareness)
- **Editing** — Capture One / Lightroom (no native recipe param support)

No single tool integrates recipe workflow with culling.

## Core Features

### 1. Photo Cull (free tier)

- Ingest from SD cards and drives
- Keyboard-driven rate/sort/filter
- Supports HEIF, HIF, JPG, JPEG
- Diverse grid selection: algorithm picks representative photos across scenes
- Ratings persisted per directory (`ratings.json`)

### 2. Recipe Lab (Pro)

- Build, edit, save, version film simulation recipes
- Import recipes from connected camera
- **Dual rendering:**
  - Camera render — 100% accurate, ~1s/photo, USB tethered via PTP
  - Software preview (v1.1) — ~93% accurate, instant, no camera needed
- **Variant comparison** — same photo x different param values side-by-side
- Recipe management — save, version, import from camera, compare

### 3. Integrated Workflow

Rate/sort in Cull, then recipe-edit selected photos in Recipe Lab. One app, one session.

## What It's NOT

- Not a general RAW editor (no exposure/crop/etc beyond recipe params)
- Not a Lightroom/Capture One replacement
- Not cross-platform (macOS only)

## Differentiators

1. **Dual rendering** — software preview + camera render in one app
2. **Variant comparison** — same photo, different params, side-by-side
3. **Integrated cull-to-recipe workflow** — rate/sort then recipe-edit without switching apps
4. **Diverse grid selection** — algorithm picks representative photos across scenes
5. **Recipe management** — save, version, import, compare

---

## Architecture

| Layer | Technology |
|---|---|
| Backend | Express server |
| HEIF conversion | `sips` (macOS built-in) |
| EXIF parsing | `exifr` |
| Frontend | Single HTML file, inline CSS/JS, no frameworks |
| Camera bridge | Swift helper via ImageCaptureCore, PTP over USB |
| Software rendering (v1.1) | libraw (Markesteijn X-Trans demosaicing) + Core Image filter chain + custom .cube LUTs |
| State | `~/.drkrm/` for sessions, `ratings.json` per photo dir, `~/.drkrm/recipes.json` global |

## Rendering Pipeline

### Camera Render (v1.0 — done)

```
Node server → camera-bridge.js (JSON-RPC stdio) → Swift helper → ImageCaptureCore → ptpcamerad → USB → X-series camera
```

- ~1s per photo
- 100% accurate to camera output
- Requires camera connected via USB

### Software Preview (v1.1 — planned)

```
RAF → libraw (X-Trans demosaicing) → .cube LUT (film sim) → Core Image filters (tone/sat/sharp/WB/DR/clarity/grain/color chrome)
```

- Instant rendering
- ~90-93% accuracy vs camera output
- No camera needed

**LUT generation method:** Shoot X-Rite ColorChecker through all 20 film sims on camera, extract color transform per sim, build .cube files. Clean IP — derived from camera output, not reverse-engineered firmware.

---

## Pricing

| Tier | Price | Includes |
|---|---|---|
| Photo Cull | Free | Culling only (funnel) |
| drkrm Pro | $49 one-time | Cull + Recipe Lab |
| Lifetime updates | $79 | All future updates included |
| Major version upgrade | $29 | v2.0+ for existing Pro users |

## Distribution

- Direct download (DMG), signed + notarized
- LemonSqueezy or Paddle as Merchant of Record
- 14-day full trial, then degrades to Cull-only without license
- No Mac App Store initially (sandboxing blocks PTP access)

## Versioning Roadmap

| Version | Scope | Status |
|---|---|---|
| v1.0 | Camera rendering + culling | Done, needs polish |
| v1.1 | Software preview mode (flagship update) | Planned |
| v2.0 | Recipe sharing, community library, Windows assessment | Future |
