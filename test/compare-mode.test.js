const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  RECIPE_DEFAULTS,
  RECIPE_KEYS,
  determineCellState,
  calculatePendingCount,
  isStandard,
  findMatchingRecipe,
  selectBaseline,
  buildSimulateList,
  compareOutputFilename,
  formatSimulateProgress,
  toggleChip,
  buildCompareVariant
} = require('./compare-helpers.js');


// ── 1. Cell state determination ──

describe('determineCellState', () => {
  it('returns current when cell matches current value', () => {
    const result = determineCellState('Provia', 'Provia', new Set());
    assert.deepStrictEqual(result, { state: 'current', blur: false, pending: false });
  });

  it('returns rendered when cell is in compareRendered', () => {
    const rendered = new Set(['Velvia']);
    const result = determineCellState('Velvia', 'Provia', rendered);
    assert.deepStrictEqual(result, { state: 'rendered', blur: false, pending: false });
  });

  it('returns pending when cell is neither current nor rendered', () => {
    const result = determineCellState('Astia', 'Provia', new Set());
    assert.deepStrictEqual(result, { state: 'pending', blur: true, pending: true });
  });

  it('handles numeric values via string coercion', () => {
    const result = determineCellState(100, '100', new Set());
    assert.deepStrictEqual(result, { state: 'current', blur: false, pending: false });
  });

  it('handles numeric rendered values', () => {
    const rendered = new Set(['200']);
    const result = determineCellState(200, '100', rendered);
    assert.deepStrictEqual(result, { state: 'rendered', blur: false, pending: false });
  });

  it('current takes priority over rendered (value is both)', () => {
    const rendered = new Set(['Provia']);
    const result = determineCellState('Provia', 'Provia', rendered);
    assert.deepStrictEqual(result, { state: 'current', blur: false, pending: false });
  });
});


// ── 2. Simulate count calculation ──

describe('calculatePendingCount', () => {
  it('returns 0 when all selected values are current', () => {
    const selected = new Set(['Provia']);
    assert.equal(calculatePendingCount(selected, 'Provia', new Set()), 0);
  });

  it('returns 0 when all non-current values are rendered', () => {
    const selected = new Set(['Provia', 'Velvia', 'Astia']);
    const rendered = new Set(['Velvia', 'Astia']);
    assert.equal(calculatePendingCount(selected, 'Provia', rendered), 0);
  });

  it('counts only values that are not current and not rendered', () => {
    const selected = new Set(['Provia', 'Velvia', 'Astia', 'ClassicNeg']);
    const rendered = new Set(['Velvia']);
    assert.equal(calculatePendingCount(selected, 'Provia', rendered), 2);
  });

  it('handles numeric values correctly', () => {
    const selected = new Set([100, 200, 400]);
    const rendered = new Set(['200']);
    assert.equal(calculatePendingCount(selected, '100', rendered), 1);
  });

  it('returns 0 for empty selected set', () => {
    assert.equal(calculatePendingCount(new Set(), 'Provia', new Set()), 0);
  });

  it('counts correctly when current is deselected', () => {
    const selected = new Set(['Velvia', 'Astia']);
    assert.equal(calculatePendingCount(selected, 'Provia', new Set()), 2);
  });
});


// ── 3. Standard detection ──

describe('isStandard', () => {
  it('returns true when all params match defaults', () => {
    assert.equal(isStandard({ ...RECIPE_DEFAULTS }), true);
  });

  it('returns false when one param differs', () => {
    const params = { ...RECIPE_DEFAULTS, filmSimulation: 'Velvia' };
    assert.equal(isStandard(params), false);
  });

  it('handles string vs number comparison (dynamicRange)', () => {
    const params = { ...RECIPE_DEFAULTS, dynamicRange: '100' };
    // String('100') === String(100) → true
    assert.equal(isStandard(params), true);
  });

  it('handles numeric zero as string', () => {
    const params = { ...RECIPE_DEFAULTS, wbShiftR: '0' };
    // String('0') === String(0) → true
    assert.equal(isStandard(params), true);
  });

  it('returns false when a numeric param is non-zero', () => {
    const params = { ...RECIPE_DEFAULTS, clarity: 3 };
    assert.equal(isStandard(params), false);
  });

  it('returns true with extra keys (only checks default keys)', () => {
    const params = { ...RECIPE_DEFAULTS, extraKey: 'whatever' };
    assert.equal(isStandard(params), true);
  });

  it('handles null/undefined with nullish coalescing', () => {
    const params = { ...RECIPE_DEFAULTS };
    delete params.clarity;
    // String(undefined ?? '') → '' vs String(0 ?? '') → '0'
    assert.equal(isStandard(params), false);
  });
});


