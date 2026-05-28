#!/usr/bin/env node
const BASE = 'http://localhost:4000';

const PHOTOS = [
  { stem: 'DSCF9145', raf: '/Volumes/OYM 2/Ari Bachelor Party May 2026/Liked/RAF/DSCF9145.RAF' },
  { stem: 'DSCF9258', raf: '/Volumes/OYM 2/Ari Bachelor Party May 2026/Liked/RAF/DSCF9258.RAF' },
  { stem: 'DSCF9397', raf: '/Volumes/OYM 2/Ari Bachelor Party May 2026/Liked/RAF/DSCF9397.RAF' },
  { stem: 'DSCF3479', raf: '/Volumes/OYM 2/Western USA Road Trip Summer 2025/RAW/DSCF3479.RAF' },
  { stem: 'DSCF3391', raf: '/Volumes/OYM 2/Western USA Road Trip Summer 2025/RAW/DSCF3391.RAF' },
  { stem: 'DSCF3345', raf: '/Volumes/OYM 2/Western USA Road Trip Summer 2025/RAW/DSCF3345.RAF' },
  { stem: 'DSCF3278', raf: '/Volumes/OYM 2/Western USA Road Trip Summer 2025/RAW/DSCF3278.RAF' },
  { stem: 'DSCF3048', raf: '/Volumes/OYM 2/Western USA Road Trip Summer 2025/RAW/DSCF3048.RAF' },
  { stem: 'DSCF3010', raf: '/Volumes/OYM 2/Western USA Road Trip Summer 2025/RAW/DSCF3010.RAF' },
  { stem: 'DSCF4589', raf: '/Volumes/OYM 2/San Diego January 2026/FUJI/RAW/DSCF4589.RAF' },
  { stem: 'DSCF4600', raf: '/Volumes/OYM 2/San Diego January 2026/FUJI/RAW/DSCF4600.RAF' },
  { stem: 'DSCF4773', raf: '/Volumes/OYM 2/San Diego January 2026/FUJI/RAW/DSCF4773.RAF' },
  { stem: 'DSCF5058', raf: '/Volumes/OYM 2/San Diego January 2026/FUJI/RAW/DSCF5058.RAF' },
];

const FILM_SIMS = [
  'Provia', 'Velvia', 'Astia', 'ClassicNeg', 'Nostalgic',
  'RealaACE', 'Acros', 'Classic', 'Eterna', 'BleachBypass'
];

const OUTPUT_DIR = '/Users/oren/Documents/photo-culler/landing/variants';

const fs = require('fs');
const path = require('path');

async function api(endpoint, opts) {
  const url = BASE + endpoint;
  const res = await fetch(url, opts);
  return res.json();
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Checking camera...');
  const list = await api('/api/camera/list');
  if (!list.cameras || list.cameras.length === 0) {
    console.error('No camera connected');
    process.exit(1);
  }
  console.log('Camera: ' + list.cameras[0].name);

  console.log('Connecting...');
  await api('/api/camera/connect', { method: 'POST' });

  let rendered = 0;
  let skipped = 0;
  const total = PHOTOS.length * FILM_SIMS.length;

  for (const photo of PHOTOS) {
    if (!fs.existsSync(photo.raf)) {
      console.error('RAF not found: ' + photo.raf);
      continue;
    }

    for (const sim of FILM_SIMS) {
      const outFile = path.join(OUTPUT_DIR, photo.stem + '_' + sim + '.jpg');
      if (fs.existsSync(outFile)) {
        skipped++;
        continue;
      }

      console.log(`[${rendered + skipped + 1}/${total}] ${photo.stem} / ${sim}...`);

      const uploadRes = await api('/api/camera/upload-raf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: photo.raf })
      });
      if (uploadRes.error) {
        console.error('  Upload failed: ' + uploadRes.error);
        continue;
      }

      const profileRes = await api('/api/camera/profile');
      const baseProfile = profileRes.data;

      const params = {
        filmSimulation: sim,
        grainEffect: 'Off',
        grainSize: 'Small',
        colorChromeEffect: 'Off',
        colorChromeFXBlue: 'Off',
        whiteBalance: 'Auto',
        wbShiftR: 0,
        wbShiftB: 0,
        dynamicRange: 'Auto',
        highlight: 0,
        shadow: 0,
        color: 0,
        sharpness: 0,
        noiseReduction: 0,
        clarity: 0
      };

      await api('/api/camera/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: baseProfile, params })
      });

      await api('/api/camera/convert', { method: 'POST' });

      const resultRes = await api('/api/camera/wait-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputPath: outFile, timeout: 15000 })
      });

      if (resultRes.ok) {
        rendered++;
        console.log('  OK');
      } else {
        console.error('  FAILED: ' + (resultRes.error || 'unknown'));
      }
    }
  }

  console.log('Disconnecting...');
  await api('/api/camera/disconnect', { method: 'POST' });
  console.log(`Done. Rendered: ${rendered}, Skipped (existing): ${skipped}, Total: ${total}`);
}

main().catch(e => { console.error(e); process.exit(1); });
