// compare-helpers.js — Pure functions extracted from Compare Mode logic in index.html
// Each function mirrors the inline JS as closely as possible.

const RECIPE_DEFAULTS = {
  filmSimulation: 'Provia',
  grainEffect: 'Off',
  grainSize: 'Small',
  colorChromeEffect: 'Off',
  colorChromeFXBlue: 'Off',
  whiteBalance: 'Auto',
  wbShiftR: 0,
  wbShiftB: 0,
  dynamicRange: 100,
  highlightTone: 0,
  shadowTone: 0,
  color: 0,
  sharpness: 0,
  noiseReduction: 0,
  clarity: 0
};

const RECIPE_KEYS = [
  'filmSimulation', 'grainEffect', 'grainSize',
  'colorChromeEffect', 'colorChromeFXBlue',
  'whiteBalance', 'wbShiftR', 'wbShiftB',
  'dynamicRange', 'highlightTone', 'shadowTone',
  'color', 'sharpness', 'noiseReduction', 'clarity'
];

/**
 * Determine the state of a compare grid cell.
 * Mirrors the logic in initCompareMode → renderGrid.
 *
 * @param {string} cellValue - The value this cell represents (stringified)
 * @param {string} currentVal - The current param value (stringified)
 * @param {Set<string>} compareRendered - Set of already-rendered values
 * @returns {{ state: 'current'|'rendered'|'pending', blur: boolean, pending: boolean }}
 */
function determineCellState(cellValue, currentVal, compareRendered) {
  const cv = String(cellValue);
  const cur = String(currentVal);
  if (cv === cur) {
    return { state: 'current', blur: false, pending: false };
  }
  if (compareRendered.has(cv)) {
    return { state: 'rendered', blur: false, pending: false };
  }
  return { state: 'pending', blur: true, pending: true };
}

/**
 * Calculate how many values need simulation.
 * Mirrors updateSimulateButton logic.
 *
 * @param {Set} selectedValues - Currently selected chip values
 * @param {string} currentVal - The current param value (stringified)
 * @param {Set<string>} compareRendered - Already-rendered values
 * @returns {number}
 */
function calculatePendingCount(selectedValues, currentVal, compareRendered) {
  let pending = 0;
  for (const v of selectedValues) {
    if (String(v) !== String(currentVal) && !compareRendered.has(String(v))) {
      pending++;
    }
  }
  return pending;
}

/**
 * Detect whether currentParams match RECIPE_DEFAULTS (i.e., "Standard").
 * Mirrors the isStandard check in updateRecipeActiveDropdown.
 *
 * @param {object} currentParams
 * @param {object} defaults - defaults to compare against (defaults to RECIPE_DEFAULTS)
 * @returns {boolean}
 */
function isStandard(currentParams, defaults) {
  defaults = defaults || RECIPE_DEFAULTS;
  const defKeys = Object.keys(defaults);
  return defKeys.every(k => String(currentParams[k] ?? '') === String(defaults[k] ?? ''));
}

/**
 * Find a matching recipe from a recipes object.
 * Mirrors findMatchingRecipe in index.html exactly.
 *
 * @param {object} params - Current params to match
 * @param {object} recipes - Map of id → { params: {...}, title, ... }
 * @returns {object|null} - The matched recipe or null
 */
function findMatchingRecipe(params, recipes) {
  if (!params || !recipes) return null;
  for (const [id, recipe] of Object.entries(recipes)) {
    if (!recipe.params) continue;
    const match = RECIPE_KEYS.every(k => String(params[k] ?? '') === String(recipe.params[k] ?? ''));
    if (match) return recipe;
  }
  return null;
}

/**
 * Select compare baseline params.
 * 'asshot' → uses exifBaseline, 'standard' → uses RECIPE_DEFAULTS.
 *
 * @param {string} choice - 'asshot' or 'standard'
 * @param {object|null} exifBaseline
 * @returns {{ params: object, title: string }}
 */
function selectBaseline(choice, exifBaseline) {
  if (choice === 'asshot' && exifBaseline) {
    return { params: { ...exifBaseline }, title: 'As Shot' };
  }
  return { params: { ...RECIPE_DEFAULTS }, title: 'Standard' };
}

/**
 * Build the list of values to simulate (skip current, skip already rendered).
 * Mirrors the toSimulate filter in the compare-simulate-btn handler.
 *
 * @param {Array} allSelected - All selected chip values
 * @param {string} currentVal - Current param value (stringified)
 * @param {Set<string>} compareRendered
 * @returns {Array}
 */
function buildSimulateList(allSelected, currentVal, compareRendered) {
  return allSelected.filter(v => String(v) !== String(currentVal) && !compareRendered.has(String(v)));
}

/**
 * Generate the output filename for a compare simulation.
 * Mirrors the path construction in compare simulate handler.
 *
 * @param {string} photoFile - e.g. 'DSCF6740.HIF'
 * @param {string} paramKey - e.g. 'filmSimulation'
 * @param {*} value - e.g. 'Velvia'
 * @returns {string} - filename portion (no directory)
 */
function compareOutputFilename(photoFile, paramKey, value) {
  const stem = photoFile.replace(/\.[^.]+$/, '');
  const safeVal = String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
  return stem + '_cmp_' + paramKey + '_' + safeVal + '.jpg';
}

/**
 * Format the simulate button text during simulation.
 * Mirrors the btn.textContent updates in the handler.
 *
 * @param {number} completed
 * @param {number} total
 * @returns {string}
 */
function formatSimulateProgress(completed, total) {
  const remaining = total - completed;
  if (remaining > 0) {
    return 'SIMULATING ' + completed + '/' + total + '  ~' + remaining + 's remaining';
  }
  return 'SIMULATING ' + completed + '/' + total;
}

/**
 * Compute chip toggle result: returns new selectedValues set after toggling a value.
 *
 * @param {Set} selectedValues - Current selection
 * @param {*} value - Value to toggle
 * @returns {Set} - New set (clone with toggle applied)
 */
function toggleChip(selectedValues, value) {
  const next = new Set(selectedValues);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

/**
 * Build a compare variant object (set when clicking a rendered or current cell).
 * Mirrors the cell click handler in renderGrid.
 *
 * @param {string} paramKey
 * @param {*} value
 * @param {boolean} isCurrentVal
 * @returns {object}
 */
function buildCompareVariant(paramKey, value, isCurrentVal) {
  return {
    param: paramKey,
    value: value,
    rendered: !isCurrentVal,
    isCurrentVal: isCurrentVal
  };
}

function isAlreadySimulated(photoFile, simulatedPhotos, simParamsUsed, currentParams) {
  if (!simulatedPhotos[photoFile] || !simParamsUsed[photoFile]) return false;
  var simP = simParamsUsed[photoFile];
  return Object.keys(currentParams).every(function(k) { return simP[k] === currentParams[k]; });
}

module.exports = {
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
  buildCompareVariant,
  isAlreadySimulated
};
