const path = require('path');

function parseExifEntry(entry) {
  let focalLength = null;
  if (entry.FocalLength != null) {
    const m = String(entry.FocalLength).match(/([\d.]+)/);
    if (m) focalLength = parseFloat(m[1]);
  }

  let iso = entry.ISO != null ? Number(entry.ISO) : null;

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

  const dims = ['focalLength', 'iso', 'exposureTime', 'fNumber', 'hourOfDay'];
  const values = {};
  for (const d of dims) values[d] = [];
  for (const p of parsed) {
    for (const d of dims) {
      if (p[d] != null && !isNaN(p[d]) && p[d] > 0) values[d].push(p[d]);
    }
  }

  const medians = {};
  for (const d of dims) {
    const sorted = values[d].slice().sort((a, b) => a - b);
    medians[d] = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 1;
  }

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

function fisherYatesShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function selectGridPhotos(hifFiles, exifEntries, count, hifByStem) {
  if (hifFiles.length === 0) return [];

  if (!exifEntries || exifEntries.length === 0) {
    return fisherYatesShuffle(hifFiles).slice(0, count).map(f => ({
      file: f, focalLength: null, iso: null, aperture: null, shutterSpeed: null, time: null, wb: null,
    }));
  }

  const vectors = buildFeatureVectors(exifEntries);

  if (vectors.length <= count) {
    const selected = [];
    const seen = new Set();
    for (const v of vectors) {
      const stem = v.file.replace(/\.[^.]+$/, '').toUpperCase();
      const hifFile = hifByStem[stem];
      if (hifFile && !seen.has(hifFile)) {
        seen.add(hifFile);
        selected.push({ file: hifFile, ...formatExifSummary(v.rawExif) });
      }
    }
    if (selected.length < count) {
      const remaining = hifFiles.filter(f => !seen.has(f));
      const shuffled = fisherYatesShuffle(remaining);
      for (const f of shuffled) {
        if (selected.length >= count) break;
        selected.push({ file: f, focalLength: null, iso: null, aperture: null, shutterSpeed: null, time: null, wb: null });
      }
    }
    return selected;
  }

  const selectedIndices = farthestPointSampling(vectors, count * 2, null, null);

  const selected = [];
  const seen = new Set();
  for (const i of selectedIndices) {
    if (selected.length >= count) break;
    const v = vectors[i];
    const stem = v.file.replace(/\.[^.]+$/, '').toUpperCase();
    const hifFile = hifByStem[stem];
    if (hifFile && !seen.has(hifFile)) {
      seen.add(hifFile);
      selected.push({ file: hifFile, ...formatExifSummary(v.rawExif) });
    }
  }

  if (selected.length < count) {
    const remaining = hifFiles.filter(f => !seen.has(f));
    const shuffled = fisherYatesShuffle(remaining);
    for (const f of shuffled) {
      if (selected.length >= count) break;
      selected.push({ file: f, focalLength: null, iso: null, aperture: null, shutterSpeed: null, time: null, wb: null });
    }
  }

  return selected;
}

function shuffleGridPhotos(hifFiles, exifEntries, count, hifByStem) {
  if (hifFiles.length === 0) return [];

  const shuffled = fisherYatesShuffle(hifFiles).slice(0, count);
  return shuffled.map(f => ({
    file: f, focalLength: null, iso: null, aperture: null, shutterSpeed: null, time: null, wb: null,
  }));
}

function formatExifSummary(rawExif) {
  if (!rawExif) return { focalLength: null, iso: null, aperture: null, shutterSpeed: null, time: null, wb: null };
  return {
    focalLength: rawExif.focalLength,
    iso: rawExif.iso,
    aperture: rawExif.fNumber,
    shutterSpeed: rawExif.exposureTime,
    time: rawExif.hourOfDay,
    wb: rawExif.wb,
  };
}

module.exports = {
  parseExifEntry,
  wbToNumeric,
  buildFeatureVectors,
  euclideanDist,
  farthestPointSampling,
  fisherYatesShuffle,
  selectGridPhotos,
  shuffleGridPhotos,
  formatExifSummary,
};
