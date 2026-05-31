# drkrm Marketing Plan

## Pre-Launch Blockers

- [ ] Apple Developer enrollment (code signing required before any downloads)
- [ ] LemonSqueezy product created + checkout wired
- [ ] Demo video recorded (see Script below)
- [ ] App screenshot set (5 screens, see list below)

---

## Assets Needed

### Demo Video (60-90 seconds, for landing page + social)

**Script outline:**
1. (0-5s) Cold open: dark screen, "drkrm" fades in
2. (5-20s) Photo Cull: load SSD folder, scrub through photos with 1/2/3 keys, show speed
3. (20-40s) Recipe Lab: open collage, tweak film sim params, show before/after hold-to-compare
4. (40-60s) Variant Test: pick a parameter, simulate 6 variants on camera, see results appear
5. (60-75s) SBS Compare: drag two variants side-by-side, synced zoom into detail
6. (75-90s) End card: "drkrm.app — Photo Cull free forever. Recipe Lab $49."

**Format:** Screen recording (macOS, dark UI photographs well). No voiceover — text captions only. Lo-fi electronic or ambient music bed. Export 1920x1080 + 1080x1080 (social crop).

### Screenshots (for landing page, Product Hunt, press kit)

1. Photo Cull filmstrip view (rated photos, amber highlights)
2. Recipe Lab collage (9-photo grid with film sim badges)
3. Variant Test grid (6+ rendered variants, AS SHOT tag)
4. SBS Compare (two variants side-by-side, synced zoom)
5. Focus mode (single photo, recipe params in right panel)

### Press Kit (`landing/press/` directory)

- [x] App icon (PNG, 1024x1024) — `landing/press/icon.png`
- [x] Logo SVG — `landing/press/logo.svg`
- [ ] 5 screenshots (2880x1800, retina) — Oren records
- [ ] Demo video (MP4, 1080p) — Oren records (shot list at `marketing/demo-shot-list.md`)
- [x] One-paragraph description — `landing/press/description.txt`
- [ ] Founder headshot + bio (optional)
- [x] Press page live — `landing/press.html` (drkrm.app/press)

### One-Paragraph Description

> drkrm is a Mac app for Fujifilm X-series photographers. Photo Cull lets you scrub through hundreds of photos with keyboard shortcuts — rate, filter, sort into folders. Recipe Lab connects to your camera over USB to test film simulation recipes on your actual photos. Pick a parameter, render every option as a variant, compare side-by-side, and dial in your recipe one setting at a time. Photo Cull is free forever. Recipe Lab is $49.

---

## Channel Plan

### 1. r/fujifilm (254K members) — HIGHEST PRIORITY

**When:** Week of launch, ideally Tuesday-Thursday for peak engagement.

**Post title options:**
- "I built a free Mac app for culling Fuji photos + testing film sim recipes on your camera"
- "drkrm — free photo culler + recipe lab that connects to your X-series camera over USB"

**Post body draft:**

```
I've been shooting Fuji for years and got tired of X RAW Studio's workflow for
testing recipes. So I built drkrm.

**Photo Cull** (free forever): Load photos from your SSD, rate with keyboard
shortcuts (1/2/3), filter, sort into folders. Handles HIF/HEIF, JPG, and carries
RAF files along.

**Recipe Lab** ($49): Connects to your Fuji camera over USB. Load your photos,
tweak recipe parameters, then hit Simulate — the camera renders each variant
using its actual film sim processor. Compare side-by-side, apply settings, dial
in your recipe one parameter at a time.

It's a native Mac app (macOS 13.5+, Apple Silicon). No subscription.

Demo video: [link]
Website: drkrm.app

Would love feedback from other Fuji shooters. What's your recipe workflow look like?
```

**Rules:** r/fujifilm allows self-promotion if you're an active community member. Engage genuinely in the sub for 2-3 weeks before posting. Respond to every comment on launch day.

**Polished version (ready to post):**

