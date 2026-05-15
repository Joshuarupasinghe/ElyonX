import React, { useMemo } from 'react';
import { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { freqToX } from '../../utils/eqMath';

interface RTAOverlayProps {
  frequencies: number[];
  magnitudes_db: number[];
  graphWidth: number;
  graphHeight: number;
  minDb?: number;
  maxDb?: number;
}

/**
 * Renders a filled frequency-spectrum overlay inside the EQ graph SVG.
 * This is an absolute RTA level display in dBFS. It deliberately does not use
 * the EQ gain scale; EQ gain and measured signal level are different values.
 */
export const RTAOverlay: React.FC<RTAOverlayProps> = ({
  frequencies,
  magnitudes_db,
  graphWidth,
  graphHeight,
  minDb = -120,
  maxDb = 0,
}) => {
  const { linePath, fillPath } = useMemo(() => {
    if (
      frequencies.length === 0 ||
      magnitudes_db.length === 0 ||
      frequencies.length !== magnitudes_db.length
    ) {
      return { linePath: '', fillPath: '' };
    }

    const dbRange = maxDb - minDb;
    if (dbRange <= 0) {
      return { linePath: '', fillPath: '' };
    }

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      const db = magnitudes_db[i];

      if (!Number.isFinite(freq) || !Number.isFinite(db)) continue;
      if (freq < 20 || freq > 20000) continue;

      const x = freqToX(freq, graphWidth);
      const clampedDb = Math.max(minDb, Math.min(maxDb, db));
      const y = ((maxDb - clampedDb) / dbRange) * graphHeight;
      points.push({ x, y });
    }

    if (points.length < 2) {
      return { linePath: '', fillPath: '' };
    }

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    }

    const linePath = d;
    const last = points[points.length - 1];
    const fillPath =
      d +
      ` L ${last.x.toFixed(1)} ${graphHeight.toFixed(1)}` +
      ` L ${points[0].x.toFixed(1)} ${graphHeight.toFixed(1)} Z`;

    return { linePath, fillPath };
  }, [frequencies, magnitudes_db, graphWidth, graphHeight, minDb, maxDb]);

  if (!linePath) return null;

  return (
    <>
      <Defs>
        <LinearGradient id="rtaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#40E0D0" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#40E0D0" stopOpacity="0.03" />
        </LinearGradient>
      </Defs>

      <Path d={fillPath} fill="url(#rtaGrad)" stroke="none" />

      <Path
        d={linePath}
        fill="none"
        stroke="#40E0D0"
        strokeWidth={1.2}
        strokeOpacity={0.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
};
