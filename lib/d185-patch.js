const FILM_SIM_MAP = {
  Provia: 0x01, Velvia: 0x02, Astia: 0x03, ProNegHi: 0x04, ProNegStd: 0x05,
  Mono: 0x06, MonoYe: 0x07, MonoR: 0x08, MonoG: 0x09, Sepia: 0x0A,
  Classic: 0x0B, Acros: 0x0C, AcrosYe: 0x0D, AcrosR: 0x0E, AcrosG: 0x0F,
  Eterna: 0x10, ClassicNeg: 0x11, BleachBypass: 0x12, NostalgicNeg: 0x13, Nostalgic: 0x13, RealaACE: 0x14,
};

const WB_MAP = {
  Auto: 0x0002, AutoWhite: 0x0002, AutoAmbiance: 0x8021,
  Daylight: 0x0004, Shade: 0x8006,
  Fluorescent1: 0x8001, Fluorescent2: 0x8002, Fluorescent3: 0x8003,
  Incandescent: 0x0006, Underwater: 0x0008,
  ColorTemp: 0x8007, Custom1: 0x0002, Custom2: 0x0002, Custom3: 0x0002,
};

const NR_ENCODE = {
  '-4': 0x8000, '-3': 0x7000, '-2': 0x4000, '-1': 0x3000,
  '0': 0x2000, '1': 0x1000, '2': 0x0000, '3': 0x6000, '4': 0x5000,
};

const NativeIdx = {
  ExposureBias: 4, DynamicRange: 6, WideDRange: 7, FilmSimulation: 8,
  GrainEffect: 9, ColorChrome: 10, SmoothSkin: 11, WhiteBalance: 12,
  WBShiftR: 13, WBShiftB: 14, WBColorTemp: 15,
  HighlightTone: 16, ShadowTone: 17, Color: 18, Sharpness: 19,
  NoiseReduction: 20, CCFxBlue: 25, Clarity: 27,
};

function patchD185Profile(base64Data, uiParams) {
  const buf = Buffer.from(base64Data, 'base64');
  const numParams = buf.readUInt16LE(0);
  const off = buf.length - numParams * 4;

  function setField(idx, val) {
    buf.writeInt32LE(val, off + idx * 4);
  }

  if (uiParams.filmSimulation && FILM_SIM_MAP[uiParams.filmSimulation] !== undefined) {
    setField(NativeIdx.FilmSimulation, FILM_SIM_MAP[uiParams.filmSimulation]);
  }

  if (uiParams.dynamicRange !== undefined) {
    setField(NativeIdx.DynamicRange, uiParams.dynamicRange);
  }

  if (uiParams.grainEffect !== undefined) {
    let grainNative = 1;
    if (uiParams.grainEffect === 'Weak' && uiParams.grainSize === 'Small') grainNative = 2;
    else if (uiParams.grainEffect === 'Strong' && uiParams.grainSize === 'Small') grainNative = 3;
    else if (uiParams.grainEffect === 'Weak' && uiParams.grainSize === 'Large') grainNative = 4;
    else if (uiParams.grainEffect === 'Strong' && uiParams.grainSize === 'Large') grainNative = 5;
    setField(NativeIdx.GrainEffect, grainNative);
  }

  if (uiParams.colorChromeEffect !== undefined) {
    const ccMap = { Off: 1, Weak: 2, Strong: 3 };
    if (ccMap[uiParams.colorChromeEffect] !== undefined) {
      setField(NativeIdx.ColorChrome, ccMap[uiParams.colorChromeEffect]);
    }
  }

  if (uiParams.colorChromeFXBlue !== undefined) {
    const ccbMap = { Off: 1, Weak: 2, Strong: 3 };
    if (ccbMap[uiParams.colorChromeFXBlue] !== undefined) {
      setField(NativeIdx.CCFxBlue, ccbMap[uiParams.colorChromeFXBlue]);
    }
  }

  if (uiParams.whiteBalance && WB_MAP[uiParams.whiteBalance] !== undefined) {
    setField(NativeIdx.WhiteBalance, WB_MAP[uiParams.whiteBalance]);
  }

  if (uiParams.wbShiftR !== undefined) setField(NativeIdx.WBShiftR, uiParams.wbShiftR * 20);
  if (uiParams.wbShiftB !== undefined) setField(NativeIdx.WBShiftB, uiParams.wbShiftB * 20);

  if (uiParams.colorTemperature !== undefined) {
    setField(NativeIdx.WBColorTemp, uiParams.colorTemperature);
  }

  if (uiParams.highlightTone !== undefined) setField(NativeIdx.HighlightTone, uiParams.highlightTone * 10);
  if (uiParams.shadowTone !== undefined) setField(NativeIdx.ShadowTone, uiParams.shadowTone * 10);
  if (uiParams.color !== undefined) setField(NativeIdx.Color, uiParams.color * 10);
  if (uiParams.sharpness !== undefined) setField(NativeIdx.Sharpness, uiParams.sharpness * 10);
  if (uiParams.clarity !== undefined) setField(NativeIdx.Clarity, uiParams.clarity * 10);

  if (uiParams.noiseReduction !== undefined) {
    const nrKey = String(uiParams.noiseReduction);
    if (NR_ENCODE[nrKey] !== undefined) {
      setField(NativeIdx.NoiseReduction, NR_ENCODE[nrKey]);
    }
  }

  return buf.toString('base64');
}

function readField(base64Data, fieldIdx) {
  const buf = Buffer.from(base64Data, 'base64');
  const numParams = buf.readUInt16LE(0);
  const off = buf.length - numParams * 4;
  return buf.readInt32LE(off + fieldIdx * 4);
}

module.exports = {
  FILM_SIM_MAP, WB_MAP, NR_ENCODE, NativeIdx,
  patchD185Profile, readField,
};
