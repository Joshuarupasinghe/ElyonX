import { BiquadCoefficients, EQBand, EQBandType } from '../store/types';

const SAMPLE_RATE = 48000; // Standard pro audio sample rate

/**
 * Compute biquad filter coefficients using the Audio EQ Cookbook
 * (Robert Bristow-Johnson)
 */
export function computeBiquadCoefficients(
  type: EQBandType,
  freq: number,
  gainDB: number,
  q: number,
  sampleRate: number = SAMPLE_RATE,
): BiquadCoefficients {
  const A = Math.pow(10, gainDB / 40); // For peaking/shelf
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * q);

  let b0: number, b1: number, b2: number;
  let a0: number, a1: number, a2: number;

  switch (type) {
    case 'bell': {
      b0 = 1 + alpha * A;
      b1 = -2 * cosW0;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cosW0;
      a2 = 1 - alpha / A;
      break;
    }
    case 'lowshelf': {
      const sqrtA = Math.sqrt(A);
      const sqrtA2Alpha = 2 * sqrtA * alpha;
      b0 = A * ((A + 1) - (A - 1) * cosW0 + sqrtA2Alpha);
      b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
      b2 = A * ((A + 1) - (A - 1) * cosW0 - sqrtA2Alpha);
      a0 = (A + 1) + (A - 1) * cosW0 + sqrtA2Alpha;
      a1 = -2 * ((A - 1) + (A + 1) * cosW0);
      a2 = (A + 1) + (A - 1) * cosW0 - sqrtA2Alpha;
      break;
    }
    case 'highshelf': {
      const sqrtA = Math.sqrt(A);
      const sqrtA2Alpha = 2 * sqrtA * alpha;
      b0 = A * ((A + 1) + (A - 1) * cosW0 + sqrtA2Alpha);
      b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
      b2 = A * ((A + 1) + (A - 1) * cosW0 - sqrtA2Alpha);
      a0 = (A + 1) - (A - 1) * cosW0 + sqrtA2Alpha;
      a1 = 2 * ((A - 1) - (A + 1) * cosW0);
      a2 = (A + 1) - (A - 1) * cosW0 - sqrtA2Alpha;
      break;
    }
    case 'highpass': {
      b0 = (1 + cosW0) / 2;
      b1 = -(1 + cosW0);
      b2 = (1 + cosW0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW0;
      a2 = 1 - alpha;
      break;
    }
    case 'lowpass': {
      b0 = (1 - cosW0) / 2;
      b1 = 1 - cosW0;
      b2 = (1 - cosW0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW0;
      a2 = 1 - alpha;
      break;
    }
    default: {
      // Unity (pass-through)
      b0 = 1; b1 = 0; b2 = 0;
      a0 = 1; a1 = 0; a2 = 0;
    }
  }

  return { b0, b1, b2, a0, a1, a2 };
}

/**
 * Evaluate the magnitude response of a biquad filter at a given frequency.
 * Returns the gain in dB.
 */
export function evaluateMagnitudeResponse(
  coeffs: BiquadCoefficients,
  freq: number,
  sampleRate: number = SAMPLE_RATE,
): number {
  const { b0, b1, b2, a0, a1, a2 } = coeffs;
  const w = (2 * Math.PI * freq) / sampleRate;
  const cosW = Math.cos(w);
  const cos2W = Math.cos(2 * w);
  const sinW = Math.sin(w);
  const sin2W = Math.sin(2 * w);

  // Numerator: b0 + b1·e^(-jw) + b2·e^(-j2w)
  const numReal = b0 + b1 * cosW + b2 * cos2W;
  const numImag = -(b1 * sinW + b2 * sin2W);

  // Denominator: a0 + a1·e^(-jw) + a2·e^(-j2w)
  const denReal = a0 + a1 * cosW + a2 * cos2W;
  const denImag = -(a1 * sinW + a2 * sin2W);

  const numMag = Math.sqrt(numReal * numReal + numImag * numImag);
  const denMag = Math.sqrt(denReal * denReal + denImag * denImag);

  if (denMag === 0) return 0;

  const magnitude = numMag / denMag;
  return 20 * Math.log10(Math.max(magnitude, 1e-10));
}

/**
 * Generate logarithmically spaced frequency points
 */
export function generateLogFrequencies(
  minFreq: number = 20,
  maxFreq: number = 20000,
  numPoints: number = 200,
): number[] {
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const step = (logMax - logMin) / (numPoints - 1);

  return Array.from({ length: numPoints }, (_, i) =>
    Math.pow(10, logMin + step * i),
  );
}

/**
 * Compute the composite frequency response for multiple EQ bands.
 * Returns an array of dB values at each frequency point.
 */
export function computeCompositeResponse(
  bands: EQBand[],
  frequencies: number[],
  sampleRate: number = SAMPLE_RATE,
): number[] {
  const enabledBands = bands.filter(b => b.enabled);

  return frequencies.map(freq => {
    let totalDB = 0;
    for (const band of enabledBands) {
      const coeffs = computeBiquadCoefficients(
        band.type, band.frequency, band.gain, band.q, sampleRate,
      );
      totalDB += evaluateMagnitudeResponse(coeffs, freq, sampleRate);
    }
    return totalDB;
  });
}

/**
 * Compute individual band response for rendering separate band curves
 */
export function computeBandResponse(
  band: EQBand,
  frequencies: number[],
  sampleRate: number = SAMPLE_RATE,
): number[] {
  if (!band.enabled) return frequencies.map(() => 0);

  const coeffs = computeBiquadCoefficients(
    band.type, band.frequency, band.gain, band.q, sampleRate,
  );

  return frequencies.map(freq =>
    evaluateMagnitudeResponse(coeffs, freq, sampleRate),
  );
}

/**
 * Map frequency (Hz) to X position on the graph (logarithmic scale)
 */
export function freqToX(
  freq: number,
  graphWidth: number,
  minFreq: number = 20,
  maxFreq: number = 20000,
): number {
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logFreq = Math.log10(Math.max(freq, minFreq));
  return ((logFreq - logMin) / (logMax - logMin)) * graphWidth;
}

/**
 * Map X position on the graph to frequency (Hz) (inverse logarithmic)
 */
export function xToFreq(
  x: number,
  graphWidth: number,
  minFreq: number = 20,
  maxFreq: number = 20000,
): number {
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logFreq = logMin + (x / graphWidth) * (logMax - logMin);
  return Math.pow(10, logFreq);
}

/**
 * Map gain (dB) to Y position on the graph (linear scale, inverted)
 */
export function gainToY(
  gain: number,
  graphHeight: number,
  minGain: number = -18,
  maxGain: number = 18,
): number {
  return ((maxGain - gain) / (maxGain - minGain)) * graphHeight;
}

/**
 * Map Y position on the graph to gain (dB) (inverse, linear)
 */
export function yToGain(
  y: number,
  graphHeight: number,
  minGain: number = -18,
  maxGain: number = 18,
): number {
  return maxGain - (y / graphHeight) * (maxGain - minGain);
}

/**
 * Format frequency for display (e.g., 1000 → "1.0k", 200 → "200")
 */
export function formatFrequency(freq: number): string {
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(1)}k`;
  }
  return freq < 100 ? freq.toFixed(1) : Math.round(freq).toString();
}

/**
 * Format gain for display (e.g., -5.1 → "-5.1 dB")
 */
export function formatGain(gain: number): string {
  return `${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB`;
}

/**
 * Format Q factor for display
 */
export function formatQ(q: number): string {
  return q.toFixed(1);
}
