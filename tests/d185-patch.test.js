import { describe, it, expect } from 'vitest';
import {
  FILM_SIM_MAP, WB_MAP, NR_ENCODE, NativeIdx,
  patchD185Profile, readField,
} from '../lib/d185-patch.js';

function makeProfile(numParams = 28) {
  const paramDataSize = numParams * 4;
  const headerSize = 2 + (625 - 2 - paramDataSize);
  const buf = Buffer.alloc(625, 0);
  buf.writeUInt16LE(numParams, 0);
  return buf.toString('base64');
}

describe('FILM_SIM_MAP', () => {
  it('maps Nostalgic to same value as NostalgicNeg', () => {
    expect(FILM_SIM_MAP.Nostalgic).toBe(0x13);
    expect(FILM_SIM_MAP.Nostalgic).toBe(FILM_SIM_MAP.NostalgicNeg);
  });

  it('maps all 20 film simulations from UI dropdown', () => {
    const uiOptions = [
      'Provia','Velvia','Astia','Classic','ClassicNeg','Nostalgic','RealaACE',
      'ProNegStd','ProNegHi','Eterna','BleachBypass','Acros','AcrosYe','AcrosR',
      'AcrosG','Mono','MonoYe','MonoR','MonoG','Sepia',
    ];
    for (const sim of uiOptions) {
      expect(FILM_SIM_MAP[sim]).toBeDefined();
    }
  });
});

describe('patchD185Profile', () => {
  it('patches film simulation correctly', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { filmSimulation: 'ClassicNeg' });
    expect(readField(patched, NativeIdx.FilmSimulation)).toBe(0x11);
  });

  it('patches Nostalgic film simulation', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { filmSimulation: 'Nostalgic' });
    expect(readField(patched, NativeIdx.FilmSimulation)).toBe(0x13);
  });

  it('patches WB shift R with x20 conversion', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { wbShiftR: 3 });
    expect(readField(patched, NativeIdx.WBShiftR)).toBe(60);
  });

  it('patches WB shift B with x20 conversion', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { wbShiftB: -6 });
    expect(readField(patched, NativeIdx.WBShiftB)).toBe(-120);
  });

  it('patches WB shift R=0 to 0', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { wbShiftR: 0 });
    expect(readField(patched, NativeIdx.WBShiftR)).toBe(0);
  });

  it('patches highlight tone with x10 conversion', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { highlightTone: -2 });
    expect(readField(patched, NativeIdx.HighlightTone)).toBe(-20);
  });

  it('patches shadow tone with x10 conversion', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { shadowTone: 3 });
    expect(readField(patched, NativeIdx.ShadowTone)).toBe(30);
  });

  it('patches noise reduction with proprietary encoding', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { noiseReduction: -4 });
    expect(readField(patched, NativeIdx.NoiseReduction)).toBe(0x8000);
  });

  it('patches noise reduction 0', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { noiseReduction: 0 });
    expect(readField(patched, NativeIdx.NoiseReduction)).toBe(0x2000);
  });

  it('patches grain Off', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { grainEffect: 'Off' });
    expect(readField(patched, NativeIdx.GrainEffect)).toBe(1);
  });

  it('patches grain Weak+Small', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { grainEffect: 'Weak', grainSize: 'Small' });
    expect(readField(patched, NativeIdx.GrainEffect)).toBe(2);
  });

  it('patches grain Strong+Large', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { grainEffect: 'Strong', grainSize: 'Large' });
    expect(readField(patched, NativeIdx.GrainEffect)).toBe(5);
  });

  it('patches dynamic range', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { dynamicRange: 400 });
    expect(readField(patched, NativeIdx.DynamicRange)).toBe(400);
  });

  it('patches color chrome effect', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { colorChromeEffect: 'Strong' });
    expect(readField(patched, NativeIdx.ColorChrome)).toBe(3);
  });

  it('patches white balance', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { whiteBalance: 'Shade' });
    expect(readField(patched, NativeIdx.WhiteBalance)).toBe(0x8006);
  });

  it('patches multiple params at once', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, {
      filmSimulation: 'Velvia',
      wbShiftR: 2,
      wbShiftB: -3,
      highlightTone: 1,
      shadowTone: -1,
      noiseReduction: 2,
    });
    expect(readField(patched, NativeIdx.FilmSimulation)).toBe(0x02);
    expect(readField(patched, NativeIdx.WBShiftR)).toBe(40);
    expect(readField(patched, NativeIdx.WBShiftB)).toBe(-60);
    expect(readField(patched, NativeIdx.HighlightTone)).toBe(10);
    expect(readField(patched, NativeIdx.ShadowTone)).toBe(-10);
    expect(readField(patched, NativeIdx.NoiseReduction)).toBe(0x0000);
  });

  it('ignores unknown film simulation', () => {
    const base = makeProfile();
    const patched = patchD185Profile(base, { filmSimulation: 'FakeFilm' });
    expect(readField(patched, NativeIdx.FilmSimulation)).toBe(0);
  });
});
