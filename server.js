const express = require('express');
const exifr = require('exifr');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync, exec } = require('child_process');
const gridSelection = require('./lib/grid-selection');
const d185 = require('./lib/d185-patch');

// ── State directory & sessions ──
const stateDir = path.join(os.homedir(), '.snapsifter');
const oldSafelightDir = path.join(os.homedir(), '.safelight');
const oldLatentDir = path.join(os.homedir(), '.latent');
const oldShotsifterDir = path.join(os.homedir(), '.shotsifter');

// Migrate ~/.safelight/ → ~/.latent/ → ~/.shotsifter/ → ~/.snapsifter/
if (fs.existsSync(oldShotsifterDir) && !fs.existsSync(stateDir)) {
  fs.renameSync(oldShotsifterDir, stateDir);
  console.log('Migrated ~/.shotsifter/ → ~/.snapsifter/');
} else if (fs.existsSync(oldSafelightDir) && !fs.existsSync(oldLatentDir) && !fs.existsSync(oldShotsifterDir) && !fs.existsSync(stateDir)) {
  fs.renameSync(oldSafelightDir, stateDir);
  console.log('Migrated ~/.safelight/ → ~/.snapsifter/');
} else if (fs.existsSync(oldLatentDir) && !fs.existsSync(oldShotsifterDir) && !fs.existsSync(stateDir)) {
  fs.renameSync(oldLatentDir, stateDir);
  console.log('Migrated ~/.latent/ → ~/.snapsifter/');
}

const sessionsFile = path.join(stateDir, 'sessions.json');
const previewCacheDir = path.join(stateDir, 'preview-cache');
const exifBatchCache = {};

// Active directory state (mutable, no restart needed)
let activeDir = null;
let activeSessionId = null;
let cacheDir = null;
let thumbCacheDir = null;
let ratingsFile = null;
let files = [];
let ratings = {};

// Recipe Lab directory state (independent from Photo Cull)
let recipeDir = null;
const recipeSessionFile = path.join(stateDir, 'recipe-session.json');

function loadRecipeSession() {
  // Only load the last dir for display in the tree — don't auto-set recipeDir.
  // User must explicitly click Load to set the active directory.
  try {
    if (fs.existsSync(recipeSessionFile)) {
      const data = JSON.parse(fs.readFileSync(recipeSessionFile, 'utf8'));
      if (data.dir && fs.existsSync(data.dir)) {
        console.log('Last recipe dir (not auto-loaded):', data.dir);
      }
    }
  } catch (e) {
    console.error('Failed to load recipe session:', e.message);
  }
}

function saveRecipeSession() {
  fs.writeFileSync(recipeSessionFile, JSON.stringify({ dir: recipeDir, lastOpened: new Date().toISOString() }, null, 2));
}

loadRecipeSession();

// ── Sessions persistence ──

function loadSessions() {
  try {
    if (fs.existsSync(sessionsFile)) {
      return JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load sessions:', e.message);
  }
  return [];
}

function saveSessions(sessions) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
  } catch (e) {
    console.error('Failed to save sessions:', e.message);
  }
}

function findSessionByDir(sessions, dir) {
  return sessions.find(s => s.dir === dir);
}

function findSessionById(sessions, id) {
  return sessions.find(s => s.id === id);
}

function countRatingsInDir(dir) {
  const rf = path.join(dir, 'ratings.json');
  try {
    if (fs.existsSync(rf)) {
      const data = JSON.parse(fs.readFileSync(rf, 'utf8'));
      return Object.keys(data).length;
    }
  } catch (e) {}
  return 0;
}

function upsertSession(dir, fileCount) {
  const sessions = loadSessions();
  let session = findSessionByDir(sessions, dir);
  const now = new Date().toISOString();

  if (session) {
    session.lastOpened = now;
    session.fileCount = fileCount;
    session.ratedCount = countRatingsInDir(dir);
  } else {
    session = {
      id: crypto.randomUUID(),
      dir,
      name: path.basename(dir),
      lastOpened: now,
      lastPosition: 0,
      fileCount,
      ratedCount: countRatingsInDir(dir),
    };
    sessions.push(session);
  }

  saveSessions(sessions);
  return session;
}

function updateSessionRatedCount(dir) {
  const sessions = loadSessions();
  const session = findSessionByDir(sessions, dir);
  if (session) {
    session.ratedCount = countRatingsInDir(dir);
    saveSessions(sessions);
  }
}

function updateSessionPosition(sessionId, position) {
  const sessions = loadSessions();
  const session = findSessionById(sessions, sessionId);
  if (session) {
    session.lastPosition = position;
    saveSessions(sessions);
  }
}

// ── Helpers ──

function isSupportedImage(filename) {
  const upper = filename.toUpperCase();
  return upper.endsWith('.HIF') || upper.endsWith('.HEIF') ||
         upper.endsWith('.JPG') || upper.endsWith('.JPEG');
}

function isHeifFile(filename) {
  const upper = filename.toUpperCase();
  return upper.endsWith('.HIF') || upper.endsWith('.HEIF');
}

function walkDir(baseDir, currentDir, maxDepth, depth) {
  if (depth > maxDepth) return [];
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch (e) {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isFile() && isSupportedImage(entry.name) && !entry.name.startsWith('._')) {
      const relativePath = path.relative(baseDir, fullPath);
      results.push(relativePath);
    } else if (entry.isDirectory()) {
      results = results.concat(walkDir(baseDir, fullPath, maxDepth, depth + 1));
    }
  }
  return results;
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

  // Recursively find all supported image files
  files = walkDir(dir, dir, 5, 0).sort();

  console.log(`Found ${files.length} photos in ${dir}`);

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

  // Upsert session and track active session ID
  const session = upsertSession(dir, files.length);
  activeSessionId = session.id;

  return { files, session };
}

function saveRatings() {
  if (!ratingsFile) return;
  fs.writeFileSync(ratingsFile, JSON.stringify(ratings, null, 2));
  // Keep session ratedCount in sync
  if (activeDir) {
    updateSessionRatedCount(activeDir);
  }
}

function requireActiveDir(req, res, next) {
  if (!activeDir) {
    return res.status(400).json({ error: 'No directory loaded. POST /api/load first.' });
  }
  next();
}

function requireRecipeDir(req, res, next) {
  if (!recipeDir) {
    return res.status(400).json({ error: 'No recipe directory loaded. POST /api/recipe-load first.' });
  }
  next();
}

function generateThumb(srcPath, destPath, size) {
  const upper = srcPath.toUpperCase();
  const needsConversion = upper.endsWith('.HIF') || upper.endsWith('.HEIF') || upper.endsWith('.RAF');
  if (needsConversion) {
    execSync(`sips -s format jpeg -Z ${size} ${JSON.stringify(srcPath)} --out ${JSON.stringify(destPath)}`, { stdio: 'pipe' });
  } else {
    execSync(`sips -Z ${size} ${JSON.stringify(srcPath)} --out ${JSON.stringify(destPath)}`, { stdio: 'pipe' });
  }
}

// ── Express setup ──

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// No-cache headers
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// ── Endpoints ──

// Status: is a directory loaded?
app.get('/api/status', (req, res) => {
  if (!activeDir) {
    return res.json({ loaded: false });
  }
  res.json({
    loaded: true,
    dir: activeDir,
    fileCount: files.length,
    sessionId: activeSessionId,
  });
});

// Sessions list with thumbnails
app.get('/api/sessions', (req, res) => {
  const sessions = loadSessions();

  // Sort by lastOpened descending
  sessions.sort((a, b) => new Date(b.lastOpened) - new Date(a.lastOpened));

  const result = sessions.map(s => {
    let accessible = true;
    let thumbnails = [];

    try {
      if (!fs.existsSync(s.dir)) {
        accessible = false;
      } else {
        const dirFiles = walkDir(s.dir, s.dir, 3, 0).sort();
        thumbnails = dirFiles.slice(0, 6);
      }
    } catch (e) {
      accessible = false;
    }

    // Fresh ratedCount from disk
    let ratedCount = 0;
    if (accessible) {
      ratedCount = countRatingsInDir(s.dir);
    }

    return {
      ...s,
      accessible,
      thumbnails,
      ratedCount,
    };
  });

  res.json(result);
});

// Delete a session
app.delete('/api/session/:id', (req, res) => {
  const { id } = req.params;
  const data = loadSessions();
  const idx = data.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Session not found' });
  data.splice(idx, 1);
  saveSessions(data);
  res.json({ ok: true });
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

    const systemDirs = new Set(['Library', 'Applications', 'node_modules', 'usr', 'bin', 'sbin', 'etc', 'var', 'tmp', 'private']);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (systemDirs.has(entry.name)) continue;

      const fullPath = path.join(resolved, entry.name);
      let photoCount = 0;
      let previewFiles = [];

      try {
        const allPhotos = walkDir(fullPath, fullPath, 3, 0).sort();
        photoCount = allPhotos.length;
        if (photoCount > 0) {
          // For preview, use the full relative paths joined back to fullPath
          previewFiles = allPhotos.slice(0, 16);
        }
      } catch (e) {
        // Permission denied or other error
      }

      const hasRatings = fs.existsSync(path.join(fullPath, 'ratings.json'));
      const ratedCount = hasRatings ? countRatingsInDir(fullPath) : 0;
      folders.push({ name: entry.name, path: fullPath, photoCount, previewFiles, hasRatings, ratedCount });
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));

    // Sum photo count from visible folders only (excludes system dirs filtered above)
    let currentPhotoCount = folders.reduce((sum, f) => sum + f.photoCount, 0);
    // Also count direct photos in this directory (not in subfolders)
    let currentPreviewFiles = [];
    try {
      const directEntries = fs.readdirSync(resolved, { withFileTypes: true });
      const directPhotos = directEntries
        .filter(e => e.isFile() && isSupportedImage(e.name) && !e.name.startsWith('.') && !e.name.startsWith('._'))
        .map(e => e.name)
        .sort();
      currentPhotoCount += directPhotos.length;
      currentPreviewFiles = directPhotos.slice(0, 16);
    } catch (e) {}

    const currentHasRatings = fs.existsSync(path.join(resolved, 'ratings.json'));
    const currentRatedCount = currentHasRatings ? countRatingsInDir(resolved) : 0;
    res.json({ dir: resolved, folders, photoCount: currentPhotoCount, previewFiles: currentPreviewFiles, hasRatings: currentHasRatings, ratedCount: currentRatedCount });
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

