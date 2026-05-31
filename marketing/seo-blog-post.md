# X RAW Studio vs drkrm: What's Different

*Target keywords: "x raw studio alternative", "fujifilm recipe tool mac", "fuji film simulation comparison tool"*

---

X RAW Studio is Fujifilm's free desktop app for processing RAW files with your camera's image processor. It connects over USB, sends your RAF files to the camera for rendering, and saves the output. It's been around since 2018 and does exactly what it says.

So why build something else?

## The workflow problem

X RAW Studio processes one photo at a time. You open a RAF, adjust settings, hit "Convert", wait, check the result. Want to see how Classic Neg compares to Nostalgic Neg on the same photo? Convert once. Change the setting. Convert again. Open both files. Compare.

Multiply that by 20 film simulations and 15 adjustable parameters.

The math gets tedious fast. Testing a single parameter across all options means 10-20 individual conversions, manually comparing files in Finder or Preview. Building a complete recipe from scratch — isolating each parameter's effect — takes hours of repetitive clicking.

## What drkrm does differently

drkrm also connects to your camera over USB and uses the camera's actual processor. Same rendering pipeline. Same output quality. The difference is workflow.

### Variant Test

Pick any parameter — film simulation, white balance, grain size, color chrome, anything. drkrm renders every available option as a variant on your photo, automatically. Ten film simulations? Ten renders, displayed in a grid. Compare them all at once. Click to zoom — all variants zoom together with synced pan.

Pick your favorite. Apply it. Move to the next parameter. Repeat until your recipe is built.

### Side-by-side comparison

Any two variants, displayed next to each other with synced zoom. Pan across fine detail in both simultaneously. No opening files in separate windows, no flipping back and forth.

### Multiple photos

Load a collage of 9 photos from a shoot. See how your recipe looks across different scenes, lighting conditions, subjects. Simulate the entire collage at once. A recipe that looks great on one photo might fall apart on another — catch that before you commit to it.

### Per-photo state

Each photo in your collage maintains its own parameter state. Click into a photo, tweak settings, simulate. The next photo keeps its own settings. Useful when photos in a set were shot with different recipes and you want to compare each one's starting point.

## What stays the same

Both apps use the camera's actual image processor over USB. The output is identical — same JPEG rendering you'd get shooting in-camera. Neither is doing software emulation or approximation.

Both require your camera connected via USB. Both work with RAF files. Both are Mac-only (X RAW Studio is also on Windows; drkrm is Mac/Apple Silicon only).

## What's different: summary

| | X RAW Studio | drkrm |
|---|---|---|
| Price | Free | Photo Cull free, Recipe Lab $49 |
| Render per photo | One at a time | All variants at once |
| Comparison | Manual (separate files) | In-app grid + SBS with synced zoom |
| Parameter isolation | Manual workflow | Built-in (pick param, see all options) |
| Multiple photos | One at a time | 9-photo collage, batch simulate |
| Photo culling | No | Yes (free, keyboard shortcuts) |
| Recipe library | Camera Custom slots only | Unlimited saved recipes + versioning |
| Import from camera | No | Yes (reads all 7 Custom slots) |
| Platform | Mac + Windows | Mac only (Apple Silicon) |

## Photo Cull (free)

Separate from Recipe Lab, drkrm includes a photo culler. Load a folder from your SSD, scrub through photos with arrow keys, rate with keyboard shortcuts (1 = ditch, 2 = maybe, 3 = like). Filter by rating. Sort into folders. Resume where you left off.

It handles HIF/HEIF, JPG, and carries RAF files along during sort. Designed for the post-shoot "pick the keepers" step before you start editing or testing recipes.

Free forever, no feature gates.

## Who drkrm is for

Fujifilm X-series photographers who:

- Build their own film simulation recipes (rather than importing other people's)
- Want to see how every option for a parameter looks before committing
- Shoot large volumes and need fast culling before recipe work
- Are tired of the one-at-a-time conversion workflow in X RAW Studio
- Want a recipe library that isn't limited to 7 Custom slots

## Requirements

- macOS 13.5+ (Ventura or later)
- Apple Silicon (M1/M2/M3/M4)
- Fujifilm X-series camera with USB tethering support
- USB cable (camera to Mac)

## Try it

Photo Cull is free at [drkrm.app](https://drkrm.app). Recipe Lab has a 14-day trial — full features, no watermark during trial.

---

*drkrm is built by Oren Mendelow (Mendelow LLC). Questions: support@drkrm.app*
