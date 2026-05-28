#!/usr/bin/env node
const BASE = 'http://localhost:4000';

const PHOTOS = ['DSCF8039', 'DSCF7009', 'DSCF7011'];
const FILM_SIMS = ['Provia', 'Velvia', 'ClassicNeg', 'Nostalgic', 'RealaACE', 'Acros'];
const RAF_DIR = '/Volumes/OYM 2/Iceland - April 2026/X100VI/Liked/RAF';
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

  for (const stem of PHOTOS) {
    const rafPath = RAF_DIR + '/' + stem + '.RAF';
    if (!fs.existsSync(rafPath)) {
      console.error('RAF not found: ' + rafPath);
      continue;
    }

    for (const sim of FILM_SIMS) {
      const outFile = path.join(OUTPUT_DIR, stem + '_' + sim + '.jpg');
      if (fs.existsSync(outFile)) {
        console.log('  SKIP ' + stem + ' / ' + sim + ' (exists)');
        continue;
      }

      console.log('  Rendering ' + stem + ' / ' + sim + '...');

      const uploadRes = await api('/api/camera/upload-raf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: rafPath })
      });
      if (uploadRes.error) {
        console.error('    Upload failed: ' + uploadRes.error);
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
        console.log('    OK: ' + outFile);
      } else {
        console.error('    FAILED: ' + (resultRes.error || 'unknown'));
      }
    }
  }

  console.log('Disconnecting...');
  await api('/api/camera/disconnect', { method: 'POST' });
  console.log('Done. Variants saved to ' + OUTPUT_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