```
Title: I built a free Mac app for culling Fuji photos + testing film sim recipes on your camera

I shoot Fuji and kept running into the same two problems. First, culling hundreds
of photos from a trip was tedious — dragging files around Finder, trying to remember
which ones I liked. Second, testing film simulation recipes meant using X RAW Studio,
which only works with specific camera+computer combos, doesn't let you compare
variants, and has a workflow from 2015.

So I built drkrm (darkroom).

**Photo Cull** is free, forever. Load a folder from your SSD, scrub through photos
with arrow keys, rate with 1/2/3 (ditch/maybe/like), filter by rating, sort into
folders. It handles HIF, JPG, and carries your RAF files along when you sort. The
goal is speed — you should be able to cull a 500-photo trip in 20 minutes.

**Recipe Lab** connects to your Fuji camera over USB. Load your liked photos, tweak
recipe parameters in the app, then hit Simulate — your camera renders each variant
using its actual film simulation processor. Not a software approximation. The real
thing. You see every film sim on your actual photo, compare side-by-side with synced
zoom, and build your recipe one parameter at a time.

The idea is: instead of dialing in a recipe by looking at the name "Nostalgic Neg"
and guessing how it'll look on your photos, you render all 20 film simulations on
a photo you actually shot, compare them at pixel level, then move to the next
parameter (grain, color chrome, white balance, etc.) and do the same thing.

It's a native Mac app. macOS 13.5+, Apple Silicon. No subscription, no cloud.
$49 one-time for Recipe Lab, or $79 for lifetime (all future versions).

Demo: [link]
Website: drkrm.app

I'd genuinely love to hear how other Fuji shooters approach recipe building. Do you
start from a preset and tweak? Copy recipes from blogs? Start from Standard and
adjust? Curious what the workflow looks like for others.
```

---

### 2. Fuji X Weekly (Ritchie Roesch) — HIGHEST SIGNAL

**What:** Email pitch for blog review/feature. Ritchie's endorsement reaches 80-100K regular readers who specifically care about film sim recipes.

**Email draft:**

```
Subject: drkrm — Mac app that tests film sim recipes on your camera

Hi Ritchie,

I built a Mac app called drkrm for Fujifilm photographers. The part I think
you'd find interesting is Recipe Lab — it connects to your X-series camera
over USB and uses the camera's actual processor to render film sim variants.

You pick a parameter (say, film simulation), it renders every option as a
variant on your photo, and you compare them side-by-side. Then you apply
your pick and move to the next parameter. It's basically a way to build
recipes one setting at a time using the camera's real rendering.

It also has a free photo culler with keyboard shortcuts for fast rating.

I'd love to send you a license if you're interested in trying it. No
expectations — just think it's relevant to what you cover.

Website: drkrm.app
Demo: [link]

— Oren Mendelow
```

**Timing:** Send 1-2 weeks before public launch. Give him time to try it.

---

### 3. Product Hunt

**When:** Schedule for a Tuesday or Wednesday. Prep 4-6 weeks ahead.

**Listing copy:**

```
Tagline: Free photo culler + film sim recipe lab for Fujifilm shooters

Description:
drkrm is a Mac app for Fujifilm X-series photographers.

Photo Cull (free): Rate photos with keyboard shortcuts, filter by rating,
sort into folders. Handles HEIF, JPG, and RAW files.

Recipe Lab ($49): Connects to your camera over USB. Test film simulation
recipes by rendering real variants on the camera's processor. Compare
side-by-side, dial in settings one parameter at a time.

No subscription. No cloud. Your photos stay on your drive.

Topics: Photography, Mac, Productivity
```

**First comment (from maker account):**

```
Hey PH! I'm Oren, the developer behind drkrm.

I've been shooting Fuji for years. The recipe workflow always felt broken — you find
a recipe on a blog, type the settings into your camera, shoot a few frames, and hope
it looks right. If it doesn't, you adjust one setting, shoot again, and repeat.
There's no way to see all your options at once or compare them on a photo you
actually care about.

drkrm connects to your camera over USB and uses the camera's own image processor to
render variants. You pick a parameter — say, film simulation — and the app renders
every option on your photo. You see Provia, Velvia, Classic Neg, Nostalgic, all 20
film sims, side by side. Pick the one you like, move to the next parameter (grain
size, color chrome, white balance), and do the same thing. You build the recipe
visually, one setting at a time.

The photo culler is free because every photographer needs one and I didn't want
pricing to be a barrier. Recipe Lab is $49 one-time — no subscription.

I'm a solo developer, so if you hit a bug or have a feature idea, email
support@drkrm.app and you'll hear from me directly.

Would love to know — what does your recipe workflow look like today?
```

