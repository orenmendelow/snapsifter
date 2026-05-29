import { describe, it, expect } from 'vitest';
import {
  parseExifEntry,
  wbToNumeric,
  buildFeatureVectors,
  euclideanDist,
  farthestPointSampling,
  fisherYatesShuffle,
  selectGridPhotos,
  shuffleGridPhotos,
  formatExifSummary,
} from '../lib/grid-selection.js';

// ── parseExifEntry ──

describe('parseExifEntry', () => {
  it('parses complete EXIF entry', () => {
    const result = parseExifEntry({
      FocalLength: '23 mm',
      ISO: 800,
      ExposureTime: '1/125',
      FNumber: 2.0,
      DateTimeOriginal: '2026:04:15 14:32:10',
      WhiteBalance: 'Auto',
    });
    expect(result.focalLength).toBe(23);
    expect(result.iso).toBe(800);
    expect(result.exposureTime).toBeCloseTo(0.008);
    expect(result.fNumber).toBe(2.0);
    expect(result.hourOfDay).toBeCloseTo(14.533);
    expect(result.wb).toBe('Auto');
  });

  it('handles missing fields', () => {
    const result = parseExifEntry({});
    expect(result.focalLength).toBeNull();
    expect(result.iso).toBeNull();
    expect(result.exposureTime).toBeNull();
    expect(result.fNumber).toBeNull();
    expect(result.hourOfDay).toBeNull();
    expect(result.wb).toBeNull();
  });

  it('parses focal length without space', () => {
    const result = parseExifEntry({ FocalLength: '23mm' });
    expect(result.focalLength).toBe(23);
  });

  it('parses numeric focal length', () => {
    const result = parseExifEntry({ FocalLength: 23 });
    expect(result.focalLength).toBe(23);
  });

  it('parses decimal exposure time', () => {
    const result = parseExifEntry({ ExposureTime: '0.5' });
    expect(result.exposureTime).toBe(0.5);
  });

  it('parses numeric exposure time', () => {
    const result = parseExifEntry({ ExposureTime: 0.001 });
    expect(result.exposureTime).toBe(0.001);
  });
});

// ── wbToNumeric ──

describe('wbToNumeric', () => {
  it('returns 0.5 for null', () => { expect(wbToNumeric(null)).toBe(0.5); });
  it('returns 0 for Auto', () => { expect(wbToNumeric('Auto')).toBe(0); });
  it('returns 0.2 for Daylight', () => { expect(wbToNumeric('Daylight')).toBe(0.2); });
  it('returns 0.4 for Shade', () => { expect(wbToNumeric('Shade')).toBe(0.4); });
  it('returns 0.6 for Fluorescent', () => { expect(wbToNumeric('Fluorescent')).toBe(0.6); });
  it('returns 0.8 for Incandescent', () => { expect(wbToNumeric('Incandescent')).toBe(0.8); });
  it('returns 0.5 for unknown', () => { expect(wbToNumeric('Custom')).toBe(0.5); });
});

// ── buildFeatureVectors ──

describe('buildFeatureVectors', () => {
  it('builds vectors from diverse EXIF data', () => {
    const entries = [
      { SourceFile: '/dir/DSCF0001.RAF', FocalLength: '23 mm', ISO: 200, ExposureTime: '1/250', FNumber: 2.0, DateTimeOriginal: '2026:04:15 10:00:00', WhiteBalance: 'Auto' },
      { SourceFile: '/dir/DSCF0002.RAF', FocalLength: '23 mm', ISO: 6400, ExposureTime: '1/30', FNumber: 8.0, DateTimeOriginal: '2026:04:15 22:00:00', WhiteBalance: 'Shade' },
    ];
    const vectors = buildFeatureVectors(entries);
    expect(vectors).toHaveLength(2);
    expect(vectors[0].vector).toHaveLength(6);
    expect(vectors[1].vector).toHaveLength(6);
    // Vectors should differ since EXIF differs
    const dist = euclideanDist(vectors[0].vector, vectors[1].vector);
    expect(dist).toBeGreaterThan(0);
  });

  it('handles identical EXIF — vectors collapse to same point', () => {
    const entries = Array.from({ length: 9 }, (_, i) => ({
      SourceFile: `/dir/DSCF000${i}.RAF`,
      FocalLength: '23 mm', ISO: 800, ExposureTime: '1/125',
      FNumber: 2.0, DateTimeOriginal: '2026:04:15 14:00:00', WhiteBalance: 'Auto',
    }));
    const vectors = buildFeatureVectors(entries);
    expect(vectors).toHaveLength(9);
    // All vectors should be identical
    for (let i = 1; i < vectors.length; i++) {
      expect(euclideanDist(vectors[0].vector, vectors[i].vector)).toBe(0);
    }
  });
});