// Load a directory (by dir path or sessionId)
app.post('/api/load', (req, res) => {
  const { dir, sessionId } = req.body;

  let targetDir = dir;

  if (sessionId && !dir) {
    const sessions = loadSessions();
    const session = findSessionById(sessions, sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    targetDir = session.dir;
  }

  if (!targetDir) {
    return res.status(400).json({ error: 'dir or sessionId is required' });
  }

  try {
    const { files: fileList, session } = loadDirectory(targetDir);
    res.json({
      ok: true,
      dir: activeDir,
      files: fileList,
      sessionId: session.id,
      lastPosition: session.lastPosition,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Save viewing position
app.post('/api/save-position', (req, res) => {
  const { position } = req.body;
  if (typeof position !== 'number') {
    return res.status(400).json({ error: 'position (number) is required' });
  }
  if (!activeSessionId) {
    return res.status(400).json({ error: 'No active session' });
  }
  updateSessionPosition(activeSessionId, position);
  res.json({ ok: true });
});

// Session thumbnail (for landing page mosaic — session not currently loaded)
app.get('/api/session-thumb/:sessionId/{*filepath}', (req, res) => {
  const sessionId = req.params.sessionId;
  const filepath = req.params.filepath;
  const decodedFilename = decodeURIComponent(Array.isArray(filepath) ? filepath.join('/') : filepath);

  const sessions = loadSessions();
  const session = findSessionById(sessions, sessionId);
  if (!session) {
    return res.status(404).send('Session not found');
  }

  const srcPath = path.join(session.dir, decodedFilename);
  if (!fs.existsSync(srcPath)) {
    return res.status(404).send('File not found');
  }

  // Cache in session's .cache/thumbs/
  const sessionThumbDir = path.join(session.dir, '.cache', 'thumbs');
  fs.mkdirSync(sessionThumbDir, { recursive: true });

  const cacheKey = crypto.createHash('md5').update(decodedFilename).digest('hex').slice(0, 16);
  const cacheName = cacheKey + '_' + path.parse(decodedFilename).name + '_thumb.jpg';
  const cachePath = path.join(sessionThumbDir, cacheName);

  try {
    if (!fs.existsSync(cachePath)) {
      generateThumb(srcPath, cachePath, 300);
    }
    res.type('image/jpeg');
    res.send(fs.readFileSync(cachePath));
  } catch (err) {
    console.error(`Error creating session thumbnail for ${decodedFilename}:`, err.message);
    res.status(500).send('Thumbnail creation failed');
  }
});

// Preview thumbnail for folder browser (dir is base64-encoded)
app.get('/api/preview-thumb/:dir/{*filepath}', (req, res) => {
  const dirDecoded = Buffer.from(req.params.dir, 'base64').toString('utf8');
  const filepath = req.params.filepath;
  const filename = decodeURIComponent(Array.isArray(filepath) ? filepath.join('/') : filepath);

  const srcPath = path.join(dirDecoded, filename);
  if (!fs.existsSync(srcPath)) {
    return res.status(404).send('File not found');
  }

  fs.mkdirSync(previewCacheDir, { recursive: true });

  // Use a hash of the full path to avoid collisions
  const pathHash = crypto.createHash('md5').update(srcPath).digest('hex').slice(0, 12);
  const cacheName = pathHash + '_preview800.jpg';
  const cachePath = path.join(previewCacheDir, cacheName);

  try {
    if (!fs.existsSync(cachePath)) {
      generateThumb(srcPath, cachePath, 800);
    }
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('image/jpeg');
    res.send(fs.readFileSync(cachePath));
  } catch (err) {
    console.error(`Error creating preview thumbnail for ${filename}:`, err.message);
    res.status(500).send('Thumbnail creation failed');
  }
});

// Full-size preview image for folder browser (dir is base64-encoded)
app.get('/api/preview-image/:dir/{*filepath}', (req, res) => {
  const dirDecoded = Buffer.from(req.params.dir, 'base64').toString('utf8');
  const filepath = req.params.filepath;
  const filename = decodeURIComponent(Array.isArray(filepath) ? filepath.join('/') : filepath);

  const srcPath = path.join(dirDecoded, filename);
  if (!fs.existsSync(srcPath)) {
    return res.status(404).send('File not found');
  }

  // JPG/JPEG — serve directly with cache headers
  const upper = srcPath.toUpperCase();
  if (upper.endsWith('.JPG') || upper.endsWith('.JPEG')) {
    try {
      res.set('Cache-Control', 'public, max-age=3600');
      res.type('image/jpeg');
      res.send(fs.readFileSync(srcPath));
    } catch (err) {
      res.status(500).send('Read failed');
    }
    return;
  }

  fs.mkdirSync(previewCacheDir, { recursive: true });

  const pathHash = crypto.createHash('md5').update(srcPath).digest('hex').slice(0, 12);
  const cacheName = pathHash + '_full.jpg';
  const cachePath = path.join(previewCacheDir, cacheName);

  try {
    if (!fs.existsSync(cachePath)) {
      generateThumb(srcPath, cachePath, 2000);
    }
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('image/jpeg');
    res.send(fs.readFileSync(cachePath));
  } catch (err) {
    console.error('Error creating full preview for ' + filename + ':', err.message);
    res.status(500).send('Conversion failed');
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
  // Use relative path without extension as key (backward-compatible for root-level files)
  const key = filename.replace(/\.[^.]+$/, '');
  if (rating === 0 || rating === null) {
    delete ratings[key];
  } else {
    ratings[key] = rating;
  }
  saveRatings();
  res.json({ ok: true });
});

// Serve full-size converted JPEG (HEIF needs sips conversion, JPG/JPEG served directly)
app.get('/api/image/{*filepath}', requireActiveDir, async (req, res) => {
  const filepath = req.params.filepath;
  const filename = decodeURIComponent(Array.isArray(filepath) ? filepath.join('/') : filepath);
  const srcPath = path.join(activeDir, filename);
  if (!fs.existsSync(srcPath)) {
    return res.status(404).send('Not found');
  }

  // JPG/JPEG — serve directly, no conversion needed
  const upper = filename.toUpperCase();
  if (upper.endsWith('.JPG') || upper.endsWith('.JPEG')) {
    try {
      res.type('image/jpeg');
      res.send(fs.readFileSync(srcPath));
    } catch (err) {
      console.error(`Error reading ${filename}:`, err.message);
      res.status(500).send('Read failed');
    }
    return;
  }

  // HEIF — convert via sips — use hash of relative path for cache key to avoid collisions
  const cacheKey = crypto.createHash('md5').update(filename).digest('hex').slice(0, 16);
  const cacheName = cacheKey + '_' + path.parse(filename).name + '.jpg';
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
app.get('/api/thumb/{*filepath}', requireActiveDir, async (req, res) => {
  const filepath = req.params.filepath;
  const filename = decodeURIComponent(Array.isArray(filepath) ? filepath.join('/') : filepath);
  const srcPath = path.join(activeDir, filename);
  if (!fs.existsSync(srcPath)) {
    return res.status(404).send('Not found');
  }

  const cacheKey = crypto.createHash('md5').update(filename).digest('hex').slice(0, 16);
  const cacheName = cacheKey + '_' + path.parse(filename).name + '_thumb.jpg';
  const cachePath = path.join(thumbCacheDir, cacheName);

  try {
    if (!fs.existsSync(cachePath)) {
      generateThumb(srcPath, cachePath, 300);
    }
    res.type('image/jpeg');
    res.send(fs.readFileSync(cachePath));
  } catch (err) {
    console.error(`Error creating thumbnail for ${filename}:`, err.message);
    res.status(500).send('Thumbnail creation failed');
  }
});

// Serve EXIF metadata
app.get('/api/meta/{*filepath}', requireActiveDir, async (req, res) => {
  const filepath = req.params.filepath;
  const filename = decodeURIComponent(Array.isArray(filepath) ? filepath.join('/') : filepath);
  const srcPath = path.join(activeDir, filename);
  if (!fs.existsSync(srcPath)) {
    return res.status(404).send('Not found');
  }

  try {
    const exif = await exifr.parse(srcPath, true);
    const stat = fs.statSync(srcPath);

    if (!exif) {
      return res.json({ fileSize: stat.size });
    }

    const meta = {
      date: exif.DateTimeOriginal ? exif.DateTimeOriginal.toISOString() : (exif.CreateDate ? exif.CreateDate.toISOString() : null),
      aperture: exif.FNumber || null,
      shutter: exif.ExposureTime || null,
      iso: exif.ISO || null,
      focalLength: exif.FocalLength || null,
      focalLength35: exif.FocalLengthIn35mmFormat || null,
      lens: exif.LensModel || null,
      camera: exif.Model || null,
      make: exif.Make || null,
      filmSimulation: exif.FilmSimulation || null,
      whiteBalance: exif.WhiteBalance || null,
      meteringMode: exif.MeteringMode || null,
      exposureProgram: exif.ExposureProgram || null,
      exposureMode: exif.ExposureMode || null,
      flash: exif.Flash || null,
      exposureCompensation: exif.ExposureCompensation != null ? exif.ExposureCompensation : null,
      colorSpace: exif.ColorSpace || null,
      imageWidth: exif.ExifImageWidth || exif.ImageWidth || null,
      imageHeight: exif.ExifImageHeight || exif.ImageHeight || null,
      fileSize: stat.size,
      gps: (exif.latitude && exif.longitude) ? { lat: exif.latitude, lng: exif.longitude } : null,
    };

    res.json(meta);
  } catch (err) {
    console.error(`Error reading EXIF for ${filename}:`, err.message);
    res.json({});
  }
});

// ── Sort / Unsort endpoints ──

const SORT_FOLDERS = { 3: 'Liked', 2: 'Maybe', 1: 'Ditch' };

app.post('/api/sort', requireActiveDir, (req, res) => {
  const mode = (req.body && req.body.mode) || 'move';
  if (mode !== 'move' && mode !== 'copy') {
    return res.status(400).json({ error: 'mode must be "move" or "copy"' });
  }

  const counts = { liked: 0, maybe: 0, ditch: 0 };
  const countKeys = { 3: 'liked', 2: 'maybe', 1: 'ditch' };
  const updatedRatings = {};

  // Group ratings by folder needed
  const stemsByRating = {};
  for (const [stem, rating] of Object.entries(ratings)) {
    if (!SORT_FOLDERS[rating]) continue;
    if (!stemsByRating[rating]) stemsByRating[rating] = [];
    stemsByRating[rating].push(stem);
  }

  // Find ALL files in activeDir (not just supported images — need to catch RAW pairs like .RAF)
  const allFiles = [];
  try {
    const entries = fs.readdirSync(activeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith('.') && !entry.name.startsWith('._')) {
        allFiles.push(entry.name);
      }
    }
  } catch (e) {}

  for (const [ratingStr, stems] of Object.entries(stemsByRating)) {
    const rating = Number(ratingStr);
    const folderName = SORT_FOLDERS[rating];
    const destDir = path.join(activeDir, folderName);

    for (const stem of stems) {
      // Find all files whose stem matches (strip directory prefix from stem for matching)
      const baseStem = path.basename(stem, path.extname(stem)) || stem;
      // The stem in ratings could already have a path prefix (e.g., "Liked/DSCF6733")
      // Extract just the filename stem
      const pureStem = path.basename(stem);

      const matchingFiles = allFiles.filter(relPath => {
        const fileStem = path.parse(relPath).name;
        return fileStem === pureStem;
      });

      for (const relPath of matchingFiles) {
        const srcPath = path.join(activeDir, relPath);
        const fileName = path.basename(relPath);
        const ext = path.extname(fileName).replace('.', '').toUpperCase();
        const extDir = path.join(destDir, ext);

        // Already in the correct subfolder (e.g., Liked/JPG/)
        const relDir = path.dirname(relPath);
        if (relDir === folderName || relDir === folderName + '/' + ext) continue;

        // Destination already exists — skip
        const destPath = path.join(extDir, fileName);
        if (fs.existsSync(destPath)) continue;

        fs.mkdirSync(extDir, { recursive: true });

        if (mode === 'move') {
          fs.renameSync(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }

      // Update rating key to include folder prefix (use first ext subfolder found)
      const firstMatch = matchingFiles[0];
      const firstExt = firstMatch ? path.extname(path.basename(firstMatch)).replace('.', '').toUpperCase() : '';
      const newKey = folderName + '/' + (firstExt ? firstExt + '/' : '') + pureStem;
      updatedRatings[newKey] = rating;
      counts[countKeys[rating]]++;
    }
  }

  // Rebuild ratings: keep unrated entries unchanged, replace sorted ones
  const newRatings = {};
  for (const [stem, rating] of Object.entries(ratings)) {
    if (SORT_FOLDERS[rating]) continue; // replaced by updatedRatings
    newRatings[stem] = rating;
  }
  Object.assign(newRatings, updatedRatings);
  ratings = newRatings;
  saveRatings();

  // Re-scan
  loadDirectory(activeDir);

  res.json({ ok: true, sorted: counts });
});

app.post('/api/unsort', requireActiveDir, (req, res) => {
  let restored = 0;
  const sortFolderNames = Object.values(SORT_FOLDERS);

  for (const folderName of sortFolderNames) {
    const folderPath = path.join(activeDir, folderName);
    if (!fs.existsSync(folderPath)) continue;

    let entries;
    try {
      entries = fs.readdirSync(folderPath, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        // Extension subfolder (e.g., Liked/JPG/)
        const extFolderPath = path.join(folderPath, entry.name);
        let subEntries;
        try {
          subEntries = fs.readdirSync(extFolderPath, { withFileTypes: true });
        } catch (e) {
          continue;
        }

        for (const subEntry of subEntries) {
          if (!subEntry.isFile()) continue;
          if (subEntry.name.startsWith('.')) continue;

          const srcPath = path.join(extFolderPath, subEntry.name);
          const destPath = path.join(activeDir, subEntry.name);

          if (fs.existsSync(destPath)) continue;

          fs.renameSync(srcPath, destPath);
          restored++;
        }

        // Remove ext subfolder if empty
        try {
          const remaining = fs.readdirSync(extFolderPath);
          if (remaining.length === 0) {
            fs.rmdirSync(extFolderPath);
          }
        } catch (e) {}
      } else if (entry.isFile()) {
        // Legacy: files directly in rating folder (old structure)
        const srcPath = path.join(folderPath, entry.name);
        const destPath = path.join(activeDir, entry.name);

        if (fs.existsSync(destPath)) continue;

        fs.renameSync(srcPath, destPath);
        restored++;
      }
    }

    // Remove rating folder if empty
    try {
      const remaining = fs.readdirSync(folderPath);
      if (remaining.length === 0) {
        fs.rmdirSync(folderPath);
      }
    } catch (e) {}
  }

  // Update ratings keys: strip folder prefixes (handles both Liked/stem and Liked/JPG/stem)
  const newRatings = {};
  for (const [stem, rating] of Object.entries(ratings)) {
    const parts = stem.split('/');
    if (parts.length === 3 && sortFolderNames.includes(parts[0])) {
      // New format: Liked/JPG/DSCF6733
      newRatings[parts[2]] = rating;
    } else if (parts.length === 2 && sortFolderNames.includes(parts[0])) {
      // Legacy format: Liked/DSCF6733
      newRatings[parts[1]] = rating;
    } else {
      newRatings[stem] = rating;
    }
  }
  ratings = newRatings;
  saveRatings();

  // Re-scan
  loadDirectory(activeDir);

  res.json({ ok: true, restored });
});

// ── Recipe Lab directory endpoints ──

app.post('/api/recipe-load', (req, res) => {
  const { dir } = req.body;
  if (!dir) return res.status(400).json({ error: 'dir is required' });
  if (!fs.existsSync(dir)) return res.status(400).json({ error: 'Directory does not exist' });
  recipeDir = dir;
  saveRecipeSession();
  res.json({ ok: true, dir: recipeDir });
});

app.get('/api/recipe-status', (req, res) => {
  res.json({ loaded: !!recipeDir, dir: recipeDir });
});

app.get('/api/recipe-last-dir', (req, res) => {
  try {
    if (fs.existsSync(recipeSessionFile)) {
      const data = JSON.parse(fs.readFileSync(recipeSessionFile, 'utf8'));
      if (data.dir && fs.existsSync(data.dir)) {
        return res.json({ dir: data.dir });
      }
    }
  } catch (e) {}
  res.json({ dir: null });
});

// ── Recipe CRUD endpoints ──

function recipesFilePath() {
  return path.join(stateDir, 'recipes.json');
}

const sampleRecipes = {
  'sample-classic-neg-street': {
    id: 'sample-classic-neg-street', title: 'Street Classic', created: '2026-01-01T00:00:00Z', modified: '2026-01-01T00:00:00Z',
    params: { filmSimulation: 'ClassicNeg', grainEffect: 'Weak', grainSize: 'Small', colorChromeEffect: 'Strong', colorChromeFXBlue: 'Weak', whiteBalance: 'Auto', wbShiftR: 3, wbShiftB: -3, dynamicRange: 200, highlightTone: -1, shadowTone: 2, color: 1, sharpness: -2, noiseReduction: -4, clarity: 0 }
  },
  'sample-nostalgic-warm': {
    id: 'sample-nostalgic-warm', title: 'Nostalgic Warm', created: '2026-01-01T00:00:00Z', modified: '2026-01-01T00:00:00Z',
    params: { filmSimulation: 'Nostalgic', grainEffect: 'Strong', grainSize: 'Large', colorChromeEffect: 'Weak', colorChromeFXBlue: 'Off', whiteBalance: 'Shade', wbShiftR: 4, wbShiftB: -2, dynamicRange: 200, highlightTone: 0, shadowTone: 1, color: 0, sharpness: -1, noiseReduction: -3, clarity: 0 }
  },
  'sample-velvia-landscape': {
    id: 'sample-velvia-landscape', title: 'Vivid Landscape', created: '2026-01-01T00:00:00Z', modified: '2026-01-01T00:00:00Z',
    params: { filmSimulation: 'Velvia', grainEffect: 'Off', grainSize: 'Small', colorChromeEffect: 'Strong', colorChromeFXBlue: 'Strong', whiteBalance: 'Daylight', wbShiftR: 0, wbShiftB: 0, dynamicRange: 400, highlightTone: 0, shadowTone: -1, color: 2, sharpness: 0, noiseReduction: -2, clarity: 3 }
  },
  'sample-acros-mono': {
    id: 'sample-acros-mono', title: 'ACROS Moody', created: '2026-01-01T00:00:00Z', modified: '2026-01-01T00:00:00Z',
    params: { filmSimulation: 'Acros', grainEffect: 'Strong', grainSize: 'Large', colorChromeEffect: 'Off', colorChromeFXBlue: 'Off', whiteBalance: 'Auto', wbShiftR: 0, wbShiftB: 0, dynamicRange: 200, highlightTone: 1, shadowTone: 2, color: 0, sharpness: 0, noiseReduction: -4, clarity: 2 }
  },
  'sample-portra-soft': {
    id: 'sample-portra-soft', title: 'Soft Portra', created: '2026-01-01T00:00:00Z', modified: '2026-01-01T00:00:00Z',
    params: { filmSimulation: 'ProNegStd', grainEffect: 'Weak', grainSize: 'Small', colorChromeEffect: 'Off', colorChromeFXBlue: 'Off', whiteBalance: 'Auto', wbShiftR: 2, wbShiftB: -1, dynamicRange: 200, highlightTone: -1, shadowTone: 0, color: -1, sharpness: -2, noiseReduction: -2, clarity: 0 }
  }
};

function loadRecipes() {
  const fp = recipesFilePath();
  try {
    if (fs.existsSync(fp)) {
      return JSON.parse(fs.readFileSync(fp, 'utf8'));
    }
    // One-time migration: copy per-directory recipes.json to global location
    if (recipeDir) {
      const oldFp = path.join(recipeDir, 'recipes.json');
      if (fs.existsSync(oldFp)) {
        const data = fs.readFileSync(oldFp, 'utf8');
        fs.writeFileSync(fp, data);
        console.log('Migrated recipes.json from', oldFp, 'to', fp);
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.error('Failed to parse recipes.json:', e.message);
  }
  return { recipes: { ...sampleRecipes }, activeRecipe: null };
}

function saveRecipes(data) {
  fs.writeFileSync(recipesFilePath(), JSON.stringify(data, null, 2));
}

app.get('/api/recipes', (req, res) => {
  res.json(loadRecipes());
});

app.post('/api/recipe', (req, res) => {
  const { title, params } = req.body;
  const data = loadRecipes();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const recipe = { id, title, created: now, modified: now, params };
  data.recipes[id] = recipe;
  saveRecipes(data);
  res.json(recipe);
});

app.put('/api/recipe/:id', (req, res) => {
  const { id } = req.params;
  const data = loadRecipes();
  if (!data.recipes[id]) {
    return res.status(404).json({ error: 'Recipe not found' });
  }
  const recipe = data.recipes[id];
  if (req.body.title !== undefined) recipe.title = req.body.title;
  if (req.body.params !== undefined) recipe.params = req.body.params;
  recipe.modified = new Date().toISOString();
  saveRecipes(data);
  res.json(recipe);
});

app.delete('/api/recipe/:id', (req, res) => {
  const { id } = req.params;
  const data = loadRecipes();
  if (!data.recipes[id]) {
    return res.status(404).json({ error: 'Recipe not found' });
  }
  delete data.recipes[id];
  if (data.activeRecipe === id) {
    data.activeRecipe = null;
  }
  saveRecipes(data);
  res.json({ ok: true });
});

app.put('/api/recipes/active', (req, res) => {
  const { id } = req.body;
  const data = loadRecipes();
  if (id !== null && !data.recipes[id]) {
    return res.status(404).json({ error: 'Recipe not found' });
  }
  data.activeRecipe = id;
  saveRecipes(data);
  res.json({ ok: true, activeRecipe: id });
});

// ── FP1 generation ──

function slugify(str) {
  return str.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, ' ');
}

const FP1_FILM_SIM_MAP = {
  'Provia': 'Provia', 'Velvia': 'Velvia', 'Astia': 'Astia',
  'Classic': 'Classic', 'ClassicNeg': 'ClassicNEGA', 'Nostalgic': 'NostalgicNEGA',
  'RealaACE': 'RealaACE', 'ProNegStd': 'NEGAStd', 'ProNegHi': 'NEGAhi',
  'Eterna': 'Eterna', 'BleachBypass': 'BleachBypass',
  'Acros': 'Acros', 'AcrosYe': 'AcrosYe', 'AcrosR': 'AcrosR', 'AcrosG': 'AcrosG',
  'Mono': 'BW', 'MonoYe': 'BYe', 'MonoR': 'BR', 'MonoG': 'BG', 'Sepia': 'Sepia',
};

function generateFP1XML(recipe) {
  const p = recipe.params || {};

  const filmSim = FP1_FILM_SIM_MAP[p.filmSimulation] || p.filmSimulation || 'Provia';
  const grain = (p.grainEffect || 'Off').toUpperCase();
  const grainSize = (p.grainSize || 'Small').toUpperCase();
  const chrome = (p.colorChromeEffect || 'OFF').toUpperCase();
  const chromeBlue = (p.colorChromeFXBlue || 'OFF').toUpperCase();
  const wb = p.whiteBalance || 'Auto';
  const wbR = p.wbShiftR != null ? p.wbShiftR : 0;
  const wbB = p.wbShiftB != null ? p.wbShiftB : 0;
  const colorTemp = p.colorTemperature ? `${p.colorTemperature}K` : '0K';
  const dr = p.dynamicRange || 100;
  const highlight = p.highlightTone != null ? p.highlightTone : 0;
  const shadow = p.shadowTone != null ? p.shadowTone : 0;
  const color = p.color != null ? p.color : 0;
  const sharpness = p.sharpness != null ? p.sharpness : 0;
  const nr = p.noiseReduction != null ? p.noiseReduction : 0;
  const clarity = p.clarity != null ? p.clarity : 0;

  const label = slugify(recipe.title || 'Untitled');

  return `<?xml version="1.0" encoding="utf-8"?>
<ConversionProfile application="XRFC" version="1.12.0.0">
    <PropertyGroup device="X100VI" version="X100VI_0100" label="${label}">
        <SerialNumber>5935373131322503252913201629C3</SerialNumber>
        <TetherRAWConditonCode>X100VI_0100</TetherRAWConditonCode>
        <Editable>TRUE</Editable>
        <SourceFileName/>
        <Fileerror>NONE</Fileerror>
        <RotationAngle>0</RotationAngle>
        <StructVer>65536</StructVer>
        <IOPCode>FF179503</IOPCode>
        <ShootingCondition>OFF</ShootingCondition>
        <FileType>JPG</FileType>
        <ImageSize>L3x2</ImageSize>
        <ImageQuality>Fine</ImageQuality>
        <ExposureBias>0</ExposureBias>
        <DynamicRange>${dr}</DynamicRange>
        <WideDRange>0</WideDRange>
        <FilmSimulation>${filmSim}</FilmSimulation>
        <BlackImageTone>0</BlackImageTone>
        <MonochromaticColor_RG>0</MonochromaticColor_RG>
        <GrainEffect>${grain}</GrainEffect>
        <GrainEffectSize>${grainSize}</GrainEffectSize>
        <ChromeEffect>${chrome}</ChromeEffect>
        <ColorChromeBlue>${chromeBlue}</ColorChromeBlue>
        <SmoothSkinEffect>OFF</SmoothSkinEffect>
        <WBShootCond>ON</WBShootCond>
        <WhiteBalance>${wb}</WhiteBalance>
        <WBShiftR>${wbR}</WBShiftR>
        <WBShiftB>${wbB}</WBShiftB>
        <WBColorTemp>${colorTemp}</WBColorTemp>
        <HighlightTone>${highlight}</HighlightTone>
        <ShadowTone>${shadow}</ShadowTone>
        <Color>${color}</Color>
        <Sharpness>${sharpness}</Sharpness>
        <NoisReduction>${nr}</NoisReduction>
        <Clarity>${clarity}</Clarity>
        <LensModulationOpt>ON</LensModulationOpt>
        <ColorSpace>sRGB</ColorSpace>
        <HDR/>
        <DigitalTeleConv>OFF</DigitalTeleConv>
        <PortraitEnhancer/>
    </PropertyGroup>
</ConversionProfile>`;
}

app.post('/api/recipe/:id/fp1', requireRecipeDir, (req, res) => {
  const { id } = req.params;
  const { gridFiles } = req.body || {};
  const data = loadRecipes();
  const recipe = data.recipes[id];
  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found' });
  }

  const xml = generateFP1XML(recipe);
  const xrsDir = path.join(
    os.homedir(),
    'Library', 'Application Support', 'com.fujifilm.denji',
    'X RAW STUDIO', 'X100VI', 'X100VI_0100'
  );
  fs.mkdirSync(xrsDir, { recursive: true });

  const filename = `${slugify(recipe.title || 'Untitled')}.FP1`;
  const fp1Path = path.join(xrsDir, filename);
  fs.writeFileSync(fp1Path, xml, 'utf8');

  // Create staging folder with symlinks to grid RAFs
  let stagingDir = null;
  if (gridFiles && Array.isArray(gridFiles) && gridFiles.length > 0) {
    stagingDir = path.join(recipeDir, 'SnapSifter Preview');
    fs.mkdirSync(stagingDir, { recursive: true });

    // Clear existing contents
    const existing = fs.readdirSync(stagingDir);
    for (const f of existing) {
      const fp = path.join(stagingDir, f);
      const stat = fs.lstatSync(fp);
      if (stat.isFile() || stat.isSymbolicLink()) {
        fs.unlinkSync(fp);
      }
    }

    const rafDir = path.join(recipeDir, 'Liked', 'RAF');
    const linked = [];
    for (const hifName of gridFiles) {
      const stem = path.parse(hifName).name;
      // Find matching RAF by stem
      try {
        const rafFiles = fs.readdirSync(rafDir);
        const match = rafFiles.find(f => path.parse(f).name === stem && f.toUpperCase().endsWith('.RAF'));
        if (match) {
          const rafPath = path.join(rafDir, match);
          const linkPath = path.join(stagingDir, match);
          try {
            fs.symlinkSync(rafPath, linkPath);
            linked.push(match);
          } catch (e) {
            console.error(`Failed to symlink ${match}:`, e.message);
          }
        }
      } catch (e) {
        // rafDir doesn't exist or can't be read
      }
    }
    console.log(`Staging: symlinked ${linked.length}/${gridFiles.length} RAFs to ${stagingDir}`);
  }

  res.json({ ok: true, path: fp1Path, label: recipe.title || 'Untitled', stagingDir });
});

// ── Scan for reprocessed HIF outputs from X RAW Studio ──

app.post('/api/scan-outputs', requireRecipeDir, (req, res) => {
  const { stems } = req.body || {};
  if (!stems || !Array.isArray(stems) || stems.length === 0) {
    return res.status(400).json({ error: 'stems array required' });
  }

  const previewDir = path.join(recipeDir, 'SnapSifter Preview');
  const rafDir = path.join(recipeDir, 'Liked', 'RAF');

  const found = [];
  const missing = [];

  for (const stem of stems) {
    let located = false;

    // Search order: SnapSifter Preview/, Liked/RAF/, root
    const locations = [
      { dir: previewDir, label: 'preview' },
      { dir: rafDir, label: 'raf' },
      { dir: recipeDir, label: 'root' },
    ];

    for (const loc of locations) {
      if (located) break;
      try {
        const files = fs.readdirSync(loc.dir);
        const match = files.find(f => {
          const upper = f.toUpperCase();
          return path.parse(f).name === stem && (upper.endsWith('.HIF') || upper.endsWith('.HEIF'));
        });
        if (match) {
          found.push({
            stem,
            outputPath: path.join(loc.dir, match),
            location: loc.label,
          });
          located = true;
        }
      } catch (e) {
        // directory doesn't exist, skip
      }
    }

    if (!located) {
      missing.push(stem);
    }
  }

  res.json({ found, missing });
});

// ── Serve reprocessed HIF output as JPEG ──

app.get('/api/preview-output-image/:stem', requireRecipeDir, (req, res) => {
  const { stem } = req.params;

  const previewDir = path.join(recipeDir, 'SnapSifter Preview');
  const rafDir = path.join(recipeDir, 'Liked', 'RAF');

  // Search for the output HIF/HEIF in order: preview, raf, root
  const locations = [previewDir, rafDir, recipeDir];
  let srcPath = null;

  for (const dir of locations) {
    try {
      const files = fs.readdirSync(dir);
      const match = files.find(f => {
        const upper = f.toUpperCase();
        return path.parse(f).name === stem && (upper.endsWith('.HIF') || upper.endsWith('.HEIF'));
      });
      if (match) {
        srcPath = path.join(dir, match);
        break;
      }
    } catch (e) {
      // directory doesn't exist
    }
  }

  if (!srcPath) {
    return res.status(404).send('Output not found for stem: ' + stem);
  }

  // Cache to SnapSifter Preview/.cache/
  const outputCacheDir = path.join(recipeDir, 'SnapSifter Preview', '.cache');
  fs.mkdirSync(outputCacheDir, { recursive: true });

  const pathHash = crypto.createHash('md5').update(srcPath).digest('hex').slice(0, 12);
  const cacheName = pathHash + '_output.jpg';
  const cachePath = path.join(outputCacheDir, cacheName);

  try {
    if (!fs.existsSync(cachePath)) {
      generateThumb(srcPath, cachePath, 2000);
    }
    res.type('image/jpeg');
    res.send(fs.readFileSync(cachePath));
  } catch (err) {
    console.error('Error converting output HIF for ' + stem + ':', err.message);
    res.status(500).send('Conversion failed');
  }
});

// ── Grid selection helpers ──

function extractExifBatch(dir) {
  // Check cache — invalidate when RAF file count changes
  let fileCount;
  try {
    fileCount = fs.readdirSync(dir).filter(f => f.toUpperCase().endsWith('.RAF')).length;
  } catch (e) {
    return [];
  }

  if (exifBatchCache[dir] && exifBatchCache[dir].fileCount === fileCount) {
    return exifBatchCache[dir].entries;
  }

  let rawOutput;
  try {
    rawOutput = execSync(
      `exiftool -json -FocalLength -ISO -ExposureTime -FNumber -DateTimeOriginal -WhiteBalance "${dir}"/*.RAF`,
      { stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 50 * 1024 * 1024 }
    );
  } catch (e) {
    // exiftool exits non-zero if no files match — check if there's stdout anyway
    if (e.stdout && e.stdout.length > 0) {
      rawOutput = e.stdout;
    } else {
      return [];
    }
  }
  try {
    const entries = JSON.parse(rawOutput.toString());
    exifBatchCache[dir] = { fileCount, entries };
    return entries;
  } catch (e) {
    console.error('Failed to parse exiftool JSON:', e.message);
    return [];
  }
}

function extractExifBatchAsync(dir) {
  let fileCount;
  try {
    fileCount = fs.readdirSync(dir).filter(f => f.toUpperCase().endsWith('.RAF')).length;
  } catch (e) {
    return;
  }
  if (exifBatchCache[dir] && exifBatchCache[dir].fileCount === fileCount) return;
  exec(
    `exiftool -json -FocalLength -ISO -ExposureTime -FNumber -DateTimeOriginal -WhiteBalance "${dir}"/*.RAF`,
    { maxBuffer: 50 * 1024 * 1024 },
    (err, stdout) => {
      const raw = stdout || (err && err.stdout ? err.stdout.toString() : '');
      if (!raw) return;
      try {
        const entries = JSON.parse(raw);
        exifBatchCache[dir] = { fileCount, entries };
      } catch (e) { /* ignore parse errors */ }
    }
  );
}

function parseExifEntry(entry) {
  // FocalLength: "23 mm" or "23mm" or 23
  let focalLength = null;
  if (entry.FocalLength != null) {
    const m = String(entry.FocalLength).match(/([\d.]+)/);
    if (m) focalLength = parseFloat(m[1]);
  }

  let iso = entry.ISO != null ? Number(entry.ISO) : null;

  // ExposureTime: "1/125" or "0.5" or number
  let exposureTime = null;
  if (entry.ExposureTime != null) {
    const s = String(entry.ExposureTime);
    if (s.includes('/')) {
      const parts = s.split('/');
      exposureTime = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else {
      exposureTime = parseFloat(s);
    }
    if (isNaN(exposureTime)) exposureTime = null;
  }

  let fNumber = null;
  if (entry.FNumber != null) {
    fNumber = parseFloat(String(entry.FNumber));
    if (isNaN(fNumber)) fNumber = null;
  }

  // DateTimeOriginal: "2026:04:15 14:32:10" or similar
  let hourOfDay = null;
  if (entry.DateTimeOriginal != null) {
    const m = String(entry.DateTimeOriginal).match(/(\d{2}):(\d{2}):(\d{2})$/);
    if (m) hourOfDay = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  }

  let wb = entry.WhiteBalance != null ? String(entry.WhiteBalance) : null;

  return { focalLength, iso, exposureTime, fNumber, hourOfDay, wb };
}

function wbToNumeric(wb) {
  if (!wb) return 0.5;
  const lower = wb.toLowerCase();
  if (lower === 'auto' || lower.includes('auto')) return 0;
  if (lower.includes('daylight') || lower.includes('fine')) return 0.2;
  if (lower.includes('shade') || lower.includes('cloudy')) return 0.4;
  if (lower.includes('fluorescent')) return 0.6;
  if (lower.includes('incandescent') || lower.includes('tungsten')) return 0.8;
  return 0.5;
}

function buildFeatureVectors(entries) {
  const parsed = entries.map(e => ({
    file: path.basename(e.SourceFile || ''),
    raw: e,
    ...parseExifEntry(e),
  }));

  // Collect non-null values per dimension for median + min/max
  const dims = ['focalLength', 'iso', 'exposureTime', 'fNumber', 'hourOfDay'];
  const values = {};
  for (const d of dims) values[d] = [];
  for (const p of parsed) {
    for (const d of dims) {
      if (p[d] != null && !isNaN(p[d]) && p[d] > 0) values[d].push(p[d]);
    }
  }

  // Compute medians
  const medians = {};
  for (const d of dims) {
    const sorted = values[d].slice().sort((a, b) => a - b);
    medians[d] = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 1;
  }

  // Fill missing with median, apply log where needed
  const logDims = ['focalLength', 'iso', 'exposureTime'];
  const vectors = parsed.map(p => {
    const v = {};
    for (const d of dims) {
      v[d] = (p[d] != null && !isNaN(p[d]) && p[d] > 0) ? p[d] : medians[d];
    }
    for (const d of logDims) {
      v[d] = Math.log(v[d]);
    }
    v.wb = wbToNumeric(p.wb);
    return { file: p.file, rawExif: p, values: v };
  });

  // Min-max normalize each dimension (hourOfDay uses /24 instead)
  const allDims = ['focalLength', 'iso', 'exposureTime', 'fNumber', 'hourOfDay', 'wb'];
  const mins = {}, maxs = {};
  for (const d of allDims) {
    mins[d] = Infinity; maxs[d] = -Infinity;
    for (const vec of vectors) {
      mins[d] = Math.min(mins[d], vec.values[d]);
      maxs[d] = Math.max(maxs[d], vec.values[d]);
    }
  }

  for (const vec of vectors) {
    for (const d of allDims) {
      if (d === 'hourOfDay') {
        vec.values[d] = vec.values[d] / 24;
      } else {
        const range = maxs[d] - mins[d];
        vec.values[d] = range > 0 ? (vec.values[d] - mins[d]) / range : 0.5;
      }
    }
    vec.vector = allDims.map(d => vec.values[d]);
  }

  return vectors;
}

function euclideanDist(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function farthestPointSampling(vectors, count, fixedIndices, excludeIndices) {
  if (vectors.length === 0) return [];
  count = Math.min(count, vectors.length);

  const selected = [];
  const excluded = new Set(excludeIndices || []);

  if (fixedIndices && fixedIndices.length > 0) {
    for (const idx of fixedIndices) {
      selected.push(idx);
    }
  } else {
    const candidates = [];
    for (let i = 0; i < vectors.length; i++) {
      if (!excluded.has(i)) candidates.push(i);
    }
    if (candidates.length === 0) return [];
    selected.push(candidates[Math.floor(Math.random() * candidates.length)]);
  }

  while (selected.length < count) {
    let bestIdx = -1;
    let bestDist = -1;

    for (let i = 0; i < vectors.length; i++) {
      if (selected.includes(i) || excluded.has(i)) continue;

      let minDist = Infinity;
      for (const si of selected) {
        const d = euclideanDist(vectors[i].vector, vectors[si].vector);
        if (d < minDist) minDist = d;
      }

      if (minDist > bestDist) {
        bestDist = minDist;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    selected.push(bestIdx);
  }

  return selected;
}

function formatExifSummary(rawExif) {
  const fl = rawExif.focalLength != null ? `${rawExif.focalLength}mm` : null;
  const iso = rawExif.iso;
  const ap = rawExif.fNumber != null ? `f/${rawExif.fNumber}` : null;

  let shutter = null;
  if (rawExif.exposureTime != null) {
    if (rawExif.exposureTime >= 1) {
      shutter = `${rawExif.exposureTime}s`;
    } else {
      shutter = `1/${Math.round(1 / rawExif.exposureTime)}`;
    }
  }

  let time = null;
  if (rawExif.hourOfDay != null) {
    const h = Math.floor(rawExif.hourOfDay);
    const m = Math.round((rawExif.hourOfDay - h) * 60);
    time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return {
    focalLength: fl,
    iso: iso,
    aperture: ap,
    shutterSpeed: shutter,
    time: time,
    wb: rawExif.wb || null,
  };
}

// ── Recipe EXIF defaults endpoint ──

const FUJI_FILM_SIM_MAP = {
  // Numeric MakerNote values
  0x0001: 'Provia', 0x0002: 'Velvia', 0x0003: 'Astia',
  0x0100: 'Classic', 0x0200: 'ClassicNeg', 0x0300: 'Nostalgic',
  0x0400: 'RealaACE',
  0x0501: 'ProNegStd', 0x0502: 'ProNegHi',
  0x0600: 'Eterna', 0x0700: 'BleachBypass',
  0x0800: 'Acros', 0x0801: 'AcrosYe', 0x0802: 'AcrosR', 0x0803: 'AcrosG',
  0x0900: 'Mono', 0x0901: 'MonoYe', 0x0902: 'MonoR', 0x0903: 'MonoG',
  0x0A00: 'Sepia',
  // String values exifr / exiftool might return
  'PROVIA/STANDARD': 'Provia', 'Provia': 'Provia', 'PROVIA': 'Provia',
  'F0/Standard (Provia)': 'Provia', 'F0/Standard': 'Provia',
  'Velvia/VIVID': 'Velvia', 'Velvia': 'Velvia', 'VELVIA': 'Velvia',
  'ASTIA/SOFT': 'Astia', 'Astia': 'Astia', 'ASTIA': 'Astia',
  'CLASSIC CHROME': 'Classic', 'Classic Chrome': 'Classic', 'Classic': 'Classic',
  'CLASSIC Neg.': 'ClassicNeg', 'Classic Neg.': 'ClassicNeg', 'Classic Neg': 'ClassicNeg', 'Classic Negative': 'ClassicNeg', 'ClassicNeg': 'ClassicNeg', 'CLASSIC NEGATIVE': 'ClassicNeg',
  'NOSTALGIC Neg.': 'Nostalgic', 'Nostalgic Neg.': 'Nostalgic', 'Nostalgic Neg': 'Nostalgic', 'Nostalgic': 'Nostalgic', 'NOSTALGIC NEGATIVE': 'Nostalgic',
  'REALA ACE': 'RealaACE', 'Reala ACE': 'RealaACE', 'RealaACE': 'RealaACE',
  'PRO Neg.Std': 'ProNegStd', 'PRO Neg. Std': 'ProNegStd', 'ProNegStd': 'ProNegStd',
  'PRO Neg.Hi': 'ProNegHi', 'PRO Neg. Hi': 'ProNegHi', 'ProNegHi': 'ProNegHi',
  'ETERNA/CINEMA': 'Eterna', 'Eterna': 'Eterna', 'ETERNA': 'Eterna',
  'ETERNA BLEACH BYPASS': 'BleachBypass', 'Bleach Bypass': 'BleachBypass', 'BleachBypass': 'BleachBypass',
  'ACROS': 'Acros', 'Acros': 'Acros',
  'ACROS+Ye': 'AcrosYe', 'ACROS+Y': 'AcrosYe', 'AcrosYe': 'AcrosYe',
  'ACROS+R': 'AcrosR', 'AcrosR': 'AcrosR',
  'ACROS+G': 'AcrosG', 'AcrosG': 'AcrosG',
  'MONO': 'Mono', 'Mono': 'Mono', 'Monochrome': 'Mono',
  'MONO+Ye': 'MonoYe', 'MONO+Y': 'MonoYe', 'MonoYe': 'MonoYe',
  'MONO+R': 'MonoR', 'MonoR': 'MonoR',
  'MONO+G': 'MonoG', 'MonoG': 'MonoG',
  'SEPIA': 'Sepia', 'Sepia': 'Sepia',
};

function mapFilmSimulation(val) {
  if (val == null) return null;
  if (FUJI_FILM_SIM_MAP[val] !== undefined) return FUJI_FILM_SIM_MAP[val];
  // Try case-insensitive exact match
  const s = String(val).toLowerCase();
  for (const [k, v] of Object.entries(FUJI_FILM_SIM_MAP)) {
    if (String(k).toLowerCase() === s) return v;
  }
  // Try extracting name from parenthetical format: "F0/Standard (Provia)" → "Provia"
  const parenMatch = String(val).match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inner = parenMatch[1];
    if (FUJI_FILM_SIM_MAP[inner] !== undefined) return FUJI_FILM_SIM_MAP[inner];
    const innerLower = inner.toLowerCase();
    for (const [k, v] of Object.entries(FUJI_FILM_SIM_MAP)) {
      if (String(k).toLowerCase() === innerLower) return v;
    }
  }
  // Try substring match — check if any known key is contained in val
  const valLower = String(val).toLowerCase().replace(/[^a-z]/g, '');
  const knownNames = ['provia', 'velvia', 'astia', 'classicneg', 'classicchrome', 'nostalgic', 'realaace', 'pronegstd', 'proneghi', 'eterna', 'bleachbypass', 'acros', 'mono', 'sepia'];
  const nameMap = { provia: 'Provia', velvia: 'Velvia', astia: 'Astia', classicneg: 'ClassicNeg', classicchrome: 'Classic', nostalgic: 'Nostalgic', realaace: 'RealaACE', pronegstd: 'ProNegStd', proneghi: 'ProNegHi', eterna: 'Eterna', bleachbypass: 'BleachBypass', acros: 'Acros', mono: 'Mono', sepia: 'Sepia' };
  for (const name of knownNames) {
    if (valLower.includes(name)) return nameMap[name];
  }
  return null;
}

function mapStrengthValue(val) {
  if (val == null) return null;
  const s = String(val).toLowerCase();
  if (s === 'off' || s === '0' || s === 'none') return 'Off';
  if (s === 'weak' || s === 'low' || s === '1') return 'Weak';
  if (s === 'strong' || s === 'high' || s === '2') return 'Strong';
  return null;
}

function mapGrainSize(val) {
  if (val == null) return null;
  const s = String(val).toLowerCase();
  if (s === 'small' || s === '0' || s === '1') return 'Small';
  if (s === 'large' || s === '2') return 'Large';
  return null;
}

function clampInt(val, min, max) {
  if (val == null) return null;
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function parseLeadingNumber(val) {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const m = String(val).match(/^([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function extractRecipeFromExiftool(data) {
  if (!data || typeof data !== 'object') return null;
  const params = {};

  // Film simulation
  if (data.FilmMode) {
    const filmSim = mapFilmSimulation(data.FilmMode);
    if (filmSim) params.filmSimulation = filmSim;
  }

  // White balance
  if (data.WhiteBalance != null) {
    const wbStr = String(data.WhiteBalance);
    const wbMap = {
      'auto': 'Auto', 'auto white': 'AutoWhite', 'auto ambiance': 'AutoAmbiance',
      'auto (ambiance priority)': 'AutoAmbiance', 'auto (white priority)': 'AutoWhite',
      'daylight': 'Daylight', 'fine weather': 'Daylight', 'sunny': 'Daylight',
      'shade': 'Shade', 'cloudy': 'Shade',
      'fluorescent': 'Fluorescent1', 'fluorescent (daylight)': 'Fluorescent1',
      'fluorescent (warm white)': 'Fluorescent2', 'fluorescent (cool white)': 'Fluorescent3',
      'incandescent': 'Incandescent', 'tungsten': 'Incandescent',
      'underwater': 'Underwater',
      'color temperature': 'ColorTemp', 'kelvin': 'ColorTemp',
      'custom': 'Custom1', 'custom1': 'Custom1', 'custom2': 'Custom2', 'custom3': 'Custom3',
    };
    const lower = wbStr.toLowerCase();
    if (wbMap[lower]) params.whiteBalance = wbMap[lower];
    else if (/auto/i.test(wbStr)) params.whiteBalance = 'Auto';
  }

  // WB shift — exiftool format: "Red +40, Blue -120"
  if (data.WhiteBalanceFineTune) {
    const wbft = String(data.WhiteBalanceFineTune);
    const redMatch = wbft.match(/Red\s*([+-]?\d+)/i);
    const blueMatch = wbft.match(/Blue\s*([+-]?\d+)/i);
    if (redMatch) params.wbShiftR = clampInt(Math.round(parseInt(redMatch[1], 10) / 20), -9, 9);
    if (blueMatch) params.wbShiftB = clampInt(Math.round(parseInt(blueMatch[1], 10) / 20), -9, 9);
  }

  // Dynamic range — use DevelopmentDynamicRange (the actual value), not DynamicRange (the mode label)
  const dr = data.DevelopmentDynamicRange ?? data.DynamicRange ?? null;
  if (dr != null) {
    const drVal = parseInt(dr, 10);
    if (!isNaN(drVal) && [100, 200, 400].includes(drVal)) params.dynamicRange = drVal;
  }

  // Highlight tone — format: "-2 (soft)" or "0 (normal)"
  if (data.HighlightTone != null) {
    const ht = parseLeadingNumber(data.HighlightTone);
    if (ht != null) params.highlightTone = clampInt(ht, -2, 4);
  }

  // Shadow tone
  if (data.ShadowTone != null) {
    const st = parseLeadingNumber(data.ShadowTone);
    if (st != null) params.shadowTone = clampInt(st, -2, 4);
  }

  // Color / Saturation — format: "+3 (very high)"
  if (data.Saturation != null) {
    const c = parseLeadingNumber(data.Saturation);
    if (c != null) params.color = clampInt(c, -4, 4);
  }

  // Sharpness — text or number format
  if (data.Sharpness != null) {
    const sharpStr = String(data.Sharpness);
    const leading = parseLeadingNumber(sharpStr);
    if (leading != null) {
      params.sharpness = clampInt(leading, -4, 4);
    } else {
      const sharpTextMap = { 'soft': -2, 'normal': 0, 'hard': 2 };
      const mapped = sharpTextMap[sharpStr.toLowerCase()];
      if (mapped != null) params.sharpness = mapped;
    }
  }

  // Noise reduction — format: "-4 (weakest)"
  if (data.NoiseReduction != null) {
    const nr = parseLeadingNumber(data.NoiseReduction);
    if (nr != null) params.noiseReduction = clampInt(nr, -4, 4);
  }

  // Clarity — already numeric
  if (data.Clarity != null) {
    params.clarity = clampInt(data.Clarity, -5, 5);
  }

  // Grain effect roughness
  if (data.GrainEffectRoughness != null) {
    const ge = mapStrengthValue(data.GrainEffectRoughness);
    if (ge) params.grainEffect = ge;
  }

  // Grain size — always set for consistent comparison (defaults to Small when grain is Off)
  if (data.GrainEffectSize != null) {
    const gs = mapGrainSize(data.GrainEffectSize);
    if (gs) params.grainSize = gs;
  }
  if (!params.grainSize) params.grainSize = 'Small';

  // Color Chrome Effect
  if (data.ColorChromeEffect != null) {
    const cce = mapStrengthValue(data.ColorChromeEffect);
    if (cce) params.colorChromeEffect = cce;
  }

  // Color Chrome FX Blue
  if (data.ColorChromeFXBlue != null) {
    const ccb = mapStrengthValue(data.ColorChromeFXBlue);
    if (ccb) params.colorChromeFXBlue = ccb;
  }

  // Strip null values
  for (const k of Object.keys(params)) {
    if (params[k] == null) delete params[k];
  }

  return Object.keys(params).length > 0 ? params : null;
}

function extractRecipeParams(exif) {
  const params = {};

  // Film simulation — try multiple tag names
  const filmRaw = exif.FilmMode ?? exif.FilmSimulation ?? exif.SaturationAdj ?? null;
  const filmSim = mapFilmSimulation(filmRaw);
  if (filmSim) params.filmSimulation = filmSim;

  // White balance
  const wb = exif.WhiteBalance ?? exif.WhiteBalanceMode ?? null;
  if (wb != null) {
    const wbStr = String(wb);
    // exifr may return human-readable string or numeric
    const wbMap = {
      'auto': 'Auto', 'auto white': 'AutoWhite', 'auto ambiance': 'AutoAmbiance',
      'daylight': 'Daylight', 'fine weather': 'Daylight', 'sunny': 'Daylight',
      'shade': 'Shade', 'cloudy': 'Shade',
      'fluorescent': 'Fluorescent1', 'fluorescent (daylight)': 'Fluorescent1',
      'fluorescent (warm white)': 'Fluorescent2', 'fluorescent (cool white)': 'Fluorescent3',
      'incandescent': 'Incandescent', 'tungsten': 'Incandescent',
      'underwater': 'Underwater',
      'color temperature': 'ColorTemp', 'kelvin': 'ColorTemp',
      'custom': 'Custom1', 'custom1': 'Custom1', 'custom2': 'Custom2', 'custom3': 'Custom3',
    };
    const lower = wbStr.toLowerCase();
    if (wbMap[lower]) params.whiteBalance = wbMap[lower];
    else if (/auto/i.test(wbStr)) params.whiteBalance = 'Auto';
  }

  // WB shift
  const wbShift = exif.WhiteBalanceFineTune ?? exif.WBShiftAB ?? null;
  if (Array.isArray(wbShift) && wbShift.length >= 2) {
    params.wbShiftR = clampInt(wbShift[0], -9, 9);
    params.wbShiftB = clampInt(wbShift[1], -9, 9);
  } else if (wbShift != null && typeof wbShift === 'object') {
    if (wbShift.R != null) params.wbShiftR = clampInt(wbShift.R, -9, 9);
    if (wbShift.B != null) params.wbShiftB = clampInt(wbShift.B, -9, 9);
  }
  // Also try separate tags
  if (params.wbShiftR == null && exif.WBShiftR != null) params.wbShiftR = clampInt(exif.WBShiftR, -9, 9);
  if (params.wbShiftB == null && exif.WBShiftB != null) params.wbShiftB = clampInt(exif.WBShiftB, -9, 9);

  // Dynamic range
  const dr = exif.DynamicRange ?? exif.DevelopmentDynamicRange ?? exif.DRangePriority ?? null;
  if (dr != null) {
    const drVal = parseInt(dr, 10);
    if ([100, 200, 400].includes(drVal)) params.dynamicRange = drVal;
    else if (drVal === 0 || String(dr).toLowerCase() === 'auto') params.dynamicRange = 100;
  }

  // Highlight / Shadow tone
  const ht = exif.HighlightTone ?? exif.ShadowHighlight ?? null;
  if (ht != null) params.highlightTone = clampInt(ht, -2, 4);
  const st = exif.ShadowTone ?? null;
  if (st != null) params.shadowTone = clampInt(st, -2, 4);

  // Color / Saturation
  const color = exif.Saturation ?? exif.Color ?? exif.ColorSaturation ?? null;
  if (color != null) params.color = clampInt(color, -4, 4);

  // Sharpness
  const sharp = exif.Sharpness ?? exif.SharpnessAdj ?? null;
  if (sharp != null) params.sharpness = clampInt(sharp, -4, 4);

  // Noise reduction
  const nr = exif.NoiseReduction ?? exif.NoisReduction ?? null;
  if (nr != null) params.noiseReduction = clampInt(nr, -4, 4);

  // Grain effect
  const grain = exif.GrainEffect ?? exif.GrainEffectRoughness ?? null;
  const grainMapped = mapStrengthValue(grain);
  if (grainMapped) params.grainEffect = grainMapped;

  // Grain size
  const gs = exif.GrainSize ?? exif.GrainEffectSize ?? null;
  const gsMapped = mapGrainSize(gs);
  if (gsMapped) params.grainSize = gsMapped;

  // Color Chrome Effect
  const cce = exif.ColorChromeEffect ?? exif.ChromeEffect ?? null;
  const cceMapped = mapStrengthValue(cce);
  if (cceMapped) params.colorChromeEffect = cceMapped;

  // Color Chrome FX Blue
  const ccb = exif.ColorChromeFXBlue ?? exif.ChromeFXBlue ?? null;
  const ccbMapped = mapStrengthValue(ccb);
  if (ccbMapped) params.colorChromeFXBlue = ccbMapped;

  // Clarity
  const clarity = exif.Clarity ?? null;
  if (clarity != null) params.clarity = clampInt(clarity, -5, 5);

  // Strip null values
  for (const k of Object.keys(params)) {
    if (params[k] == null) delete params[k];
  }

  return Object.keys(params).length > 0 ? params : null;
}

app.get('/api/recipe-exif-defaults', async (req, res) => {
  const dir = req.query.dir;
  if (!dir) return res.status(400).json({ error: 'dir param required' });

  const rafDir = path.join(dir, 'Liked', 'RAF');
  if (!fs.existsSync(rafDir)) {
    return res.json({ params: null });
  }

  try {
    const entries = fs.readdirSync(rafDir);
    const rafFile = entries.find(f => f.toUpperCase().endsWith('.RAF'));
    if (!rafFile) {
      return res.json({ params: null });
    }

    const filePath = path.join(rafDir, rafFile);
    const exiftoolArgs = [
      '-json',
      '-FilmMode', '-WhiteBalance', '-WhiteBalanceFineTune',
      '-DynamicRange', '-DevelopmentDynamicRange',
      '-HighlightTone', '-ShadowTone', '-Saturation', '-Sharpness',
      '-NoiseReduction', '-Clarity',
      '-GrainEffectRoughness', '-GrainEffectSize',
      '-ColorChromeEffect', '-ColorChromeFXBlue',
      filePath
    ];
    const stdout = execSync(`/opt/homebrew/bin/exiftool ${exiftoolArgs.map(a => JSON.stringify(a)).join(' ')}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const parsed = JSON.parse(stdout);
    if (!parsed || !parsed[0]) {
      return res.json({ params: null, sourceFile: rafFile });
    }

    const params = extractRecipeFromExiftool(parsed[0]);
    res.json({ params, sourceFile: rafFile });
  } catch (e) {
    console.error('Failed to read recipe EXIF defaults:', e.message);
    res.json({ params: null, error: e.message });
  }
});

// ── Batch recipe EXIF extraction ──

app.post('/api/batch-recipe-exif', express.json(), async (req, res) => {
  const { dir, files } = req.body;
  if (!dir || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'dir and files[] required' });
  }

  const rafDir = path.join(dir, 'Liked', 'RAF');
  if (!fs.existsSync(rafDir)) {
    return res.json({ perFile: {}, majority: {} });
  }

  // Map HIF stems to RAF filenames
  const rafEntries = fs.readdirSync(rafDir).filter(f => f.toUpperCase().endsWith('.RAF'));
  const rafByStem = {};
  for (const f of rafEntries) {
    const stem = f.replace(/\.[^.]+$/, '');
    rafByStem[stem] = f;
  }

  // Find matching RAF files
  const stems = files.map(f => f.replace(/\.[^.]+$/, ''));
  const matchedPaths = [];
  const matchedStems = [];
  for (const stem of stems) {
    if (rafByStem[stem]) {
      matchedPaths.push(path.join(rafDir, rafByStem[stem]));
      matchedStems.push(stem);
    }
  }

  if (matchedPaths.length === 0) {
    return res.json({ perFile: {}, majority: {} });
  }

  try {
    const exiftoolArgs = [
      '-json',
      '-FilmMode', '-WhiteBalance', '-WhiteBalanceFineTune',
      '-DynamicRange', '-DevelopmentDynamicRange',
      '-HighlightTone', '-ShadowTone', '-Saturation', '-Sharpness',
      '-NoiseReduction', '-Clarity',
      '-GrainEffectRoughness', '-GrainEffectSize',
      '-ColorChromeEffect', '-ColorChromeFXBlue',
      '-ShutterSpeed', '-ISO', '-Aperture', '-FocalLength', '-DateTimeOriginal',
      ...matchedPaths
    ];
    const stdout = execSync(`/opt/homebrew/bin/exiftool ${exiftoolArgs.map(a => JSON.stringify(a)).join(' ')}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000
    });
    const parsed = JSON.parse(stdout);

    const perFile = {};
    for (let i = 0; i < parsed.length; i++) {
      const stem = matchedStems[i];
      const params = extractRecipeFromExiftool(parsed[i]);
      if (params) {
        const raw = parsed[i];
        if (raw.ShutterSpeed) params._shutterSpeed = parseFloat(raw.ShutterSpeed) || null;
        if (raw.ISO) params._iso = parseInt(raw.ISO, 10) || null;
        if (raw.Aperture) params._aperture = parseFloat(raw.Aperture) || null;
        if (raw.FocalLength) {
          const flMatch = String(raw.FocalLength).match(/([\d.]+)/);
          params._focalLength = flMatch ? parseFloat(flMatch[1]) : null;
        }
        if (raw.DateTimeOriginal) params._dateTaken = raw.DateTimeOriginal;
        perFile[stem] = params;
      }
    }

    // Compute majority params
    const majority = {};
    const allKeys = new Set();
    for (const p of Object.values(perFile)) {
      for (const k of Object.keys(p)) allKeys.add(k);
    }
    for (const key of allKeys) {
      const counts = {};
      for (const p of Object.values(perFile)) {
        if (p[key] != null) {
          const v = String(p[key]);
          counts[v] = (counts[v] || 0) + 1;
        }
      }
      let maxCount = 0, maxVal = null;
      for (const [v, c] of Object.entries(counts)) {
        if (c > maxCount) { maxCount = c; maxVal = v; }
      }
      if (maxVal != null) {
        // Preserve numeric types
        const numVal = Number(maxVal);
        majority[key] = isNaN(numVal) ? maxVal : numVal;
      }
    }

    res.json({ perFile, majority });
  } catch (e) {
    console.error('Batch recipe EXIF extraction failed:', e.message);
    res.json({ perFile: {}, majority: {}, error: e.message });
  }
});

// ── Camera detection ──

app.get('/api/camera-status', (req, res) => {
  try {
    // Try system_profiler first
    const output = execSync('system_profiler SPUSBDataType 2>/dev/null', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });
    if (/fuji|x100|x-t|x-s|x-h|x-e|x-pro|gfx/i.test(output)) {
      return res.json({ connected: true });
    }
  } catch (e) {}

  try {
    // Fallback: ioreg (camera appears as "USB PTP Camera" on some Macs)
    const ioreg = execSync('ioreg -p IOUSB -l 2>/dev/null', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });
    if (/fuji|x100|USB PTP Camera/i.test(ioreg)) {
      return res.json({ connected: true });
    }
  } catch (e) {}

  res.json({ connected: false });
});

// ── Grid selection endpoints ──

app.get('/api/raf-count', (req, res) => {
  const dir = req.query.dir;
  if (!dir) return res.status(400).json({ error: 'dir param required' });
  if (!fs.existsSync(dir)) return res.json({ count: 0, dir });
  try {
    const entries = fs.readdirSync(dir);
    const rafCount = entries.filter(f => f.toUpperCase().endsWith('.RAF')).length;
    res.json({ count: rafCount, dir });
  } catch (e) {
    res.json({ count: 0, dir });
  }
});

app.get('/api/grid-select', (req, res) => {
  const dir = req.query.dir; // base session directory
  const count = parseInt(req.query.count, 10) || 9;

  if (!dir || !path.isAbsolute(dir)) {
    return res.status(400).json({ error: 'dir must be an absolute path' });
  }

  const rafDir = path.join(dir, 'Liked', 'RAF');
  let hifDir = path.join(dir, 'Liked', 'HIF');
  const jpgDir = path.join(dir, 'Liked', 'JPG');

  if (!fs.existsSync(rafDir)) {
    return res.status(404).json({ error: 'Liked/RAF/ directory not found' });
  }
  if (!fs.existsSync(hifDir)) {
    if (fs.existsSync(jpgDir)) {
      hifDir = jpgDir;
    } else {
      return res.status(404).json({ error: 'Liked/HIF/ directory not found' });
    }
  }

  // Build a map of HIF/JPG files by stem (case-insensitive)
  let hifFiles;
  try {
    hifFiles = fs.readdirSync(hifDir).filter(f => {
      const upper = f.toUpperCase();
      return (upper.endsWith('.HIF') || upper.endsWith('.HEIF') || upper.endsWith('.JPG') || upper.endsWith('.JPEG')) && !f.startsWith('.') && !f.startsWith('._');
    });
  } catch (e) {
    return res.status(500).json({ error: 'Cannot read HIF directory' });
  }

  const hifByStem = {};
  hifFiles.forEach(f => {
    const stem = f.replace(/\.[^.]+$/, '').toUpperCase();
    hifByStem[stem] = f;
  });

  if (hifFiles.length === 0) {
    return res.json({ selected: [], totalAvailable: 0, hifDir });
  }

  const exifEntries = exifBatchCache[rafDir] ? extractExifBatch(rafDir) : [];
  const selected = gridSelection.selectGridPhotos(hifFiles, exifEntries, count, hifByStem);
  if (!exifBatchCache[rafDir]) extractExifBatchAsync(rafDir);
  res.json({ selected, totalAvailable: hifFiles.length, hifDir });
});

app.post('/api/grid-replace', (req, res) => {
  const { dir, selected, replaceIndex, count } = req.body; // dir = base session directory
  const targetCount = count || 9;

  if (!dir || !path.isAbsolute(dir)) {
    return res.status(400).json({ error: 'dir must be an absolute path' });
  }

  const rafDir = path.join(dir, 'Liked', 'RAF');
  let hifDir = path.join(dir, 'Liked', 'HIF');
  const jpgDir2 = path.join(dir, 'Liked', 'JPG');

  if (!fs.existsSync(rafDir)) {
    return res.status(404).json({ error: 'Liked/RAF/ directory not found' });
  }
  if (!fs.existsSync(hifDir)) {
    if (fs.existsSync(jpgDir2)) {
      hifDir = jpgDir2;
    } else {
      return res.status(404).json({ error: 'Liked/HIF/ directory not found' });
    }
  }
  if (!Array.isArray(selected) || typeof replaceIndex !== 'number') {
    return res.status(400).json({ error: 'selected (array) and replaceIndex (number) required' });
  }
  if (replaceIndex < 0 || replaceIndex >= selected.length) {
    return res.status(400).json({ error: 'replaceIndex out of bounds' });
  }

  // Build HIF/JPG stem map
  let hifFiles;
  try {
    hifFiles = fs.readdirSync(hifDir).filter(f => {
      const upper = f.toUpperCase();
      return (upper.endsWith('.HIF') || upper.endsWith('.HEIF') || upper.endsWith('.JPG') || upper.endsWith('.JPEG')) && !f.startsWith('.') && !f.startsWith('._');
    });
  } catch (e) {
    return res.status(500).json({ error: 'Cannot read HIF directory' });
  }
  const hifByStem = {};
  hifFiles.forEach(f => {
    const stem = f.replace(/\.[^.]+$/, '').toUpperCase();
    hifByStem[stem] = f;
  });

  // EXIF from RAFs
  const exifEntries = extractExifBatch(rafDir);
  if (exifEntries.length === 0) {
    return res.status(500).json({ error: 'No EXIF data extracted' });
  }

  const vectors = buildFeatureVectors(exifEntries);

  // Pick a random replacement not in current selection
  const currentStems = new Set(selected.map(f => f.replace(/\.[^.]+$/, '').toUpperCase()));

  // All available HIF files not currently selected
  const candidates = hifFiles.filter(f => {
    const stem = f.replace(/\.[^.]+$/, '').toUpperCase();
    return !currentStems.has(stem);
  });

  if (candidates.length === 0) {
    return res.json({ selected: selected.map(f => ({ file: f })), totalAvailable: hifFiles.length, hifDir });
  }

  // Pick random
  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  // Build result — keep existing photos, replace the one at replaceIndex
  const result = [];
  for (let i = 0; i < selected.length; i++) {
    const file = i === replaceIndex ? pick : selected[i];
    const stem = file.replace(/\.[^.]+$/, '').toUpperCase();
    let exifSummary = { focalLength: null, iso: null, aperture: null, shutterSpeed: null, time: null, wb: null };
    if (vectors.length > 0) {
      const matchVec = vectors.find(v => v.file.replace(/\.[^.]+$/, '').toUpperCase() === stem);
      if (matchVec) exifSummary = formatExifSummary(matchVec.rawExif);
    }
    result.push({ file: file, ...exifSummary });
  }

  res.json({ selected: result, totalAvailable: hifFiles.length, hifDir });
});

app.post('/api/grid-shuffle', (req, res) => {
  const { dir, count } = req.body; // dir = base session directory
  const targetCount = count || 9;

  if (!dir || !path.isAbsolute(dir)) {
    return res.status(400).json({ error: 'dir must be an absolute path' });
  }

  const rafDir = path.join(dir, 'Liked', 'RAF');
  let hifDir = path.join(dir, 'Liked', 'HIF');
  const jpgDir3 = path.join(dir, 'Liked', 'JPG');

  if (!fs.existsSync(rafDir)) {
    return res.status(404).json({ error: 'Liked/RAF/ directory not found' });
  }
  if (!fs.existsSync(hifDir)) {
    if (fs.existsSync(jpgDir3)) {
      hifDir = jpgDir3;
    } else {
      return res.status(404).json({ error: 'Liked/HIF/ directory not found' });
    }
  }

  // Build HIF/JPG stem map
  let hifFiles;
  try {
    hifFiles = fs.readdirSync(hifDir).filter(f => {
      const upper = f.toUpperCase();
      return (upper.endsWith('.HIF') || upper.endsWith('.HEIF') || upper.endsWith('.JPG') || upper.endsWith('.JPEG')) && !f.startsWith('.') && !f.startsWith('._');
    });
  } catch (e) {
    return res.status(500).json({ error: 'Cannot read HIF directory' });
  }
  const hifByStem = {};
  hifFiles.forEach(f => {
    const stem = f.replace(/\.[^.]+$/, '').toUpperCase();
    hifByStem[stem] = f;
  });

  if (hifFiles.length === 0) {
    return res.json({ selected: [], totalAvailable: 0, hifDir });
  }

  const selected = gridSelection.shuffleGridPhotos(hifFiles, [], targetCount, hifByStem);
  res.json({ selected, totalAvailable: hifFiles.length, hifDir });
});

// ── Startup: migrate old state.json → sessions (no auto-resume) ──

(function migrateOldState() {
  const oldStateFile = path.join(stateDir, 'state.json');

  // Migrate old state.json if sessions.json doesn't exist yet
  if (!fs.existsSync(sessionsFile) && fs.existsSync(oldStateFile)) {
    try {
      const old = JSON.parse(fs.readFileSync(oldStateFile, 'utf8'));
      if (old.lastDir && fs.existsSync(old.lastDir)) {
        const dirFiles = fs.readdirSync(old.lastDir)
          .filter(f => isSupportedImage(f) && !f.startsWith('._'));
        const session = {
          id: crypto.randomUUID(),
          dir: old.lastDir,
          name: path.basename(old.lastDir),
          lastOpened: new Date().toISOString(),
          lastPosition: 0,
          fileCount: dirFiles.length,
          ratedCount: countRatingsInDir(old.lastDir),
        };
        saveSessions([session]);
        console.log(`Migrated state.json → sessions.json`);
      }
    } catch (e) {
      console.error('Migration failed:', e.message);
    }
  }
})();

// ── Batch pre-warm thumbnails in parallel ──
app.post('/api/prewarm-thumbs', (req, res) => {
  const { dir, files } = req.body;
  if (!dir || !files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'dir and files array required' });
  }

  const promises = files.map(filename => {
    const srcPath = path.join(dir, filename);
    if (!fs.existsSync(srcPath)) return Promise.resolve();

    const pathHash = crypto.createHash('md5').update(srcPath).digest('hex').slice(0, 12);
    const cacheName = pathHash + '_preview800.jpg';
    const cachePath = path.join(previewCacheDir, cacheName);

    if (fs.existsSync(cachePath)) return Promise.resolve();

    return new Promise((resolve) => {
      const upper = srcPath.toUpperCase();
      const needsConversion = upper.endsWith('.HIF') || upper.endsWith('.HEIF') || upper.endsWith('.RAF');
      const cmd = needsConversion
        ? `sips -s format jpeg -Z 800 ${JSON.stringify(srcPath)} --out ${JSON.stringify(cachePath)}`
        : `sips -Z 800 ${JSON.stringify(srcPath)} --out ${JSON.stringify(cachePath)}`;
      exec(cmd, { stdio: 'pipe' }, (err) => {
        if (err) console.error('Prewarm failed for', filename, err.message);
        resolve();
      });
    });
  });

  Promise.all(promises).then(() => {
    res.json({ ok: true, warmed: files.length });
  });
});

// ── d185 Profile Patching ──

const { patchD185Profile } = d185;

// ── Camera Bridge (PTP via ImageCaptureCore) ──
const cameraBridge = require('./camera-bridge');

app.get('/api/camera/list', async (req, res) => {
  try {
    const result = await cameraBridge.list();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/camera/connect', async (req, res) => {
  try {
    const result = await cameraBridge.connect();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/camera/disconnect', async (req, res) => {
  try {
    const result = await cameraBridge.disconnect();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/camera/info', async (req, res) => {
  try {
    const result = await cameraBridge.deviceInfo();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/camera/upload-raf', async (req, res) => {
  try {
    const { path: rafPath } = req.body;
    if (!rafPath) return res.status(400).json({ error: 'path required' });
    const result = await cameraBridge.uploadRaf(rafPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/camera/profile', async (req, res) => {
  try {
    const result = await cameraBridge.getProfile();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/camera/profile', async (req, res) => {
  try {
    const { data, params } = req.body;
    if (!data) return res.status(400).json({ error: 'data (base64) required' });
    const profileData = params ? patchD185Profile(data, params) : data;
    const result = await cameraBridge.setProfile(profileData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/camera/convert', async (req, res) => {
  try {
    const result = await cameraBridge.triggerConversion();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/camera/wait-result', async (req, res) => {
  try {
    const { outputPath, timeout } = req.body;
    if (!outputPath) return res.status(400).json({ error: 'outputPath required' });
    const result = await cameraBridge.waitForResult(outputPath, timeout || 30);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/camera/read-prop', async (req, res) => {
  try {
    const { propId } = req.body;
    if (propId === undefined) return res.status(400).json({ error: 'propId required' });
    const result = await cameraBridge.readProp(propId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/camera/write-prop', async (req, res) => {
  try {
    const { propId, data } = req.body;
    if (propId === undefined || !data) return res.status(400).json({ error: 'propId and data required' });
    const result = await cameraBridge.writeProp(propId, data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Scan camera Custom presets (C1-C7) ---

const FILM_SIM_MAP = {
  1: 'Provia', 2: 'Velvia', 3: 'Astia', 4: 'Classic',
  5: 'ProNegHi', 6: 'ProNegStd', 7: 'ClassicNeg', 8: 'Eterna',
  9: 'BleachBypass', 10: 'Nostalgic', 11: 'RealaACE',
  16: 'Acros', 17: 'AcrosYe', 18: 'AcrosR', 19: 'AcrosG',
  20: 'Mono', 21: 'MonoYe', 22: 'MonoR', 23: 'MonoG', 24: 'Sepia'
};

const WB_MAP = {
  2: 'Auto', 4: 'Daylight', 5: 'Shade', 6: 'Fluorescent1', 7: 'Fluorescent2',
  8: 'Fluorescent3', 9: 'Incandescent', 10: 'Underwater', 15: 'ColorTemp',
  18: 'AutoWhite', 19: 'AutoAmbiance', 20: 'Custom1', 21: 'Custom2', 22: 'Custom3'
};

const GRAIN_MAP = {
  1: { grainEffect: 'Off', grainSize: 'Small' },
  2: { grainEffect: 'Weak', grainSize: 'Small' },
  3: { grainEffect: 'Strong', grainSize: 'Small' },
  4: { grainEffect: 'Weak', grainSize: 'Large' },
  5: { grainEffect: 'Strong', grainSize: 'Large' },
};

const EFFECT_MAP = { 1: 'Off', 2: 'Weak', 3: 'Strong' };

const NR_DECODE = {
  0x8000: -4, 0x7000: -3, 0x4000: -2, 0x3000: -1,
  0x2000: 0, 0x1000: 1, 0x0000: 2, 0x6000: 3, 0x5000: 4
};

function decodePtpUint16(base64Data) {
  const buf = Buffer.from(base64Data, 'base64');
  return buf.readUInt16LE(0);
}

function decodePtpInt16(base64Data) {
  const raw = decodePtpUint16(base64Data);
  return raw >= 0x8000 ? raw - 0x10000 : raw;
}

function decodePtpString(base64Data) {
  const buf = Buffer.from(base64Data, 'base64');
  if (buf.length < 1) return '';
  const charCount = buf[0]; // includes null terminator
  if (charCount <= 1) return '';
  const chars = [];
  for (let i = 0; i < charCount - 1; i++) {
    const offset = 1 + i * 2;
    if (offset + 1 >= buf.length) break;
    const code = buf.readUInt16LE(offset);
    if (code === 0) break;
    chars.push(String.fromCharCode(code));
  }
  return chars.join('');
}

function encodeSlotValue(slot) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(slot);
  return buf.toString('base64');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Move a photo (and all stem-mates) from Liked to Ditch
app.post('/api/recipe-cull', (req, res) => {
  const { dir, file } = req.body || {};
  if (!dir || !file) return res.status(400).json({ error: 'dir and file required' });
  const stem = file.replace(/\.[^.]+$/, '');
  const likedDir = path.join(dir, 'Liked');
  const ditchDir = path.join(dir, 'Ditch');
  let moved = 0;
  // Scan all ext subdirs under Liked/ for files matching this stem
  const extDirs = ['HIF', 'JPG', 'RAF', 'HEIF', 'JPEG'];
  for (const ext of extDirs) {
    const srcDir = path.join(likedDir, ext);
    if (!fs.existsSync(srcDir)) continue;
    const files = fs.readdirSync(srcDir);
    for (const f of files) {
      if (f.replace(/\.[^.]+$/, '') === stem) {
        const fileExt = f.split('.').pop().toUpperCase();
        const destDir = path.join(ditchDir, fileExt);
        fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(path.join(srcDir, f), path.join(destDir, f));
        moved++;
      }
    }
  }
  // Also check Liked/ root for non-subdir files
  if (fs.existsSync(likedDir)) {
    const rootFiles = fs.readdirSync(likedDir);
    for (const f of rootFiles) {
      const fPath = path.join(likedDir, f);
      if (!fs.statSync(fPath).isFile()) continue;
      if (f.replace(/\.[^.]+$/, '') === stem) {
        const fileExt = f.split('.').pop().toUpperCase();
        const destDir = path.join(ditchDir, fileExt);
        fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(fPath, path.join(destDir, f));
        moved++;
      }
    }
  }
  res.json({ ok: true, moved, stem });
});

app.post('/api/camera/scan-presets', async (req, res) => {
  try {
    // List first to ensure camera is discovered before connecting
    const listing = await cameraBridge.list();
    if (!listing.cameras || listing.cameras.length === 0) {
      return res.status(404).json({ error: 'No Fujifilm camera found' });
    }
    await cameraBridge.connect();

    // Read current slot to restore later
    const origSlotResult = await cameraBridge.readProp(0xD18C);
    const origSlot = decodePtpUint16(origSlotResult.data);

    const presets = [];

    for (let slot = 1; slot <= 7; slot++) {
      // Switch to this slot
      await cameraBridge.writeProp(0xD18C, encodeSlotValue(slot));
      await sleep(150);

      // Read preset name (D18D)
      const nameResult = await cameraBridge.readProp(0xD18D);
      const name = decodePtpString(nameResult.data);

      // Read film simulation first to check if slot is empty
      const filmSimResult = await cameraBridge.readProp(0xD192);
      const filmSimRaw = decodePtpUint16(filmSimResult.data);

      // Read grain to check validity
      const grainResult = await cameraBridge.readProp(0xD195);
      const grainRaw = decodePtpUint16(grainResult.data);

      // Skip empty slots
      if (!name || filmSimRaw === 0 || !FILM_SIM_MAP[filmSimRaw] || grainRaw > 5) {
        continue;
      }

      // Read all other properties
      const drResult = await cameraBridge.readProp(0xD190);
      const ccResult = await cameraBridge.readProp(0xD196);
      const ccBlueResult = await cameraBridge.readProp(0xD197);
      const wbResult = await cameraBridge.readProp(0xD199);
      const wbRResult = await cameraBridge.readProp(0xD19A);
      const wbBResult = await cameraBridge.readProp(0xD19B);
      const hlResult = await cameraBridge.readProp(0xD19D);
      const shResult = await cameraBridge.readProp(0xD19E);
      const colorResult = await cameraBridge.readProp(0xD19F);
      const sharpResult = await cameraBridge.readProp(0xD1A0);
      const nrResult = await cameraBridge.readProp(0xD1A1);
      const clarityResult = await cameraBridge.readProp(0xD1A2);

      // Decode WB — handle sentinel values (bit 15 set means "auto" family)
      const wbRaw = decodePtpUint16(wbResult.data);
      let whiteBalance;
      if (wbRaw & 0x8000) {
        // Bit 15 set — check lower bits for specific auto mode
        const wbLower = wbRaw & 0x7FFF;
        whiteBalance = WB_MAP[wbLower] || WB_MAP[wbRaw] || 'Auto';
      } else {
        whiteBalance = WB_MAP[wbRaw] || 'Auto';
      }

      // Decode tone values — handle sentinel 0x8000 (-32768) as 0
      const hlRaw = decodePtpInt16(hlResult.data);
      const shRaw = decodePtpInt16(shResult.data);
      const colorRaw = decodePtpInt16(colorResult.data);
      const sharpRaw = decodePtpInt16(sharpResult.data);
      const clarityRaw = decodePtpInt16(clarityResult.data);

      const highlightTone = hlRaw === -32768 ? 0 : Math.round(hlRaw / 10);
      const shadowTone = shRaw === -32768 ? 0 : Math.round(shRaw / 10);
      const color = colorRaw === -32768 ? 0 : Math.round(colorRaw / 10);
      const sharpness = sharpRaw === -32768 ? 0 : Math.round(sharpRaw / 10);
      const clarity = clarityRaw === -32768 ? 0 : Math.round(clarityRaw / 10);

      // Decode noise reduction
      const nrRaw = decodePtpUint16(nrResult.data);
      const noiseReduction = NR_DECODE[nrRaw] !== undefined ? NR_DECODE[nrRaw] : 0;

      // Decode grain
      const grain = GRAIN_MAP[grainRaw] || { grainEffect: 'Off', grainSize: 'Small' };

      const params = {
        filmSimulation: FILM_SIM_MAP[filmSimRaw],
        dynamicRange: decodePtpUint16(drResult.data),
        grainEffect: grain.grainEffect,
        grainSize: grain.grainSize,
        colorChromeEffect: EFFECT_MAP[decodePtpUint16(ccResult.data)] || 'Off',
        colorChromeFXBlue: EFFECT_MAP[decodePtpUint16(ccBlueResult.data)] || 'Off',
        whiteBalance,
        wbShiftR: decodePtpInt16(wbRResult.data),
        wbShiftB: decodePtpInt16(wbBResult.data),
        highlightTone,
        shadowTone,
        color,
        sharpness,
        noiseReduction,
        clarity
      };

      presets.push({ slot, name, params });
    }

    // Restore original slot
    await cameraBridge.writeProp(0xD18C, encodeSlotValue(origSlot));
    await sleep(150);

    // Disconnect
    await cameraBridge.disconnect();

    res.json({ presets });
  } catch (err) {
    // Try to disconnect on error
    try { await cameraBridge.disconnect(); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

const PORT = parseInt(process.env.PORT, 10) || 4000;
app.listen(PORT, () => {
  console.log(`SnapSifter running at http://localhost:${PORT}`);
  if (!activeDir) {
    console.log('No directory loaded — use the web UI to select a folder');
  }
});