**Prep:**
- [ ] Create Product Hunt maker profile
- [ ] Get 3-5 friends to leave genuine first comments at launch
- [ ] Upload demo GIF/video, 5 screenshots
- [ ] Share PH link on all channels day-of

---

### 4. YouTube Creator Outreach

**Targets (prioritized by relevance to recipe content):**

| Creator | Subscribers | Why | Email/Contact |
|---------|------------|-----|---------------|
| Fuji X Weekly (Ritchie Roesch) | 18K | THE recipe authority | roeschphotography@yahoo.com |
| pal2tech (Chris Lee) | 226K | Fuji settings explainer | media@pal2tech.com |
| Kevin Mullins | 47K | Recipe creator + Recipe Maker tool | kevin@kevinmullinsphotography.co.uk |
| Reggie Ballesteros | 93K | "Stop shooting RAW" + recipe seller | info@reggiebphotography.com |
| Eren Sarigul | 59K | Street/travel, shoots RAW (weakest fit) | hello@erenjam.com |

**Personalized emails:** See `marketing/creator-outreach.md` — individualized pitches for all 5 creators with verified contact info and content-specific hooks.

**Note:** Send app + license key, not just a pitch. Let them try it unpressured. Follow up once after 2 weeks if no response.

---

### 5. Press Pitch (PetaPixel, The Phoblographer, Digital Camera World, Fstoppers)

**Personalized emails:** See `marketing/press-emails.md` — individualized pitches for PetaPixel (Jeremy Gray), The Phoblographer (Chris Gampat), Digital Camera World (Kim Bunermann), Fstoppers (Alex Cooke) with verified contact info and content-specific hooks.

---

### 6. Facebook Groups

**Targets:**
- Fujifilm Film Simulations (134K members)
- Fujifilm Film Simulations SOOC
- Regional Fujifilm groups

**Post format:** Shorter than Reddit. Lead with the demo video/GIF. Groups favor visual posts.

**Film Simulations group post (134K members):**

```
Built a Mac app for testing film sim recipes directly on your Fuji camera.

Instead of guessing how a recipe will look, drkrm connects to your X-series
camera over USB and renders every film simulation on your actual photo using
the camera's processor. Compare all 20 sims side-by-side, pick your favorite,
then move to the next parameter and do the same thing.

Photo culling is free forever. Recipe Lab is $49 one-time.

drkrm.app
[demo video/GIF]
```

**SOOC group post (shorter):**

```
If you shoot SOOC and spend time dialing in recipes — I made a Mac app that
might help. drkrm connects to your Fuji camera over USB and renders every
film sim variant on your actual photos. You compare at pixel level and build
the recipe one setting at a time.

Free photo culler included. Recipe Lab $49 one-time.

drkrm.app
```

---

### 7. Twitter/X Build-in-Public

**Pre-launch posts (1-2x per week, 3-4 weeks before launch):**

**Post 1 — The hook (variant test):**
```
Building a Mac app that connects to your Fuji camera over USB.

You pick a recipe parameter — say, film simulation — and the app
tells the camera to render every option on your actual photo.

All 20 film sims. Side by side. From the camera's own processor.

Here's what it looks like:
[variant grid screenshot]
```

**Post 2 — Photo Cull speed:**
```
I cull 500 photos from a trip in about 20 minutes now.

Arrow keys to scrub. 1 = ditch. 2 = maybe. 3 = like.
Tab to filter. Sort moves everything to folders.

Built this because Finder isn't a photo workflow tool.
[screen recording GIF — 10-15s of rapid rating]
```

**Post 3 — Why the camera, not software:**
```
Every recipe app approximates film simulations in software.

drkrm sends your photo to the camera and the camera renders it.
Same processor that shoots the image. Same color science.
What you see is what you get when you load that recipe in the field.

That's the difference between a preview and the real thing.
[SBS compare screenshot — software vs camera render]
```

**Post 4 — Launch announcement:**
```
drkrm launches [date].

Photo Cull is free forever.
Recipe Lab is $49 — one time, no subscription.

Built for Fuji X-series shooters who want to actually see
what their recipes look like before they shoot.

drkrm.app
```

