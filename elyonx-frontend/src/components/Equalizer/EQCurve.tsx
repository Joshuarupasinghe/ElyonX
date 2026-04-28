import React, { useMemo } from 'react';
import { Path } from 'react-native-svg';
import { EQBand } from '../../store/types';
import {
  generateLogFrequencies,
  computeCompositeResponse,
  computeBandResponse,
  freqToX,
  gainToY,
} from '../../utils/eqMath';
import { colors } from '../../theme/theme';

interface EQCurveProps {
  bands: EQBand[];
  graphWidth: number;
  graphHeight: number;
  minGain?: number;
  maxGain?: number;
}

const BAND_COLORS = [
  colors.eqBand1,
  colors.eqBand2,
  colors.eqBand3,
  colors.eqBand4,
  colors.eqBand5,
];

/**
 * Generate an SVG path string from frequency response data
 */
function responseToPath(
  frequencies: number[],
  response: number[],
  graphWidth: number,
  graphHeight: number,
  minGain: number,
  maxGain: number,
  closed: boolean = false,
): string {
  const points = frequencies.map((freq, i) => ({
    x: freqToX(freq, graphWidth),
    y: gainToY(response[i], graphHeight, minGain, maxGain),
  }));

  if (points.length === 0) return '';

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  // Use smooth curves through points
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    // Simple quadratic smoothing
    const cpx = (prev.x + curr.x) / 2;
    d += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${cpx.toFixed(1)} ${((prev.y + curr.y) / 2).toFixed(1)}`;
  }

  // Last point
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

  // Close path for filled area
  if (closed) {
    const zeroY = gainToY(0, graphHeight, minGain, maxGain);
    d += ` L ${last.x.toFixed(1)} ${zeroY.toFixed(1)}`;
    d += ` L ${points[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
  }

  return d;
}

export const EQCurve: React.FC<EQCurveProps> = ({
  bands,
  graphWidth,
  graphHeight,
  minGain = -18,
  maxGain = 18,
}) => {
  const frequencies = useMemo(() => generateLogFrequencies(20, 20000, 200), []);

  // Composite response (sum of all bands)
  const compositeResponse = useMemo(
    () => computeCompositeResponse(bands, frequencies),
    [bands, frequencies],
  );

  // Individual band responses
  const bandResponses = useMemo(
    () => bands.map(band => computeBandResponse(band, frequencies)),
    [bands, frequencies],
  );

  // Composite path (line + filled)
  const compositePath = useMemo(
    () =>
      responseToPath(frequencies, compositeResponse, graphWidth, graphHeight, minGain, maxGain),
    [compositeResponse, frequencies, graphWidth, graphHeight, minGain, maxGain],
  );

  const compositeFilledPath = useMemo(
    () =>
      responseToPath(
        frequencies,
        compositeResponse,
        graphWidth,
        graphHeight,
        minGain,
        maxGain,
        true,
      ),
    [compositeResponse, frequencies, graphWidth, graphHeight, minGain, maxGain],
  );

  // Individual band paths
  const bandPaths = useMemo(
    () =>
      bandResponses.map(response =>
        responseToPath(frequencies, response, graphWidth, graphHeight, minGain, maxGain),
      ),
    [bandResponses, frequencies, graphWidth, graphHeight, minGain, maxGain],
  );

  return (
    <>
      {/* Filled area under composite curve */}
      {compositeFilledPath && (
        <Path
          d={compositeFilledPath}
          fill="rgba(123, 92, 250, 0.08)"
          stroke="none"
        />
      )}

      {/* Individual band curves (semi-transparent) */}
      {bandPaths.map((path, i) => {
        if (!bands[i].enabled || !path) return null;
        return (
          <Path
            key={`band-${bands[i].id}`}
            d={path}
            fill="none"
            stroke={BAND_COLORS[i % BAND_COLORS.length]}
            strokeWidth={1}
            strokeOpacity={0.35}
          />
        );
      })}

      {/* Composite curve (main) */}
      {compositePath && (
        <Path
          d={compositePath}
          fill="none"
          stroke={colors.purpleLight}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </>
  );
};
