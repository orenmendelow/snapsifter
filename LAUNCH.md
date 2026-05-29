# drkrm Launch Checklist

## Market Context

- 2-3M active Fuji X-series owners globally, 740K cameras shipped in 2024 (+75% YoY)
- SAM ~1-1.5M (macOS + recipe interest)
- SOM 10K-45K users in years 1-3
- Zero VC-funded competitors. Desktop space is empty. All competitors are iOS recipe reference apps.
- X RAW Studio universally hated but universally used (no alternative for authentic rendering)
- FujiXWeekly dominates mindshare (10M pageviews/yr) but is read-only recipe reference

## Competitive Positioning

- Below Photo Mechanic ($149) and Capture One ($199)
- Above recipe reference apps ($15-20/yr)
- Only tool offering dual rendering (software preview + camera final)
- Only desktop tool integrating culling + recipes

## Business Model

- **Photo Cull:** FREE (acquisition funnel)
- **drkrm Pro:** $49 one-time
- **Lifetime updates:** $79 (upsell anchor)
- **Major version upgrades:** $29 upgrade / $49 new
- **Distribution:** Direct DMG, signed + notarized. LemonSqueezy or Paddle as MoR.
- **Trial:** 14-day full access, then Cull-only without license
- **Cost structure:** Apple Dev $99/yr + domain ~$100/yr + MoR ~5-8% of revenue

## Revenue Projections

| Scenario | Year 1 | Year 2 | Year 3 |
|----------|--------|--------|--------|
| Pessimistic (2K) | $98K | $60K | $40K |
| Base (5K) | $245K | $150K | $100K |
| Optimistic (10K) | $490K | $300K | $200K |

---

## Phase 0: Pre-Launch Prep

- [ ] Finalize name (keep drkrm or rename?)
- [ ] Logo design
- [ ] Clean up repo (delete test artifacts: ptp-test*.py, test-ptp*.js, webusb-test.html)
- [ ] Update package.json metadata (name, description, author, version, license)
- [ ] Write 5 starter recipes (Classic Chrome Street, Kodak Portra emulation, Acros Moody, Vivid Landscape, Soft Portrait)
- [ ] Fresh install verification (npm install from clean state)
- [ ] Error state hardening (camera disconnect mid-sim, SSD eject)
- [ ] Performance audit (500+ photo directory load time, memory)

## Phase 1: Demo Ready

- [ ] Record demo video (2-3 min golden path: load folder -> cull -> Recipe Lab -> simulate -> variant test -> compare)
- [ ] Take screenshots for landing page (landing, cull view, recipe collage, variant test, SBS compare)
- [ ] Test with X100VI + at least one other X-series body
- [ ] Build landing/sales page (hero video, features, pricing, download button)
- [ ] Domain (drkrm.com or use mendelow.studio/drkrm)

## Phase 2: Sales Infrastructure

- [ ] Apple Developer Program enrollment ($99)
- [ ] Code signing + notarization build script (codesign -> notarytool -> staple -> DMG)
- [ ] GitHub Releases for DMG hosting + electron-updater for auto-updates
- [ ] LemonSqueezy or Paddle storefront setup
- [ ] License key validation in app (check at startup, store in ~/.drkrm/license.json)
- [ ] Trial mode (14-day countdown, Cull stays free, Recipe Lab locks)
- [ ] Build DMG packaging script
- [ ] In-app feedback pipeline (bug reports / feature requests → GitHub Issues or similar)

## Phase 3: Soft Launch

- [ ] Beta with 5-10 Fuji shooters (personal network + r/fujifilm recruits)
- [ ] Incorporate beta feedback
- [ ] r/fujifilm "I built a tool" post (254K members)
- [ ] Product Hunt launch (near-zero Fuji tools listed)
- [ ] Email Ritchie Roesch (FujiXWeekly) for blog review
- [ ] Submit to The Phoblographer, PetaPixel, Digital Camera World
- [ ] Short-form TikTok/Instagram content showing recipe workflow

## Phase 4: Growth

- [ ] YouTube creator outreach (Fuji recipe channels, 10K-100K views each)
- [ ] SEO content: "x raw studio alternative", "fujifilm recipe tool mac", "fuji photo culling app"
- [ ] Setapp submission (up to 90% revenue share)
- [ ] Consider Mac App Store for Cull-only free version (discovery funnel, if sandbox allows)

## Phase 5: Software Preview (v1.1 -- second press cycle)

- [ ] Shoot X-Rite ColorChecker through all 20 film sims on X100VI
- [ ] Script to build .cube LUTs from color chart data
- [ ] libraw integration (Node native addon or extend Swift helper)
- [ ] Core Image filter chain for recipe params
- [ ] Grain + Color Chrome approximation
- [ ] Preview / Camera Render toggle in UI
- [ ] Preview caching layer
- [ ] Ship as free update to v1 customers
- [ ] Second Product Hunt launch
- [ ] Second r/fujifilm post
- [ ] Second press outreach (this version demos without camera -- easier for reviewers)

## Phase 6: Expand (v2.0+)

- [ ] Recipe sharing/export format (JSON)
- [ ] Community recipe library integration
- [ ] Windows port assessment
- [ ] Additional camera brand support

---

## Key Distribution Channels (ranked by expected impact)

1. r/fujifilm (254K members, high engagement for tool posts)
2. FujiXWeekly blog/newsletter (10M pageviews/yr, exact target audience)
3. Product Hunt (zero competition in Fuji tools)
4. YouTube Fuji creators (recipe videos get 10K-100K views)
5. PetaPixel / The Phoblographer / Digital Camera World
6. TikTok/Instagram short-form demos
7. Setapp marketplace
8. SEO (long-term)
