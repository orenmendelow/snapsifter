const express = require('express');
const exifr = require('exifr');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

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

// Active directory state (mutable, no restart needed)
let activeDir = null;
let activeSessionId = null;
let cacheDir = null;
let thumbCacheDir = null;
let ratingsFile = null;
let files = [];
let ratings = {};

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
  const cacheName = pathHash + '_preview.jpg';
  const cachePath = path.join(previewCacheDir, cacheName);

  try {
    if (!fs.existsSync(cachePath)) {
      generateThumb(srcPath, cachePath, 300);
    }
    res.type('image/jpeg');
    res.send(fs.readFileSync(cachePath));
  } catch (err) {
    console.error(`Error creating preview thumbnail for ${filename}:`, err.message);
    res.status(500).send('Thumbnail creation failed');
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

// ── Recipe CRUD endpoints ──

function recipesFilePath() {
  return path.join(activeDir, 'recipes.json');
}

function loadRecipes() {
  const fp = recipesFilePath();
  try {
    if (fs.existsSync(fp)) {
      return JSON.parse(fs.readFileSync(fp, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to parse recipes.json:', e.message);
  }
  return { recipes: {}, activeRecipe: null };
}

function saveRecipes(data) {
  fs.writeFileSync(recipesFilePath(), JSON.stringify(data, null, 2));
}

app.get('/api/recipes', requireActiveDir, (req, res) => {
  res.json(loadRecipes());
});

app.post('/api/recipe', requireActiveDir, (req, res) => {
  const { title, params } = req.body;
  const data = loadRecipes();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const recipe = { id, title, created: now, modified: now, params };
  data.recipes[id] = recipe;
  saveRecipes(data);
  res.json(recipe);
});

app.put('/api/recipe/:id', requireActiveDir, (req, res) => {
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

app.delete('/api/recipe/:id', requireActiveDir, (req, res) => {
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

app.put('/api/recipes/active', requireActiveDir, (req, res) => {
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

app.post('/api/recipe/:id/fp1', requireActiveDir, (req, res) => {
  const { id } = req.params;
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

  res.json({ path: fp1Path, label: recipe.title || 'Untitled' });
});

// ── Grid selection helpers ──

function extractExifBatch(dir) {
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
    return JSON.parse(rawOutput.toString());
  } catch (e) {
    console.error('Failed to parse exiftool JSON:', e.message);
    return [];
  }
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

// ── Grid selection endpoints ──

app.get('/api/grid-select', (req, res) => {
  const dir = req.query.dir;
  const count = parseInt(req.query.count, 10) || 9;

  if (!dir || !path.isAbsolute(dir)) {
    return res.status(400).json({ error: 'dir must be an absolute path' });
  }
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  let allFiles;
  try {
    allFiles = fs.readdirSync(dir).filter(f => {
      return f.toUpperCase().endsWith('.RAF') && !f.startsWith('.') && !f.startsWith('._');
    });
  } catch (e) {
    return res.status(500).json({ error: 'Cannot read directory' });
  }

  if (allFiles.length === 0) {
    return res.json({ selected: [], totalAvailable: 0 });
  }

  const exifEntries = extractExifBatch(dir);
  if (exifEntries.length === 0) {
    const shuffled = allFiles.sort(() => Math.random() - 0.5).slice(0, count);
    return res.json({
      selected: shuffled.map(f => ({ file: f, focalLength: null, iso: null, aperture: null, shutterSpeed: null, time: null, wb: null })),
      totalAvailable: allFiles.length,
    });
  }

  const vectors = buildFeatureVectors(exifEntries);
  const selectedIndices = farthestPointSampling(vectors, count, null, null);

  const selected = selectedIndices.map(i => {
    const v = vectors[i];
    return { file: v.file, ...formatExifSummary(v.rawExif) };
  });

  res.json({ selected, totalAvailable: allFiles.length });
});

app.post('/api/grid-replace', (req, res) => {
  const { dir, selected, replaceIndex, count } = req.body;
  const targetCount = count || 9;

  if (!dir || !path.isAbsolute(dir)) {
    return res.status(400).json({ error: 'dir must be an absolute path' });
  }
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: 'Directory not found' });
  }
  if (!Array.isArray(selected) || typeof replaceIndex !== 'number') {
    return res.status(400).json({ error: 'selected (array) and replaceIndex (number) required' });
  }
  if (replaceIndex < 0 || replaceIndex >= selected.length) {
    return res.status(400).json({ error: 'replaceIndex out of bounds' });
  }

  const exifEntries = extractExifBatch(dir);
  if (exifEntries.length === 0) {
    return res.status(500).json({ error: 'No EXIF data extracted' });
  }

  const vectors = buildFeatureVectors(exifEntries);

  const fileToIdx = {};
  vectors.forEach((v, i) => { fileToIdx[v.file] = i; });

  const fixedIndices = [];
  const excludeIndices = [];
  for (let i = 0; i < selected.length; i++) {
    const idx = fileToIdx[selected[i]];
    if (idx == null) continue;
    if (i === replaceIndex) {
      excludeIndices.push(idx);
    } else {
      fixedIndices.push(idx);
    }
  }

  const selectedIndices = farthestPointSampling(vectors, targetCount, fixedIndices, excludeIndices);

  const result = selectedIndices.map(i => {
    const v = vectors[i];
    return { file: v.file, ...formatExifSummary(v.rawExif) };
  });

  res.json({ selected: result, totalAvailable: vectors.length });
});

app.post('/api/grid-shuffle', (req, res) => {
  const { dir, count } = req.body;
  const targetCount = count || 9;

  if (!dir || !path.isAbsolute(dir)) {
    return res.status(400).json({ error: 'dir must be an absolute path' });
  }
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  const exifEntries = extractExifBatch(dir);
  if (exifEntries.length === 0) {
    let allFiles;
    try {
      allFiles = fs.readdirSync(dir).filter(f => f.toUpperCase().endsWith('.RAF') && !f.startsWith('.') && !f.startsWith('._'));
    } catch (e) {
      return res.status(500).json({ error: 'Cannot read directory' });
    }
    const shuffled = allFiles.sort(() => Math.random() - 0.5).slice(0, targetCount);
    return res.json({
      selected: shuffled.map(f => ({ file: f, focalLength: null, iso: null, aperture: null, shutterSpeed: null, time: null, wb: null })),
      totalAvailable: allFiles.length,
    });
  }

  const vectors = buildFeatureVectors(exifEntries);
  const selectedIndices = farthestPointSampling(vectors, targetCount, null, null);

  const result = selectedIndices.map(i => {
    const v = vectors[i];
    return { file: v.file, ...formatExifSummary(v.rawExif) };
  });

  res.json({ selected: result, totalAvailable: vectors.length });
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

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`SnapSifter running at http://localhost:${PORT}`);
  if (!activeDir) {
    console.log('No directory loaded — use the web UI to select a folder');
  }
});