// ── 4. Recipe matching ──

describe('findMatchingRecipe', () => {
  const sampleRecipe = {
    id: 'r1',
    title: 'Warm Street',
    params: {
      filmSimulation: 'ClassicNeg',
      grainEffect: 'Strong',
      grainSize: 'Small',
      colorChromeEffect: 'Weak',
      colorChromeFXBlue: 'Off',
      whiteBalance: 'Auto',
      wbShiftR: 3,
      wbShiftB: -2,
      dynamicRange: 200,
      highlightTone: -1,
      shadowTone: 2,
      color: 1,
      sharpness: -2,
      noiseReduction: -4,
      clarity: 0
    }
  };

  it('returns recipe on exact match', () => {
    const recipes = { r1: sampleRecipe };
    const result = findMatchingRecipe({ ...sampleRecipe.params }, recipes);
    assert.equal(result, sampleRecipe);
  });

  it('returns null when no match', () => {
    const recipes = { r1: sampleRecipe };
    const result = findMatchingRecipe({ ...RECIPE_DEFAULTS }, recipes);
    assert.equal(result, null);
  });

  it('returns null on partial match (14/15 keys)', () => {
    const recipes = { r1: sampleRecipe };
    const almost = { ...sampleRecipe.params, clarity: 5 };
    assert.equal(findMatchingRecipe(almost, recipes), null);
  });

  it('returns null with empty recipes object', () => {
    assert.equal(findMatchingRecipe({ ...RECIPE_DEFAULTS }, {}), null);
  });

  it('returns null when params is null', () => {
    assert.equal(findMatchingRecipe(null, { r1: sampleRecipe }), null);
  });

  it('returns null when recipes is null', () => {
    assert.equal(findMatchingRecipe({ ...RECIPE_DEFAULTS }, null), null);
  });

  it('skips recipes without params property', () => {
    const recipes = { r1: { id: 'r1', title: 'No Params' } };
    assert.equal(findMatchingRecipe({ ...RECIPE_DEFAULTS }, recipes), null);
  });

  it('matches with string vs number coercion', () => {
    const recipes = { r1: sampleRecipe };
    const asStrings = { ...sampleRecipe.params, dynamicRange: '200', wbShiftR: '3' };
    const result = findMatchingRecipe(asStrings, recipes);
    assert.equal(result, sampleRecipe);
  });

  it('returns first match when multiple recipes match', () => {
    const recipes = {
      r1: sampleRecipe,
      r2: { id: 'r2', title: 'Duplicate', params: { ...sampleRecipe.params } }
    };
    const result = findMatchingRecipe({ ...sampleRecipe.params }, recipes);
    assert.ok(result === sampleRecipe || result.id === 'r2');
  });
});


// ── 5. Compare baseline selection ──

