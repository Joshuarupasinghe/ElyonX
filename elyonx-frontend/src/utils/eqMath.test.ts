import { describe, expect, it } from '@jest/globals';

import {
  computeBandResponse,
  computeCompositeResponse,
  computeBiquadCoefficients,
  evaluateMagnitudeResponse,
  formatFrequency,
  formatGain,
  freqToX,
  generateLogFrequencies,
  xToFreq,
} from './eqMath';
import type { EQBand } from '../store/types';

describe('eqMath', () => {
  it('generates evenly spaced logarithmic frequencies', () => {
    const frequencies = generateLogFrequencies(20, 20000, 4);

    expect(frequencies[0]).toBeCloseTo(20);
    expect(frequencies[1]).toBeCloseTo(200);
    expect(frequencies[2]).toBeCloseTo(2000);
    expect(frequencies[3]).toBeCloseTo(20000);
  });

  it('keeps a zero-gain bell filter transparent', () => {
    const coeffs = computeBiquadCoefficients('bell', 1000, 0, 1);

    expect(evaluateMagnitudeResponse(coeffs, 100)).toBeCloseTo(0, 4);
    expect(evaluateMagnitudeResponse(coeffs, 1000)).toBeCloseTo(0, 4);
    expect(evaluateMagnitudeResponse(coeffs, 10000)).toBeCloseTo(0, 4);
  });

  it('ignores disabled bands in the composite response', () => {
    const bands: EQBand[] = [
      { id: 1, type: 'bell', frequency: 1000, gain: 9, q: 1, enabled: false },
    ];

    expect(computeCompositeResponse(bands, [1000])).toEqual([0]);
    expect(computeBandResponse(bands[0], [1000])).toEqual([0]);
  });

  it('round-trips graph frequency coordinates', () => {
    const width = 600;
    const x = freqToX(1000, width);

    expect(xToFreq(x, width)).toBeCloseTo(1000);
  });

  it('formats live-mix labels compactly', () => {
    expect(formatFrequency(80)).toBe('80.0');
    expect(formatFrequency(1000)).toBe('1.0k');
    expect(formatGain(2.25)).toBe('+2.3 dB');
    expect(formatGain(-4)).toBe('-4.0 dB');
  });
});