// ── farthestPointSampling ──

describe('farthestPointSampling', () => {
  it('returns requested count from diverse vectors', () => {
    const vectors = [
      { vector: [0, 0, 0, 0, 0, 0] },
      { vector: [1, 1, 1, 1, 1, 1] },
      { vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
      { vector: [0.2, 0.8, 0.3, 0.7, 0.1, 0.9] },
    ];
    const indices = farthestPointSampling(vectors, 3, null, null);
    expect(indices).toHaveLength(3);
    expect(new Set(indices).size).toBe(3); // no duplicates
  });

  it('returns unique indices even with identical vectors', () => {
    const vectors = Array.from({ length: 9 }, () => ({
      vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    }));
    const indices = farthestPointSampling(vectors, 5, null, null);
    expect(indices).toHaveLength(5);
    expect(new Set(indices).size).toBe(5); // no duplicate INDICES
  });

  it('respects exclude list', () => {
    const vectors = [
      { vector: [0, 0, 0, 0, 0, 0] },
      { vector: [1, 1, 1, 1, 1, 1] },
      { vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    ];
    const indices = farthestPointSampling(vectors, 2, null, [1]);
    expect(indices).toHaveLength(2);
    expect(indices).not.toContain(1);
  });

  it('returns empty for empty input', () => {
    expect(farthestPointSampling([], 5, null, null)).toEqual([]);
  });

  it('clamps to vector count', () => {
    const vectors = [{ vector: [0, 0] }, { vector: [1, 1] }];
    const indices = farthestPointSampling(vectors, 10, null, null);
    expect(indices).toHaveLength(2);
  });
});

// ── fisherYatesShuffle ──

describe('fisherYatesShuffle', () => {
  it('returns same length array', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(fisherYatesShuffle(arr)).toHaveLength(5);
  });

  it('does not mutate original', () => {
    const arr = [1, 2, 3, 4, 5];
    fisherYatesShuffle(arr);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });

  it('contains same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = fisherYatesShuffle(arr);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

// ── selectGridPhotos — the critical bug test ──

describe('selectGridPhotos', () => {
  const makeHifByStem = (files) => {
    const map = {};
    files.forEach(f => { map[f.replace(/\.[^.]+$/, '').toUpperCase()] = f; });
    return map;
  };

  it('returns empty for empty input', () => {
    expect(selectGridPhotos([], [], 9, {})).toEqual([]);
  });

  it('returns unique photos even with identical EXIF', () => {
    const hifFiles = Array.from({ length: 20 }, (_, i) => `DSCF${String(i).padStart(4, '0')}.HIF`);
    const exifEntries = hifFiles.map((f, i) => ({
      SourceFile: `/dir/Liked/RAF/${f.replace('.HIF', '.RAF')}`,
      FocalLength: '23 mm', ISO: 800, ExposureTime: '1/125',
      FNumber: 2.0, DateTimeOriginal: '2026:04:15 14:00:00', WhiteBalance: 'Auto',
    }));
    const hifByStem = makeHifByStem(hifFiles);

    const result = selectGridPhotos(hifFiles, exifEntries, 9, hifByStem);
    expect(result).toHaveLength(9);

    // THE CRITICAL TEST: all 9 photos must be DIFFERENT files
    const fileNames = result.map(r => r.file);
    expect(new Set(fileNames).size).toBe(9);
  });

  it('returns unique photos with diverse EXIF', () => {
    const hifFiles = Array.from({ length: 20 }, (_, i) => `DSCF${String(i).padStart(4, '0')}.HIF`);
    const exifEntries = hifFiles.map((f, i) => ({
      SourceFile: `/dir/Liked/RAF/${f.replace('.HIF', '.RAF')}`,
      FocalLength: `${23 + i} mm`,
      ISO: 200 + i * 100,
      ExposureTime: `1/${60 + i * 10}`,
      FNumber: 2.0 + i * 0.5,
      DateTimeOriginal: `2026:04:15 ${String(10 + i).padStart(2, '0')}:00:00`,
      WhiteBalance: i % 2 === 0 ? 'Auto' : 'Daylight',
    }));
    const hifByStem = makeHifByStem(hifFiles);

    const result = selectGridPhotos(hifFiles, exifEntries, 9, hifByStem);
    expect(result).toHaveLength(9);
    const fileNames = result.map(r => r.file);
    expect(new Set(fileNames).size).toBe(9);
  });

  it('handles fewer HIF files than requested count', () => {
    const hifFiles = ['DSCF0001.HIF', 'DSCF0002.HIF', 'DSCF0003.HIF'];
    const exifEntries = hifFiles.map(f => ({
      SourceFile: `/dir/Liked/RAF/${f.replace('.HIF', '.RAF')}`,
      FocalLength: '23 mm', ISO: 800, ExposureTime: '1/125',
      FNumber: 2.0, DateTimeOriginal: '2026:04:15 14:00:00', WhiteBalance: 'Auto',
    }));
    const hifByStem = makeHifByStem(hifFiles);

    const result = selectGridPhotos(hifFiles, exifEntries, 9, hifByStem);
    expect(result).toHaveLength(3);
    expect(new Set(result.map(r => r.file)).size).toBe(3);
  });

  it('handles no EXIF data — falls back to random', () => {
    const hifFiles = Array.from({ length: 20 }, (_, i) => `DSCF${String(i).padStart(4, '0')}.HIF`);
    const hifByStem = makeHifByStem(hifFiles);

    const result = selectGridPhotos(hifFiles, [], 9, hifByStem);
    expect(result).toHaveLength(9);
    expect(new Set(result.map(r => r.file)).size).toBe(9);
  });

  it('handles RAF stems that do not match any HIF', () => {
    const hifFiles = ['DSCF0001.HIF', 'DSCF0002.HIF', 'DSCF0003.HIF'];
    const exifEntries = [
      { SourceFile: '/dir/DSCF9999.RAF', FocalLength: '23 mm', ISO: 800, ExposureTime: '1/125', FNumber: 2.0, DateTimeOriginal: '2026:04:15 14:00:00', WhiteBalance: 'Auto' },
    ];
    const hifByStem = makeHifByStem(hifFiles);

    const result = selectGridPhotos(hifFiles, exifEntries, 9, hifByStem);
    // Should fall back to random HIF selection since no stems match
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

// ── shuffleGridPhotos ──

describe('shuffleGridPhotos', () => {
  it('returns unique photos', () => {
    const hifFiles = Array.from({ length: 20 }, (_, i) => `DSCF${String(i).padStart(4, '0')}.HIF`);
    const result = shuffleGridPhotos(hifFiles, [], 9, {});
    expect(result).toHaveLength(9);
    expect(new Set(result.map(r => r.file)).size).toBe(9);
  });

  it('handles fewer files than count', () => {
    const hifFiles = ['A.HIF', 'B.HIF'];
    const result = shuffleGridPhotos(hifFiles, [], 9, {});
    expect(result).toHaveLength(2);
  });
});

// ── formatExifSummary ──

describe('formatExifSummary', () => {
  it('formats non-null EXIF', () => {
    const result = formatExifSummary({
      focalLength: 23, iso: 800, fNumber: 2.0, exposureTime: 0.008, hourOfDay: 14.5, wb: 'Auto',
    });
    expect(result.focalLength).toBe(23);
    expect(result.iso).toBe(800);
    expect(result.aperture).toBe(2.0);
    expect(result.shutterSpeed).toBe(0.008);
    expect(result.time).toBe(14.5);
    expect(result.wb).toBe('Auto');
  });

  it('handles null input', () => {
    const result = formatExifSummary(null);
    expect(result.focalLength).toBeNull();
  });
});