**Launch day thread:**
```
1/ drkrm is live. A Mac app for Fujifilm photographers.

Two tools:
- Photo Cull (free) — rate, filter, sort photos with keyboard shortcuts
- Recipe Lab ($49) — test film sim recipes on your camera over USB

drkrm.app

2/ The problem with recipe testing today: you find a recipe on a blog,
type 15 settings into your camera, shoot a test frame, and squint at
the LCD. If you don't like it, you change one thing and repeat.

There's no way to compare options or see what you're choosing between.

3/ Recipe Lab fixes this. Connect your Fuji camera, pick a parameter,
and the app renders every variant using the camera's actual processor.

All 20 film sims on one photo. Every grain size option. Every color
chrome level. Side by side with synced zoom.
[variant grid screenshot]

4/ Then you pick your favorite and move to the next parameter.
Film sim → grain → color chrome → white balance → etc.

You build the recipe visually, one setting at a time, instead
of typing numbers into your camera and hoping.
[SBS compare screenshot]

5/ Photo Cull is free because every photographer needs a way to
sort through their photos, and I didn't want that to cost anything.

1/2/3 keys to rate. Arrow keys to scrub. Tab to cycle filters.
One keystroke to sort everything into folders by rating.
[screen recording GIF]

6/ Native Mac app. Apple Silicon. No subscription. No cloud.
Your photos stay on your drive.

I'm a solo developer. If you hit a bug or have an idea,
support@drkrm.app goes straight to me.

[Product Hunt link]
```

---

### 8. Email List Messages

**Subscriber list endpoint:** `POST /api/send-blast` with `Authorization: Bearer <BLAST_SECRET>` returns all subscriber emails for Gmail BCC. Set `BLAST_SECRET` env var in Cloudflare Pages project settings. Subscriber count: `GET /api/subscribers` (same auth).

**Pre-launch preview (send ~1 week before launch):**

```
Subject: drkrm launches next week

You signed up to hear about drkrm — here's what's coming.

drkrm is a Mac app for Fujifilm X-series photographers with two tools:

PHOTO CULL (free, forever)
Load photos from your SSD. Rate with keyboard shortcuts (1 = ditch,
2 = maybe, 3 = like). Filter by rating. Sort into folders. Handles
HIF, JPG, and carries RAF files along. The goal is speed — cull a
500-photo trip in 20 minutes.

RECIPE LAB ($49 one-time)
Connect your Fuji camera over USB. Tweak recipe parameters in the app,
then hit Simulate — your camera renders each variant using its actual
film simulation processor. Compare side-by-side with synced zoom. Build
your recipe one parameter at a time.

No subscription. No cloud. Your photos stay on your drive.

Launch date: [date]
Early bird pricing: $49 (regular $79) for Recipe Lab.
Lifetime (all future versions): $79 (regular $129).

I'll email you once more on launch day with the download link.

— Oren
support@drkrm.app
```

**Launch day announcement:**

```
Subject: drkrm is live — download now

drkrm is live.

Download: drkrm.app
Demo video: [link]

Photo Cull is free. Recipe Lab is $49 (launch price — goes up later).
Lifetime option: $79.

If you run into anything, reply to this email or hit support@drkrm.app.
I'm a solo developer and I read every message.

— Oren
```

---

### 9. SEO Content (Post-Launch, Ongoing)

**Target keywords:**
- "x raw studio alternative" — low competition, high intent
- "fujifilm recipe tool mac" — exact match
- "fuji photo culling app" — broader
- "fujifilm film simulation comparison tool"
- "fuji recipe manager desktop"

**Content format:** Blog posts on drkrm.app/blog (add later). Titles like:
- "How to build a Fujifilm recipe from scratch (step-by-step with drkrm)"
- "X RAW Studio vs drkrm: what's different"
- "Testing all 20 Fujifilm film simulations on one photo"

**Full SEO article draft:** See `marketing/seo-blog-post.md` — complete "X RAW Studio vs drkrm" comparison article with feature table, keyword targeting.

---

## Detailed Marketing Files

All ready-to-use drafts in `marketing/`:

| File | Content |
|------|---------|
| `creator-outreach.md` | 5 personalized YouTube creator emails with contact info |
| `press-emails.md` | 4 personalized press pitch emails with editor contacts |
| `twitter-threads.md` | 4 build-in-public posts + 6-tweet launch thread + engagement replies |
| `facebook-posts.md` | Film Simulations group + SOOC group posts |
| `product-hunt.md` | Tagline, description, first comment, gallery checklist |
| `email-blasts.md` | Pre-launch preview + launch day announcement emails |
| `email-templates.html` | Dark-themed local tool for composing/previewing email blasts |
| `seo-blog-post.md` | Full "X RAW Studio vs drkrm" comparison article |
| `demo-shot-list.md` | Shot-by-shot video script with timings, actions, captions |
| `dashboard.html` | Interactive launch checklist + outreach tracker (localStorage) |

---

## Content Calendar

### Weeks -4 to -2 (Pre-Launch)
- [ ] Start engaging on r/fujifilm (comment on recipe/workflow posts)
- [ ] Twitter/X account created, first build-in-public post
- [ ] Email Ritchie Roesch with early access
- [ ] Record demo video (shot list ready: `marketing/demo-shot-list.md`)
- [x] Create press kit (`landing/press/` — icon, logo, description, press page)

### Week -1
- [x] Product Hunt listing drafted (`marketing/product-hunt.md`)
- [ ] YouTube creator emails sent with license keys (drafts ready: `marketing/creator-outreach.md`)
- [ ] Final landing page review
- [ ] Email list preview (draft ready: `marketing/email-blasts.md`)

### Launch Week
- [ ] Product Hunt launch (Tuesday AM)
- [ ] r/fujifilm post (same day or day after)
- [ ] Facebook group posts
- [ ] Twitter/X launch thread
- [ ] Press emails sent
- [ ] Reply to every comment/question for 48 hours

### Weeks +1 to +4
- [ ] Follow up with YouTube creators
- [ ] Second r/fujifilm post (if first got traction — different angle, e.g. "here's what I learned from 500 beta testers")
- [ ] Engage with any press coverage (comments, shares)
- [ ] First SEO blog post
- [ ] Collect testimonials for landing page

### Month 2-3
- [ ] Setapp submission
- [ ] Second Product Hunt launch (if v1.1 ships with software preview)
- [ ] Forum signature/profile links (Fuji-X-Forum, DPReview)

---

## Metrics to Track

- **Email signups** (Cloudflare KV count — check via `wrangler kv:key list`)
- **Website traffic** (Cloudflare Analytics — built into Pages)
- **Product Hunt upvotes + rank**
- **Reddit post upvotes + comments**
- **License activations** (LemonSqueezy dashboard)
- **Revenue** (LemonSqueezy dashboard)
- **Demo video views** (YouTube/hosting analytics)
- **Press mentions** (Google Alert for "drkrm")

---

## Finalized Copy (marketing/ directory)

All drafts expanded, personalized, and ready to use:

| File | Contents |
|------|----------|
| `marketing/creator-outreach.md` | Personalized emails for 5 YouTube creators (Ritchie, pal2tech, Kevin Mullins, Reggie, Eren) |
| `marketing/press-emails.md` | Personalized press pitches for PetaPixel, The Phoblographer, DCW, Fstoppers |
| `marketing/twitter-threads.md` | 4 build-in-public posts + full launch day thread (6 tweets) |
| `marketing/facebook-posts.md` | Posts for Film Simulations (134K) and SOOC groups |
| `marketing/email-blasts.md` | Pre-launch preview + launch day announcement for KV subscribers |
| `marketing/product-hunt.md` | Tagline, description, first comment, launch checklist |
| `marketing/seo-blog-post.md` | Full "X RAW Studio vs drkrm" article (target: "x raw studio alternative") |
| `marketing/demo-shot-list.md` | Shot-by-shot video script with timings, actions, captions |
| `marketing/email-templates.html` | Local tool: load subscribers, export CSV, generate Gmail drafts |
| `marketing/dashboard.html` | Interactive checklist + outreach tracker (localStorage state) |

## Infrastructure (deployed)

| File | Purpose |
|------|---------|
| `landing/press.html` | Public press page at drkrm.app/press |
| `landing/press/icon.png` | 1024x1024 app icon PNG |
| `landing/press/logo.svg` | Logo SVG |
| `landing/press/description.txt` | One-paragraph product description |
| `landing/functions/api/subscribers.js` | CF Pages Function — list subscribers with token auth |

**To deploy subscribers endpoint:** Add `ADMIN_TOKEN` env var in CF Pages project settings.