describe('selectBaseline', () => {
  const exifBaseline = {
    filmSimulation: 'ClassicNeg',
    grainEffect: 'Off',
    grainSize: 'Small',
    colorChromeEffect: 'Off',
    colorChromeFXBlue: 'Off',
    whiteBalance: 'Daylight',
    wbShiftR: 2,
    wbShiftB: -1,
    dynamicRange: 200,
    highlightTone: 0,
    shadowTone: 0,
    color: 0,
    sharpness: 0,
    noiseReduction: 0,
    clarity: 0
  };

  it('asshot with exifBaseline returns exifBaseline copy', () => {
    const result = selectBaseline('asshot', exifBaseline);
    assert.deepStrictEqual(result.params, exifBaseline);
    assert.equal(result.title, 'As Shot');
    assert.notEqual(result.params, exifBaseline); // must be a copy
  });

  it('standard returns RECIPE_DEFAULTS copy', () => {
    const result = selectBaseline('standard', exifBaseline);
    assert.deepStrictEqual(result.params, RECIPE_DEFAULTS);
    assert.equal(result.title, 'Standard');
  });

  it('asshot without exifBaseline falls back to standard', () => {
    const result = selectBaseline('asshot', null);
    assert.deepStrictEqual(result.params, RECIPE_DEFAULTS);
    assert.equal(result.title, 'Standard');
  });

  it('unknown choice defaults to standard', () => {
    const result = selectBaseline('bogus', exifBaseline);
    assert.deepStrictEqual(result.params, RECIPE_DEFAULTS);
    assert.equal(result.title, 'Standard');
  });
});


// ── 6. Compare variant state ──

describe('buildCompareVariant', () => {
  it('builds variant for a rendered cell', () => {
    const v = buildCompareVariant('filmSimulation', 'Velvia', false);
    assert.deepStrictEqual(v, {
      param: 'filmSimulation',
      value: 'Velvia',
      rendered: true,
      isCurrentVal: false
    });
  });

  it('builds variant for the current value cell', () => {
    const v = buildCompareVariant('filmSimulation', 'Provia', true);
    assert.deepStrictEqual(v, {
      param: 'filmSimulation',
      value: 'Provia',
      rendered: false,
      isCurrentVal: true
    });
  });

  it('handles numeric param values', () => {
    const v = buildCompareVariant('dynamicRange', 200, false);
    assert.equal(v.value, 200);
    assert.equal(v.rendered, true);
  });
});


// ── 7. Simulate handler edge cases ──

describe('buildSimulateList', () => {
  it('skips current value', () => {
    const result = buildSimulateList(['Provia', 'Velvia', 'Astia'], 'Provia', new Set());
    assert.deepStrictEqual(result, ['Velvia', 'Astia']);
  });

  it('skips already rendered values', () => {
    const rendered = new Set(['Velvia']);
    const result = buildSimulateList(['Provia', 'Velvia', 'Astia'], 'Provia', rendered);
    assert.deepStrictEqual(result, ['Astia']);
  });

  it('returns empty when all are current or rendered', () => {
    const rendered = new Set(['Velvia', 'Astia']);
    const result = buildSimulateList(['Provia', 'Velvia', 'Astia'], 'Provia', rendered);
    assert.deepStrictEqual(result, []);
  });

  it('handles numeric values with string coercion', () => {
    const rendered = new Set(['200']);
    const result = buildSimulateList([100, 200, 400], '100', rendered);
    assert.deepStrictEqual(result, [400]);
  });

  it('returns empty for empty input', () => {
    assert.deepStrictEqual(buildSimulateList([], 'Provia', new Set()), []);
  });
});

describe('compareOutputFilename', () => {
  it('generates correct filename for string value', () => {
    assert.equal(
      compareOutputFilename('DSCF6740.HIF', 'filmSimulation', 'Velvia'),
      'DSCF6740_cmp_filmSimulation_Velvia.jpg'
    );
  });

  it('sanitizes special characters in value', () => {
    assert.equal(
      compareOutputFilename('DSCF6740.HIF', 'wbShiftR', -3),
      'DSCF6740_cmp_wbShiftR_-3.jpg'
    );
  });

  it('strips file extension from photo name', () => {
    assert.equal(
      compareOutputFilename('IMG_001.JPG', 'grainEffect', 'Strong'),
      'IMG_001_cmp_grainEffect_Strong.jpg'
    );
  });

  it('handles value with spaces (sanitized to underscore)', () => {
    assert.equal(
      compareOutputFilename('DSCF0001.HIF', 'test', 'some value'),
      'DSCF0001_cmp_test_some_value.jpg'
    );
  });

  it('filenames survive chip toggle/reorder (value-based, not index-based)', () => {
    // Same value always produces the same filename regardless of position
    const name1 = compareOutputFilename('DSCF6740.HIF', 'filmSimulation', 'Astia');
    const name2 = compareOutputFilename('DSCF6740.HIF', 'filmSimulation', 'Astia');
    assert.equal(name1, name2);
  });
});

