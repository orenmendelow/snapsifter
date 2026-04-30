const express = require('express');
const exifr = require('exifr');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Active directory state (mutable, no restart needed)
let activeDir = null;
let cacheDir = null;
let thumbCacheDir = null;
let ratingsFile = null;
let files = [];
let ratings = {};

function isHeifFile(filename) {
  const upper = filename.toUpperCase();
  return upper.endsWith('.HIF') || upper.endsWith('.HEIF');
}

function loadDirectory(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  activeDir = dir;
  cacheDir = path.join(dir, '.cache');
  thumbCacheDir = path.join(dir, '.cache', 'thumbs');
  ratingsFile = path.join(dir, 'ratings.json');

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(thumbCacheDir, { recursive: true });

  files = fs.readdirSync(dir)
    .filter(f => isHeifFile(f) && !f.startsWith('._'))
    .sort();

  console.log(`Found ${files.length} HEIF files in ${dir}`);

  ratings = {};
  if (fs.existsSync(ratingsFile)) {
    try {
      ratings = JSON.parse(fs.readFileSync(ratingsFile, 'utf8'));
      const ratedCount = Object.keys(ratings).length;
      console.log(`Loaded ${ratedCount} existing ratings`);
    } catch (e) {
      console.error('Failed to parse ratings.json, starting fresh');
      ratings = {};
    }
  }

  return files;
}

function saveRatings() {
  if (!ratingsFile) return;
  fs.writeFileSync(ratingsFile, JSON.stringify(ratings, null, 2));
}

function requireActiveDir(req, res, next) {
  if (!activeDir) {
    return res.status(400).json({ error: 'No directory loaded. POST /api/load first.' });
  }
  next();
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// No-cache headers
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// ── New endpoints ──

// Status: is a directory loaded?
app.get('/api/status', (req, res) => {
  if (!activeDir) {
    return res.json({ loaded: false });
  }
  res.json({ loaded: true, dir: activeDir, fileCount: files.length });
});

// Browse directories
app.get('/api/browse', (req, res) => {
  const dir = req.query.dir || os.homedir();
  const resolved = path.resolve(dir);

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const folders = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue; // skip hidden

      const fullPath = path.join(resolved, entry.name);
      let heifCount = 0;

      try {
        const contents = fs.readdirSync(fullPath);
        heifCount = contents.filter(f => isHeifFile(f) && !f.startsWith('._')).length;
      } catch (e) {
        // Permission denied or other error — skip count
      }

      folders.push({ name: entry.name, path: fullPath, heifCount });
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));

    // Count HEIF files in the current directory itself
    let currentHeifCount = 0;
    try {
      const contents = fs.readdirSync(resolved);
      currentHeifCount = contents.filter(f => isHeifFile(f) && !f.startsWith('._')).length;
    } catch (e) {}

    res.json({ dir: resolved, folders, heifCount: currentHeifCount });
  } catch (err) {
    res.status(403).json({ error: 'Cannot read directory' });
  }
});

// List mounted volumes
app.get('/api/volumes', (req, res) => {
  const volumesPath = '/Volumes';
  try {
    const entries = fs.readdirSync(volumesPath, { withFileTypes: true });
    const volumes = entries
      .filter(e => e.isDirectory() || e.isSymbolicLink())
      .map(e => ({ name: e.name, path: path.join(volumesPath, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(volumes);
  } catch (err) {
    res.json([]);
  }
});

// Load a directory
app.post('/api/load', (req, res) => {
  const { dir } = req.body;
  if (!dir) {
    return res.status(400).json({ error: 'dir is required' });
  }

  try {
    const fileList = loadDirectory(dir);
    res.json({ ok: true, dir: activeDir, files: fileList });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Existing endpoints (require active directory) ──

// List all files
app.get('/api/files', requireActiveDir, (req, res) => {
  res.json(files);
});

// Get all ratings
app.get('/api/ratings', requireActiveDir, (req, res) => {
  res.json(ratings);
});

// Rate a file
app.post('/api/rate', requireActiveDir, (req, res) => {
  const { filename, rating } = req.body;
  const basename = path.parse(filename).name;
  if (rating === 0 || rating === null) {
    delete ratings[basename];
  } else {
    ratings[basename] = rating;
  }
  saveRatings();
  res.json({ ok: true });
});

// Serve full-size converted JPEG
app.get('/api/image/:filename', requireActiveDir, async (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const srcPath = path.join(activeDir, filename);
  if (!fs.existsSync(srcPath)) {
    return res.status(404).send('Not found');
  }

  const cacheName = path.parse(filename).name + '.jpg';
  const cachePath = path.join(cacheDir, cacheName);

  try {
    if (!fs.existsSync(cachePath)) {
      execSync(`sips -s format jpeg -Z 2000 ${JSON.stringify(srcPath)} --out ${JSON.stringify(cachePath)}`, { stdio: 'pipe' });
    }
    res.type('image/jpeg');
    res.send(fs.readFileSync(cachePath));
  } catch (err) {
    console.error(`Error converting ${filename}:`, err.message);
    res.status(500).send('Conversion failed');
  }
});

// Serve thumbnail
app.get('/api/thumb/:filename', requireActiveDir, async (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const srcPath = path.join(activeDir, filename);
  if (!fs.existsSync(srcPath)) {
    return res.status(404).send('Not found');
  }

  const cacheName = path.parse(filename).name + '.jpg';
  const cachePath = path.join(thumbCacheDir, cacheName);

  try {
    if (!fs.existsSync(cachePath)) {
      execSync(`sips -s format jpeg -Z 300 ${JSON.stringify(srcPath)} --out ${JSON.stringify(cachePath)}`, { stdio: 'pipe' });
    }
    res.type('image/jpeg');
    res.send(fs.readFileSync(cachePath));
  } catch (err) {
    console.error(`Error creating thumbnail for ${filename}:`, err.message);
    res.status(500).send('Thumbnail creation failed');
  }
});

// Serve EXIF metadata
app.get('/api/meta/:filename', requireActiveDir, async (req, res) => {
  const filename = req.params.filename;
  const srcPath = path.join(activeDir, filename);
  if (!fs.existsSync(srcPath)) {
    return res.status(404).send('Not found');
  }

  try {
    const exif = await exifr.parse(srcPath, {
      pick: ['DateTimeOriginal', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'FocalLengthIn35mmFormat', 'LensModel', 'Model']
    });

    if (!exif) {
      return res.json({});
    }

    const meta = {
      date: exif.DateTimeOriginal ? exif.DateTimeOriginal.toISOString() : null,
      aperture: exif.FNumber || null,
      shutter: exif.ExposureTime || null,
      iso: exif.ISO || null,
      focalLength: exif.FocalLength || null,
      focalLength35: exif.FocalLengthIn35mmFormat || null,
      lens: exif.LensModel || null,
      camera: exif.Model || null,
    };

    res.json(meta);
  } catch (err) {
    console.error(`Error reading EXIF for ${filename}:`, err.message);
    res.json({});
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Photo culler running at http://localhost:${PORT}`);
  console.log('No directory loaded — use the web UI to select a folder');
});