describe('formatSimulateProgress', () => {
  it('shows 0/N at start', () => {
    assert.equal(formatSimulateProgress(0, 5), 'SIMULATING 0/5  ~5s remaining');
  });

  it('shows progress mid-run', () => {
    assert.equal(formatSimulateProgress(2, 5), 'SIMULATING 2/5  ~3s remaining');
  });

  it('shows N/N at completion (no remaining text)', () => {
    assert.equal(formatSimulateProgress(5, 5), 'SIMULATING 5/5');
  });

  it('handles 1 total', () => {
    assert.equal(formatSimulateProgress(0, 1), 'SIMULATING 0/1  ~1s remaining');
  });
});


// ── 8. Chip toggle behavior ──

describe('toggleChip', () => {
  it('select chip adds to set', () => {
    const result = toggleChip(new Set(), 'Velvia');
    assert.ok(result.has('Velvia'));
    assert.equal(result.size, 1);
  });

  it('deselect chip removes from set', () => {
    const result = toggleChip(new Set(['Velvia', 'Astia']), 'Velvia');
    assert.ok(!result.has('Velvia'));
    assert.ok(result.has('Astia'));
  });

  it('does not mutate original set', () => {
    const original = new Set(['Provia']);
    const result = toggleChip(original, 'Velvia');
    assert.equal(original.size, 1);
    assert.equal(result.size, 2);
  });

  it('deselect current-val chip works (no special treatment)', () => {
    const selected = new Set(['Provia', 'Velvia']);
    const result = toggleChip(selected, 'Provia');
    assert.ok(!result.has('Provia'));
    assert.equal(result.size, 1);
  });

  it('re-select current-val chip restores it', () => {
    const selected = new Set(['Velvia']);
    const result = toggleChip(selected, 'Provia');
    assert.ok(result.has('Provia'));
    assert.ok(result.has('Velvia'));
  });

  it('select all produces large set', () => {
    let s = new Set();
    const allFilmSims = ['Provia', 'Velvia', 'Astia', 'Classic', 'ClassicNeg', 'Nostalgic',
      'RealaACE', 'ProNegStd', 'ProNegHi', 'Eterna', 'BleachBypass', 'Acros',
      'AcrosYe', 'AcrosR', 'AcrosG', 'Mono', 'MonoYe', 'MonoR', 'MonoG', 'Sepia'];
    for (const v of allFilmSims) s = toggleChip(s, v);
    assert.equal(s.size, 20);
  });

  it('deselect all produces empty set', () => {
    let s = new Set(['Provia', 'Velvia', 'Astia']);
    for (const v of ['Provia', 'Velvia', 'Astia']) s = toggleChip(s, v);
    assert.equal(s.size, 0);
  });
});


// ── Integration: pending count after chip toggles ──

describe('chip toggle + pending count integration', () => {
  it('select all film sims → large pending count', () => {
    const allFilmSims = ['Provia', 'Velvia', 'Astia', 'Classic', 'ClassicNeg', 'Nostalgic',
      'RealaACE', 'ProNegStd', 'ProNegHi', 'Eterna', 'BleachBypass', 'Acros',
      'AcrosYe', 'AcrosR', 'AcrosG', 'Mono', 'MonoYe', 'MonoR', 'MonoG', 'Sepia'];
    const selected = new Set(allFilmSims);
    // 20 total, 1 is current (Provia) → 19 pending
    assert.equal(calculatePendingCount(selected, 'Provia', new Set()), 19);
  });

  it('deselect all → 0 pending, no simulate button', () => {
    assert.equal(calculatePendingCount(new Set(), 'Provia', new Set()), 0);
  });

  it('deselect current + some rendered → counts non-rendered only', () => {
    const selected = new Set(['Velvia', 'Astia', 'ClassicNeg']);
    const rendered = new Set(['Velvia']);
    // current (Provia) not in set, Velvia rendered → pending = Astia + ClassicNeg = 2
    assert.equal(calculatePendingCount(selected, 'Provia', rendered), 2);
  });
});
